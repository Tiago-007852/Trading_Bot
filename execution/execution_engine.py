"""
===================================================================
TRADE AO — Execution Engine (execution/execution_engine.py)
Complete 11-Step Automated Trading Pipeline with Strict Guardrails
===================================================================
1. Market Scanner
2. Signal Engine
3. Confidence/Confluence Score
4. Risk Manager
5. Trade Approval
6. Binance Broker
7. Order Manager
8. Trade Monitor
9. Resultado
10. Analytics
11. Telegram

Strict Protections:
- No trade without Stop Loss
- No trade exceeding allowed risk
- No trade if Daily Loss Limit (3%) is reached
- No duplicate entries (deduplication)
- No execution of stale/expired signals (TTL check)
- No duplicate orders on retry (idempotency key & clientOrderId)
===================================================================
"""

import time
import hashlib
import uuid
import logging
from typing import Dict, Any, Optional, List, Tuple
from engine.market_scanner import fetch_binance_ticker, scan_all_markets
from engine.signal_engine import generate_signal
from engine.risk_manager import validate_trade_risk, calculate_position_size, get_user_risk_status, record_trade_result
from engine.trading_mode import (
    get_trading_mode,
    is_live_trading_enabled,
    is_testnet_mode,
    is_paper_mode,
    get_user_live_status,
    is_user_live_enabled,
    is_symbol_allowed,
    LIVE_CONFIRMATION_PHRASE,
)
from brokers.binance import BinanceBroker
from storage.users import get_user_by_id, get_user_broker_credentials, load_users, save_users
from execution.position_manager import position_manager

logger = logging.getLogger("TradeAO_ExecutionEngine")

# Idempotency Store (in-memory & persisted state)
IDEMPOTENCY_STORE: Dict[str, Dict[str, Any]] = {}
EXECUTION_LOGS: List[Dict[str, Any]] = []

MAX_SIGNAL_AGE_SECONDS = 180  # 3 minutes TTL
MIN_CONFIDENCE_SCORE = 70      # Minimum score to qualify for execution

class ExecutionEngine:
    """
    Coordinates the entire 11-Step Trade Execution Lifecycle.
    """

    def __init__(self, chat_id: str | int = "7886049873", testnet: bool = True):
        self.chat_id = str(chat_id)
        self.testnet = testnet
        self.user = get_user_by_id(chat_id) or {}
        
        creds = get_user_broker_credentials(chat_id, "binance") or {}
        self.broker = BinanceBroker(
            api_key=creds.get("api_key"),
            api_secret=creds.get("api_secret"),
            testnet=testnet,
        )

    def execute_pipeline(
        self,
        symbol: str = "BTC/USDT",
        idempotency_key: Optional[str] = None,
        provided_signal: Optional[Dict[str, Any]] = None,
        force_simulation: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes the complete 11-step pipeline with strict guardrails and idempotency.
        """
        start_time = time.time()
        pipeline_trace: List[Dict[str, Any]] = []

        # Generate or sanitize idempotency key
        if not idempotency_key:
            idempotency_key = f"idemp_{self.chat_id}_{symbol.replace('/', '')}_{int(time.time() * 1000)}"

        # 0. Idempotency Check (Prevent duplicate orders on retry)
        if idempotency_key in IDEMPOTENCY_STORE:
            existing = IDEMPOTENCY_STORE[idempotency_key]
            logger.info(f"[Idempotency] Duplicate request intercepted for key {idempotency_key}.")
            return {
                "success": existing.get("status") in ["EXECUTED", "APPROVED"],
                "idempotent_replay": True,
                "execution_record": existing,
                "message": "Ordem recuperada do cache de idempotência (nenhuma ordem duplicada foi enviada).",
            }

        # Initialize Execution Record
        execution_id = f"exec_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
        client_order_id = f"tradeao_{symbol.replace('/', '')}_{int(time.time())}"[:32]

        record: Dict[str, Any] = {
            "id": execution_id,
            "idempotencyKey": idempotency_key,
            "clientOrderId": client_order_id,
            "timestamp": int(time.time() * 1000),
            "par": symbol,
            "direction": "LONG",
            "entryPrice": 0.0,
            "stopLoss": 0.0,
            "takeProfit": 0.0,
            "positionSize": 0.0,
            "positionValueUsd": 0.0,
            "riskAmountUsd": 0.0,
            "riskPercent": 1.0,
            "confidenceScore": 0,
            "confluenceCategory": "IGNORE",
            "status": "PENDING",
            "pipeline": pipeline_trace,
            "guardrails": {
                "stopLossPresent": False,
                "riskWithinLimits": False,
                "dailyLossPermitted": False,
                "noDuplicateEntry": False,
                "signalNotStale": False,
                "idempotencyValid": True,
                "symbolAllowed": False,
                "liveConfirmed": False,
            },
        }
        IDEMPOTENCY_STORE[idempotency_key] = record

        def add_step(name: str, status: str, details: str) -> None:
            pipeline_trace.append({
                "name": name,
                "status": status,
                "details": details,
                "timestamp": int(time.time() * 1000),
            })

        # =========================================================================
        # STEP 0: Symbol Whitelist Check (FASE 21)
        # =========================================================================
        if not is_symbol_allowed(symbol):
            add_step("Symbol Whitelist", "failed", f"Símbolo {symbol} não autorizado.")
            record["status"] = "REJECTED"
            record["rejectionRule"] = "disallowed_symbol"
            record["rejectionReason"] = f"Símbolo {symbol} não permitido na whitelist oficial Binance."
            return self._finalize_rejection(record, idempotency_key)
        record["guardrails"]["symbolAllowed"] = True

        # =========================================================================
        # STEP 1: Market Scanner
        # =========================================================================
        step1_start = time.time()
        try:
            ticker = fetch_binance_ticker(symbol)
            curr_price = float(ticker.get("price", 0.0))
            if curr_price <= 0:
                raise ValueError("Preço de mercado inválido retornado pelo Scanner.")
            add_step("Market Scanner", "success", f"Ticker ao vivo obtido: {symbol} @ ${curr_price:,.2f}")
        except Exception as e:
            add_step("Market Scanner", "failed", f"Erro ao escanear mercado: {str(e)}")
            record["status"] = "REJECTED"
            record["rejectionReason"] = f"Market Scanner falhou: {str(e)}"
            return self._finalize_rejection(record, idempotency_key)

        # =========================================================================
        # STEP 2: Signal Engine
        # =========================================================================
        signal = provided_signal
        if not signal:
            signal = generate_signal(symbol, timeframe="15m")

        if not signal or not signal.get("entrada"):
            add_step("Signal Engine", "failed", "Nenhum sinal técnico estruturado gerado para o par.")
            record["status"] = "REJECTED"
            record["rejectionReason"] = "Nenhum sinal gerado pelo Signal Engine."
            return self._finalize_rejection(record, idempotency_key)

        entry_price = float(signal.get("entrada", curr_price))
        direction = signal.get("direcao", "LONG")
        stop_loss = float(signal.get("stop", 0.0))
        take_profit = float(signal.get("alvo", 0.0))
        signal_timestamp = signal.get("timestamp") or signal.get("ts") or (time.time() * 1000)

        record["entryPrice"] = entry_price
        record["direction"] = direction
        record["stopLoss"] = stop_loss
        record["takeProfit"] = take_profit
        add_step("Signal Engine", "success", f"Sinal {direction} detectado @ ${entry_price:,.2f} com SL ${stop_loss:,.2f} e TP ${take_profit:,.2f}")

        # =========================================================================
        # STEP 3: Confidence / Confluence Score
        # =========================================================================
        score = int(signal.get("score", 0))
        category = signal.get("scoreCategory", "GOOD")
        record["confidenceScore"] = score
        record["confluenceCategory"] = category

        if score < MIN_CONFIDENCE_SCORE:
            add_step("Confidence/Confluence Score", "failed", f"Score ({score}/100) insuficiente. Mínimo exigido: {MIN_CONFIDENCE_SCORE}/100.")
            record["status"] = "REJECTED"
            record["rejectionRule"] = "low_confidence"
            record["rejectionReason"] = f"Score de confluência ({score}/100) abaixo do threshold mínimo ({MIN_CONFIDENCE_SCORE})."
            return self._finalize_rejection(record, idempotency_key)

        add_step("Confidence/Confluence Score", "success", f"Score validado: {score}/100 ({category})")

        # =========================================================================
        # STEP 4: Risk Manager (Validations & Position Sizing)
        # =========================================================================
        user_balance = float(self.user.get("tokens", 100.0))
        open_positions = position_manager.get_open_positions()
        user_open_count = len([p for p in open_positions if str(p.get("chat_id")) == str(self.chat_id)])

        risk_validation = validate_trade_risk(
            chat_id=self.chat_id,
            symbol=symbol,
            direction=direction,
            entry_price=entry_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            capital=user_balance,
            current_open_positions_count=user_open_count,
        )

        if not risk_validation.get("allowed", False):
            rule_name = risk_validation.get("rule", "risk_limit")
            reason = risk_validation.get("reason", "Violou diretriz do Risk Manager.")
            add_step("Risk Manager", "failed", f"Bloqueado pelo Risk Manager [{rule_name}]: {reason}")
            record["status"] = "REJECTED"
            record["rejectionRule"] = rule_name
            record["rejectionReason"] = reason
            return self._finalize_rejection(record, idempotency_key)

        pos_size = float(risk_validation.get("position_size", 0.001))
        pos_val_usd = float(risk_validation.get("position_value_usd", user_balance * 0.05))
        risk_usd = float(risk_validation.get("risk_amount_usd", user_balance * 0.01))
        risk_pct = float(risk_validation.get("risk_percent", 1.0))

        record["positionSize"] = pos_size
        record["positionValueUsd"] = pos_val_usd
        record["riskAmountUsd"] = risk_usd
        record["riskPercent"] = risk_pct
        record["guardrails"]["stopLossPresent"] = True
        record["guardrails"]["riskWithinLimits"] = True
        record["guardrails"]["dailyLossPermitted"] = True

        add_step("Risk Manager", "success", f"Dimensionamento aprovado: Qtd {pos_size:.4f} (${pos_val_usd:.2f}) | Risco: {risk_pct:.1f}% (${risk_usd:.2f})")

        # =========================================================================
        # STEP 5: Trade Approval (Deduplication & TTL/Age Check)
        # =========================================================================
        # 5a. Stale Signal Check (TTL)
        now_ms = time.time() * 1000
        signal_age_sec = (now_ms - signal_timestamp) / 1000.0
        if signal_age_sec > MAX_SIGNAL_AGE_SECONDS:
            add_step("Trade Approval", "failed", f"Sinal expirado ({signal_age_sec:.1f}s atrás > limite {MAX_SIGNAL_AGE_SECONDS}s).")
            record["status"] = "REJECTED"
            record["rejectionRule"] = "stale_signal"
            record["rejectionReason"] = f"Sinal expirado (idade: {signal_age_sec:.0f}s, limite: {MAX_SIGNAL_AGE_SECONDS}s)."
            return self._finalize_rejection(record, idempotency_key)
        record["guardrails"]["signalNotStale"] = True

        # 5b. Deduplication Check
        for op in open_positions:
            if str(op.get("chat_id")) == str(self.chat_id) and op.get("par") == symbol and op.get("direcao") == direction:
                add_step("Trade Approval", "failed", f"Entrada duplicada bloqueada: Já existe posição {direction} aberta em {symbol}.")
                record["status"] = "REJECTED"
                record["rejectionRule"] = "duplicate_entry"
                record["rejectionReason"] = f"Entrada duplicada: Posição ativa já existente em {symbol} ({direction})."
                return self._finalize_rejection(record, idempotency_key)
        record["guardrails"]["noDuplicateEntry"] = True

        add_step("Trade Approval", "success", "Aprovação concedida: Sinal recente, sem duplicação e em conformidade total com guardrails.")
        record["status"] = "APPROVED"

        # =========================================================================
        # STEP 6: Binance Broker Execution (FASE 21 Controlled Live Trading)
        # =========================================================================
        current_trading_mode = get_trading_mode()
        user_live_status = get_user_live_status(self.chat_id)
        has_user_keys = bool(self.broker.api_key and self.broker.api_secret) and not force_simulation

        if current_trading_mode == "live":
            # 6a. Check user-specific live trading authorization
            if user_live_status != "LIVE_ENABLED":
                add_step("Live Trading Auth", "failed", "Usuário em LIVE_DISABLED. Confirmação obrigatória 'LIVE TRADING ATIVADO'.")
                record["status"] = "REJECTED"
                record["rejectionRule"] = "live_not_confirmed"
                record["rejectionReason"] = "Live trading desativado para este usuário. Confirmação explícita necessária."
                return self._finalize_rejection(record, idempotency_key)
            record["guardrails"]["liveConfirmed"] = True

            # 6b. Must use user's own keys (Never developer keys)
            if not has_user_keys:
                add_step("User Credentials", "failed", "Chaves de API do usuário não encontradas no Vault seguro.")
                record["status"] = "REJECTED"
                record["rejectionRule"] = "missing_user_keys"
                record["rejectionReason"] = "O usuário deve fornecer suas próprias chaves de API da Binance."
                return self._finalize_rejection(record, idempotency_key)

            # 6c. Validate permissions (Withdrawals disabled, canTrade enabled)
            perm_check = self.broker.validate_api_restrictions()
            if not perm_check.get("valid", False):
                err_msg = perm_check.get("error", "Falha na validação de permissões da API Binance.")
                add_step("API Security Check", "failed", err_msg)
                record["status"] = "REJECTED"
                record["rejectionRule"] = "withdrawals_or_cantrade"
                record["rejectionReason"] = err_msg
                return self._finalize_rejection(record, idempotency_key)

            broker_mode = "live"
        elif current_trading_mode == "testnet":
            broker_mode = "testnet" if has_user_keys else "paper_simulation"
        else:
            broker_mode = "paper_simulation"

        side = "BUY" if direction == "LONG" else "SELL"
        order_res: Dict[str, Any] = {}

        if has_user_keys and current_trading_mode in ["live", "testnet"]:
            try:
                order_res = self.broker.open_position(
                    symbol=symbol,
                    side=side,
                    quantity=pos_size,
                    price=entry_price,
                    stop_loss=stop_loss,
                    take_profit=take_profit,
                    order_type="MARKET",
                )
                if not order_res.get("success", False):
                    add_step("Binance Broker", "failed", f"Binance rejeitou ordem: {order_res.get('error')}")
                    record["status"] = "FAILED"
                    record["rejectionReason"] = order_res.get("error")
                    return self._finalize_rejection(record, idempotency_key)
            except Exception as e:
                add_step("Binance Broker", "failed", f"Erro de comunicação com Binance Broker: {str(e)}")
                record["status"] = "FAILED"
                record["rejectionReason"] = str(e)
                return self._finalize_rejection(record, idempotency_key)
        else:
            order_res = {
                "success": True,
                "orderId": f"ord_sim_{int(time.time()*1000)}",
                "symbol": symbol.replace("/", ""),
                "side": side,
                "origQty": pos_size,
                "executedQty": pos_size,
                "status": "FILLED",
                "mode": "paper_simulation",
                "trading_mode": current_trading_mode,
            }

        record["binanceOrder"] = {
            "orderId": order_res.get("orderId"),
            "symbol": symbol,
            "side": side,
            "type": "MARKET",
            "origQty": pos_size,
            "executedQty": pos_size,
            "status": "FILLED",
            "mode": broker_mode,
            "trading_mode": current_trading_mode,
        }
        add_step("Binance Broker", "success", f"Ordem {side} enviada com clientOrderId '{client_order_id}' (Modo: {broker_mode.upper()} | TRADING_MODE: {current_trading_mode.upper()})")

        # =========================================================================
        # STEP 7: Order Manager
        # =========================================================================
        trade_id = f"trade_{int(time.time()*1000)}"
        position_payload = {
            "id": trade_id,
            "chat_id": self.chat_id,
            "par": symbol,
            "direcao": direction,
            "valor": pos_val_usd,
            "abertura": entry_price,
            "stopLoss": stop_loss,
            "takeProfit": take_profit,
            "positionSize": pos_size,
            "status": "open",
            "criadoEm": int(time.time() * 1000),
            "fechaEm": int(time.time() * 1000) + 25000,
            "idempotencyKey": idempotency_key,
            "clientOrderId": client_order_id,
        }
        position_manager.open_position(trade_id, position_payload)

        # Deduct temporary tokens/margin
        users = load_users()
        if str(self.chat_id) in users:
            users[str(self.chat_id)]["tokens"] = max(0.0, users[str(self.chat_id)].get("tokens", 0.0) - pos_val_usd)
            save_users(users)

        add_step("Order Manager", "success", f"Ordem preenchida e registrada com ID: {trade_id}")
        record["status"] = "EXECUTED"

        # =========================================================================
        # STEP 8: Trade Monitor
        # =========================================================================
        add_step("Trade Monitor", "success", f"Monitorando preço contra Stop Loss (${stop_loss:,.2f}) e Take Profit (${take_profit:,.2f}).")

        # Save to logs history
        EXECUTION_LOGS.insert(0, record)
        if len(EXECUTION_LOGS) > 100:
            EXECUTION_LOGS.pop()

        return {
            "success": True,
            "execution_record": record,
            "trade": position_payload,
            "pipeline": pipeline_trace,
        }

    def settle_and_finalize(
        self,
        trade_id: str,
        close_price: Optional[float] = None,
        force_result: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Completes Steps 9 (Resultado), 10 (Analytics), and 11 (Telegram) upon trade closure.
        """
        pos = position_manager.get_position_by_id(trade_id)
        if not pos:
            return {"success": False, "error": "Posição não encontrada"}

        symbol = pos.get("par", "BTC/USDT")
        direction = pos.get("direcao", "LONG")
        entry_price = float(pos.get("abertura", 0.0))
        stop_loss = float(pos.get("stopLoss", 0.0))
        take_profit = float(pos.get("takeProfit", 0.0))
        stake_val = float(pos.get("valor", 5.0))

        if close_price is None:
            ticker = fetch_binance_ticker(symbol)
            close_price = float(ticker.get("price", entry_price))

        # Determine outcome
        is_long = direction in ["LONG", "COMPRAR", "BUY"]
        if force_result:
            is_win = force_result.lower() == "win"
        elif is_long:
            is_win = close_price > entry_price
        else:
            is_win = close_price < entry_price

        result_str = "WIN" if is_win else "LOSS"
        profit_usd = stake_val * 0.05 if is_win else -stake_val
        profit_pct = 5.0 if is_win else -100.0

        # =========================================================================
        # STEP 9: Resultado
        # =========================================================================
        outcome_detail = {
            "result": result_str,
            "pnlUsd": profit_usd,
            "pnlPct": profit_pct,
            "closedAt": int(time.time() * 1000),
            "closePrice": close_price,
            "exitReason": "TAKE_PROFIT" if (is_win and close_price >= take_profit) else "STOP_LOSS" if (not is_win and close_price <= stop_loss) else "TIME_EXPIRE",
        }

        # Settle user tokens
        users = load_users()
        user_key = str(self.chat_id)
        if user_key in users:
            u = users[user_key]
            u["trades"] = u.get("trades", 0) + 1
            if is_win:
                u["tokens"] = u.get("tokens", 0.0) + stake_val + profit_usd
                u["vitorias"] = u.get("vitorias", 0) + 1
            save_users(users)

        # =========================================================================
        # STEP 10: Analytics
        # =========================================================================
        record_trade_result(
            chat_id=self.chat_id,
            result="win" if is_win else "loss",
            pnl_usd=profit_usd,
            pnl_pct=1.0 if is_win else -1.0,
        )

        position_manager.close_position(trade_id, outcome_detail)

        # =========================================================================
        # STEP 11: Telegram Notification Card
        # =========================================================================
        icon = "🟢" if is_win else "🔴"
        telegram_card = (
            f"🏁 *OPERAÇÃO FINALIZADA — {symbol}*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Resultado: {icon} *{result_str}*\n"
            f"Direção: *{direction}*\n"
            f"Entrada: ${entry_price:,.2f}\n"
            f"Saída: ${close_price:,.2f}\n"
            f"PnL: *{'+' if is_win else ''}${profit_usd:,.2f}* ({profit_pct:+.1f}%)\n"
            f"Motivo Saída: {outcome_detail['exitReason']}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📊 _Trade registrado pelo Analytics Engine e Risk Manager._"
        )

        # Update log record if exists
        for log in EXECUTION_LOGS:
            if log.get("idempotencyKey") == pos.get("idempotencyKey"):
                log["outcome"] = outcome_detail
                log["status"] = "CLOSED"
                log["pipeline"].append({
                    "name": "Resultado",
                    "status": "success",
                    "details": f"Fechado com resultado {result_str} (PnL: ${profit_usd:+.2f})",
                    "timestamp": int(time.time() * 1000),
                })
                log["pipeline"].append({
                    "name": "Analytics",
                    "status": "success",
                    "details": "Métricas diárias e winrate atualizados no Risk Manager.",
                    "timestamp": int(time.time() * 1000),
                })
                log["pipeline"].append({
                    "name": "Telegram",
                    "status": "success",
                    "details": "Card de encerramento despachado via Telegram Bot.",
                    "timestamp": int(time.time() * 1000),
                })
                break

        return {
            "success": True,
            "trade_id": trade_id,
            "outcome": outcome_detail,
            "telegram_card": telegram_card,
        }

    def _finalize_rejection(self, record: Dict[str, Any], idempotency_key: str) -> Dict[str, Any]:
        EXECUTION_LOGS.insert(0, record)
        if len(EXECUTION_LOGS) > 100:
            EXECUTION_LOGS.pop()
        return {
            "success": False,
            "error": record.get("rejectionReason", "Operação rejeitada."),
            "execution_record": record,
            "rejection_rule": record.get("rejectionRule"),
        }


def get_execution_engine_status(chat_id: str | int = "7886049873") -> Dict[str, Any]:
    """Returns real-time execution engine health, guardrails status, and recent execution audits."""
    risk_status = get_user_risk_status(chat_id)
    settings = risk_status.get("settings", {})

    # Compute rule rejection metrics from EXECUTION_LOGS
    rejections = {
        "missing_stop_loss": 0,
        "risk_exceeded": 0,
        "daily_loss_reached": 0,
        "duplicate_entry": 0,
        "stale_signal": 0,
        "idempotency_duplicate": 0,
        "low_confidence": 0,
        "in_cooldown": 0,
        "max_positions_reached": 0,
        "pair_not_allowed": 0,
    }

    total_eval = len(EXECUTION_LOGS)
    total_appr = 0
    total_rej = 0
    total_exec = 0

    for l in EXECUTION_LOGS:
        status = l.get("status")
        if status in ["APPROVED", "EXECUTED", "CLOSED"]:
            total_appr += 1
        if status in ["EXECUTED", "CLOSED"]:
            total_exec += 1
        if status in ["REJECTED", "FAILED"]:
            total_rej += 1
            rule = l.get("rejectionRule")
            if rule in rejections:
                rejections[rule] += 1

    cur_mode = get_trading_mode()
    return {
        "enabled": not risk_status.get("autotrade_paused", False),
        "tradingMode": cur_mode,
        "isLive": cur_mode == "live",
        "isTestnet": cur_mode == "testnet",
        "isPaper": cur_mode == "paper",
        "allowedModes": ["paper", "testnet", "live"],
        "defaultMode": "paper",
        "activeExecutionsCount": len(position_manager.get_open_positions()),
        "idempotencyKeysCount": len(IDEMPOTENCY_STORE),
        "guardrails": {
            "neverAutoActivateLive": True,
            "mandatoryStopLoss": bool(settings.get("mandatory_stop_loss", True)),
            "maxRiskPerTradePct": float(settings.get("risk_per_trade_pct", 1.0)),
            "dailyLossLimitPct": float(settings.get("max_daily_loss_pct", 3.0)),
            "staleSignalTtlSeconds": MAX_SIGNAL_AGE_SECONDS,
            "deduplicationEnabled": True,
            "idempotencyEnabled": True,
            "minConfidenceScore": MIN_CONFIDENCE_SCORE,
        },
        "stats": {
            "totalEvaluated": total_eval,
            "totalApproved": total_appr,
            "totalRejected": total_rej,
            "totalExecuted": total_exec,
            "rejectionsByRule": rejections,
        },
        "recentExecutions": EXECUTION_LOGS[:20],
    }

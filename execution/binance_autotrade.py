"""
===================================================================
TRADE AO — Binance Autotrading Engine (execution/binance_autotrade.py)
Automated order placement and risk monitoring for Binance Spot.
Strictly official API. No scraping, no unofficial automation.
===================================================================
"""

import time
import logging
from typing import Dict, Any, Optional, List
from brokers.binance import BinanceBroker
from engine.signal_engine import generate_signal
from engine.risk_manager import calculate_position_size, validate_trade_risk
from engine.trading_mode import get_trading_mode, is_live_trading_enabled, is_testnet_mode
from storage.users import get_user_broker_credentials, get_user_by_id

logger = logging.getLogger("TradeAO_BinanceAuto")

class BinanceAutotrader:
    """
    Coordinates automated signal detection and execution on Binance Spot
    for registered Trade AO accounts with TRADING_MODE safety guardrails.
    """

    def __init__(self, chat_id: str | int, testnet: bool = True):
        self.chat_id = str(chat_id)
        current_mode = get_trading_mode()
        self.trading_mode = current_mode
        self.testnet = testnet if current_mode != "live" else False
        self.user = get_user_by_id(chat_id)
        
        creds = get_user_broker_credentials(chat_id, "binance") or {}
        self.broker = BinanceBroker(
            api_key=creds.get("api_key"),
            api_secret=creds.get("api_secret"),
            testnet=self.testnet,
        )

    def verify_account(self) -> Dict[str, Any]:
        """Validates API credentials and connection with Binance."""
        return self.broker.connect()

    def get_account_summary(self) -> Dict[str, Any]:
        """Retrieves available balances and active positions."""
        balances = self.broker.get_balance()
        positions = self.broker.get_positions()
        return {
            "connected": bool(self.broker.api_key and self.broker.api_secret),
            "balances": balances,
            "positions": positions,
            "trading_mode": self.trading_mode,
            "mode": "live" if self.trading_mode == "live" else "testnet" if self.trading_mode == "testnet" else "paper",
        }

    def execute_signal_autotrade(
        self,
        symbol: str = "BTC/USDT",
        min_confluence_score: int = 70,
        risk_pct: float = 2.0,
    ) -> Dict[str, Any]:
        """
        Scans for technical signal and executes on Binance if confluence score meets threshold.
        """
        # 1. Generate multi-factor confluence signal
        signal = generate_signal(symbol, timeframe="15m")
        if not signal:
            return {
                "executed": False,
                "reason": "Nenhum sinal gerado no momento.",
            }

        score = signal.get("score", 0)
        direction = signal.get("direcao", "LONG")
        entry = signal.get("entrada", 0.0)
        tp = signal.get("alvo", 0.0)
        sl = signal.get("stop", 0.0)

        # 2. Confluence threshold check
        if score < min_confluence_score:
            return {
                "executed": False,
                "reason": f"Confluence Score ({score}/100) abaixo do limite mínimo configurado ({min_confluence_score}/100).",
                "signal": signal,
            }

        # 3. Balance & Position Sizing
        balances = self.broker.get_balance()
        usdt_balance = balances.get("USDT", 1000.0)
        open_positions = self.broker.get_positions()
        open_count = len(open_positions)

        # 4. 6-Pillar Risk validation (Circuit Breaker, Cooldown, Allowed Pairs, Max Positions, SL, RR)
        risk_check = validate_trade_risk(
            chat_id=self.chat_id,
            symbol=symbol,
            direction=direction,
            entry_price=entry,
            stop_loss=sl,
            take_profit=tp,
            capital=usdt_balance,
            current_open_positions_count=open_count,
        )
        if not risk_check.get("allowed", False):
            return {
                "executed": False,
                "reason": f"Risco reprovado [{risk_check.get('rule')}]: {risk_check.get('reason')}",
                "risk_check": risk_check,
                "signal": signal,
            }

        trade_quantity = risk_check.get("position_size", 0.001)

        # 5. Place official Binance order
        order_res = self.broker.open_position(
            symbol=symbol,
            side="BUY" if direction == "LONG" else "SELL",
            quantity=trade_quantity,
            price=entry,
            stop_loss=sl,
            take_profit=tp,
            order_type="MARKET",
        )

        return {
            "executed": order_res.get("success", False),
            "symbol": symbol,
            "direction": direction,
            "score": score,
            "entry_price": entry,
            "take_profit": tp,
            "stop_loss": sl,
            "quantity": trade_quantity,
            "order_result": order_res,
            "signal": signal,
            "timestamp": int(time.time() * 1000),
        }

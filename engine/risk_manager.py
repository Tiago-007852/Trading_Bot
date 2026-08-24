"""
===================================================================
TRADE AO — Risk Management Engine (engine/risk_manager.py)
Strict Capital Protection, Position Sizing, & Autotrade Guardrails
===================================================================
"""

import time
import json
import os
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("TradeAO_RiskManager")

RISK_STATE_FILE = "storage/risk_state.json"

DEFAULT_RISK_SETTINGS: Dict[str, Any] = {
    "risk_per_trade_pct": 1.0,        # 1% risk per trade
    "max_daily_loss_pct": 3.0,        # 3% max daily loss (Circuit Breaker)
    "max_open_positions": 2,          # Max 2 simultaneous open positions
    "allowed_pairs": [                # Whitelisted pairs
        "BTC/USDT",
        "ETH/USDT",
        "SOL/USDT",
        "BNB/USDT",
    ],
    "mandatory_stop_loss": True,      # Stop Loss is strictly mandatory
    "min_risk_reward_ratio": 1.5,     # 1:1.5 minimum Risk:Reward
    "loss_cooldown_minutes": 15,      # 15 minutes cooldown after a loss
}


def _load_risk_state() -> Dict[str, Any]:
    """Loads persistent risk tracking state (daily PnL, cooldowns, pauses)."""
    if os.path.exists(RISK_STATE_FILE):
        try:
            with open(RISK_STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading {RISK_STATE_FILE}: {e}")
    return {}


def _save_risk_state(state: Dict[str, Any]) -> None:
    """Persists risk tracking state to storage."""
    try:
        os.makedirs(os.path.dirname(RISK_STATE_FILE), exist_ok=True)
        with open(RISK_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving {RISK_STATE_FILE}: {e}")


def get_user_risk_settings(chat_id: str | int) -> Dict[str, Any]:
    """Returns custom or default risk settings for a given user."""
    state = _load_risk_state()
    user_state = state.get(str(chat_id), {})
    settings = user_state.get("settings", {})
    merged = dict(DEFAULT_RISK_SETTINGS)
    merged.update(settings)
    return merged


def update_user_risk_settings(chat_id: str | int, new_settings: Dict[str, Any]) -> Dict[str, Any]:
    """Updates and saves risk management settings for a user."""
    state = _load_risk_state()
    user_key = str(chat_id)
    if user_key not in state:
        state[user_key] = {
            "settings": dict(DEFAULT_RISK_SETTINGS),
            "daily_stats": {
                "date": time.strftime("%Y-%m-%d"),
                "total_pnl_usd": 0.0,
                "total_pnl_pct": 0.0,
                "trades_count": 0,
                "losses_count": 0,
                "wins_count": 0,
            },
            "last_loss_timestamp": 0,
            "autotrade_paused": False,
            "pause_reason": None,
        }

    # Validate and merge
    current = state[user_key].get("settings", dict(DEFAULT_RISK_SETTINGS))
    if "risk_per_trade_pct" in new_settings:
        current["risk_per_trade_pct"] = max(0.25, min(10.0, float(new_settings["risk_per_trade_pct"])))
    if "max_daily_loss_pct" in new_settings:
        current["max_daily_loss_pct"] = max(1.0, min(20.0, float(new_settings["max_daily_loss_pct"])))
    if "max_open_positions" in new_settings:
        current["max_open_positions"] = max(1, min(5, int(new_settings["max_open_positions"])))
    if "allowed_pairs" in new_settings and isinstance(new_settings["allowed_pairs"], list):
        current["allowed_pairs"] = [p.strip().upper() for p in new_settings["allowed_pairs"] if p.strip()]
    if "mandatory_stop_loss" in new_settings:
        current["mandatory_stop_loss"] = bool(new_settings["mandatory_stop_loss"])
    if "min_risk_reward_ratio" in new_settings:
        current["min_risk_reward_ratio"] = max(1.0, min(5.0, float(new_settings["min_risk_reward_ratio"])))
    if "loss_cooldown_minutes" in new_settings:
        current["loss_cooldown_minutes"] = max(0, min(120, int(new_settings["loss_cooldown_minutes"])))

    state[user_key]["settings"] = current
    _save_risk_state(state)
    return current


def calculate_position_size(
    capital: float,
    risk_percent: float,
    entry_price: float,
    stop_loss: float,
    max_capital_allocation_pct: float = 95.0,
) -> Dict[str, Any]:
    """
    Calculates exact position size based on dollar risk and distance to stop loss.
    
    Formula:
    1. Risk Amount ($) = Capital * (risk_percent / 100)
    2. Distance ($) = |entry_price - stop_loss|
    3. Distance (%) = Distance / entry_price
    4. Position Size (Units) = Risk Amount / Distance ($)
    5. Position Value ($) = Position Size (Units) * entry_price
    """
    if capital <= 0 or entry_price <= 0:
        return {
            "position_size": 0.0,
            "position_value_usd": 0.0,
            "risk_amount_usd": 0.0,
            "distance_pct": 0.0,
            "valid": False,
            "error": "Capital ou preço de entrada inválidos.",
        }

    distance = abs(entry_price - stop_loss)
    if distance <= 0:
        return {
            "position_size": 0.0,
            "position_value_usd": 0.0,
            "risk_amount_usd": 0.0,
            "distance_pct": 0.0,
            "valid": False,
            "error": "Stop Loss não pode ser igual ao preço de entrada.",
        }

    risk_amount_usd = capital * (risk_percent / 100.0)
    distance_pct = (distance / entry_price) * 100.0

    # Number of units of the base asset
    raw_units = risk_amount_usd / distance
    position_value_usd = raw_units * entry_price

    # Cap position value to maximum allocated capital (e.g. 95% of available balance)
    max_allowed_value = capital * (max_capital_allocation_pct / 100.0)
    if position_value_usd > max_allowed_value:
        position_value_usd = max_allowed_value
        raw_units = position_value_usd / entry_price
        effective_risk_usd = raw_units * distance
    else:
        effective_risk_usd = risk_amount_usd

    return {
        "valid": True,
        "position_size": round(raw_units, 6),
        "position_value_usd": round(position_value_usd, 2),
        "risk_amount_usd": round(effective_risk_usd, 2),
        "distance_pct": round(distance_pct, 2),
        "stop_distance_usd": round(distance, 2),
        "capital": capital,
        "risk_percent": risk_percent,
    }


def calculate_tp_sl(
    entry_price: float,
    atr: float,
    direction: str,
    multiplier: float = 1.5,
    min_rr_ratio: float = 1.5,
) -> Dict[str, float]:
    """Calculates volatility-adjusted Take Profit (TP) and Stop Loss (SL) using ATR and minimum RR ratio."""
    distance = atr * multiplier if atr > 0 else entry_price * 0.015
    sl_distance = distance * 0.8
    tp_distance = sl_distance * min_rr_ratio

    if direction in ["LONG", "COMPRAR", "BUY"]:
        sl = entry_price - sl_distance
        tp = entry_price + tp_distance
    else:
        sl = entry_price + sl_distance
        tp = entry_price - tp_distance

    return {
        "tp": round(tp, 2),
        "sl": round(sl, 2),
        "risk_reward_ratio": round(tp_distance / sl_distance, 2),
        "sl_distance": round(sl_distance, 2),
        "tp_distance": round(tp_distance, 2),
    }


def get_user_risk_status(chat_id: str | int) -> Dict[str, Any]:
    """Retrieves live risk metrics, daily loss tracking, cooldown status, and pause state."""
    state = _load_risk_state()
    user_key = str(chat_id)
    user_data = state.get(user_key, {})
    settings = get_user_risk_settings(chat_id)
    
    today_str = time.strftime("%Y-%m-%d")
    daily_stats = user_data.get("daily_stats", {})
    if daily_stats.get("date") != today_str:
        # Reset daily stats on new day
        daily_stats = {
            "date": today_str,
            "total_pnl_usd": 0.0,
            "total_pnl_pct": 0.0,
            "trades_count": 0,
            "losses_count": 0,
            "wins_count": 0,
        }
        if user_key in state:
            state[user_key]["daily_stats"] = daily_stats
            # Reset pause if caused solely by previous day's daily loss
            if state[user_key].get("autotrade_paused") and "diária" in str(state[user_key].get("pause_reason", "")):
                state[user_key]["autotrade_paused"] = False
                state[user_key]["pause_reason"] = None
            _save_risk_state(state)

    last_loss_ts = user_data.get("last_loss_timestamp", 0)
    cooldown_min = settings.get("loss_cooldown_minutes", 15)
    now = time.time()
    cooldown_elapsed = now - last_loss_ts
    cooldown_remaining_sec = max(0, (cooldown_min * 60) - cooldown_elapsed)

    max_daily_loss = settings.get("max_daily_loss_pct", 3.0)
    daily_loss_pct = abs(min(0.0, daily_stats.get("total_pnl_pct", 0.0)))
    daily_loss_reached = daily_loss_pct >= max_daily_loss

    is_paused = user_data.get("autotrade_paused", False) or daily_loss_reached
    pause_reason = user_data.get("pause_reason")
    if daily_loss_reached and not pause_reason:
        pause_reason = f"Perda máxima diária atingida ({daily_loss_pct:.1f}% / {max_daily_loss:.1f}% max). Autotrading pausado."

    return {
        "chat_id": chat_id,
        "settings": settings,
        "daily_stats": daily_stats,
        "daily_loss_pct": round(daily_loss_pct, 2),
        "daily_loss_reached": daily_loss_reached,
        "in_cooldown": cooldown_remaining_sec > 0,
        "cooldown_remaining_seconds": int(cooldown_remaining_sec),
        "cooldown_remaining_minutes": round(cooldown_remaining_sec / 60, 1),
        "autotrade_paused": is_paused,
        "pause_reason": pause_reason,
    }


def record_trade_outcome(
    chat_id: str | int,
    trade_result: str,  # 'win' or 'loss'
    pnl_usd: float,
    pnl_pct: float,
) -> Dict[str, Any]:
    """
    Records trade outcome, updates daily stats, activates cooldown on loss,
    and triggers automatic circuit breaker pause if daily loss threshold is crossed.
    """
    state = _load_risk_state()
    user_key = str(chat_id)
    if user_key not in state:
        state[user_key] = {
            "settings": dict(DEFAULT_RISK_SETTINGS),
            "daily_stats": {
                "date": time.strftime("%Y-%m-%d"),
                "total_pnl_usd": 0.0,
                "total_pnl_pct": 0.0,
                "trades_count": 0,
                "losses_count": 0,
                "wins_count": 0,
            },
            "last_loss_timestamp": 0,
            "autotrade_paused": False,
            "pause_reason": None,
        }

    today_str = time.strftime("%Y-%m-%d")
    daily = state[user_key].get("daily_stats", {})
    if daily.get("date") != today_str:
        daily = {
            "date": today_str,
            "total_pnl_usd": 0.0,
            "total_pnl_pct": 0.0,
            "trades_count": 0,
            "losses_count": 0,
            "wins_count": 0,
        }

    daily["total_pnl_usd"] = round(daily.get("total_pnl_usd", 0.0) + pnl_usd, 2)
    daily["total_pnl_pct"] = round(daily.get("total_pnl_pct", 0.0) + pnl_pct, 2)
    daily["trades_count"] = daily.get("trades_count", 0) + 1

    settings = state[user_key].get("settings", DEFAULT_RISK_SETTINGS)
    max_daily_loss = settings.get("max_daily_loss_pct", 3.0)

    if trade_result.lower() in ["loss", "perdeu", "stop_loss"]:
        daily["losses_count"] = daily.get("losses_count", 0) + 1
        state[user_key]["last_loss_timestamp"] = time.time()
    else:
        daily["wins_count"] = daily.get("wins_count", 0) + 1

    state[user_key]["daily_stats"] = daily

    # Check Circuit Breaker: Daily Loss Limit
    accumulated_loss_pct = abs(min(0.0, daily["total_pnl_pct"]))
    if accumulated_loss_pct >= max_daily_loss:
        state[user_key]["autotrade_paused"] = True
        state[user_key]["pause_reason"] = (
            f"⚠️ CIRCOUTO DE PROTEÇÃO ATIVADO: Perda acumulada de {accumulated_loss_pct:.1f}% "
            f"atingiu o limite diário de {max_daily_loss:.1f}%. Autotrading pausado automaticamente."
        )
        logger.warning(f"User {chat_id} circuit breaker triggered: -{accumulated_loss_pct}% daily loss.")

    _save_risk_state(state)
    return state[user_key]


def reset_user_pause(chat_id: str | int) -> bool:
    """Manually unpauses autotrading for user."""
    state = _load_risk_state()
    user_key = str(chat_id)
    if user_key in state:
        state[user_key]["autotrade_paused"] = False
        state[user_key]["pause_reason"] = None
        _save_risk_state(state)
        return True
    return False


def validate_trade_risk(
    chat_id: str | int,
    symbol: str,
    direction: str,
    entry_price: float,
    stop_loss: float,
    take_profit: float,
    capital: float,
    current_open_positions_count: int = 0,
) -> Dict[str, Any]:
    """
    Comprehensive 6-Pillar Risk Validation Pipeline.
    Strictly verifies all risk management constraints before permitting any trade execution.
    """
    settings = get_user_risk_settings(chat_id)
    status = get_user_risk_status(chat_id)

    # 1. Circuit Breaker Check (Autotrade Pause / Daily Loss Limit)
    if status.get("autotrade_paused"):
        return {
            "allowed": False,
            "rule": "circuit_breaker",
            "reason": f"Autotrading pausado por proteção: {status.get('pause_reason')}",
            "details": status,
        }

    # 2. Cooldown After Loss Check
    if status.get("in_cooldown"):
        rem_min = status.get("cooldown_remaining_minutes", 0)
        return {
            "allowed": False,
            "rule": "loss_cooldown",
            "reason": f"Período de cooldown pós-loss ativo. Restam {rem_min} min de pausa para proteção psicológica e de capital.",
            "remaining_seconds": status.get("cooldown_remaining_seconds"),
        }

    # 3. Maximum Simultaneous Open Positions Check
    max_positions = settings.get("max_open_positions", 2)
    if current_open_positions_count >= max_positions:
        return {
            "allowed": False,
            "rule": "max_positions",
            "reason": f"Limite de posições simultâneas atingido ({current_open_positions_count}/{max_positions}). Aguarde o fechamento de uma operação.",
            "current_positions": current_open_positions_count,
            "max_positions": max_positions,
        }

    # 4. Whitelisted / Allowed Pairs Check
    allowed_pairs = [p.upper() for p in settings.get("allowed_pairs", [])]
    clean_symbol = symbol.upper()
    if clean_symbol not in allowed_pairs and clean_symbol.replace("/", "") not in [p.replace("/", "") for p in allowed_pairs]:
        return {
            "allowed": False,
            "rule": "allowed_pairs",
            "reason": f"Par {symbol} não está na lista de pares permitidos ({', '.join(allowed_pairs)}).",
            "allowed_pairs": allowed_pairs,
        }

    # 5. Mandatory Stop Loss Check & Orientation
    if settings.get("mandatory_stop_loss", True):
        if not stop_loss or stop_loss <= 0:
            return {
                "allowed": False,
                "rule": "mandatory_stop_loss",
                "reason": "Stop Loss é estritamente obrigatório no Trade AO e não foi informado.",
            }

        is_long = direction.upper() in ["LONG", "COMPRAR", "BUY"]
        if is_long and stop_loss >= entry_price:
            return {
                "allowed": False,
                "rule": "stop_loss_logic",
                "reason": f"Stop Loss inválido para operação LONG ({stop_loss} >= {entry_price}). O stop deve ficar abaixo da entrada.",
            }
        elif not is_long and stop_loss <= entry_price:
            return {
                "allowed": False,
                "rule": "stop_loss_logic",
                "reason": f"Stop Loss inválido para operação SHORT ({stop_loss} <= {entry_price}). O stop deve ficar acima da entrada.",
            }

    # 6. Take Profit & Minimum Risk-Reward Ratio
    if take_profit and take_profit > 0 and stop_loss and stop_loss > 0:
        sl_distance = abs(entry_price - stop_loss)
        tp_distance = abs(take_profit - entry_price)
        min_rr = settings.get("min_risk_reward_ratio", 1.5)
        if sl_distance > 0:
            rr_ratio = tp_distance / sl_distance
            if rr_ratio < (min_rr - 0.05):
                return {
                    "allowed": False,
                    "rule": "risk_reward_ratio",
                    "reason": f"Relação Risco:Retorno insuficiente ({rr_ratio:.2f}R). Mínimo exigido: {min_rr:.1f}R.",
                    "rr_ratio": round(rr_ratio, 2),
                    "min_rr": min_rr,
                }

    # Calculate final position sizing
    risk_pct = settings.get("risk_per_trade_pct", 1.0)
    sizing = calculate_position_size(
        capital=capital,
        risk_percent=risk_pct,
        entry_price=entry_price,
        stop_loss=stop_loss,
    )

    if not sizing.get("valid"):
        return {
            "allowed": False,
            "rule": "position_sizing",
            "reason": sizing.get("error", "Erro no cálculo de dimensionamento de posição."),
        }

    return {
        "allowed": True,
        "symbol": symbol,
        "direction": direction,
        "entry_price": entry_price,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "position_size": sizing["position_size"],
        "position_value_usd": sizing["position_value_usd"],
        "risk_amount_usd": sizing["risk_amount_usd"],
        "distance_pct": sizing["distance_pct"],
        "risk_percent": risk_pct,
        "settings": settings,
    }

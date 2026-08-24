"""
===================================================================
TRADE AO — Order Manager (execution/order_manager.py)
Unified Order Execution & Routing across Brokers & Demo Engine
===================================================================
"""

import time
from typing import Dict, Any, Optional
from storage.users import get_user_broker_credentials, get_user_by_id, load_users, save_users
from brokers.binance import BinanceBroker
from execution.position_manager import position_manager
from engine.risk_manager import validate_trade_risk
from engine.trading_mode import get_trading_mode, is_live_trading_enabled

def execute_user_order(
    chat_id: str | int,
    pair: str,
    direction: str,
    amount_tokens: float,
    entry_price: float = 96000.0,
    stop_loss: Optional[float] = None,
    take_profit: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Coordinates order placement through the user's configured broker (Binance)
    or the internal Trade AO Demo Engine with strict Risk Manager validation
    and TRADING_MODE (paper | testnet | live) feature flag protection.
    """
    trading_mode = get_trading_mode()
    user = get_user_by_id(chat_id)
    if not user:
        return {"success": False, "error": "Usuário não encontrado."}

    if user.get("tokens", 0) < amount_tokens:
        return {"success": False, "error": "Saldo insuficiente de tokens."}

    # Derive default SL/TP if missing
    is_long = direction.upper() in ["COMPRAR", "LONG", "BUY"]
    if stop_loss is None or stop_loss <= 0:
        stop_loss = entry_price * 0.985 if is_long else entry_price * 1.015
    if take_profit is None or take_profit <= 0:
        take_profit = entry_price * 1.025 if is_long else entry_price * 0.975

    # 6-Pillar Risk Manager Verification
    open_positions = position_manager.get_open_positions()
    user_open_count = len([p for p in open_positions if str(p.get("chat_id")) == str(chat_id)])

    risk_check = validate_trade_risk(
        chat_id=chat_id,
        symbol=pair,
        direction=direction,
        entry_price=entry_price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        capital=float(user.get("tokens", 100.0)),
        current_open_positions_count=user_open_count,
    )

    if not risk_check.get("allowed", False):
        return {
            "success": False,
            "error": f"Risco reprovado [{risk_check.get('rule')}]: {risk_check.get('reason')}",
            "risk_check": risk_check,
            "trading_mode": trading_mode,
        }

    creds = get_user_broker_credentials(chat_id, "binance")

    # If user has Binance credentials AND trading_mode is not 'paper'
    if creds and creds.get("api_key") and creds.get("api_secret") and trading_mode != "paper":
        broker = BinanceBroker(
            api_key=creds["api_key"],
            api_secret=creds["api_secret"],
            testnet=(trading_mode != "live"),
        )
        side = "BUY" if is_long else "SELL"
        order_res = broker.open_position(
            symbol=pair,
            side=side,
            quantity=risk_check.get("position_size", amount_tokens * 0.0001),
            stop_loss=stop_loss,
            take_profit=take_profit,
            order_type="MARKET",
        )
        return {
            "success": order_res.get("success", False),
            "broker": "binance",
            "trading_mode": trading_mode,
            "order": order_res,
            "risk_check": risk_check,
        }

    # Otherwise execute in Trade AO Paper / Demo Engine
    users = load_users()
    u = users[str(chat_id)]
    u["tokens"] -= amount_tokens
    u["trades"] = u.get("trades", 0) + 1
    save_users(users)

    trade_id = f"trade_{int(time.time()*1000)}"
    position_manager.open_position(
        trade_id,
        {
            "id": trade_id,
            "chat_id": chat_id,
            "par": pair,
            "direcao": direction,
            "valor": amount_tokens,
            "entry_price": entry_price,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "status": "active",
            "trading_mode": trading_mode,
            "timestamp": int(time.time() * 1000),
        },
    )

    return {
        "success": True,
        "broker": "paper_demo",
        "trading_mode": trading_mode,
        "trade_id": trade_id,
        "tokens_deducted": amount_tokens,
        "new_balance": u["tokens"],
        "risk_check": risk_check,
    }

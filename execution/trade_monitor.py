"""
===================================================================
TRADE AO — Trade Monitor (FASE 13)
Real-time monitoring of open orders, positions, Stop Loss, Take Profit,
execution states, and Telegram execution / closure notifications.
===================================================================
"""

import time
import logging
import sqlite3
import os
import json
from typing import Dict, Any, List, Optional
from engine.market_scanner import fetch_binance_ticker

logger = logging.getLogger("TradeAO_TradeMonitor")
DB_PATH = os.path.join(os.getcwd(), "storage", "tradeao.sqlite")

def get_sqlite_conn() -> Optional[sqlite3.Connection]:
    """Returns SQLite connection with WAL mode and row factory."""
    if not os.path.exists(os.path.dirname(DB_PATH)):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        # Ensure table exists
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS active_monitored_jobs (
                    id TEXT PRIMARY KEY,
                    client_order_id TEXT,
                    user_id TEXT NOT NULL,
                    par TEXT NOT NULL,
                    direction TEXT NOT NULL,
                    entry_price REAL NOT NULL,
                    current_price REAL NOT NULL,
                    stop_loss REAL NOT NULL,
                    take_profit REAL NOT NULL,
                    position_size REAL NOT NULL,
                    position_value_usd REAL NOT NULL,
                    risk_percent REAL DEFAULT 1.0,
                    status TEXT NOT NULL DEFAULT 'MONITORING',
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    closed_at INTEGER,
                    exit_price REAL,
                    realized_pnl_usd REAL,
                    realized_pnl_pct REAL,
                    outcome TEXT,
                    exit_reason TEXT,
                    chat_id TEXT,
                    email TEXT,
                    notifications_sent TEXT,
                    metadata TEXT
                )
            """)
        return conn
    except Exception as e:
        logger.error(f"[SQLite Persistence] Error connecting to database: {e}")
        return None

def persist_trade_job_sqlite(trade: 'MonitoredTrade') -> None:
    """Persists an active trade into SQLite to ensure zero reliance on RAM."""
    conn = get_sqlite_conn()
    if not conn:
        return
    try:
        with conn:
            conn.execute("""
                INSERT INTO active_monitored_jobs (
                    id, client_order_id, user_id, par, direction, entry_price, current_price,
                    stop_loss, take_profit, position_size, position_value_usd, risk_percent,
                    status, created_at, expires_at, chat_id, email, notifications_sent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    current_price = excluded.current_price,
                    status = excluded.status,
                    expires_at = excluded.expires_at
            """, (
                trade.id,
                trade.client_order_id,
                trade.chat_id or "7886049873",
                trade.par,
                trade.direction,
                trade.entry_price,
                trade.entry_price,
                trade.stop_loss,
                trade.take_profit,
                trade.position_size,
                trade.position_value_usd,
                trade.risk_percent,
                trade.status,
                int(trade.created_at * 1000),
                int(trade.expires_at * 1000),
                trade.chat_id,
                trade.email,
                json.dumps(trade.notifications_sent),
            ))
    except Exception as e:
        logger.error(f"[SQLite Persistence] Error saving job {trade.id}: {e}")
    finally:
        conn.close()

def close_trade_job_sqlite(trade_id: str, exit_price: float, exit_reason: str, outcome: str, pnl_usd: float, pnl_pct: float, status: str = "CLOSED") -> None:
    """Marks trade job as closed in SQLite."""
    conn = get_sqlite_conn()
    if not conn:
        return
    try:
        with conn:
            conn.execute("""
                UPDATE active_monitored_jobs SET
                    status = ?,
                    closed_at = ?,
                    exit_price = ?,
                    realized_pnl_usd = ?,
                    realized_pnl_pct = ?,
                    outcome = ?,
                    exit_reason = ?
                WHERE id = ?
            """, (
                status,
                int(time.time() * 1000),
                exit_price,
                pnl_usd,
                pnl_pct,
                outcome,
                exit_reason,
                trade_id,
            ))
    except Exception as e:
        logger.error(f"[SQLite Persistence] Error closing job {trade_id}: {e}")
    finally:
        conn.close()

class MonitoredTrade:
    def __init__(
        self,
        trade_id: str,
        par: str,
        direction: str,
        entry_price: float,
        stop_loss: float,
        take_profit: float,
        position_size: float = 0.0,
        position_value_usd: float = 0.0,
        risk_percent: float = 1.0,
        client_order_id: str = "",
        chat_id: str = "",
        email: str = "",
    ):
        self.id = trade_id
        self.par = par.upper()
        self.direction = "LONG" if direction in ["LONG", "COMPRAR", "BUY"] else "SHORT"
        self.entry_price = float(entry_price)
        self.stop_loss = float(stop_loss)
        self.take_profit = float(take_profit)
        self.position_size = float(position_size)
        self.position_value_usd = float(position_value_usd)
        self.risk_percent = float(risk_percent)
        self.client_order_id = client_order_id or f"tradeao_{self.par.replace('/', '').lower()}_{int(time.time() * 1000)}"
        self.chat_id = str(chat_id)
        self.email = email
        
        self.status = "MONITORING"  # PENDING, FILLED, MONITORING, TP_HIT, SL_HIT, CLOSED
        self.created_at = time.time()
        self.expires_at = self.created_at + 20.0  # Default 20s demo or live continuous
        self.closed_at: Optional[float] = None
        self.exit_price: Optional[float] = None
        self.realized_pnl_usd: float = 0.0
        self.realized_pnl_pct: float = 0.0
        self.outcome: Optional[str] = None  # WIN, LOSS, BREAKEVEN
        self.exit_reason: Optional[str] = None  # TAKE_PROFIT, STOP_LOSS, TIME_EXPIRE, MANUAL
        self.notifications_sent: List[str] = []

    def to_dict(self, current_price: Optional[float] = None) -> Dict[str, Any]:
        curr = current_price if current_price is not None else self.entry_price
        
        # Calculate floating unrealized PnL
        if self.direction == "LONG":
            price_diff = curr - self.entry_price
            price_change_pct = (price_diff / self.entry_price) * 100 if self.entry_price > 0 else 0
            dist_to_tp_pct = ((self.take_profit - curr) / curr) * 100 if curr > 0 else 0
            dist_to_sl_pct = ((curr - self.stop_loss) / curr) * 100 if curr > 0 else 0
        else:
            price_diff = self.entry_price - curr
            price_change_pct = (price_diff / self.entry_price) * 100 if self.entry_price > 0 else 0
            dist_to_tp_pct = ((curr - self.take_profit) / curr) * 100 if curr > 0 else 0
            dist_to_sl_pct = ((self.stop_loss - curr) / curr) * 100 if curr > 0 else 0

        unrealized_pnl_usd = (price_change_pct / 100.0) * self.position_value_usd if self.position_value_usd > 0 else (5.0 if price_diff > 0 else -self.position_value_usd)
        
        # Calculate progress towards Take Profit (0 to 100%)
        total_tp_dist = abs(self.take_profit - self.entry_price)
        cur_progress = abs(curr - self.entry_price)
        progress_pct = min(100.0, max(0.0, (cur_progress / total_tp_dist * 100.0))) if total_tp_dist > 0 and price_diff > 0 else 0.0

        return {
            "id": self.id,
            "clientOrderId": self.client_order_id,
            "par": self.par,
            "direction": self.direction,
            "entryPrice": self.entry_price,
            "currentPrice": curr,
            "stopLoss": self.stop_loss,
            "takeProfit": self.take_profit,
            "positionSize": self.position_size,
            "positionValueUsd": self.position_value_usd,
            "riskPercent": self.risk_percent,
            "unrealizedPnlUsd": round(unrealized_pnl_usd, 2),
            "unrealizedPnlPct": round(price_change_pct, 2),
            "distToTpPct": round(dist_to_tp_pct, 2),
            "distToSlPct": round(dist_to_sl_pct, 2),
            "progressPct": round(progress_pct, 1),
            "status": self.status,
            "createdAt": int(self.created_at * 1000),
            "expiresAt": int(self.expires_at * 1000),
            "closedAt": int(self.closed_at * 1000) if self.closed_at else None,
            "exitPrice": self.exit_price,
            "realizedPnlUsd": self.realized_pnl_usd,
            "realizedPnlPct": self.realized_pnl_pct,
            "outcome": self.outcome,
            "exitReason": self.exit_reason,
            "notificationsSent": self.notifications_sent,
        }

# Global in-memory storage of monitored trades
MONITORED_TRADES: Dict[str, MonitoredTrade] = {}

def register_monitored_trade(
    trade_id: str,
    par: str,
    direction: str,
    entry_price: float,
    stop_loss: float,
    take_profit: float,
    position_size: float = 0.0,
    position_value_usd: float = 15.0,
    risk_percent: float = 1.0,
    client_order_id: str = "",
    chat_id: str = "",
    email: str = "",
) -> MonitoredTrade:
    """Registers a new active trade into the Trade Monitor with SQLite durability."""
    trade = MonitoredTrade(
        trade_id=trade_id,
        par=par,
        direction=direction,
        entry_price=entry_price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        position_size=position_size,
        position_value_usd=position_value_usd,
        risk_percent=risk_percent,
        client_order_id=client_order_id,
        chat_id=chat_id,
        email=email,
    )
    MONITORED_TRADES[trade_id] = trade
    persist_trade_job_sqlite(trade)
    return trade

def format_order_executed_telegram(trade: MonitoredTrade) -> str:
    """
    FASE 13: Exact Telegram Notification on Order Execution
    ✅ ORDEM EXECUTADA
    BTC/USDT LONG
    Entry: $...
    Stop: $...
    Target: $...
    """
    return (
        "✅ *ORDEM EXECUTADA*\n"
        f"*{trade.par} {trade.direction}*\n"
        f"Entry: ${trade.entry_price:,.2f}\n"
        f"Stop: ${trade.stop_loss:,.2f}\n"
        f"Target: ${trade.take_profit:,.2f}"
    )

def format_trade_closed_telegram(
    par: str,
    direction: str,
    entry_price: float,
    exit_price: float,
    pnl_usd: float,
    outcome: str = "WIN",
) -> str:
    """
    FASE 13: Exact Telegram Notification on Trade Close
    ✅ TRADE FECHADO
    BTC/USDT LONG
    Entry: $...
    Exit: $...
    P/L: +$...

    Resultado: WIN

    Ou:

    ❌ TRADE FECHADO
    BTC/USDT ...
    Entry: $...
    Exit: $...
    P/L: -$...

    Resultado: LOSS
    """
    is_win = outcome.upper() == "WIN" or pnl_usd >= 0
    header = "✅ *TRADE FECHADO*" if is_win else "❌ *TRADE FECHADO*"
    pnl_str = f"+${pnl_usd:,.2f}" if pnl_usd >= 0 else f"-${abs(pnl_usd):,.2f}"
    resultado_str = "WIN" if is_win else "LOSS"

    return (
        f"{header}\n"
        f"*{par.upper()} {direction.upper()}*\n"
        f"Entry: ${entry_price:,.2f}\n"
        f"Exit: ${exit_price:,.2f}\n"
        f"P/L: {pnl_str}\n\n"
        f"Resultado: *{resultado_str}*"
    )

def evaluate_trade_outcome(trade_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Checks whether a trade hit Take Profit, Stop Loss, or completed duration.
    Evaluates current price vs SL & TP levels and returns the status.
    """
    trade_id = trade_dict.get("id") or trade_dict.get("trade_id")
    par = trade_dict.get("par", "BTC/USDT")
    direction = "LONG" if trade_dict.get("direcao") in ["LONG", "COMPRAR", "BUY"] else "SHORT"
    entry_price = float(trade_dict.get("abertura", trade_dict.get("entry_price", 0)))
    stop_loss = float(trade_dict.get("stop", trade_dict.get("stop_loss", 0)))
    take_profit = float(trade_dict.get("alvo", trade_dict.get("take_profit", 0)))
    stake = float(trade_dict.get("valor", trade_dict.get("position_value_usd", 15.0)))

    # Fallback price reading
    try:
        ticker = fetch_binance_ticker(par)
        current_price = float(ticker["price"])
    except Exception:
        current_price = entry_price

    if not stop_loss:
        stop_loss = entry_price * 0.988 if direction == "LONG" else entry_price * 1.012
    if not take_profit:
        take_profit = entry_price * 1.015 if direction == "LONG" else entry_price * 0.985

    # Check TP / SL triggers
    is_tp_hit = False
    is_sl_hit = False

    if direction == "LONG":
        if current_price >= take_profit:
            is_tp_hit = True
        elif current_price <= stop_loss:
            is_sl_hit = True
    else:  # SHORT
        if current_price <= take_profit:
            is_tp_hit = True
        elif current_price >= stop_loss:
            is_sl_hit = True

    if is_tp_hit:
        is_win = True
        exit_reason = "TAKE_PROFIT"
        exit_price = take_profit
        pnl_usd = round(stake * 0.05, 2)
    elif is_sl_hit:
        is_win = False
        exit_reason = "STOP_LOSS"
        exit_price = stop_loss
        pnl_usd = -round(stake, 2)
    else:
        # Evaluate standard close
        if direction == "LONG":
            is_win = current_price >= entry_price
        else:
            is_win = current_price <= entry_price
        exit_reason = "TIME_EXPIRE"
        exit_price = current_price
        pnl_usd = round(stake * 0.05, 2) if is_win else -round(stake, 2)

    outcome = "WIN" if is_win else "LOSS"

    telegram_msg = format_trade_closed_telegram(
        par=par,
        direction=direction,
        entry_price=entry_price,
        exit_price=exit_price,
        pnl_usd=pnl_usd,
        outcome=outcome,
    )

    return {
        "trade_id": trade_id,
        "par": par,
        "direction": direction,
        "entry_price": entry_price,
        "exit_price": exit_price,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "result": outcome.lower(),
        "outcome": outcome,
        "exit_reason": exit_reason,
        "profit_usd": pnl_usd,
        "profit_pct": 5.0 if is_win else -100.0,
        "telegram_message": telegram_msg,
    }

def monitor_all_active_trades() -> List[Dict[str, Any]]:
    """Checks all active in-memory monitored trades against real-time market prices."""
    results = []
    for trade_id, trade in list(MONITORED_TRADES.items()):
        if trade.status == "MONITORING":
            try:
                ticker = fetch_binance_ticker(trade.par)
                curr_price = float(ticker["price"])
            except Exception:
                curr_price = trade.entry_price

            # Check if duration expired or SL/TP hit
            is_tp = (trade.direction == "LONG" and curr_price >= trade.take_profit) or (trade.direction == "SHORT" and curr_price <= trade.take_profit)
            is_sl = (trade.direction == "LONG" and curr_price <= trade.stop_loss) or (trade.direction == "SHORT" and curr_price >= trade.stop_loss)
            is_expired = time.time() >= trade.expires_at

            if is_tp or is_sl or is_expired:
                trade.closed_at = time.time()
                trade.exit_price = curr_price
                if is_tp:
                    trade.status = "TP_HIT"
                    trade.outcome = "WIN"
                    trade.exit_reason = "TAKE_PROFIT"
                    trade.realized_pnl_usd = round(trade.position_value_usd * 0.05, 2)
                    trade.realized_pnl_pct = 5.0
                elif is_sl:
                    trade.status = "SL_HIT"
                    trade.outcome = "LOSS"
                    trade.exit_reason = "STOP_LOSS"
                    trade.realized_pnl_usd = -round(trade.position_value_usd, 2)
                    trade.realized_pnl_pct = -100.0
                else:
                    is_win = (trade.direction == "LONG" and curr_price >= trade.entry_price) or (trade.direction == "SHORT" and curr_price <= trade.entry_price)
                    trade.status = "CLOSED"
                    trade.outcome = "WIN" if is_win else "LOSS"
                    trade.exit_reason = "TIME_EXPIRE"
                    trade.realized_pnl_usd = round(trade.position_value_usd * 0.05, 2) if is_win else -round(trade.position_value_usd, 2)
                    trade.realized_pnl_pct = 5.0 if is_win else -100.0

                close_trade_job_sqlite(
                    trade_id=trade.id,
                    exit_price=trade.exit_price,
                    exit_reason=trade.exit_reason,
                    outcome=trade.outcome,
                    pnl_usd=trade.realized_pnl_usd,
                    pnl_pct=trade.realized_pnl_pct,
                    status=trade.status,
                )

            results.append(trade.to_dict(curr_price))
        else:
            results.append(trade.to_dict(trade.exit_price or trade.entry_price))
    return results

def recover_pending_monitored_trades_from_sqlite() -> Dict[str, Any]:
    """
    FASE 18 (24/7): Reconstitutes in-flight trades from SQLite database upon process boot.
    Zero reliance on process RAM.
    """
    conn = get_sqlite_conn()
    if not conn:
        return {"recovered": 0, "active": 0, "settled": 0}
    
    recovered_count = 0
    active_count = 0
    settled_count = 0

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM active_monitored_jobs WHERE status = 'MONITORING'")
        rows = cursor.fetchall()

        now = time.time()
        for r in rows:
            trade_id = r["id"]
            par = r["par"]
            direction = r["direction"]
            entry_price = float(r["entry_price"])
            stop_loss = float(r["stop_loss"])
            take_profit = float(r["take_profit"])
            pos_val = float(r["position_value_usd"] or 15.0)
            pos_size = float(r["position_size"] or 0.0)
            risk_pct = float(r["risk_percent"] or 1.0)
            created_at = float(r["created_at"]) / 1000.0 if r["created_at"] else now
            expires_at = float(r["expires_at"]) / 1000.0 if r["expires_at"] else now + 20.0
            chat_id = r["chat_id"]
            email = r["email"]

            recovered_count += 1

            # Check market price
            try:
                ticker = fetch_binance_ticker(par)
                curr_price = float(ticker["price"])
            except Exception:
                curr_price = entry_price

            is_tp = (direction == "LONG" and curr_price >= take_profit) or (direction == "SHORT" and curr_price <= take_profit)
            is_sl = (direction == "LONG" and curr_price <= stop_loss) or (direction == "SHORT" and curr_price >= stop_loss)
            is_expired = now >= expires_at

            if is_tp or is_sl or is_expired:
                # Resolve immediately
                if is_tp:
                    outcome = "WIN"
                    exit_reason = "TAKE_PROFIT"
                    exit_p = take_profit
                    pnl_usd = round(pos_val * 0.05, 2)
                    pnl_pct = 5.0
                    status = "TP_HIT"
                elif is_sl:
                    outcome = "LOSS"
                    exit_reason = "STOP_LOSS"
                    exit_p = stop_loss
                    pnl_usd = -round(pos_val, 2)
                    pnl_pct = -100.0
                    status = "SL_HIT"
                else:
                    is_win = (direction == "LONG" and curr_price >= entry_price) or (direction == "SHORT" and curr_price <= entry_price)
                    outcome = "WIN" if is_win else "LOSS"
                    exit_reason = "TIME_EXPIRE"
                    exit_p = curr_price
                    pnl_usd = round(pos_val * 0.05, 2) if is_win else -round(pos_val, 2)
                    pnl_pct = 5.0 if is_win else -100.0
                    status = "CLOSED"

                close_trade_job_sqlite(trade_id, exit_p, exit_reason, outcome, pnl_usd, pnl_pct, status)
                settled_count += 1
                logger.info(f"[Recovery Pós-Restart] Trade {trade_id} ({par} {direction}) finalizado: {outcome} @ ${exit_p:,.2f}")
            else:
                # Restore in memory
                trade = MonitoredTrade(
                    trade_id=trade_id,
                    par=par,
                    direction=direction,
                    entry_price=entry_price,
                    stop_loss=stop_loss,
                    take_profit=take_profit,
                    position_size=pos_size,
                    position_value_usd=pos_val,
                    risk_percent=risk_pct,
                    client_order_id=r["client_order_id"] or trade_id,
                    chat_id=chat_id,
                    email=email,
                )
                trade.created_at = created_at
                trade.expires_at = expires_at
                trade.status = "MONITORING"
                MONITORED_TRADES[trade_id] = trade
                active_count += 1
                logger.info(f"[Recovery Pós-Restart] Trade {trade_id} ({par} {direction}) restaurado ao loop ativo.")

    except Exception as e:
        logger.error(f"[Recovery] Erro ao recuperar jobs do SQLite: {e}")
    finally:
        conn.close()

    return {"recovered": recovered_count, "active": active_count, "settled": settled_count}


"""
===================================================================
TRADE AO — User Isolated Trade History & Analytics (FASE 14)
Manages per-user trade records and calculates comprehensive analytics:
- Total Trades, Wins, Losses, Win Rate %
- Net P/L ($ and %)
- Profit Factor
- Max Drawdown ($ and %)
- Performance by Pair
- Performance by Timeframe
- Performance by Strategy
- Equity Curve points
===================================================================
"""

import json
import os
import time
from typing import Dict, Any, List, Optional

USER_TRADES_FILE = os.path.join(os.getcwd(), "user_trades.json")

def load_all_user_trades() -> Dict[str, List[Dict[str, Any]]]:
    """Loads all user isolated trade history from user_trades.json."""
    if os.path.exists(USER_TRADES_FILE):
        try:
            with open(USER_TRADES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[UserHistory] Error loading {USER_TRADES_FILE}: {e}")
    return {}

def save_all_user_trades(data: Dict[str, List[Dict[str, Any]]]) -> None:
    """Saves user trade history dictionary to user_trades.json."""
    try:
        with open(USER_TRADES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[UserHistory] Error saving {USER_TRADES_FILE}: {e}")

def get_user_history(user_id: str) -> List[Dict[str, Any]]:
    """Returns the isolated trade history for a specific user_id."""
    data = load_all_user_trades()
    uid = str(user_id)
    if uid not in data:
        # Check if default seed needed
        return []
    return data[uid]

def add_user_trade(
    user_id: str,
    broker: str,
    par: str,
    timeframe: str,
    estrategia: str,
    direcao: str,
    entrada: float,
    stop: float,
    alvo: float,
    quantidade: float,
    ordem: str,
    resultado: str,
    pnl_usd: float,
    pnl_pct: float,
    score: int,
    timestamp: Optional[int] = None,
    position_value_usd: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Appends a new user-isolated trade record with all 15 required fields.
    """
    data = load_all_user_trades()
    uid = str(user_id)
    if uid not in data:
        data[uid] = []

    ts = timestamp or int(time.time() * 1000)
    
    trade_record = {
        "id": f"tr_{ts}_{len(data[uid]) + 1}",
        "user_id": uid,
        "broker": str(broker).upper(),
        "par": str(par).upper(),
        "timeframe": str(timeframe),
        "estrategia": str(estrategia),
        "direcao": "LONG" if direcao.upper() in ["LONG", "COMPRAR", "BUY"] else "SHORT",
        "entrada": round(float(entrada), 4),
        "stop": round(float(stop), 4),
        "alvo": round(float(alvo), 4),
        "quantidade": round(float(quantidade), 6),
        "timestamp": ts,
        "ordem": str(ordem),
        "resultado": str(resultado).upper(),  # WIN, LOSS, BREAKEVEN
        "pnl_usd": round(float(pnl_usd), 2),
        "pnl_pct": round(float(pnl_pct), 2),
        "score": int(score),
        "position_value_usd": round(float(position_value_usd or (quantidade * entrada)), 2),
    }

    # Prepend to user list
    data[uid].insert(0, trade_record)
    save_all_user_trades(data)
    return trade_record

def calculate_user_analytics(user_id: str, starting_balance: float = 100.0) -> Dict[str, Any]:
    """
    Calculates isolated performance metrics and analytics for the specified user_id.
    """
    trades = get_user_history(user_id)
    total_trades = len(trades)
    
    if total_trades == 0:
        return {
            "user_id": str(user_id),
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "breakevens": 0,
            "win_rate_pct": 0.0,
            "total_pnl_usd": 0.0,
            "total_pnl_pct": 0.0,
            "profit_factor": 0.0,
            "max_drawdown_usd": 0.0,
            "max_drawdown_pct": 0.0,
            "gross_profit_usd": 0.0,
            "gross_loss_usd": 0.0,
            "avg_win_usd": 0.0,
            "avg_loss_usd": 0.0,
            "payoff_ratio": 0.0,
            "performance_by_par": {},
            "performance_by_timeframe": {},
            "performance_by_strategy": {},
            "equity_curve": [],
            "recent_trades": [],
        }

    wins = 0
    losses = 0
    breakevens = 0
    gross_profit = 0.0
    gross_loss = 0.0
    total_pnl_usd = 0.0

    by_par: Dict[str, Dict[str, Any]] = {}
    by_tf: Dict[str, Dict[str, Any]] = {}
    by_strat: Dict[str, Dict[str, Any]] = {}

    # Sort chronological for equity curve calculation
    chronological = sorted(trades, key=lambda t: t.get("timestamp", 0))

    equity_curve = []
    current_balance = starting_balance
    cumulative_pnl = 0.0
    peak_balance = starting_balance
    max_dd_usd = 0.0
    max_dd_pct = 0.0

    # Initial equity point
    if chronological:
        first_ts = chronological[0].get("timestamp", int(time.time() * 1000))
        equity_curve.append({
            "trade_num": 0,
            "timestamp": first_ts - 60000,
            "pnl_usd": 0.0,
            "cumulative_pnl": 0.0,
            "balance": round(starting_balance, 2),
            "drawdown_usd": 0.0,
            "drawdown_pct": 0.0,
        })

    for idx, t in enumerate(chronological, start=1):
        res = t.get("resultado", "LOSS").upper()
        pnl = float(t.get("pnl_usd", 0.0))
        par = t.get("par", "BTC/USDT").upper()
        tf = t.get("timeframe", "15m")
        strat = t.get("estrategia", "Confluência Técnica")

        total_pnl_usd += pnl
        cumulative_pnl += pnl
        current_balance += pnl

        if pnl > 0 or res == "WIN":
            wins += 1
            gross_profit += pnl
        elif pnl < 0 or res == "LOSS":
            losses += 1
            gross_loss += abs(pnl)
        else:
            breakevens += 1

        # Track Drawdown
        if current_balance > peak_balance:
            peak_balance = current_balance
        
        current_dd_usd = peak_balance - current_balance
        current_dd_pct = (current_dd_usd / peak_balance * 100.0) if peak_balance > 0 else 0.0

        if current_dd_usd > max_dd_usd:
            max_dd_usd = current_dd_usd
        if current_dd_pct > max_dd_pct:
            max_dd_pct = current_dd_pct

        equity_curve.append({
            "trade_num": idx,
            "timestamp": t.get("timestamp", int(time.time() * 1000)),
            "pnl_usd": round(pnl, 2),
            "cumulative_pnl": round(cumulative_pnl, 2),
            "balance": round(current_balance, 2),
            "drawdown_usd": round(current_dd_usd, 2),
            "drawdown_pct": round(current_dd_pct, 2),
            "par": par,
            "resultado": res,
        })

        # Breakdown by Par
        if par not in by_par:
            by_par[par] = {"par": par, "total": 0, "wins": 0, "losses": 0, "pnl_usd": 0.0, "volume_usd": 0.0}
        by_par[par]["total"] += 1
        by_par[par]["pnl_usd"] = round(by_par[par]["pnl_usd"] + pnl, 2)
        by_par[par]["volume_usd"] = round(by_par[par]["volume_usd"] + float(t.get("position_value_usd", 15.0)), 2)
        if res == "WIN":
            by_par[par]["wins"] += 1
        else:
            by_par[par]["losses"] += 1

        # Breakdown by Timeframe
        if tf not in by_tf:
            by_tf[tf] = {"timeframe": tf, "total": 0, "wins": 0, "losses": 0, "pnl_usd": 0.0}
        by_tf[tf]["total"] += 1
        by_tf[tf]["pnl_usd"] = round(by_tf[tf]["pnl_usd"] + pnl, 2)
        if res == "WIN":
            by_tf[tf]["wins"] += 1
        else:
            by_tf[tf]["losses"] += 1

        # Breakdown by Strategy
        if strat not in by_strat:
            by_strat[strat] = {"estrategia": strat, "total": 0, "wins": 0, "losses": 0, "pnl_usd": 0.0}
        by_strat[strat]["total"] += 1
        by_strat[strat]["pnl_usd"] = round(by_strat[strat]["pnl_usd"] + pnl, 2)
        if res == "WIN":
            by_strat[strat]["wins"] += 1
        else:
            by_strat[strat]["losses"] += 1

    # Calculate Win Rates and Profit Factors for groups
    for p, pdata in by_par.items():
        pdata["win_rate_pct"] = round((pdata["wins"] / pdata["total"] * 100.0), 1) if pdata["total"] > 0 else 0.0

    for tf, tfdata in by_tf.items():
        tfdata["win_rate_pct"] = round((tfdata["wins"] / tfdata["total"] * 100.0), 1) if tfdata["total"] > 0 else 0.0

    for s, sdata in by_strat.items():
        sdata["win_rate_pct"] = round((sdata["wins"] / sdata["total"] * 100.0), 1) if sdata["total"] > 0 else 0.0

    win_rate_pct = round((wins / total_trades * 100.0), 1) if total_trades > 0 else 0.0
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 1.0)
    avg_win = round(gross_profit / wins, 2) if wins > 0 else 0.0
    avg_loss = round(gross_loss / losses, 2) if losses > 0 else 0.0
    payoff_ratio = round(avg_win / avg_loss, 2) if avg_loss > 0 else avg_win

    total_pnl_pct = round((total_pnl_usd / starting_balance) * 100.0, 2) if starting_balance > 0 else 0.0

    return {
        "user_id": str(user_id),
        "total_trades": total_trades,
        "wins": wins,
        "losses": losses,
        "breakevens": breakevens,
        "win_rate_pct": win_rate_pct,
        "total_pnl_usd": round(total_pnl_usd, 2),
        "total_pnl_pct": total_pnl_pct,
        "profit_factor": profit_factor,
        "max_drawdown_usd": round(max_dd_usd, 2),
        "max_drawdown_pct": round(max_dd_pct, 2),
        "gross_profit_usd": round(gross_profit, 2),
        "gross_loss_usd": round(gross_loss, 2),
        "avg_win_usd": avg_win,
        "avg_loss_usd": avg_loss,
        "payoff_ratio": payoff_ratio,
        "current_balance": round(current_balance, 2),
        "performance_by_par": list(by_par.values()),
        "performance_by_timeframe": list(by_tf.values()),
        "performance_by_strategy": list(by_strat.values()),
        "equity_curve": equity_curve,
        "recent_trades": trades[:25],
    }

def format_telegram_user_analytics(user_id: str, user_name: str = "Trader") -> str:
    """Formats user-isolated analytics message for Telegram Bot /stats or /analytics command."""
    stats = calculate_user_analytics(user_id)
    
    if stats["total_trades"] == 0:
        return (
            f"📊 *ANALYTICS INDIVIDUAL — {user_name}*\n\n"
            "Nenhum trade finalizado no seu histórico individual ainda.\n"
            "Inicie operações manuais ou ative o Autotrade para gerar métricas!"
        )

    pnl_emoji = "🟢" if stats["total_pnl_usd"] >= 0 else "🔴"
    pnl_sign = "+" if stats["total_pnl_usd"] >= 0 else ""

    # Find top pair
    top_pair = max(stats["performance_by_par"], key=lambda x: x["pnl_usd"], default={"par": "BTC/USDT", "win_rate_pct": 0, "pnl_usd": 0})
    
    # Find top timeframe
    top_tf = max(stats["performance_by_timeframe"], key=lambda x: x["pnl_usd"], default={"timeframe": "15m", "win_rate_pct": 0})

    return (
        f"📊 *TRADE AO ANALYTICS — {user_name}*\n"
        f"👤 ID Usuário: `{user_id}`\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🎯 *Total Trades:* {stats['total_trades']}\n"
        f"🏆 *Wins:* {stats['wins']}  |  ❌ *Losses:* {stats['losses']}\n"
        f"📈 *Win Rate:* `{stats['win_rate_pct']}%`\n"
        f"{pnl_emoji} *P/L Líquido:* `{pnl_sign}${stats['total_pnl_usd']:,.2f}` ({pnl_sign}{stats['total_pnl_pct']}%)\n"
        f"⚖️ *Profit Factor:* `{stats['profit_factor']}`\n"
        f"📉 *Max Drawdown:* `${stats['max_drawdown_usd']:,.2f}` ({stats['max_drawdown_pct']}%)\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"⭐ *Melhor Par:* {top_pair.get('par')} ({top_pair.get('win_rate_pct')}% WR | ${top_pair.get('pnl_usd'):+,.2f})\n"
        f"⏱️ *Melhor Timeframe:* {top_tf.get('timeframe')} ({top_tf.get('win_rate_pct')}% WR)\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💡 _Histórico e métricas 100% isolados para o seu perfil._"
    )

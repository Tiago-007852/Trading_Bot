from typing import Dict, Any, List, Optional
from storage.trades import load_history
from storage.user_history import calculate_user_analytics, get_user_history

def calculate_performance_metrics(user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Calculates metrics. If user_id is provided, returns isolated metrics for that user.
    Otherwise returns global metrics.
    """
    if user_id:
        return calculate_user_analytics(str(user_id))

    history = load_history()
    closed = [s for s in history if s.get("status") in ["win", "loss"]]
    total = len(closed)
    wins = len([s for s in closed if s.get("status") == "win"])
    losses = total - wins

    win_rate = round((wins / total) * 100, 1) if total > 0 else 0.0

    return {
        "total_signals": len(history),
        "total_closed": total,
        "wins": wins,
        "losses": losses,
        "win_rate_percent": win_rate,
        "pending": len([s for s in history if s.get("status") == "pending"]),
    }

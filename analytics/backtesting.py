from typing import List, Dict, Any
from engine.strategy import calc_rsi, calc_ema, calc_bollinger, calc_atr
from engine.confidence import evaluate_confluence

def run_strategy_backtest(klines: List[List[float]]) -> Dict[str, Any]:
    """Runs a historical simulation across candle history to evaluate win rate and profit."""
    if len(klines) < 50:
        return {"error": "Insufficient candle data for backtest."}

    closes = [k[4] for k in klines]
    trades = 0
    wins = 0

    for i in range(30, len(closes) - 5):
        sub_closes = closes[:i]
        rsi = calc_rsi(sub_closes, 14)
        rsi_prev = calc_rsi(sub_closes[:-1], 14) or rsi
        ema9 = calc_ema(sub_closes, 9)
        ema21 = calc_ema(sub_closes, 21)
        ema50 = calc_ema(sub_closes, 50)
        bb = calc_bollinger(sub_closes, 20, 2.0)

        if not rsi or not ema9 or not ema21 or not bb:
            continue

        direction, confidence, _ = evaluate_confluence(
            price=sub_closes[-1],
            rsi=rsi,
            rsi_prev=rsi_prev,
            ema9=ema9,
            ema21=ema21,
            ema50=ema50 or ema21,
            bb=bb,
        )

        if confidence >= 70:
            trades += 1
            entry = sub_closes[-1]
            future_close = closes[i + 3]
            if direction == "LONG" and future_close > entry:
                wins += 1
            elif direction == "SHORT" and future_close < entry:
                wins += 1

    return {
        "total_backtest_trades": trades,
        "wins": wins,
        "win_rate_pct": round((wins / trades) * 100, 1) if trades > 0 else 0.0,
    }

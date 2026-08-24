import time
from typing import Dict, Any, List, Optional
from engine.market_scanner import fetch_klines, fetch_binance_ticker
from engine.strategy import (
    calc_ema,
    calc_rsi,
    calc_bollinger,
    calc_atr,
    calc_macd,
    calc_volume_analysis,
    calc_market_structure,
)
from engine.confidence import evaluate_confluence, get_score_category
from engine.risk_manager import calculate_tp_sl
from storage.trades import add_signal_to_history

SUPPORTED_PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"]

def generate_signal(pair: str = "BTC/USDT", timeframe: str = "15m", min_score: int = 60) -> Optional[Dict[str, Any]]:
    """
    Scans pair klines, computes technical indicators, calculates multi-factor confluence score,
    and returns a structured signal payload conforming to Phase 5 standards.
    """
    klines = fetch_klines(pair, interval=timeframe, limit=100)
    if not klines or len(klines) < 30:
        return None

    closes = [k[4] for k in klines]
    current_price = closes[-1]

    # Technical Indicators calculation
    rsi = calc_rsi(closes, 14)
    rsi_prev = calc_rsi(closes[:-1], 14) or rsi
    ema9 = calc_ema(closes, 9)
    ema21 = calc_ema(closes, 21)
    ema50 = calc_ema(closes, 50)
    bb = calc_bollinger(closes, 20, 2.0)
    atr = calc_atr(klines, 14) or (current_price * 0.01)
    macd = calc_macd(closes, 12, 26, 9)
    volume_analysis = calc_volume_analysis(klines, 20)
    market_structure = calc_market_structure(klines, 15)

    if not rsi or not ema9 or not ema21 or not ema50 or not bb:
        return None

    # Multi-Factor Confluence Scoring (Trend, Momentum, RSI, MACD, Volume, Bollinger, Structure, Volatility)
    direction, score, category, reasons, breakdown = evaluate_confluence(
        price=current_price,
        rsi=rsi,
        rsi_prev=rsi_prev,
        ema9=ema9,
        ema21=ema21,
        ema50=ema50,
        bb=bb,
        macd=macd,
        volume_analysis=volume_analysis,
        market_structure=market_structure,
        atr=atr,
    )

    levels = calculate_tp_sl(current_price, atr, direction)

    signal_item = {
        "id": f"sig_{int(time.time() * 1000)}_{pair.replace('/', '')}",
        "par": pair,
        "timeframe": timeframe,
        "direcao": direction,
        "entrada": round(current_price, 2),
        "stop": levels["sl"],
        "alvo": levels["tp"],
        "score": score,
        "score_category": category,
        "indicadores": {
            "rsi": rsi,
            "ema9": ema9,
            "ema21": ema21,
            "ema50": ema50,
            "atr": atr,
            "bollinger": {
                "upper": bb["upper"],
                "middle": bb["middle"],
                "lower": bb["lower"],
                "bandwidth": bb.get("bandwidth", 0.0),
            },
            "macd": macd or {},
            "volume": volume_analysis,
            "market_structure": market_structure,
        },
        "confluence_breakdown": breakdown,
        "reasons": reasons,
        "timestamp": int(time.time() * 1000),
        "estrategia": "Trade AO Multi-Factor Confluence Engine v2",
        "status": "pending",
    }

    add_signal_to_history(signal_item)
    return signal_item

def scan_all_markets() -> List[Dict[str, Any]]:
    signals = []
    for p in SUPPORTED_PAIRS:
        sig = generate_signal(p)
        if sig:
            signals.append(sig)
    return signals

import math
from typing import List, Optional, Tuple, Dict, Any

def calc_ema(values: List[float], period: int) -> Optional[float]:
    if not values or len(values) < period:
        return None
    k = 2 / (period + 1)
    ema = sum(values[:period]) / period
    for val in values[period:]:
        ema = val * k + ema * (1 - k)
    return round(ema, 4)

def calc_ema_series(values: List[float], period: int) -> List[float]:
    if not values or len(values) < period:
        return []
    k = 2 / (period + 1)
    series = []
    current_ema = sum(values[:period]) / period
    series.append(current_ema)
    for val in values[period:]:
        current_ema = val * k + current_ema * (1 - k)
        series.append(current_ema)
    return series

def calc_rsi(closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    gains: List[float] = []
    losses: List[float] = []
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period

    for i in range(period + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(diff, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-diff, 0.0)) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return round(rsi, 2)

def calc_bollinger(closes: List[float], period: int = 20, num_std: float = 2.0) -> Optional[Dict[str, float]]:
    if len(closes) < period:
        return None
    window = closes[-period:]
    mean = sum(window) / period
    variance = sum((x - mean) ** 2 for x in window) / period
    std_dev = math.sqrt(variance)
    return {
        "upper": round(mean + num_std * std_dev, 4),
        "middle": round(mean, 4),
        "lower": round(mean - num_std * std_dev, 4),
        "bandwidth": round(((mean + num_std * std_dev) - (mean - num_std * std_dev)) / mean * 100, 2),
    }

def calc_atr(klines: List[List[float]], period: int = 14) -> Optional[float]:
    # klines: [timestamp, open, high, low, close, volume]
    if len(klines) < period + 1:
        return None
    trs: List[float] = []
    for i in range(1, len(klines)):
        high = klines[i][2]
        low = klines[i][3]
        close_prev = klines[i - 1][4]
        tr = max(high - low, abs(high - close_prev), abs(low - close_prev))
        trs.append(tr)
    atr = sum(trs[-period:]) / period
    return round(atr, 4)

def calc_macd(closes: List[float], fast: int = 12, slow: int = 26, signal_period: int = 9) -> Optional[Dict[str, float]]:
    if len(closes) < slow + signal_period:
        return None
    
    # Calculate fast & slow series
    fast_series = calc_ema_series(closes, fast)
    slow_series = calc_ema_series(closes, slow)
    
    # Align lengths
    offset = len(fast_series) - len(slow_series)
    macd_line_series = [fast_series[i + offset] - slow_series[i] for i in range(len(slow_series))]
    
    if len(macd_line_series) < signal_period:
        return None
        
    signal_series = calc_ema_series(macd_line_series, signal_period)
    if not signal_series:
        return None
        
    current_macd = macd_line_series[-1]
    current_signal = signal_series[-1]
    histogram = current_macd - current_signal
    prev_histogram = (macd_line_series[-2] - signal_series[-2]) if len(signal_series) > 1 else histogram

    return {
        "macd": round(current_macd, 2),
        "signal": round(current_signal, 2),
        "histogram": round(histogram, 2),
        "histogram_growing": histogram > prev_histogram,
    }

def calc_volume_analysis(klines: List[List[float]], period: int = 20) -> Dict[str, Any]:
    # klines: [time, open, high, low, close, volume]
    if len(klines) < period:
        return {"ratio": 1.0, "is_high_volume": False, "trend": "neutral"}
    
    volumes = [k[5] for k in klines]
    current_vol = volumes[-1]
    avg_vol = sum(volumes[-period - 1:-1]) / period if len(volumes) > period else sum(volumes) / len(volumes)
    ratio = current_vol / avg_vol if avg_vol > 0 else 1.0
    
    is_bullish_candle = klines[-1][4] >= klines[-1][1]
    
    return {
        "current_volume": round(current_vol, 2),
        "avg_volume": round(avg_vol, 2),
        "ratio": round(ratio, 2),
        "is_high_volume": ratio >= 1.25,
        "is_bullish_volume": is_bullish_candle,
    }

def calc_market_structure(klines: List[List[float]], lookback: int = 15) -> Dict[str, Any]:
    if len(klines) < lookback:
        return {"structure": "RANGING", "bias": "NEUTRAL", "breakout": None}
    
    highs = [k[2] for k in klines[-lookback:]]
    lows = [k[3] for k in klines[-lookback:]]
    closes = [k[4] for k in klines[-lookback:]]
    
    recent_high = max(highs[:-2])
    recent_low = min(lows[:-2])
    current_close = closes[-1]
    
    if current_close > recent_high:
        return {"structure": "BULLISH_EXPANSION", "bias": "BULLISH", "breakout": "BOS_UP"}
    elif current_close < recent_low:
        return {"structure": "BEARISH_EXPANSION", "bias": "BEARISH", "breakout": "BOS_DOWN"}
    elif highs[-1] > highs[-5] and lows[-1] > lows[-5]:
        return {"structure": "HIGHER_HIGHS", "bias": "BULLISH", "breakout": None}
    elif highs[-1] < highs[-5] and lows[-1] < lows[-5]:
        return {"structure": "LOWER_LOWS", "bias": "BEARISH", "breakout": None}
    
    return {"structure": "RANGING", "bias": "NEUTRAL", "breakout": None}

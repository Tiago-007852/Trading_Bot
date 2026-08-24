from typing import List, Dict, Any, Tuple

# Configurable Weights for Confluence Scoring
DEFAULT_WEIGHTS = {
    "trend": 20,
    "momentum": 15,
    "rsi": 15,
    "macd": 15,
    "volume": 10,
    "bollinger": 10,
    "market_structure": 10,
    "volatility": 5,
}

def get_score_category(score: int) -> str:
    """Classifies the confluence score into defined qualitative tiers."""
    if score >= 90:
        return "VERY STRONG"
    elif score >= 80:
        return "STRONG"
    elif score >= 70:
        return "GOOD"
    elif score >= 60:
        return "WEAK"
    else:
        return "IGNORE"

def evaluate_confluence(
    price: float,
    rsi: float,
    rsi_prev: float,
    ema9: float,
    ema21: float,
    ema50: float,
    bb: Dict[str, float],
    macd: Dict[str, float] = None,
    volume_analysis: Dict[str, Any] = None,
    market_structure: Dict[str, Any] = None,
    atr: float = 0.0,
    weights: Dict[str, int] = None,
) -> Tuple[str, int, str, List[str], Dict[str, Any]]:
    """
    Evaluates multi-indicator technical confluence across 8 categories:
    Trend, Momentum, RSI, MACD, Volume, Bollinger, Market Structure, Volatility.

    Returns:
      (direction, score_0_to_100, category_label, reasons_list, category_breakdown)
    """
    w = weights or DEFAULT_WEIGHTS
    reasons: List[str] = []
    
    long_scores: Dict[str, float] = {}
    short_scores: Dict[str, float] = {}

    # 1. Trend (EMA9, EMA21, EMA50) - Max: w['trend']
    trend_w = w.get("trend", 20)
    if ema9 > ema21 > ema50:
        long_scores["trend"] = trend_w
        reasons.append("Tendência: Alinhamento altista perfeito (EMA9 > EMA21 > EMA50)")
        short_scores["trend"] = 0
    elif ema9 < ema21 < ema50:
        short_scores["trend"] = trend_w
        reasons.append("Tendência: Alinhamento baixista perfeito (EMA9 < EMA21 < EMA50)")
        long_scores["trend"] = 0
    elif price > ema50:
        long_scores["trend"] = trend_w * 0.6
        short_scores["trend"] = trend_w * 0.2
    else:
        short_scores["trend"] = trend_w * 0.6
        long_scores["trend"] = trend_w * 0.2

    # 2. Momentum (EMA 9/21 cross & slope) - Max: w['momentum']
    mom_w = w.get("momentum", 15)
    if ema9 >= ema21 * 0.999 and price >= ema9:
        long_scores["momentum"] = mom_w
        reasons.append("Momentum: Preço sustentado acima da EMA9 com força compradora")
        short_scores["momentum"] = 0
    elif ema9 <= ema21 * 1.001 and price <= ema9:
        short_scores["momentum"] = mom_w
        reasons.append("Momentum: Rejeição na EMA9 com pressão vendedora")
        long_scores["momentum"] = 0
    else:
        long_scores["momentum"] = mom_w * 0.5
        short_scores["momentum"] = mom_w * 0.5

    # 3. RSI (14) - Max: w['rsi']
    rsi_w = w.get("rsi", 15)
    if rsi <= 35:
        long_scores["rsi"] = rsi_w
        reasons.append(f"RSI({rsi:.1f}): Zona de sobrevenda extrema favorável à recuperação")
        short_scores["rsi"] = 0
    elif rsi >= 65:
        short_scores["rsi"] = rsi_w
        reasons.append(f"RSI({rsi:.1f}): Zona de sobrecompra extrema favorável à exaustão")
        long_scores["rsi"] = 0
    elif rsi > 50 and rsi > rsi_prev:
        long_scores["rsi"] = rsi_w * 0.75
        short_scores["rsi"] = rsi_w * 0.25
        reasons.append(f"RSI({rsi:.1f}): Acima da linha de 50 com aceleração de alta")
    elif rsi < 50 and rsi < rsi_prev:
        short_scores["rsi"] = rsi_w * 0.75
        long_scores["rsi"] = rsi_w * 0.25
        reasons.append(f"RSI({rsi:.1f}): Abaixo da linha de 50 com inclinação de baixa")
    else:
        long_scores["rsi"] = rsi_w * 0.4
        short_scores["rsi"] = rsi_w * 0.4

    # 4. MACD - Max: w['macd']
    macd_w = w.get("macd", 15)
    if macd:
        if macd.get("macd", 0) > macd.get("signal", 0) and macd.get("histogram_growing", False):
            long_scores["macd"] = macd_w
            reasons.append("MACD: Linha rápida acima do sinal e histograma altista em expansão")
            short_scores["macd"] = 0
        elif macd.get("macd", 0) < macd.get("signal", 0) and not macd.get("histogram_growing", True):
            short_scores["macd"] = macd_w
            reasons.append("MACD: Cruzamento baixista com histograma vendedor")
            long_scores["macd"] = 0
        elif macd.get("macd", 0) > 0:
            long_scores["macd"] = macd_w * 0.6
            short_scores["macd"] = macd_w * 0.2
        else:
            short_scores["macd"] = macd_w * 0.6
            long_scores["macd"] = macd_w * 0.2
    else:
        long_scores["macd"] = macd_w * 0.5
        short_scores["macd"] = macd_w * 0.5

    # 5. Volume Analysis - Max: w['volume']
    vol_w = w.get("volume", 10)
    if volume_analysis:
        if volume_analysis.get("is_high_volume"):
            if volume_analysis.get("is_bullish_volume"):
                long_scores["volume"] = vol_w
                reasons.append(f"Volume: Expansão de volume comprador ({volume_analysis.get('ratio', 1.0)}x da média)")
                short_scores["volume"] = vol_w * 0.2
            else:
                short_scores["volume"] = vol_w
                reasons.append(f"Volume: Expansão de volume vendedor ({volume_analysis.get('ratio', 1.0)}x da média)")
                long_scores["volume"] = vol_w * 0.2
        else:
            long_scores["volume"] = vol_w * 0.5
            short_scores["volume"] = vol_w * 0.5
    else:
        long_scores["volume"] = vol_w * 0.5
        short_scores["volume"] = vol_w * 0.5

    # 6. Bollinger Bands - Max: w['bollinger']
    bb_w = w.get("bollinger", 10)
    if price <= bb["lower"] * 1.008:
        long_scores["bollinger"] = bb_w
        reasons.append(f"Bollinger: Toque na banda inferior (${bb['lower']:,.2f}) com rejeição de fundo")
        short_scores["bollinger"] = 0
    elif price >= bb["upper"] * 0.992:
        short_scores["bollinger"] = bb_w
        reasons.append(f"Bollinger: Toque na banda superior (${bb['upper']:,.2f}) em região de topo")
        long_scores["bollinger"] = 0
    elif price > bb["middle"]:
        long_scores["bollinger"] = bb_w * 0.6
        short_scores["bollinger"] = bb_w * 0.3
    else:
        short_scores["bollinger"] = bb_w * 0.6
        long_scores["bollinger"] = bb_w * 0.3

    # 7. Market Structure (BOS / Swings) - Max: w['market_structure']
    struct_w = w.get("market_structure", 10)
    if market_structure:
        bias = market_structure.get("bias")
        if bias == "BULLISH":
            long_scores["market_structure"] = struct_w
            reasons.append(f"Estrutura: Pivô de alta / quebra altista ({market_structure.get('structure')})")
            short_scores["market_structure"] = 0
        elif bias == "BEARISH":
            short_scores["market_structure"] = struct_w
            reasons.append(f"Estrutura: Pivô de baixa / quebra baixista ({market_structure.get('structure')})")
            long_scores["market_structure"] = 0
        else:
            long_scores["market_structure"] = struct_w * 0.5
            short_scores["market_structure"] = struct_w * 0.5
    else:
        long_scores["market_structure"] = struct_w * 0.5
        short_scores["market_structure"] = struct_w * 0.5

    # 8. Volatility (ATR) - Max: w['volatility']
    volat_w = w.get("volatility", 5)
    long_scores["volatility"] = volat_w * 0.8
    short_scores["volatility"] = volat_w * 0.8

    total_long = int(round(sum(long_scores.values())))
    total_short = int(round(sum(short_scores.values())))

    if total_long >= total_short:
        direction = "LONG"
        final_score = min(100, max(0, total_long))
        breakdown = long_scores
    else:
        direction = "SHORT"
        final_score = min(100, max(0, total_short))
        breakdown = short_scores

    category = get_score_category(final_score)

    return direction, final_score, category, reasons, breakdown

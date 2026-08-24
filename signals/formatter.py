from typing import Dict, Any, List

def format_signal_center(signals: List[Dict[str, Any]]) -> str:
    """
    Formats the Telegram '📡 SIGNAL CENTER' dashboard ranking active signals
    and highlighting the '🔥 TOP SIGNAL' with platform classifications.
    """
    if not signals:
        return """📡 *SIGNAL CENTER — TRADE AO*
━━━━━━━━━━━━━━━━━━━
Nenhum sinal com confluência suficiente no momento.
Aguarde a próxima varredura de mercado (15m/1h).

_Engine ativa escaneando BTC, ETH, SOL, BNB..._"""

    # Sort signals descending by confluence score
    sorted_signals = sorted(signals, key=lambda s: s.get("score", 0), reverse=True)
    top = sorted_signals[0]

    top_dir = "🟢 LONG (COMPRA)" if top.get("direcao") == "LONG" else "🔴 SHORT (VENDA)"
    top_score = top.get("score", 85)
    top_cat = top.get("score_category", "STRONG")
    top_tf = top.get("timeframe", "15m")
    top_reasons = "\n".join([f"  • {r}" for r in top.get("reasons", [])[:3]])

    # Build other ranked signals summary
    others_text = ""
    if len(sorted_signals) > 1:
        others_text = "\n━━━━━━━━━━━━━━━━━━━\n📊 *OUTROS PARES ANALISADOS:*\n"
        for s in sorted_signals[1:]:
            s_dir = "🟢 LONG" if s.get("direcao") == "LONG" else "🔴 SHORT"
            others_text += (
                f"• *{s.get('par')}* ({s.get('timeframe', '15m')}): {s_dir} | "
                f"Score: *{s.get('score')}/100* (${s.get('entrada', 0):,.2f})\n"
            )

    return f"""📡 *SIGNAL CENTER — MERCADOS ATIVOS*
━━━━━━━━━━━━━━━━━━━
🔥 *TOP SIGNAL DO MOMENTO:*

💎 *{top.get('par')}*
📈 DIREÇÃO: *{top_dir}*
🎯 CONFLUÊNCIA: *{top_score}/100* ({top_cat})
⏱️ TIMEFRAME: *{top_tf}*

💰 Entrada: *${top.get('entrada', 0):,.2f}*
🎯 Take Profit (TP): *${top.get('alvo', 0):,.2f}*
🛑 Stop Loss (SL): *${top.get('stop', 0):,.2f}*

🔍 *Confluência Técnica:*
{top_reasons}
{others_text}
━━━━━━━━━━━━━━━━━━━
🌐 *CLASSIFICAÇÃO POR PLATAFORMA:*
• 🟡 *Binance*: Spot / Futuros (Compatível c/ API Trade AO)
• 🔵 *Bybit*: Derivativos / Spot (Destino de Sinal)
• 🟣 *Quotex*: Opções Digitais *(Destino / Execução Manual)*
• 🟠 *Pocket Option*: Opções Digitais *(Destino / Execução Manual)*

⚠️ _Quotex e Pocket Option operam exclusivamente como destino de sinais para execução manual. Não há automação desautorizada._
⚠️ _O Confluence Score reflete o alinhamento técnico dos 8 pilares, não constituindo garantia ou probabilidade de lucro._"""

def format_signal_message(signal: Dict[str, Any]) -> str:
    """Formats an individual technical signal."""
    direction = signal.get("direcao", "LONG")
    direction_emoji = "🟢 *LONG (COMPRA)*" if direction == "LONG" else "🔴 *SHORT (VENDA)*"
    score = signal.get("score", 75)
    category = signal.get("score_category", "GOOD")
    strategy = signal.get("estrategia", "Trade AO Multi-Factor Confluence Engine v2")
    indicators = signal.get("indicadores", {})
    reasons = "\n".join([f"• {r}" for r in signal.get("reasons", [])[:4]])

    category_badge = {
        "VERY STRONG": "💎 MUITO FORTE",
        "STRONG": "🟢 FORTE",
        "GOOD": "🟡 BOM",
        "WEAK": "🟠 FRACO",
        "IGNORE": "⚪ NEUTRO/IGNORAR",
    }.get(category, category)

    rsi_val = indicators.get("rsi", "N/A")
    ema9_val = indicators.get("ema9", 0)
    ema21_val = indicators.get("ema21", 0)
    macd_data = indicators.get("macd", {})
    macd_hist = macd_data.get("histogram", 0)

    return f"""📊 *SINAL EDUCACIONAL — {signal.get('par')} ({signal.get('timeframe', '15m')})*
━━━━━━━━━━━━━━━━━━━
📈 DIREÇÃO: {direction_emoji}
🎯 SCORE DE CONFLUÊNCIA: *{score}/100* ({category_badge})
⚙️ ESTRATÉGIA: _{strategy}_

💰 ENTRADA: *${signal.get('entrada', 0):,.2f}*
🎯 ALVO (TP): *${signal.get('alvo', 0):,.2f}*
🛑 STOP (SL): *${signal.get('stop', 0):,.2f}*
━━━━━━━━━━━━━━━━━━━
📐 *Indicadores Chave:*
• RSI(14): *{rsi_val}* | Hist. MACD: *{macd_hist}*
• EMA 9: *${ema9_val:,.2f}* | EMA 21: *${ema21_val:,.2f}*

🔍 *Confluência Detectada:*
{reasons}
━━━━━━━━━━━━━━━━━━━
🌐 *Destinos Compatíveis:* Binance · Bybit · Quotex (Manual) · Pocket Option (Manual)
⚠️ _Score representa a força da confluência dos indicadores técnicos. Não é probabilidade ou garantia de lucro._"""

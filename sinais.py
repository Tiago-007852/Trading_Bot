# sinais.py — Motor de sinais demo (indicadores reais, Python puro)
import time
import math
import ccxt

# ---------- Indicadores ----------

def ema(valores, periodo):
    """EMA sem dependências (seed = SMA)."""
    if not valores or len(valores) < periodo:
        return None
    k = 2 / (periodo + 1)
    e = sum(valores[:periodo]) / periodo
    for v in valores[periodo:]:
        e = v * k + e * (1 - k)
    return e

def rsi(fechamentos, periodo=14):
    if len(fechamentos) < periodo + 1:
        return None
    ganhos, perdas = [], []
    for i in range(1, periodo + 1):
        d = fechamentos[i] - fechamentos[i - 1]
        ganhos.append(max(d, 0)); perdas.append(max(-d, 0))
    ag = sum(ganhos) / periodo
    ap = sum(perdas) / periodo
    for i in range(periodo + 1, len(fechamentos)):
        d = fechamentos[i] - fechamentos[i - 1]
        ag = (ag * (periodo - 1) + max(d, 0)) / periodo
        ap = (ap * (periodo - 1) + max(-d, 0)) / periodo
    if ap == 0:
        return 100.0
    return 100 - (100 / (1 + ag / ap))

def bollinger(fechamentos, periodo=20, desvios=2.0):
    if len(fechamentos) < periodo:
        return None
    janela = fechamentos[-periodo:]
    media = sum(janela) / periodo
    dp = math.sqrt(sum((x - media) ** 2 for x in janela) / periodo)
    return media + desvios * dp, media, media - desvios * dp

def atr(velas, periodo=14):
    """Volatilidade real → stop/alvo realistas (não promessas)."""
    if len(velas) < periodo + 1:
        return None
    trs = []
    for i in range(1, len(velas)):
        h, l, cp = velas[i][2], velas[i][3], velas[i - 1][4]
        trs.append(max(h - l, abs(h - cp), abs(l - cp)))
    return sum(trs[-periodo:]) / periodo

# ---------- Estratégia (confluência: RSI + EMA + Bollinger + tendência) ----------

def gerar_sinal(pares=None, timeframe='15m', limite=120):
    """Devolve dict do sinal, ou None se não houver confluência."""
    if pares is None:
        pares = ['BTC/USDT', 'ETH/USDT']
    exchange = ccxt.binance({'enableRateLimit': True})
    for par in pares:
        try:
            velas = exchange.fetch_ohlcv(par, timeframe, limit=limite)
        except Exception:
            continue
        fech = [v[4] for v in velas]
        r = rsi(fech)
        r_ant = rsi(fech[:-1])
        e9, e21, e50 = ema(fech, 9), ema(fech, 21), ema(fech, 50)
        bb = bollinger(fech)
        at = atr(velas)
        if None in (r, r_ant, e9, e21, e50, bb[0], bb[2], at):
            continue
        preco = fech[-1]

        # LONG: RSI a sair de sobrevenda + preço na banda inferior + EMA9>EMA21 + tendência alta
        if r <= 32 and r > r_ant and preco <= bb[2] * 1.002 and e9 > e21 and preco > e50:
            direcao = 'LONG'
        # SHORT: RSI a sair de sobrecompra + preço na banda superior + EMA9<EMA21 + tendência baixa
        elif r >= 68 and r < r_ant and preco >= bb[0] * 0.998 and e9 < e21 and preco < e50:
            direcao = 'SHORT'
        else:
            continue

        dist = at * 1.5
        if direcao == 'LONG':
            alvo, stop = preco + dist, preco - dist * 0.8
        else:
            alvo, stop = preco - dist, preco + dist * 0.8

        return {
            'par': par, 'timeframe': timeframe, 'direcao': direcao,
            'entrada': round(preco, 2), 'alvo': round(alvo, 2), 'stop': round(stop, 2),
            'rsi': round(r, 1), 'ema9': round(e9, 2), 'ema21': round(e21, 2),
            'ts': int(time.time() * 1000),
        }
    return None

# ---------- Formatação da mensagem (visual profissional) ----------

def formatar_sinal(s, wr=None):
    linhas = [
        f"📊 SINAL — {s['par']} ({s['timeframe']})",
        "━━━━━━━━━━━━━━━━━━━",
        f"📈 DIREÇÃO: {'LONG (COMPRA)' if s['direcao'] == 'LONG' else 'SHORT (VENDA)'}",
        f"💰 ENTRADA: ${s['entrada']:,.2f}",
        f"🎯 ALVO: ${s['alvo']:,.2f}",
        f"🛑 STOP: ${s['stop']:,.2f}",
        "━━━━━━━━━━━━━━━━━━━",
        f"RSI(14): {s['rsi']} · EMA9: {s['ema9']:,.2f} · EMA21: {s['ema21']:,.2f}",
    ]
    if wr:
        linhas.append(f"📈 Histórico: {wr['acertos']}/{wr['total']} ({wr['pct']}%)")
    linhas += [
        "━━━━━━━━━━━━━━━━━━━",
        "⚠️ Sinal educativo gerado por indicadores técnicos.",
        "Não é aconselhamento financeiro. Simulação apenas.",
        "📢 Pratica na Binance: https://www.binance.com/register?ref=1058024469",
    ]
    return "\n".join(linhas)

# ---------- Resolução do resultado (win/loss honesto) ----------

def resolver_sinal(s):
    """Verifica se o sinal atingiu alvo ou stop. None = ainda pendente."""
    try:
        exchange = ccxt.binance({'enableRateLimit': True})
        preco = exchange.fetch_ticker(s['par'])['last']
    except Exception:
        return None
    if s['direcao'] == 'LONG':
        if preco >= s['alvo']: return 'win'
        if preco <= s['stop']: return 'loss'
    else:
        if preco <= s['alvo']: return 'win'
        if preco >= s['stop']: return 'loss'
    return None

"""
🤖 BOT DE TRADING 
Simulador educativo 100% demo. Depósito real direcionado para corretoras parceiras.
Nenhum dinheiro passa pelo bot.
"""
import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
import os, re, json, secrets, string, random
from datetime import datetime
from datetime import timedelta
from zoneinfo import ZoneInfo

from sinais import gerar_sinal, formatar_sinal, resolver_sinal

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, MessageHandler,
    ConversationHandler, filters, ContextTypes
)

# ========== CONFIG ==========
from dotenv import load_dotenv
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BOT_USERNAME = "TradeAO_Bot"          # troca pelo username real do teu bot
ARQUIVO = "users.json"
TOKENS_INICIAIS = 20.0
ASK_EMAIL, ASK_VALOR, ASK_DIRECAO = range(3)

# ========== AFILIADOS ==========
LINK_BINANCE = "https://www.binance.com/register?ref=1058024469"
LINK_BYBIT = "https://www.bybit.com/invite?ref=SEU_CODIGO_BYBIT"  # ← preenche quando a Bybit aprovar
NOME_BINANCE = "Binance"
NOME_BYBIT = "Bybit"

# ========== PERSISTÊNCIA ==========
def carregar():
    if os.path.exists(ARQUIVO):
        with open(ARQUIVO, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def salvar(dados):
    with open(ARQUIVO, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

def gerar_senha(n=12):
    return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(n))

def email_valido(email):
    return bool(re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email))

def preco_btc():
    """Preço real (API pública da Binance). Fallback fictício se offline."""
    try:
        import ccxt
        return float(ccxt.binance().fetch_ticker("BTC/USDT")["last"])
    except Exception:
        return random.uniform(55000, 65000)

# ========== MENU ==========
HISTORICO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "historico.json")
USERS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.json")

def carregar_historico():
    if not os.path.exists(HISTORICO_PATH):
        return []
    try:
        with open(HISTORICO_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

def guardar_historico(dados):
    with open(HISTORICO_PATH, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

def win_rate():
    hist = carregar_historico()
    fechados = [s for s in hist if s.get("status") in ("win", "loss")]
    if not fechados:
        return None
    acertos = sum(1 for s in fechados if s["status"] == "win")
    return {
        "acertos": acertos,
        "total": len(fechados),
        "pct": round(acertos / len(fechados) * 100),
    }

def carregar_chat_ids():
    if not os.path.exists(USERS_PATH):
        return []
    try:
        with open(USERS_PATH, "r", encoding="utf-8") as f:
            users = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    ids = []
    for chave in users:
        try:
            ids.append(int(chave))
        except (TypeError, ValueError):
            continue
    return ids

async def enviar_sinal_periodico(context):
    sinal = gerar_sinal()
    if not sinal:
        return
    sinal["status"] = "pending"
    hist = carregar_historico()
    hist.append(sinal)
    guardar_historico(hist)

    texto = formatar_sinal(sinal, wr=win_rate())
    for chat_id in carregar_chat_ids():
        try:
            await context.bot.send_message(chat_id=chat_id, text=texto)
        except Exception as e:
            print(f"Falha a enviar sinal para {chat_id}: {e}")

    context.job_queue.run_once(
        resolver_sinal_job,
        when=timedelta(minutes=45),
        data=sinal["ts"],
        name=f"resolver_{sinal['ts']}",
    )

async def resolver_sinal_job(context):
    ts = context.job.data
    hist = carregar_historico()
    alvo = next((s for s in hist if s.get("ts") == ts and s.get("status") == "pending"), None)
    if not alvo:
        return
    resultado = resolver_sinal(alvo)
    if resultado is None:
        context.job_queue.run_once(
            resolver_sinal_job,
            when=timedelta(minutes=15),
            data=ts,
            name=f"resolver_{ts}_retry",
        )
        return
    alvo["status"] = resultado
    guardar_historico(hist)

    emoji = "✅" if resultado == "win" else "❌"
    texto = (
        f"{emoji} RESULTADO — {alvo['par']}\n"
        f"{'Alvo atingido' if resultado == 'win' else 'Stop atingido'}\n"
        f"Entrada: ${alvo['entrada']:,.2f} · "
        f"{'Alvo' if resultado == 'win' else 'Stop'}: "
        f"${alvo['alvo'] if resultado == 'win' else alvo['stop']:,.2f}"
    )
    for chat_id in carregar_chat_ids():
        try:
            await context.bot.send_message(chat_id=chat_id, text=texto)
        except Exception as e:
            print(f"Falha a enviar resultado para {chat_id}: {e}")

async def sinais_menu(update, context):
    wr = win_rate()
    if wr:
        stats = f"Histórico: {wr['acertos']}/{wr['total']} ({wr['pct']}%)"
    else:
        stats = "Ainda sem sinais fechados."
    texto = (
        "📡 Sinais educativos — cripto\n\n"
        "Indicadores: RSI, EMA, Bollinger, ATR.\n"
        "Horários: 09:00, 13:00, 17:00, 21:00 (Lisboa).\n"
        f"{stats}\n\n"
        "⚠️ Não é aconselhamento financeiro. Simulação apenas."
    )
    teclado = [
        [InlineKeyboardButton("📡 Pedir sinal agora", callback_data="sinal_agora")],
        [InlineKeyboardButton("◀️ Voltar", callback_data="menu_principal")],
    ]
    await update.callback_query.edit_message_text(
        texto,
        reply_markup=InlineKeyboardMarkup(teclado),
    )

async def sinal_agora(update, context):
    await update.callback_query.answer("A analisar o mercado…")
    sinal = gerar_sinal()
    if not sinal:
        await update.callback_query.edit_message_text(
            "Nenhuma confluência neste momento.\n"
            "O próximo sinal automático sai no horário seguinte.",
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("◀️ Voltar", callback_data="sinais")]]
            ),
        )
        return
    sinal["status"] = "pending"
    hist = carregar_historico()
    hist.append(sinal)
    guardar_historico(hist)
    await update.callback_query.edit_message_text(formatar_sinal(sinal, wr=win_rate()))
    context.job_queue.run_once(
        resolver_sinal_job,
        when=timedelta(minutes=45),
        data=sinal["ts"],
        name=f"resolver_{sinal['ts']}",
    )
def menu_markup():
    return InlineKeyboardMarkup([
	[InlineKeyboardButton("📡 Sinais", callback_data="sinais")],
        [InlineKeyboardButton("🤖 Iniciar Autotrading", callback_data="autotrade")],
        [InlineKeyboardButton("📊 Modo Manual", callback_data="manual")],
        [InlineKeyboardButton("🟢 Mudar para Real", callback_data="real")],
        [InlineKeyboardButton("💰 Depositar (Real)", callback_data="depositar")],   # ← AFILIADO
        [InlineKeyboardButton("💼 Minha Conta", callback_data="conta"),
         InlineKeyboardButton("💎 Tokens", callback_data="tokens")],
        [InlineKeyboardButton("❓ FAQ", callback_data="faq"),
         InlineKeyboardButton("🛟 Suporte", callback_data="suporte")],
        [InlineKeyboardButton("👥 Amigos", callback_data="amigos"),
         InlineKeyboardButton("⚙️ Ajustes", callback_data="ajustes")],
    ])

def texto_menu(usuario):
    return (f"🤖 @{BOT_USERNAME}\n"
            f"🟠 Modo: DEMO\n"
            f"💎 Tokens: {usuario['tokens']:.2f}\n"
            f"📈 BTC/USDT: ${preco_btc():,.2f}")

def voltar_markup():
    return InlineKeyboardMarkup([[InlineKeyboardButton("↩️ Menu", callback_data="menu")]])

async def mostrar_menu(update: Update, context: ContextTypes.DEFAULT_TYPE, user_id=None):
    if user_id is None:
        user_id = update.effective_user.id
    usuarios = carregar()
    u = usuarios.get(str(user_id))
    if not u:
        return
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.edit_message_text(texto_menu(u), reply_markup=menu_markup())
    else:
        await update.message.reply_text(texto_menu(u), reply_markup=menu_markup())

# ========== /START + REGISTO ==========
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    usuarios = carregar()
    uid = str(update.effective_user.id)
    ref = context.args[0] if context.args else None

    if uid in usuarios:
        await mostrar_menu(update, context, update.effective_user.id)
        return ConversationHandler.END

    if ref and ref.startswith("ref"):
        context.user_data["convidado_por"] = ref[3:]

    await update.message.reply_text(
        "👋 Olá! Eu sou @" + BOT_USERNAME + ".\n"
        "Vou registrar uma conta de trading e fazer uma série de operações demo.\n\n"
        "✉️ Digite seu e-mail para se registrar:"
    )
    return ASK_EMAIL

async def receber_email(update: Update, context: ContextTypes.DEFAULT_TYPE):
    email = update.message.text.strip().lower()
    usuarios = carregar()

    if not email_valido(email):
        await update.message.reply_text("⚠️ E-mail inválido. Digite um e-mail válido (ex: nome@email.com):")
        return ASK_EMAIL

    for u in usuarios.values():
        if u["email"] == email:
            await update.message.reply_text("⚠️ Este e-mail já está registrado. Digite outro:")
            return ASK_EMAIL

    uid = str(update.effective_user.id)
    senha = gerar_senha()
    usuarios[uid] = {
        "email": email,
        "senha": senha,
        "tokens": TOKENS_INICIAIS,
        "chat_id": update.effective_chat.id,
        "registro": datetime.now().isoformat(),
        "trades": 0,
        "vitorias": 0,
        "autotrade": False,
        "risco": 0.25,
        "clicou_depositar": False,
        "convidado_por": context.user_data.get("convidado_por"),
    }
    salvar(usuarios)

    ref = usuarios[uid]["convidado_por"]
    if ref and ref in usuarios:
        usuarios[ref]["tokens"] += 5
        salvar(usuarios)

    await update.message.reply_text(
        f"✅ Conta criada!\n\n"
        f"🔑 Login: {email}\n"
        f"🔒 Senha: {senha}\n\n"
        f"📌 Salve estes dados. Agora vamos ao menu:"
    )
    await mostrar_menu(update, context, update.effective_user.id)
    return ConversationHandler.END

# ========== DEPOSITAR (AFILIADOS) ==========
async def depositar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # bónus demo por clicar (opcional)
    usuarios = carregar()
    u = usuarios.get(str(update.effective_user.id))
    if u and not u.get("clicou_depositar"):
        u["clicou_depositar"] = True
        u["tokens"] += 5
        salvar(usuarios)

    await update.callback_query.edit_message_text(
        "💰 *Depositar — Modo Real*\n\n"
        "Este bot é um simulador educativo e **NÃO recebe depósitos**.\n\n"
        "Para operar com dinheiro real, escolha uma corretora parceira. "
        "O depósito é feito **100% na corretora**, nunca aqui:\n\n"
        "⚠️ *Divulgação:* ao usar estes links, garantimos que se cadastre de forma segura. "
        "Operar cripto envolve risco de perda de capital. "
        "Resultados passados não garantem lucros futuros.",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(f"🔗 {NOME_BINANCE}", url=LINK_BINANCE)],
            [InlineKeyboardButton(f"🔗 {NOME_BYBIT}", url=LINK_BYBIT)],
            [InlineKeyboardButton("↩️ Menu", callback_data="menu")],
        ])
    )

# ========== MENU: AÇÕES ==========
async def manual_inicio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    usuarios = carregar()
    u = usuarios.get(str(update.effective_user.id))
    if not u:
        await update.callback_query.answer("Registre-se com /start")
        return ConversationHandler.END
    await update.callback_query.message.reply_text(
        f"💵 Seu saldo: {u['tokens']:.2f} tokens\n"
        "Quanto quer operar? (ex: 5)\n\n"
        "Envie /cancelar para voltar ao menu."
    )
    return ASK_VALOR

async def manual_valor(update: Update, context: ContextTypes.DEFAULT_TYPE):
    usuarios = carregar()
    uid = str(update.effective_user.id)
    u = usuarios.get(uid)
    try:
        valor = float(update.message.text.replace(",", "."))
        if valor <= 0 or valor > u["tokens"]:
            raise ValueError
    except (ValueError, TypeError):
        await update.message.reply_text("⚠️ Valor inválido ou acima do saldo. Digite outro:")
        return ASK_VALOR
    context.user_data["valor"] = valor
    await update.message.reply_text(
        "📈 Escolha a direção:\n\n"
        "• COMPRAR — aposta que o preço sobe\n"
        "• VENDER — aposta que o preço cai\n\n"
        "Digite COMPRAR ou VENDER:"
    )
    return ASK_DIRECAO

async def manual_direcao(update: Update, context: ContextTypes.DEFAULT_TYPE):
    direcao = update.message.text.strip().upper()
    if direcao not in ("COMPRAR", "VENDER"):
        await update.message.reply_text("⚠️ Digite apenas COMPRAR ou VENDER:")
        return ASK_DIRECAO

    uid = str(update.effective_user.id)
    usuarios = carregar()
    u = usuarios[uid]
    valor = context.user_data["valor"]
    preco = preco_btc()

    context.job_queue.run_once(
        fechar_trade, 20,
        data={"chat_id": update.effective_chat.id, "email": u["email"],
              "direcao": direcao, "valor": valor, "abertura": preco},
        name=f"trade_{uid}"
    )
    await update.message.reply_text(
        f"🔄 Trade aberto!\n"
        f"💰 Valor: {valor:.2f} tokens\n"
        f"📊 Direção: {direcao}\n"
        f"🎯 Preço de abertura: ${preco:,.2f}\n\n"
        f"⏳ Resultado em 20 segundos..."
    )
    return ConversationHandler.END

async def fechar_trade(context: ContextTypes.DEFAULT_TYPE):
    dados = context.job.data
    usuarios = carregar()
    u = next((x for x in usuarios.values() if x["email"] == dados["email"]), None)
    if not u:
        return

    novo_preco = preco_btc()
    subiu = novo_preco > dados["abertura"]
    ganhou = (dados["direcao"] == "COMPRAR" and subiu) or (dados["direcao"] == "VENDER" and not subiu)

    if ganhou:
        lucro = dados["valor"] * 0.05
        u["tokens"] += dados["valor"] + lucro
        u["vitorias"] += 1
        resultado = f"✅ VOCÊ GANHOU! +{lucro:.2f} tokens"
    else:
        u["tokens"] -= dados["valor"]
        resultado = f"❌ PERDEU. -{dados['valor']:.2f} tokens"
    u["trades"] += 1
    salvar(usuarios)

    await context.bot.send_message(
        chat_id=dados["chat_id"],
        text=(f"{resultado}\n"
              f"📉 Preço de fechamento: ${novo_preco:,.2f}\n"
              f"💎 Novo saldo: {u['tokens']:.2f} tokens")
    )

async def autotrade(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = str(update.effective_user.id)
    usuarios = carregar()
    u = usuarios.get(uid)
    if not u:
        await update.callback_query.answer("Registre-se com /start")
        return

    nome_job = f"auto_{uid}"
    jobs = [j.name for j in context.job_queue.jobs()]
    if nome_job in jobs:
        context.job_queue.get_jobs_by_name(nome_job)[0].schedule_removal()
        u["autotrade"] = False
        msg = "⏸️ Autotrading DESLIGADO."
    else:
        u["autotrade"] = True
        context.job_queue.run_repeating(
            ciclo_autotrade, 300, first=10,
            data={"chat_id": update.effective_chat.id, "email": u["email"]},
            name=nome_job
        )
        msg = "🤖 Autotrading LIGADO! Uma operação simulada a cada 5 minutos."
    salvar(usuarios)
    await update.callback_query.answer()
    await update.callback_query.edit_message_text(msg + "\n\n↩️ Voltar:", reply_markup=voltar_markup())

async def ciclo_autotrade(context: ContextTypes.DEFAULT_TYPE):
    dados = context.job.data
    usuarios = carregar()
    u = next((x for x in usuarios.values() if x["email"] == dados["email"]), None)
    if not u:
        return
    valor = u["tokens"] * u["risco"]
    direcao = random.choice(["COMPRAR", "VENDER"])
    salvar(usuarios)
    context.job_queue.run_once(
        fechar_trade, 20,
        data={"chat_id": dados["chat_id"], "email": u["email"],
              "direcao": direcao, "valor": valor, "abertura": preco_btc()},
        name=f"trade_{u['email']}_{datetime.now().timestamp()}"
    )
    await context.bot.send_message(
        chat_id=dados["chat_id"],
        text=f"🤖 Autotrade abriu {direcao} de {valor:.2f} tokens. Resultado em 20s..."
    )

async def ver_conta(update: Update, context: ContextTypes.DEFAULT_TYPE):
    usuarios = carregar()
    u = usuarios.get(str(update.effective_user.id))
    if not u:
        await update.callback_query.answer("Registre-se com /start")
        return
    await update.callback_query.edit_message_text(
        f"💼 *Minha Conta*\n\n"
        f"📧 E-mail: `{u['email']}`\n"
        f"🔒 Senha: `{u['senha']}`\n"
        f"💎 Tokens: {u['tokens']:.2f}\n"
        f"📊 Trades: {u['trades']} (vitórias: {u['vitorias']})\n"
        f"🤖 Autotrade: {'LIGADO' if u['autotrade'] else 'desligado'}\n"
        f"📅 Registro: {u['registro'][:10]}",
        parse_mode="Markdown", reply_markup=voltar_markup()
    )

async def ver_tokens(update: Update, context: ContextTypes.DEFAULT_TYPE):
    usuarios = carregar()
    u = usuarios.get(str(update.effective_user.id))
    if not u:
        await update.callback_query.answer("Registre-se com /start")
        return
    await update.callback_query.edit_message_text(
        f"💎 *Tokens: {u['tokens']:.2f}*\n\n"
        f"Tokens são fictícios (modo demo). Ganhe mais:\n"
        f"• 👥 Convide amigos: +5 tokens por convite\n"
        f"• ✅ Ganhe trades no modo manual/autotrade\n"
        f"• 💰 Acesse a página de depósito: +5 tokens",
        parse_mode="Markdown", reply_markup=voltar_markup()
    )

async def ver_faq(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.callback_query.edit_message_text(
        "❓ *FAQ*\n\n"
        "Q: Este bot opera com dinheiro real?\n"
        "A: NÃO. É um simulador educativo. Os tokens são fictícios.\n\n"
        "Q: Os preços são reais?\n"
        "A: Sim! Os preços de BTC/USDT vêm da Binance (API pública).\n\n"
        "Q: Como opero com dinheiro real?\n"
        "A: Pelo botão 💰 Depositar você é direcionado para corretoras parceiras. "
        "O depósito é feito lá, nunca no bot.",
        parse_mode="Markdown", reply_markup=voltar_markup()
    )

async def ver_suporte(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.callback_query.edit_message_text(
        "🛟 *Suporte*\n\n"
        "Este é um simulador demo.\n"
        "Para dúvidas, fale com o administrador.",
        parse_mode="Markdown", reply_markup=voltar_markup()
    )

async def ver_amigos(update: Update, context: ContextTypes.DEFAULT_TYPE):
    usuarios = carregar()
    uid = str(update.effective_user.id)
    u = usuarios.get(uid)
    convidados = sum(1 for x in usuarios.values() if x.get("convidado_por") == uid)
    link = f"https://t.me/{BOT_USERNAME}?start=ref{uid}"
    await update.callback_query.edit_message_text(
        f"👥 *Amigos*\n\n"
        f"Convidados: {convidados}\n"
        f"Bónus: +5 tokens por convite que se registrar\n\n"
        f"🔗 Seu link:\n`{link}`",
        parse_mode="Markdown", reply_markup=voltar_markup()
    )

async def ver_ajustes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    usuarios = carregar()
    u = usuarios.get(str(update.effective_user.id))
    if not u:
        await update.callback_query.answer("Registre-se com /start")
        return
    await update.callback_query.edit_message_text(
        f"⚙️ *Ajustes*\n\n"
        f"Risco por operação (autotrade): {int(u['risco']*100)}% do saldo",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("10%", callback_data="risco10"),
             InlineKeyboardButton("25%", callback_data="risco25"),
             InlineKeyboardButton("50%", callback_data="risco50")],
            [InlineKeyboardButton("↩️ Menu", callback_data="menu")],
        ])
    )

async def set_risco(update: Update, context: ContextTypes.DEFAULT_TYPE):
    pct = update.callback_query.data.replace("risco", "")
    usuarios = carregar()
    u = usuarios.get(str(update.effective_user.id))
    if u:
        u["risco"] = int(pct) / 100
        salvar(usuarios)
    await update.callback_query.answer(f"Risco definido: {pct}%")
    await ver_ajustes(update, context)

async def ver_real(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.callback_query.edit_message_text(
        "🟢 *Modo Real*\n\n"
        "Este bot é um simulador 100% demo.\n\n"
        "Para operar com dinheiro real de forma legal, use uma corretora real "
        "(veja o botão 💰 Depositar) e opere por lá.\n"
        "⚠️ Nenhum depósito é feito através deste bot.",
        parse_mode="Markdown", reply_markup=voltar_markup()
    )

# ========== MAIN ==========
async def erro_global(update, context):
    print(f"ERRO: {context.error}")
    try:
        await context.bot.send_message(
            chat_id=int(os.getenv("TELEGRAM_CHAT_ID")),
            text=f"⚠️ Erro no bot:\n{context.error}"
        )
    except Exception:
        pass
def main():
    app = Application.builder().token(TOKEN).build()

    registro = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={ASK_EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, receber_email)]},
        fallbacks=[CommandHandler("cancelar", lambda u, c: ConversationHandler.END)],
    )

    manual = ConversationHandler(
        entry_points=[CallbackQueryHandler(manual_inicio, pattern="^manual$")],
        states={
            ASK_VALOR:  [MessageHandler(filters.TEXT & ~filters.COMMAND, manual_valor)],
            ASK_DIRECAO: [MessageHandler(filters.TEXT & ~filters.COMMAND, manual_direcao)],
        },
        fallbacks=[CommandHandler("cancelar", lambda u, c: ConversationHandler.END),
                   CallbackQueryHandler(mostrar_menu, pattern="^menu$")],
    )

    app.add_handler(registro)
    app.add_handler(manual)
    app.add_handler(CallbackQueryHandler(mostrar_menu, pattern="^menu$"))
    app.add_handler(CallbackQueryHandler(depositar, pattern="^depositar$"))
    app.add_handler(CallbackQueryHandler(autotrade, pattern="^autotrade$"))
    app.add_handler(CallbackQueryHandler(ver_conta, pattern="^conta$"))
    app.add_handler(CallbackQueryHandler(ver_tokens, pattern="^tokens$"))
    app.add_handler(CallbackQueryHandler(ver_faq, pattern="^faq$"))
    app.add_handler(CallbackQueryHandler(ver_suporte, pattern="^suporte$"))
    app.add_handler(CallbackQueryHandler(ver_amigos, pattern="^amigos$"))
    app.add_handler(CallbackQueryHandler(ver_ajustes, pattern="^ajustes$"))
    app.add_handler(CallbackQueryHandler(ver_real, pattern="^real$"))
    app.add_handler(CallbackQueryHandler(set_risco, pattern="^risco"))

    print("🤖 Bot demo rodando...")
    app.run_polling()

if __name__ == "__main__":
    main()

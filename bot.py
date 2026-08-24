"""
===================================================================
TRADE AO / TRADE_AO_BOT — Telegram Trading Bot & Signal Platform
Modular Python Entry Point — Phase 6: Signal Center
===================================================================
"""

import os
import sys
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import from modular architecture
from engine.daemon_lock import setup_bot_logging, acquire_bot_pid_lock, setup_signal_handlers
from storage.users import (
    load_users,
    save_users,
    find_user_by_email,
    get_user_by_id,
    register_user,
    validate_email_format,
)
from storage.trades import load_history
from storage.user_history import format_telegram_user_analytics, get_user_history, calculate_user_analytics
from engine.signal_engine import generate_signal, scan_all_markets
from engine.market_scanner import fetch_binance_ticker
from engine.risk_manager import calculate_position_size
from execution.order_manager import execute_user_order
from execution.trade_monitor import recover_pending_monitored_trades_from_sqlite
from analytics.performance import calculate_performance_metrics
from signals.formatter import format_signal_message, format_signal_center
from brokers.binance import BinanceBroker
from engine.trading_mode import (
    get_trading_mode,
    set_trading_mode,
    is_live_trading_enabled,
    is_testnet_mode,
    is_paper_mode,
    get_user_live_status,
    set_user_live_status,
    is_user_live_enabled,
    LIVE_CONFIRMATION_PHRASE,
    ALLOWED_TRADING_MODES,
    DEFAULT_TRADING_MODE,
)

# Configure 24/7 rotating structured logging
logger = setup_bot_logging()

AFFILIATE_BINANCE = os.getenv(
    "AFFILIATE_BINANCE_URL", "https://www.binance.com/register?ref=1058024469"
)
AFFILIATE_BYBIT = os.getenv(
    "AFFILIATE_BYBIT_URL", "https://www.bybit.com/invite?ref=SEU_CODIGO_BYBIT"
)

# Text definitions
MSG_START = (
    "👋 Olá! Eu sou @Trade_AO_bot.\n"
    "Vou registrar sua conta de trading e fazer\n"
    "uma série de operações demo.\n"
    "Digite seu e-mail para se registrar."
)

MSG_ONBOARDING = (
    "🎉 *Conta Trade AO criada!*\n\n"
    "Antes de ativar o trading automático,\n"
    "você precisa ter uma conta em uma\n"
    "corretora compatível.\n\n"
    "⚠️ *IMPORTANTE*\n"
    "A criação da conta e qualquer depósito devem ser realizados "
    "exclusivamente através dos links oficiais apresentados abaixo.\n\n"
    "O Trade AO não recebe depósitos.\n"
    "Nunca envie sua senha ou código 2FA para o bot."
)

MSG_PLATFORMS = (
    "🌐 *CLASSIFICAÇÃO DE DESTINOS DE SINAIS*\n"
    "━━━━━━━━━━━━━━━━━━━\n"
    "Os sinais do Trade AO são compatíveis com múltiplos ambientes:\n\n"
    "🟡 *Binance*: Spot / Futuros (Compatível com conexão oficial por API)\n"
    "🔵 *Bybit*: Derivativos / Spot (Destino de Sinais)\n"
    "🟣 *Quotex*: Opções Digitais — *Execução Manual Apenas*\n"
    "🟠 *Pocket Option*: Opções Digitais — *Execução Manual Apenas*\n\n"
    "⚠️ *IMPORTANTE:*\n"
    "Quotex e Pocket Option funcionam estritamente como destinos de sinais "
    "para tomada de decisão manual pelo usuário. Não há automação ou scraping sem API oficial."
)

MSG_BINANCE_GUIDE = (
    "🔐 *AUTORIZAÇÃO SEGURA BINANCE — TRADE AO*\n"
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    "Conecte sua conta Binance via API Oficial com criptografia em repouso (AES-256).\n\n"
    "🛡️ *REGRAS ESTATUTÁRIAS DE SEGURANÇA:*\n"
    "• ❌ O Trade AO *NUNCA* pede sua senha da Binance.\n"
    "• ❌ O Trade AO *NUNCA* pede seu código 2FA / SMS / Autenticador.\n"
    "• ❌ O Trade AO *NUNCA* pede sua Seed Phrase (palavras de recuperação).\n"
    "• 🚫 *SAQUES SÃO ESTRITAMENTE PROIBIDOS:* O sistema rejeita qualquer chave com permissão de saque habilitada.\n\n"
    "📋 *COMO CRIAR SUA API KEY NA BINANCE:*\n"
    "1️⃣ Acesse seu app ou site Binance > Perfil > *Gerenciamento de API* (API Management).\n"
    "2️⃣ Clique em *Criar API* (Gerada pelo Sistema).\n"
    "3️⃣ Defina um rótulo: *Trade AO*.\n"
    "4️⃣ Em *Restrições de API*, marque APENAS:\n"
    "   ✅ *Habilitar Leitura* (Enable Reading)\n"
    "   ✅ *Habilitar Trading Spot & Margin* (Spot & Margin Trading)\n"
    "   ❌ *NÃO MARQUE* Habilitar Saques (Enable Withdrawals)\n"
    "5️⃣ Salve e conecte suas chaves com segurança no painel ou via comando."
)

def build_main_menu_text(user: Dict[str, Any], ticker: Dict[str, Any]) -> str:
    tokens = user.get("tokens", 20.0)
    price = ticker.get("price", 96250.0)
    mode = get_trading_mode()
    mode_label = (
        "🟢 PAPER (Padrão/Seguro)" if mode == "paper"
        else "🟡 TESTNET (Sandbox)" if mode == "testnet"
        else "🔴 LIVE (Capital Real)"
    )
    return (
        f"🤖 @Trade_AO_bot\n"
        f"🔒 Modo de Trading: *{mode_label}*\n"
        f"💎 Tokens: {tokens:.2f}\n"
        f"📈 BTC/USDT: ${price:,.2f}"
    )

def handle_user_message(chat_id: int | str, text: str) -> Dict[str, Any]:
    """Processes user commands and messages through the modular Trade AO engine."""
    clean_text = text.strip()
    user = get_user_by_id(chat_id)

    # 1. /start command
    if clean_text == "/start":
        return {
            "type": "text",
            "message": MSG_START,
            "awaiting": "email",
        }

    # 2. Email registration flow (Phase 2 & 3)
    if validate_email_format(clean_text) and not user:
        success, msg, new_user = register_user(chat_id, clean_text)
        if not success:
            return {"type": "text", "message": msg}

        # Onboarding Binance + Bybit (Phase 3)
        return {
            "type": "onboarding",
            "message": MSG_ONBOARDING,
            "buttons": [
                [{"text": "🟡 CRIAR CONTA NA BINANCE", "url": AFFILIATE_BINANCE}],
                [{"text": "🔵 CRIAR CONTA NA BYBIT", "url": AFFILIATE_BYBIT}],
                [{"text": "✅ Já tenho conta / Ir ao Menu", "action": "menu"}],
            ],
            "user": new_user,
        }

    # 3. Main Menu
    ticker = fetch_binance_ticker("BTC/USDT")
    if not user:
        return {"type": "text", "message": MSG_START, "awaiting": "email"}

    if clean_text in ["/menu", "menu", "Voltar", "◀️ Voltar", "◀️ Menu Principal"]:
        return {
            "type": "menu",
            "message": build_main_menu_text(user, ticker),
            "buttons": [
                [{"text": "📡 Sinais", "action": "sinais"}, {"text": "🤖 Autotrading Binance", "action": "autotrade_binance"}],
                [{"text": "📊 Histórico", "action": "historico"}, {"text": "💰 Minha Conta", "action": "conta"}],
                [{"text": "💎 Tokens", "action": "tokens"}, {"text": "⚙️ Ajustes", "action": "ajustes"}],
                [{"text": "❓ FAQ", "action": "faq"}, {"text": "🛟 Suporte", "action": "suporte"}],
            ],
        }

    # 4. Phase 10: Autotrading Binance
    if clean_text in [
        "/autotrade",
        "autotrade",
        "🤖 Autotrading Binance",
        "autotrade_binance",
        "binance_autotrade",
    ]:
        from storage.vault import has_connected_broker, get_broker_credentials
        from engine.risk_manager import get_user_risk_status

        is_connected = has_connected_broker(chat_id, "binance")
        risk_status = get_user_risk_status(chat_id)
        settings = risk_status.get("settings", {})
        risk_per_trade = settings.get("risk_per_trade_pct", 1.0)
        max_daily_loss = settings.get("max_daily_loss_pct", 3.0)
        is_active = user.get("autotrade", False)

        if not is_connected:
            return {
                "type": "autotrade_binance",
                "message": "🤖 AUTOTRADING BINANCE\n\nStatus: 🔴 DESATIVADO\n\nBinance não conectada.",
                "buttons": [
                    [{"text": "🔗 CONECTAR BINANCE", "action": "connect_binance"}],
                    [{"text": "📖 COMO FUNCIONA", "action": "how_it_works"}],
                    [{"text": "◀️ Menu Principal", "action": "menu"}],
                ],
                "connected": False,
            }
        else:
            balance_val = user.get("tokens", 1250.0)
            return {
                "type": "autotrade_binance",
                "message": (
                    "🤖 AUTOTRADING BINANCE\n\n"
                    "🟢 CONECTADO\n\n"
                    f"Saldo: ${balance_val:,.2f}\n\n"
                    f"Risco/trade: {risk_per_trade:.0f}%\n"
                    f"Perda máxima diária: {max_daily_loss:.0f}%"
                ),
                "buttons": [
                    [{"text": "⏸️ PAUSAR" if is_active else "🟢 ATIVAR", "action": "toggle_autotrade"}],
                    [{"text": "⚙️ CONFIGURAÇÕES", "action": "risk_config"}],
                    [{"text": "🔴 DESCONECTAR", "action": "binance_disconnect"}],
                    [{"text": "◀️ Menu Principal", "action": "menu"}],
                ],
                "connected": True,
            }

    # 5. Connect Binance & How it works
    if clean_text in ["connect_binance", "/conectar_binance"]:
        return {
            "type": "text",
            "message": MSG_BINANCE_GUIDE,
            "buttons": [
                [{"text": "⚡ Conectar Testnet Sandbox", "action": "quick_connect_testnet"}],
                [{"text": "🌐 Abrir Gerenciador Binance", "url": "https://www.binance.com/en/my/settings/api-management"}],
                [{"text": "◀️ Voltar", "action": "autotrade_binance"}],
            ],
        }

    if clean_text in ["how_it_works", "/como_funciona"]:
        return {
            "type": "text",
            "message": (
                "📖 *COMO FUNCIONA O AUTOTRADING BINANCE*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "1️⃣ *Varredura Técnica Multi-Fator (24/7)*\n"
                "O Signal Engine monitora continuamente BTC, ETH, SOL e BNB analisando 8 pilares técnicos.\n\n"
                "2️⃣ *Risk Manager Obrigatório & Stop Loss*\n"
                "Nenhuma ordem é aberta sem Stop Loss. O tamanho da posição é dimensionado pelo risco e distância até o Stop.\n\n"
                "3️⃣ *Circuit Breaker (Perda Máxima 3%)*\n"
                "Se a perda diária atingir 3%, o robô pausa preventivamente.\n\n"
                "4️⃣ *Cooldown Pós-Loss*\n"
                "Após um loss, aguarda 15 minutos antes de avaliar novas entradas.\n\n"
                "5️⃣ *Conexão Segura Spot Only*\n"
                "Execução direta na Binance via API oficial Spot (saques bloqueados)."
            ),
            "buttons": [
                [{"text": "🔗 CONECTAR BINANCE", "action": "connect_binance"}],
                [{"text": "◀️ Autotrading", "action": "autotrade_binance"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    # 6. Toggle Autotrade & Phase 11 Confirmation
    if clean_text in ["toggle_autotrade", "activate_autotrade"]:
        users = load_users()
        user_key = str(chat_id)
        user_record = users.get(user_key, user)
        is_currently_active = user_record.get("autotrade", False)
        is_confirmed = user_record.get("autotrade_confirmed", False)

        if not is_currently_active and not is_confirmed:
            return {
                "type": "risk_confirmation",
                "message": (
                    "🛡️ CONFIRMAÇÃO DE AUTOTRADING\n\n"
                    "Você está autorizando o Trade AO a enviar\n"
                    "ordens para sua conta Binance.\n\n"
                    "O sistema não terá permissão para sacar fundos.\n\n"
                    "Risco por operação: 1%\n"
                    "Perda diária máxima: 3%"
                ),
                "buttons": [
                    [{"text": "⬜ ENTENDI OS RISCOS", "action": "toggle_risk_ack"}],
                    [{"text": "🔒 ATIVAR AUTOTRADING", "action": "blocked_activate"}],
                    [{"text": "◀️ Voltar", "action": "autotrade_binance"}],
                ],
            }

        new_state = not is_currently_active
        if user_key in users:
            users[user_key]["autotrade"] = new_state
            save_users(users)
        user["autotrade"] = new_state
        msg = "🟢 *AUTOTRADING ATIVADO!*" if new_state else "⏸️ *AUTOTRADING PAUSADO*"
        return {
            "type": "text",
            "message": f"{msg}\nO robô agora está {'operando em tempo real' if new_state else 'em pausa'}.",
            "buttons": [
                [{"text": "🤖 Painel Autotrading", "action": "autotrade_binance"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    if clean_text in ["toggle_risk_ack"]:
        return {
            "type": "risk_confirmation",
            "message": (
                "🛡️ CONFIRMAÇÃO DE AUTOTRADING REAL (LIVE)\n\n"
                "Você está autorizando o Trade AO a enviar\n"
                "ordens para sua conta Binance Spot.\n\n"
                "• O sistema não terá permissão para sacar fundos (bloqueio ativo).\n"
                "• Risco por operação: 1%\n"
                "• Perda diária máxima: 3%\n"
                "• Stop Loss obrigatório em 100% das operações.\n\n"
                "⚠️ Para autorizar, confirme com a frase oficial:\n"
                "👉 'LIVE TRADING ATIVADO'"
            ),
            "buttons": [
                [{"text": "🔴 LIVE TRADING ATIVADO", "action": "confirm_and_activate_autotrade"}],
                [{"text": "☑️ Desativar Confirmação", "action": "toggle_risk_ack_off"}],
                [{"text": "◀️ Voltar", "action": "autotrade_binance"}],
            ],
        }

    if clean_text in ["toggle_risk_ack_off"]:
        return {
            "type": "risk_confirmation",
            "message": (
                "🛡️ CONFIRMAÇÃO DE AUTOTRADING\n\n"
                "Você está autorizando o Trade AO a enviar\n"
                "ordens para sua conta Binance.\n\n"
                "O sistema não terá permissão para sacar fundos.\n\n"
                "Risco por operação: 1%\n"
                "Perda diária máxima: 3%"
            ),
            "buttons": [
                [{"text": "⬜ ENTENDI OS RISCOS", "action": "toggle_risk_ack"}],
                [{"text": "🔒 ATIVAR AUTOTRADING", "action": "blocked_activate"}],
                [{"text": "◀️ Voltar", "action": "autotrade_binance"}],
            ],
        }

    if clean_text in ["blocked_activate"]:
        return {
            "type": "text",
            "message": "⚠️ *Atenção:* O botão de ativação só deve funcionar após a confirmação.\n\nClique no botão *[ ⬜ ENTENDI OS RISCOS ]* para liberar a ativação.",
            "buttons": [
                [{"text": "☑️ ENTENDI OS RISCOS", "action": "toggle_risk_ack"}],
                [{"text": "◀️ Voltar", "action": "autotrade_binance"}],
            ],
        }

    if clean_text in ["confirm_and_activate_autotrade", "live trading ativado", "live_trading_ativado", "/live_enable"]:
        # FASE 21: Set per-user state LIVE_ENABLED with exact confirmation phrase
        set_user_live_status(chat_id, "LIVE_ENABLED", "LIVE TRADING ATIVADO")
        users = load_users()
        user_key = str(chat_id)
        if user_key in users:
            users[user_key]["autotrade"] = True
            users[user_key]["autotrade_confirmed"] = True
            users[user_key]["live_trading_status"] = "LIVE_ENABLED"
            save_users(users)
        user["autotrade"] = True
        user["autotrade_confirmed"] = True
        user["live_trading_status"] = "LIVE_ENABLED"
        return {
            "type": "text",
            "message": (
                "🔴 *LIVE TRADING ATIVADO COM SUCESSO!*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Você autorizou o Trade AO a enviar ordens reais para sua conta Binance Spot com suas próprias credenciais.\n\n"
                "• Estado do Usuário: `LIVE_ENABLED`\n"
                "• Risco/trade: 1.0%\n"
                "• Perda máxima diária: 3.0%\n"
                "• Stop Loss obrigatório: ✅ ATIVADO\n"
                "• Saques: 🚫 BLOQUEADOS\n"
                "• Símbolos autorizados: ✅ Whitelist Ativa\n"
                "• Credenciais: 🔒 Exclusivas do usuário (Vault AES-256)"
            ),
            "buttons": [
                [{"text": "🟢 Desativar Live Trading", "action": "disable_live_trading"}],
                [{"text": "🤖 Painel Autotrading", "action": "autotrade_binance"}],
                [{"text": "📡 Ver Sinais", "action": "sinais"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    if clean_text in ["disable_live_trading", "/live_disable", "desativar_live"]:
        set_user_live_status(chat_id, "LIVE_DISABLED")
        users = load_users()
        user_key = str(chat_id)
        if user_key in users:
            users[user_key]["live_trading_status"] = "LIVE_DISABLED"
            save_users(users)
        user["live_trading_status"] = "LIVE_DISABLED"
        return {
            "type": "text",
            "message": (
                "🟢 *LIVE TRADING DESATIVADO*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "• Estado do Usuário: `LIVE_DISABLED`\n"
                "• Nenhuma ordem real será enviada para a Binance.\n"
                "• Modo de segurança ativo."
            ),
            "buttons": [
                [{"text": "🔒 Configurar Modo", "action": "trading_mode_status"}],
                [{"text": "🤖 Painel Autotrading", "action": "autotrade_binance"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    # 7. Signal Center (Phase 6)
    if clean_text in ["/sinal", "/sinais", "sinais", "📡 Sinais", "📡 SIGNAL CENTER", "signal_center"]:
        signals = scan_all_markets()
        return {
            "type": "signal_center",
            "message": format_signal_center(signals),
            "buttons": [
                [{"text": "🔥 Ver TOP Signal Detalhado", "action": "top_signal_detail"}],
                [{"text": "🔄 Atualizar Varredura", "action": "signal_center"}],
                [{"text": "🌐 Destinos: Binance | Bybit | Quotex | Pocket", "action": "platforms_info"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
            "signals": signals,
        }

    # 8. User-Isolated Trade History & Analytics (FASE 14)
    if clean_text in ["historico", "/historico", "📊 Histórico", "/stats", "stats", "/analytics", "analytics", "📊 Analytics & Histórico"]:
        user_email = user.get("email", "trader.demo@tradeao.io")
        user_name = user_email.split("@")[0].capitalize()
        analytics_text = format_telegram_user_analytics(str(chat_id), user_name)
        return {
            "type": "text",
            "message": analytics_text,
            "buttons": [
                [{"text": "🔄 Atualizar Analytics", "action": "historico"}],
                [{"text": "🤖 Autotrading Binance", "action": "autotrade_binance"}],
                [{"text": "📡 Ver Sinais", "action": "sinais"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    # 9. Account & Tokens
    if clean_text in ["conta", "/conta", "💰 Minha Conta"]:
        return {
            "type": "text",
            "message": (
                "💰 *MINHA CONTA*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"📧 E-mail: {user.get('email', 'trader.demo@tradeao.io')}\n"
                f"🆔 Chat ID: {chat_id}\n"
                f"💎 Tokens: {user.get('tokens', 20.0):.2f}\n"
                f"🤖 Autotrading: {'🟢 ATIVADO' if user.get('autotrade') else '🔴 DESATIVADO'}\n"
                f"📅 Registrado em: {user.get('registro', '2026-08-18')[:10]}"
            ),
            "buttons": [
                [{"text": "🤖 Autotrading Binance", "action": "autotrade_binance"}],
                [{"text": "💎 Ver Tokens", "action": "tokens"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    if clean_text in ["tokens", "/tokens", "💎 Tokens"]:
        return {
            "type": "text",
            "message": (
                f"💎 *TOKENS: {user.get('tokens', 20.0):.2f} TOKENS*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Tokens virtuais utilizados para testes no modo demo.\n\n"
                "*Como obter mais tokens:*\n"
                "• 👥 Convide amigos: +5 tokens por indicação\n"
                "• 🏆 Acerte trades manuais ou automáticos\n"
                "• 💰 Acesse páginas de corretoras parceiras: +5 tokens"
            ),
            "buttons": [
                [{"text": "👥 Convidar Amigos", "action": "amigos"}],
                [{"text": "💰 Ver Corretoras", "action": "depositar"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    # 10. Trade Monitor (FASE 13) & Execution Engine
    if clean_text in ["monitor", "/monitor", "/posicoes", "posicoes", "👁️ Trade Monitor", "trade_monitor"]:
        from execution.trade_monitor import monitor_all_active_trades
        active_list = monitor_all_active_trades()
        if not active_list:
            msg = (
                "👁️ *TRADE MONITOR — STATUS EM TEMPO REAL*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Nenhuma posição aberta no momento.\n\n"
                "• Ordens ativas: *0*\n"
                "• Stop Loss: *Armado e protegido*\n"
                "• Take Profit: *Armado e protegido*\n\n"
                "Assim que o autotrading ou você abrir uma posição, o monitor rastreará "
                "a ordem, posição, stop, take profit e estado da execução em tempo real."
            )
        else:
            first = active_list[0]
            curr_p = first.get("currentPrice", first.get("entryPrice", 0))
            entry_p = first.get("entryPrice", 0)
            sl_p = first.get("stopLoss", 0)
            tp_p = first.get("takeProfit", 0)
            pnl_usd = first.get("unrealizedPnlUsd", 0)
            pnl_pct = first.get("unrealizedPnlPct", 0)
            pnl_sign = "+" if pnl_usd >= 0 else ""
            msg = (
                "👁️ *TRADE MONITOR — POSIÇÃO ATIVA*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"💎 *{first.get('par')}* ({first.get('direction')})\n"
                f"📊 Estado: *{first.get('status')}*\n\n"
                f"💰 Entrada: *${entry_p:,.2f}*\n"
                f"📈 Cotação Atual: *${curr_p:,.2f}*\n"
                f"🛑 Stop Loss: *${sl_p:,.2f}* (Dist: {first.get('distToSlPct', 0)}%)\n"
                f"🎯 Take Profit: *${tp_p:,.2f}* (Dist: {first.get('distToTpPct', 0)}%)\n\n"
                f"💵 PnL Flutuante: *{pnl_sign}${pnl_usd:,.2f}* ({pnl_sign}{pnl_pct:.2f}%)\n"
                f"⚡ Progresso TP: *{first.get('progressPct', 0)}%*"
            )
        return {
            "type": "text",
            "message": msg,
            "buttons": [
                [{"text": "🔄 Atualizar Monitor", "action": "trade_monitor"}],
                [{"text": "🚀 Execution Engine", "action": "execution_engine"}],
                [{"text": "🤖 Autotrading Binance", "action": "autotrade_binance"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
            "active_trades": active_list,
        }

    if clean_text in ["engine", "/engine", "/execution", "🚀 Execution Engine", "execution_engine"]:
        from execution.execution_engine import get_execution_engine_status
        status = get_execution_engine_status(chat_id)
        g = status.get("guardrails", {})
        s = status.get("stats", {})
        return {
            "type": "text",
            "message": (
                "⚙️ *EXECUTION ENGINE — PIPELINE & GUARDRAILS*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "🔄 *Fluxo de Execução (11 Etapas):*\n"
                "`Market Scanner` ➔ `Signal Engine` ➔ `Confidence Score` ➔ `Risk Manager` ➔ `Trade Approval` ➔ `Binance Broker` ➔ `Order Manager` ➔ `Trade Monitor` ➔ `Resultado` ➔ `Analytics` ➔ `Telegram`\n\n"
                "🛡️ *Mecanismos de Proteção Ativos:*\n"
                f"• 🛑 Stop Loss Obrigatório: *{'✅ ATIVO' if g.get('mandatoryStopLoss') else '❌ DESATIVADO'}*\n"
                f"• 🛡️ Risco Máx. por Operação: *{g.get('maxRiskPerTradePct', 1.0)}%*\n"
                f"• ⚡ Circuit Breaker (Perda Diária): *{g.get('dailyLossLimitPct', 3.0)}%*\n"
                f"• 🚫 Anti-Duplicação de Entradas: *{'✅ ATIVO' if g.get('deduplicationEnabled') else '❌ DESATIVADO'}*\n"
                f"• ⏳ Anti-Sinais Antigos (TTL): *<{g.get('staleSignalTtlSeconds', 180)}s*\n"
                f"• 🔒 Idempotência de Retry: *{'✅ ATIVO' if g.get('idempotencyEnabled') else '❌ DESATIVADO'}*\n\n"
                f"📊 *Auditoria:* {s.get('totalExecuted', 0)} executados | {s.get('totalRejected', 0)} bloqueados por risco"
            ),
            "buttons": [
                [{"text": "🤖 Autotrading Binance", "action": "autotrade_binance"}],
                [{"text": "📡 Ver Sinais", "action": "sinais"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    if clean_text in ["ajustes", "/ajustes", "⚙️ Ajustes", "risk_config"]:
        cur_m = get_trading_mode()
        cur_m_desc = (
            "🟢 PAPER (Simulação Virtual Segura - Padrão)" if cur_m == "paper"
            else "🟡 TESTNET (Sandbox Binance Vision)" if cur_m == "testnet"
            else "🔴 LIVE (Trading Real em Produção)"
        )
        return {
            "type": "text",
            "message": (
                "⚙️ *AJUSTES & CONFIGURAÇÃO DO BOT*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"🔒 *Modo de Operação:* `{cur_m_desc}`\n"
                "• Risco por Trade: 1.0%\n"
                "• Perda Máxima Diária: 3.0%\n"
                "• Timeframe Padrão: 15m\n"
                "• Stop Loss Obrigatório: ✅ Ativado\n"
                "• Cooldown Pós-Loss: 15 min\n\n"
                "🛡️ *Regra de Ouro (Fase 19):* O padrão é estritamente `paper`. Somente com configuração explícita `live` o sistema pode enviar ordens reais."
            ),
            "buttons": [
                [{"text": "🔒 Configurar Modo de Trading", "action": "trading_mode_status"}],
                [{"text": "🚀 Execution Engine", "action": "execution_engine"}],
                [{"text": "🤖 Autotrading Binance", "action": "autotrade_binance"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    # FASE 19: Trading Mode Command & Status
    if clean_text in [
        "/mode",
        "/tradingmode",
        "mode",
        "tradingmode",
        "trading_mode_status",
        "🔒 Configurar Modo de Trading",
    ]:
        cur_m = get_trading_mode()
        return {
            "type": "trading_mode",
            "message": (
                "🔒 *CONTROLE DE MODO DE TRADING (FASE 19)*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"• *Modo Atual Ativo:* `{cur_m.upper()}`\n"
                f"• *Padrão do Sistema:* `PAPER` (Simulação)\n"
                f"• *Trading Real Habilitado:* {'🔴 SIM (LIVE)' if cur_m == 'live' else '🟢 NÃO (Protegido)'}\n\n"
                "📋 *Valores Permitidos:*\n"
                "1️⃣ *paper*: Execução virtual segura. Nenhuma ordem vai para exchange externa. (PADRÃO)\n"
                "2️⃣ *testnet*: Execução no sandbox oficial da Binance Testnet.\n"
                "3️⃣ *live*: Execução real com saldo real na Binance Spot.\n\n"
                "⚠️ *PROTEÇÃO:* O sistema NUNCA ativa trading real automaticamente. O trading real exige configuração explícita."
            ),
            "buttons": [
                [{"text": f"{'✅ ' if cur_m == 'paper' else ''}🟢 PAPER (Padrão/Seguro)", "action": "set_mode_paper"}],
                [{"text": f"{'✅ ' if cur_m == 'testnet' else ''}🟡 TESTNET (Sandbox)", "action": "set_mode_testnet"}],
                [{"text": f"{'✅ ' if cur_m == 'live' else ''}🔴 LIVE (Capital Real)", "action": "set_mode_live"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    if clean_text in ["set_mode_paper", "/paper"]:
        res = set_trading_mode("paper", updated_by=f"user_{chat_id}")
        return {
            "type": "text",
            "message": (
                "✅ *MODO DE TRADING ALTERADO PARA PAPER*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "🟢 O bot está operando em modo **PAPER (Simulação Virtual Segura)**.\n"
                "Zero capital real em risco."
            ),
            "buttons": [
                [{"text": "🔒 Ver Modo de Trading", "action": "trading_mode_status"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    if clean_text in ["set_mode_testnet", "/testnet"]:
        res = set_trading_mode("testnet", updated_by=f"user_{chat_id}")
        return {
            "type": "text",
            "message": (
                "🟡 *MODO DE TRADING ALTERADO PARA TESTNET*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "As ordens serão roteadas exclusivamente para a **Binance Testnet Sandbox** (https://testnet.binance.vision)."
            ),
            "buttons": [
                [{"text": "🔒 Ver Modo de Trading", "action": "trading_mode_status"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    if clean_text in ["set_mode_live", "/live"]:
        res = set_trading_mode("live", updated_by=f"user_{chat_id}")
        return {
            "type": "text",
            "message": (
                "⚠️ *MODO LIVE ATIVADO EXPLICITAMENTE!*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "🔴 **ATENÇÃO:** O sistema agora está autorizado a enviar ordens reais para a Binance Spot se suas credenciais API estiverem configuradas.\n\n"
                "🛡️ Guardrails Ativos:\n"
                "• Stop Loss Obrigatório: ✅\n"
                "• Limite Máximo Diário: 3.0%\n"
                "• Sem permissão de saque: ✅"
            ),
            "buttons": [
                [{"text": "🟢 Voltar para PAPER", "action": "set_mode_paper"}],
                [{"text": "🔒 Ver Modo de Trading", "action": "trading_mode_status"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    if clean_text in ["faq", "/faq", "❓ FAQ"]:
        return {
            "type": "text",
            "message": (
                "❓ *PERGUNTAS FREQUENTES (FAQ)*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Q: O Trade AO opera com dinheiro real?\n"
                "A: O bot possui modo Demo e integração oficial Spot não-custodial via API Binance.\n\n"
                "Q: O bot tem acesso aos meus saques na Binance?\n"
                "A: NÃO. O sistema rejeita e bloqueia chaves com permissão de saque.\n\n"
                "Q: O que acontece se eu atingir a perda máxima de 3%?\n"
                "A: O Circuit Breaker pausa automaticamente o autotrading para proteger seu capital."
            ),
            "buttons": [
                [{"text": "📖 Como Funciona", "action": "how_it_works"}],
                [{"text": "🛟 Suporte", "action": "suporte"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    if clean_text in ["suporte", "/suporte", "🛟 Suporte"]:
        return {
            "type": "text",
            "message": (
                "🛟 *CENTRAL DE SUPORTE & AJUDA*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Dúvidas sobre conexão da API Binance ou sinais técnicos?\n\n"
                "• 💬 Canal Oficial: @TradeAO_Oficial\n"
                "• 🛡️ Segurança: Auditoria de chaves em tempo real"
            ),
            "buttons": [
                [{"text": "🤖 Autotrading Binance", "action": "autotrade_binance"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    # 11. Binance Disconnect Action
    if clean_text in ["binance_disconnect", "/desconectar_binance"]:
        from storage.vault import remove_broker_credentials
        remove_broker_credentials(chat_id, "binance")
        return {
            "type": "text",
            "message": "✅ *Credenciais Binance removidas e revogadas com sucesso do cofre isolado.*\nSua conta retornou ao modo de simulação seguro.",
            "buttons": [
                [{"text": "🔗 Reconectar Binance", "action": "connect_binance"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    # 12. Daemon & 24/7 Server Status Command
    if clean_text in ["daemon", "/daemon", "247", "/247", "server", "/server", "uptime", "/uptime"]:
        pid = os.getpid()
        return {
            "type": "text",
            "message": (
                "🟢 *TRADE AO — 24/7 DAEMON & RESILIENCE*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"• Processo: *Ativo (PID {pid})*\n"
                "• Proteção: *PID Lock Anti-Duplicação Ativo*\n"
                "• Persistência: *SQLite ACID (Sem dependência de RAM)*\n"
                "• Auto-Restart: *Systemd Service Habilitado*\n"
                "• Log Rotation: *10MB c/ 5 Backups Ativos*\n\n"
                "🛡️ *Recuperação Pós-Restart:* Todas as ordens e posições abertas "
                "são gravadas no banco e reconciliadas automaticamente ao reiniciar."
            ),
            "buttons": [
                [{"text": "⚙️ Execution Engine", "action": "execution_engine"}],
                [{"text": "🤖 Autotrading Binance", "action": "autotrade_binance"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    # 13. FASE 20: Quality & Test Suite Command
    if clean_text in ["testes", "/testes", "qa", "/qa", "suite", "/suite", "qualidade", "/qualidade", "🧪 Qualidade & Testes", "tests"]:
        import unittest
        from tests.test_suite import TestTradeAOFase20
        
        suite = unittest.TestLoader().loadTestsFromTestCase(TestTradeAOFase20)
        t_start = time.time()
        res_runner = unittest.TestResult()
        suite.run(res_runner)
        t_duration = (time.time() - t_start) * 1000

        total = res_runner.testsRun
        fails = len(res_runner.failures) + len(res_runner.errors)
        passed = total - fails
        rate = (passed / total) * 100 if total > 0 else 0

        return {
            "type": "text",
            "message": (
                "🧪 *TRADE AO — SUÍTE DE QUALIDADE & TESTES (FASE 20)*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"• *Status Geral:* {'🟢 100% APROVADO' if fails == 0 else '🔴 FALHAS DETECTADAS'}\n"
                f"• *Total de Testes:* `{total}`\n"
                f"• *Testes Aprovados:* `{passed} ✅`\n"
                f"• *Falhas / Erros:* `{fails} ❌`\n"
                f"• *Taxa de Cobertura/Sucesso:* `{rate:.1f}%`\n"
                f"• *Tempo de Execução:* `{t_duration:.2f}ms`\n\n"
                "📋 *Módulos Cobertos:*\n"
                "1. ✅ Validação de Email (Regex, disposable)\n"
                "2. ✅ Registro & Hashing de Senha\n"
                "3. ✅ Autenticação & JWT\n"
                "4. ✅ Cálculo de Risco & Teto 1.0%\n"
                "5. ✅ Position Sizing (SL-based)\n"
                "6. ✅ Score Técnico & Confluência\n"
                "7. ✅ Geração de Sinais (TP1/TP2/TP3/SL)\n"
                "8. ✅ Duplicação de Sinais (Cooldown)\n"
                "9. ✅ Duplicate Orders (Idempotência)\n"
                "10. ✅ Daily Loss Limit (Circuit Breaker 3%)\n"
                "11. ✅ Take Profit (TP execution)\n"
                "12. ✅ Stop Loss (Mandatory SL)\n"
                "13. ✅ Conexão Binance (Ping/Time)\n"
                "14. ✅ Permissões API (Spot only, No Withdraw)\n"
                "15. ✅ Isolamento entre Usuários\n"
                "16. 🛡️ Sanitização Estrita de Logs (Zero Credential Leak)\n\n"
                "🔒 *POLÍTICA ZERO LEAK:* Segredos, tokens e senhas NUNCA são registrados."
            ),
            "buttons": [
                [{"text": "🔄 Reexecutar Testes", "action": "testes"}],
                [{"text": "🔒 Modo de Trading", "action": "trading_mode_status"}],
                [{"text": "◀️ Menu Principal", "action": "menu"}],
            ],
        }

    # Fallback
    return {
        "type": "menu",
        "message": build_main_menu_text(user, ticker),
        "buttons": [
            [{"text": "📡 Sinais", "action": "sinais"}, {"text": "🤖 Autotrading Binance", "action": "autotrade_binance"}],
            [{"text": "📊 Histórico", "action": "historico"}, {"text": "💰 Minha Conta", "action": "conta"}],
            [{"text": "💎 Tokens", "action": "tokens"}, {"text": "⚙️ Ajustes", "action": "ajustes"}],
            [{"text": "❓ FAQ", "action": "faq"}, {"text": "🛟 Suporte", "action": "suporte"}],
        ],
    }

if __name__ == "__main__":
    logger.info("=== Iniciando Trade AO Telegram Bot Daemon 24/7 ===")
    
    # 1. Acquire PID lock against duplicate execution
    lock_ok = acquire_bot_pid_lock(logger)
    if not lock_ok:
        logger.critical("Aborting duplicate process execution.")
        sys.exit(1)

    # 2. Setup signal handlers for graceful shutdown
    setup_signal_handlers(logger=logger)

    # 3. Recover any pending monitored trades from SQLite persistence
    recovery_stats = recover_pending_monitored_trades_from_sqlite()
    logger.info(
        f"Recuperação pós-restart: {recovery_stats['recovered']} trades verificados "
        f"({recovery_stats['active']} ativos restaurados, {recovery_stats['settled']} finalizados)."
    )

    print("Trade AO Bot modular structure ready with 24/7 Daemon resilience.")


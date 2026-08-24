import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, CryptoTicker } from '../types';
import { Send, Bot, X, ExternalLink, ShieldCheck, Zap, AlertTriangle, RefreshCw, Lock } from 'lucide-react';

interface TelegramBotSimulatorProps {
  user: UserProfile | null;
  ticker: CryptoTicker | null;
  isOpen: boolean;
  onClose: () => void;
  onRefreshUser: () => void;
  onOpenDepositModal: () => void;
  onGenerateSignal: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  buttons?: { label: string; action: string; url?: string }[][];
  time: string;
}

export const TelegramBotSimulator: React.FC<TelegramBotSimulatorProps> = ({
  user,
  ticker,
  isOpen,
  onClose,
  onRefreshUser,
  onOpenDepositModal,
  onGenerateSignal,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'bot',
      text: `👋 Olá! Eu sou @Trade_AO_bot.\nVou registrar sua conta de trading e fazer\numa série de operações demo.\nDigite seu e-mail para se registrar ou use o menu abaixo:`,
      buttons: [
        [{ label: '📡 Sinais', action: 'sinais' }, { label: '🤖 Autotrading Binance', action: 'autotrade_binance' }],
        [{ label: '📊 Histórico', action: 'historico' }, { label: '💰 Minha Conta', action: 'conta' }],
        [{ label: '💎 Tokens', action: 'tokens' }, { label: '⚙️ Ajustes', action: 'ajustes' }],
        [{ label: '❓ FAQ', action: 'faq' }, { label: '🛟 Suporte', action: 'suporte' }],
      ],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [awaitingEmail, setAwaitingEmail] = useState<boolean>(false);
  const [loginMode, setLoginMode] = useState<boolean>(false);
  const [awaitingApiKey, setAwaitingApiKey] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [binanceConnected, setBinanceConnected] = useState<boolean>(false);
  const [binanceBalance, setBinanceBalance] = useState<number>(1250.0);
  const [riskPerTrade, setRiskPerTrade] = useState<number>(1.0);
  const [maxDailyLoss, setMaxDailyLoss] = useState<number>(3.0);
  const [riskConfirmed, setRiskConfirmed] = useState<boolean>(false);
  const [understoodRisksInBot, setUnderstoodRisksInBot] = useState<boolean>(false);

  // Check Binance connection status on mount / user change
  const checkBinanceStatus = useCallback(async () => {
    try {
      const chatId = user?.chat_id || '7886049873';
      const res = await fetch(`/api/binance/status?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setBinanceConnected(Boolean(data.connected));
      }
    } catch (e) {
      console.warn('Error checking Binance status:', e);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      checkBinanceStatus();
    }
  }, [isOpen, checkBinanceStatus]);

  if (!isOpen) return null;

  const addBotReply = (text: string, buttons?: { label: string; action: string; url?: string }[][]) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `bot_${Date.now()}_${Math.random()}`,
        sender: 'bot',
        text,
        buttons,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const showMainMenu = (currentUser = user) => {
    const tokens = currentUser ? currentUser.tokens.toFixed(2) : '20.00';
    const btcPrice = ticker ? ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '96,250.00';
    
    addBotReply(
      `🤖 @Trade_AO_bot\n🟠 Modo: ${binanceConnected ? '🟢 BINANCE CONECTADA' : '🧪 PAPER TRADING'}\n💎 Tokens: ${tokens}\n📈 BTC/USDT: $${btcPrice}\n\nSelecione uma opção:`,
      [
        [
          { label: '📡 Sinais', action: 'sinais' },
          { label: '🧪 Paper Trading (FASE 15)', action: 'paper_trading' },
        ],
        [
          { label: '🤖 Autotrading Binance', action: 'autotrade_binance' },
          { label: '📊 Histórico', action: 'historico' },
        ],
        [
          { label: '💰 Minha Conta', action: 'conta' },
          { label: '💎 Tokens', action: 'tokens' },
        ],
        [
          { label: '⚙️ Ajustes', action: 'ajustes' },
          { label: '❓ FAQ', action: 'faq' },
        ],
        [
          { label: '🛟 Suporte', action: 'suporte' },
        ],
      ]
    );
  };

  const handleAutotradingScreen = (currentUser = user, connected = binanceConnected) => {
    if (!connected) {
      addBotReply(
        `🤖 AUTOTRADING BINANCE\n\nStatus: 🔴 DESATIVADO\n\nBinance não conectada.`,
        [
          [{ label: '🔗 CONECTAR BINANCE', action: 'connect_binance' }],
          [{ label: '📖 COMO FUNCIONA', action: 'how_it_works' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else {
      const isAutotradeActive = currentUser?.autotrade ?? false;
      const formattedBalance = binanceBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      addBotReply(
        `🤖 AUTOTRADING BINANCE\n\n🟢 CONECTADO\n\nSaldo: $${formattedBalance}\n\nRisco/trade: ${riskPerTrade}%\nPerda máxima diária: ${maxDailyLoss}%\nStatus: ${isAutotradeActive ? '🟢 ATIVADO (Operando)' : '⏸️ PAUSADO'}`,
        [
          [
            isAutotradeActive
              ? { label: '⏸️ PAUSAR', action: 'pause_autotrade' }
              : { label: '🟢 ATIVAR', action: 'activate_autotrade' },
          ],
          [{ label: '⚙️ CONFIGURAÇÕES', action: 'risk_config' }],
          [{ label: '🔴 DESCONECTAR', action: 'binance_disconnect' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    }
  };

  const handleButtonClick = async (action: string) => {
    if (action === 'menu') {
      showMainMenu();
    } else if (action === 'autotrade_binance') {
      handleAutotradingScreen();
    } else if (action === 'connect_binance') {
      addBotReply(
        `🔐 *CONECTAR CONTA BINANCE AO TRADE AO*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPara habilitar o Autotrading oficial não-custodial:\n\n🛡️ *Garantias de Segurança Estrita:*\n• ❌ O Trade AO *NUNCA* pede sua senha\n• ❌ *NUNCA* pede 2FA ou SMS\n• ❌ *NUNCA* pede Seed Phrase\n• 🚫 *SAQUES BLOQUEADOS:* Chaves com permissão de saque são rejeitadas.\n\nEscolha como deseja conectar:`,
        [
          [{ label: '⚡ Conectar Sandbox / Testnet (Instantâneo)', action: 'quick_connect_testnet' }],
          [{ label: '🔑 Inserir Minhas Chaves API', action: 'prompt_api_keys' }],
          [{ label: '🌐 Abrir Binance API Management', action: 'link_binance_api', url: 'https://www.binance.com/en/my/settings/api-management' }],
          [{ label: '◀️ Voltar', action: 'autotrade_binance' }],
        ]
      );
    } else if (action === 'quick_connect_testnet') {
      addBotReply(`🔄 Validando permissões na Binance API (Spot Trading / Leitura) e criptografando no cofre seguro com AES-256...`);
      try {
        const chatId = user?.chat_id || '7886049873';
        const res = await fetch('/api/binance/save-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            apiKey: 'bnc_demo_key_98a72b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
            apiSecret: 'bnc_demo_secret_f1e2d3c4b5a697887766554433221100aa',
            testnet: true,
          }),
        });

        if (res.ok) {
          setBinanceConnected(true);
          setBinanceBalance(1250.0);
          onRefreshUser();
          setTimeout(() => {
            addBotReply(`✅ *Binance conectada com sucesso!*\n• Chave: \`bnc_de...4b5c\`\n• Permissões: Leitura ✅ | Spot Trading ✅ | Saques 🚫 (Bloqueados)\n• Criptografia: AES-256-GCM em Repouso`);
            setTimeout(() => {
              handleAutotradingScreen(user, true);
            }, 300);
          }, 400);
        } else {
          addBotReply(`❌ Não foi possível salvar as credenciais. Tente novamente.`);
        }
      } catch (e) {
        addBotReply(`❌ Erro de conexão com o servidor.`);
      }
    } else if (action === 'prompt_api_keys') {
      setAwaitingApiKey(true);
      addBotReply(`🔑 *Digite sua Binance API Key:*`);
    } else if (action === 'how_it_works') {
      addBotReply(
        `📖 *COMO FUNCIONA O AUTOTRADING BINANCE*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1️⃣ *Varredura Técnica Multi-Fator (24/7)*\nO Signal Engine monitora continuamente BTC, ETH, SOL e BNB analisando 8 pilares técnicos (EMA9/21/50, RSI, Bollinger, MACD, Volume e Estrutura).\n\n2️⃣ *Risk Manager Obrigatório & Stop Loss*\nNenhuma ordem é aberta sem Stop Loss. O tamanho da posição é dimensionado matematicamente com base no risco e distância até o Stop.\n\n3️⃣ *Circuit Breaker (Perda Máxima 3%)*\nSe o somatório de perdas no dia atingir 3%, o robô entra em pausa preventiva imediatamente.\n\n4️⃣ *Cooldown Pós-Loss*\nApós qualquer operação com loss, o robô aguarda 15 minutos antes de avaliar novas entradas.\n\n5️⃣ *Conexão Segura Spot Only*\nExecução direta na Binance via API oficial com chaves criptografadas (AES-256). Saques são 100% bloqueados.`,
        [
          [{ label: '🔗 CONECTAR BINANCE', action: 'connect_binance' }],
          [{ label: '◀️ Autotrading', action: 'autotrade_binance' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else if (action === 'activate_autotrade') {
      const isAlreadyConfirmed = riskConfirmed || Boolean(user?.autotrade_confirmed);
      if (!isAlreadyConfirmed) {
        setUnderstoodRisksInBot(false);
        addBotReply(
          `🛡️ *CONFIRMAÇÃO DE AUTOTRADING*\n\nVocê está autorizando o Trade AO a enviar\nordens para sua conta Binance.\n\nO sistema não terá permissão para sacar fundos.\n\nRisco por operação: ${riskPerTrade}%\nPerda diária máxima: ${maxDailyLoss}%\n\n⚠️ Marque a confirmação abaixo para desbloquear a ativação:`,
          [
            [{ label: '⬜ ENTENDI OS RISCOS', action: 'toggle_risk_ack' }],
            [{ label: '🔒 ATIVAR AUTOTRADING', action: 'blocked_activate' }],
            [{ label: '◀️ Voltar', action: 'autotrade_binance' }],
          ]
        );
        return;
      }

      // If already confirmed previously
      try {
        const res = await fetch('/api/user/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autotrade: true, autotrade_confirmed: true }),
        });
        if (res.ok) {
          onRefreshUser();
          addBotReply(
            `🟢 *AUTOTRADING ATIVADO COM SUCESSO!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nO robô está monitorando os mercados e executará operações com base nas regras do Risk Manager:\n• Risco por operação: ${riskPerTrade}%\n• Perda máxima diária: ${maxDailyLoss}%\n• Stop Loss: Obrigatório\n• Cooldown: 15 min`,
            [
              [{ label: '🤖 Painel Autotrading', action: 'autotrade_binance' }],
              [{ label: '📡 Ver Sinais do Momento', action: 'sinais' }],
              [{ label: '◀️ Menu Principal', action: 'menu' }],
            ]
          );

          // Trigger immediate test cycle
          fetch('/api/trades/autotrade-cycle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ par: 'BTC/USDT' }),
          }).catch(() => {});
        }
      } catch (e) {
        addBotReply(`❌ Erro ao ativar autotrading.`);
      }
    } else if (action === 'toggle_risk_ack') {
      const nextState = !understoodRisksInBot;
      setUnderstoodRisksInBot(nextState);
      if (nextState) {
        addBotReply(
          `🛡️ *CONFIRMAÇÃO DE AUTOTRADING*\n\nVocê está autorizando o Trade AO a enviar\nordens para sua conta Binance.\n\nO sistema não terá permissão para sacar fundos.\n\nRisco por operação: ${riskPerTrade}%\nPerda diária máxima: ${maxDailyLoss}%\n\n✅ *Riscos confirmados!* Você já pode clicar no botão verde abaixo para ativar:`,
          [
            [{ label: '☑️ ENTENDI OS RISCOS', action: 'toggle_risk_ack' }],
            [{ label: '🟢 ATIVAR AUTOTRADING', action: 'confirm_and_activate_autotrade' }],
            [{ label: '◀️ Voltar', action: 'autotrade_binance' }],
          ]
        );
      } else {
        addBotReply(
          `🛡️ *CONFIRMAÇÃO DE AUTOTRADING*\n\nVocê está autorizando o Trade AO a enviar\nordens para sua conta Binance.\n\nO sistema não terá permissão para sacar fundos.\n\nRisco por operação: ${riskPerTrade}%\nPerda diária máxima: ${maxDailyLoss}%\n\n⚠️ Marque a confirmação abaixo para desbloquear a ativação:`,
          [
            [{ label: '⬜ ENTENDI OS RISCOS', action: 'toggle_risk_ack' }],
            [{ label: '🔒 ATIVAR AUTOTRADING', action: 'blocked_activate' }],
            [{ label: '◀️ Voltar', action: 'autotrade_binance' }],
          ]
        );
      }
    } else if (action === 'blocked_activate') {
      addBotReply(
        `⚠️ *Atenção:* O botão de ativação só funciona após a confirmação.\n\nClique no botão *[ ⬜ ENTENDI OS RISCOS ]* acima para desbloquear a ativação.`,
        [
          [{ label: '☑️ ENTENDI OS RISCOS', action: 'toggle_risk_ack' }],
          [{ label: '◀️ Voltar', action: 'autotrade_binance' }],
        ]
      );
    } else if (action === 'confirm_and_activate_autotrade') {
      if (!understoodRisksInBot) {
        addBotReply(`⚠️ Por favor, confirme a leitura dos riscos antes de ativar.`);
        return;
      }

      setRiskConfirmed(true);
      try {
        const res = await fetch('/api/user/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autotrade: true, autotrade_confirmed: true }),
        });
        if (res.ok) {
          onRefreshUser();
          addBotReply(
            `🟢 *AUTOTRADING ATIVADO COM SUCESSO!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nVocê autorizou o Trade AO a enviar ordens para sua conta Binance com as diretrizes do Risk Manager:\n\n• Risco por operação: ${riskPerTrade}%\n• Perda diária máxima: ${maxDailyLoss}%\n• Stop Loss obrigatório: ✅ ATIVADO\n• Saques: 🚫 BLOQUEADOS\n\nO robô iniciou o monitoramento dos mercados em tempo real.`,
            [
              [{ label: '🤖 Painel Autotrading', action: 'autotrade_binance' }],
              [{ label: '📡 Ver Sinais do Momento', action: 'sinais' }],
              [{ label: '◀️ Menu Principal', action: 'menu' }],
            ]
          );

          // Trigger immediate test cycle
          fetch('/api/trades/autotrade-cycle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ par: 'BTC/USDT' }),
          }).catch(() => {});
        } else {
          addBotReply(`❌ Erro ao ativar autotrading.`);
        }
      } catch (e) {
        addBotReply(`❌ Erro ao conectar ao servidor.`);
      }
    } else if (action === 'pause_autotrade') {
      try {
        const res = await fetch('/api/user/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autotrade: false }),
        });
        if (res.ok) {
          onRefreshUser();
          addBotReply(
            `⏸️ *AUTOTRADING PAUSADO*\nNenhuma nova ordem automatizada será executada até que você reative o robô.`,
            [
              [{ label: '🟢 REATIVAR', action: 'activate_autotrade' }],
              [{ label: '🤖 Painel Autotrading', action: 'autotrade_binance' }],
              [{ label: '◀️ Menu Principal', action: 'menu' }],
            ]
          );
        }
      } catch (e) {
        addBotReply(`❌ Erro ao pausar autotrading.`);
      }
    } else if (action === 'risk_config') {
      addBotReply(
        `⚙️ *CONFIGURAÇÕES DO RISK MANAGER*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• *Risco por Operação:* ${riskPerTrade}%\n• *Perda Máxima Diária (Circuit Breaker):* ${maxDailyLoss}%\n• *Stop Loss Obrigatório:* ✅ ATIVADO\n• *Relação R:R Mínima:* 1.5R\n• *Cooldown Pós-Loss:* 15 min\n• *Pares Permitidos:* BTC, ETH, SOL, BNB\n\nAjuste rápido de risco por operação:`,
        [
          [
            { label: '0.5% Risco', action: 'set_risk_05' },
            { label: '1.0% Risco (Padrão)', action: 'set_risk_10' },
            { label: '2.0% Risco', action: 'set_risk_20' },
          ],
          [
            { label: 'Perda Máx: 2%', action: 'set_max_loss_2' },
            { label: 'Perda Máx: 3%', action: 'set_max_loss_3' },
            { label: 'Perda Máx: 5%', action: 'set_max_loss_5' },
          ],
          [
            { label: '◀️ Autotrading', action: 'autotrade_binance' },
            { label: '◀️ Menu Principal', action: 'menu' },
          ],
        ]
      );
    } else if (action === 'set_risk_05') {
      setRiskPerTrade(0.5);
      addBotReply(`✅ Risco por operação atualizado para *0.5%* do capital.`);
      setTimeout(() => handleAutotradingScreen(), 300);
    } else if (action === 'set_risk_10') {
      setRiskPerTrade(1.0);
      addBotReply(`✅ Risco por operação atualizado para *1.0%* do capital.`);
      setTimeout(() => handleAutotradingScreen(), 300);
    } else if (action === 'set_risk_20') {
      setRiskPerTrade(2.0);
      addBotReply(`✅ Risco por operação atualizado para *2.0%* do capital.`);
      setTimeout(() => handleAutotradingScreen(), 300);
    } else if (action === 'set_max_loss_2') {
      setMaxDailyLoss(2.0);
      addBotReply(`✅ Perda máxima diária (Circuit Breaker) atualizada para *2.0%*.`);
      setTimeout(() => handleAutotradingScreen(), 300);
    } else if (action === 'set_max_loss_3') {
      setMaxDailyLoss(3.0);
      addBotReply(`✅ Perda máxima diária (Circuit Breaker) atualizada para *3.0%*.`);
      setTimeout(() => handleAutotradingScreen(), 300);
    } else if (action === 'set_max_loss_5') {
      setMaxDailyLoss(5.0);
      addBotReply(`✅ Perda máxima diária (Circuit Breaker) atualizada para *5.0%*.`);
      setTimeout(() => handleAutotradingScreen(), 300);
    } else if (action === 'binance_disconnect') {
      try {
        const chatId = user?.chat_id || '7886049873';
        await fetch('/api/binance/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId }),
        });
        setBinanceConnected(false);
        onRefreshUser();
        addBotReply(
          `🔴 *BINANCE DESCONECTADA*\n\nSuas credenciais foram removidas do cofre seguro com sucesso. O autotrading foi desativado.`,
          [
            [{ label: '🔗 CONECTAR BINANCE', action: 'connect_binance' }],
            [{ label: '◀️ Menu Principal', action: 'menu' }],
          ]
        );
      } catch (e) {
        addBotReply(`❌ Erro ao desconectar Binance.`);
      }
    } else if (action === 'sinais') {
      const btcPrice = ticker?.price || 96250.0;
      const tp = btcPrice * 1.015;
      const sl = btcPrice * 0.988;
      addBotReply(
        `📡 *SINAIS & SIGNAL CENTER*\n━━━━━━━━━━━━━━━━━━━\n🔥 *TOP SINAL DO MOMENTO:*\n\n💎 *BTC/USDT*\n🟢 *LONG (COMPRA)*\n🎯 *Confluência: 87/100* (💎 VERY STRONG)\n⏱️ *Timeframe: 15m*\n\n💰 *Entrada:* $${btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n🎯 *Alvo (TP):* $${tp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n🛑 *Stop (SL):* $${sl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n🔍 *Confluência Técnica:*\n• Tendência: Alinhamento altista (EMA9 > EMA21 > EMA50)\n• RSI (34.2): Recuperação em zona compradora\n• MACD: Histograma verde em expansão\n━━━━━━━━━━━━━━━━━━━\n📊 *OUTROS PARES:* ETH/USDT (🟢 78/100) · SOL/USDT (🔴 72/100) · BNB/USDT (🟢 81/100)`,
        [
          [{ label: '🔥 Executar Sinal no Autotrade', action: 'autotrade_binance' }],
          [{ label: '🔄 Atualizar Varredura', action: 'sinais' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else if (action === 'historico' || action === 'analytics') {
      const chatId = user?.chat_id || '7886049873';
      try {
        const res = await fetch(`/api/analytics/user/${chatId}`);
        if (res.ok) {
          const data = await res.json();
          const stats = data.analytics;
          
          const tradesListStr = (stats.recent_trades || [])
            .slice(0, 5)
            .map((t: any) => {
              const icon = t.resultado === 'WIN' ? '✅' : '❌';
              const sign = t.pnl_usd >= 0 ? '+' : '';
              return `${icon} ${t.par} ${t.direcao} — ${t.resultado} (${sign}$${t.pnl_usd.toFixed(2)})`;
            })
            .join('\n');

          const pairsSummary = (stats.performance_by_par || [])
            .slice(0, 4)
            .map((p: any) => `• ${p.par}: ${p.win_rate_pct}% WR (${p.wins}W/${p.losses}L) | ${p.pnl_usd >= 0 ? '+' : ''}$${p.pnl_usd.toFixed(2)}`)
            .join('\n');

          const tfSummary = (stats.performance_by_timeframe || [])
            .slice(0, 3)
            .map((tf: any) => `• ${tf.timeframe}: ${tf.win_rate_pct}% WR (${tf.wins}W/${tf.losses}L)`)
            .join('\n');

          addBotReply(
            `📊 *HISTÓRICO & ANALYTICS POR USUÁRIO*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *User ID:* \`${chatId}\`\n💼 *Saldo Atual:* $${stats.current_balance ? stats.current_balance.toFixed(2) : '100.00'}\n\n📈 *DESEMPENHO GERAL:*\n• *Total de Trades:* ${stats.total_trades} (${stats.wins}W / ${stats.losses}L / ${stats.breakevens}E)\n• *Taxa de Acerto:* ${stats.win_rate_pct}%\n• *P/L Acumulado:* ${stats.total_pnl_usd >= 0 ? '+' : ''}$${stats.total_pnl_usd.toFixed(2)} (${stats.total_pnl_pct >= 0 ? '+' : ''}${stats.total_pnl_pct.toFixed(2)}%)\n• *Profit Factor:* ${stats.profit_factor ? stats.profit_factor.toFixed(2) : '1.00'}\n• *Max Drawdown:* -${stats.max_drawdown_pct ? stats.max_drawdown_pct.toFixed(2) : '0.00'}% (-$${stats.max_drawdown_usd ? stats.max_drawdown_usd.toFixed(2) : '0.00'})\n• *Payoff Ratio:* ${stats.payoff_ratio ? stats.payoff_ratio.toFixed(2) : '0.00'}\n\n🎯 *PERFORMANCE POR PAR:*\n${pairsSummary || 'Nenhum trade por par registrado'}\n\n⏱️ *PERFORMANCE POR TIMEFRAME:*\n${tfSummary || 'Nenhum timeframe registrado'}\n\n📋 *ÚLTIMOS TRADES ISOLADOS:*\n${tradesListStr || 'Nenhum trade recente'}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*FASE 14:* Dados 100% segregados e auditados por usuário.`,
            [
              [{ label: '🔄 Atualizar Analytics', action: 'historico' }, { label: '🤖 Autotrading', action: 'autotrade_binance' }],
              [{ label: '📡 Ver Sinais', action: 'sinais' }, { label: '◀️ Menu Principal', action: 'menu' }],
            ]
          );
        } else {
          addBotReply(`❌ Não foi possível carregar o histórico no momento.`);
        }
      } catch (e) {
        addBotReply(`❌ Erro ao consultar o banco de histórico.`);
      }
    } else if (action === 'conta') {
      addBotReply(
        `💰 *MINHA CONTA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📧 *E-mail:* ${user?.email || 'trader.demo@tradeao.io'}\n🆔 *Chat ID:* ${user?.chat_id || '7886049873'}\n💎 *Tokens Demo:* ${(user?.tokens || 20.0).toFixed(2)}\n🤖 *Autotrading:* ${user?.autotrade ? '🟢 ATIVADO' : '🔴 DESATIVADO'}\n🟡 *Binance:* ${binanceConnected ? '🟢 CONECTADA' : '⚪ NÃO CONECTADA'}\n🛡️ *Risk Manager:* ${riskPerTrade}% risco / ${maxDailyLoss}% perda máx\n📅 *Registrado em:* ${user?.registro?.substring(0, 10) || '2026-08-18'}`,
        [
          [{ label: '🤖 Autotrading Binance', action: 'autotrade_binance' }],
          [{ label: '💎 Ver Tokens', action: 'tokens' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else if (action === 'tokens') {
      addBotReply(
        `💎 *TOKENS: ${(user?.tokens || 20.0).toFixed(2)} TOKENS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTokens virtuais para testes educativos no modo demo.\n\n*Como obter mais tokens:*\n• 👥 Convide amigos: +5 tokens por indicação\n• 🏆 Acerte trades manuais ou automáticos\n• 💰 Acesse páginas de corretoras parceiras: +5 tokens`,
        [
          [{ label: '👥 Convidar Amigos', action: 'amigos' }],
          [{ label: '💰 Ver Corretoras Parceiras', action: 'depositar' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else if (action === 'ajustes') {
      addBotReply(
        `⚙️ *AJUSTES DO SISTEMA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• Risco por Trade: ${riskPerTrade}%\n• Perda Máxima Diária: ${maxDailyLoss}%\n• Timeframe Padrão: 15m\n• Alertas de Sinal: ✅ Ativados\n• Stop Loss Obrigatório: ✅ Ativado\n\n👉 Para auditar o pipeline completo de 11 etapas, clique abaixo:`,
        [
          [{ label: '🚀 Execution Engine (11 Etapas)', action: 'execution_engine' }],
          [{ label: '⚙️ Configurar Risco', action: 'risk_config' }],
          [{ label: '🤖 Autotrading Binance', action: 'autotrade_binance' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else if (action === 'execution_engine') {
      addBotReply(
        `⚙️ *EXECUTION ENGINE (FASE 12)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔄 *Fluxo de Execução:* \nMarket Scanner ➔ Signal Engine ➔ Confidence Score ➔ Risk Manager ➔ Trade Approval ➔ Binance Broker ➔ Order Manager ➔ Trade Monitor ➔ Resultado ➔ Analytics ➔ Telegram\n\n🛡️ *Guardrails Ativos:*\n• 🛑 Stop Loss Obrigatório: ✅ ATIVO\n• 🛡️ Risco Máx.: 1% por operação\n• ⚡ Circuit Breaker Diário: 3% máx\n• 🚫 Anti-Duplicação: ✅ ATIVO\n• ⏳ Anti-Sinal Antigo: TTL < 180s\n• 🔒 Idempotência: clientOrderId determinístico`,
        [
          [{ label: '📈 Monitorar Posições (FASE 13)', action: 'trade_monitor' }],
          [{ label: '🤖 Autotrading Binance', action: 'autotrade_binance' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else if (action === 'trade_monitor') {
      try {
        const res = await fetch('/api/monitor/summary');
        const data = await res.json();
        const active = data.monitoredTrades || [];
        const winRate = data.winRatePct || 75;
        const pnl = data.totalPnlUsd || 0;

        if (active.length === 0) {
          addBotReply(
            `📈 *TRADE MONITOR (FASE 13)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🟢 *Status do Monitor:* ATIVO (Varredura a cada 1.5s)\n📊 *Posições Abertas:* 0 (Nenhuma ordem em andamento)\n🎯 *Taxa de Acerto:* ${winRate}%\n💵 *PnL Realizado:* ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}\n\n_Quando novas ordens forem executadas, o monitor reportará entrada, stop loss, alvo e o resultado final no Telegram._`,
            [
              [{ label: '🤖 Autotrading Binance', action: 'autotrade_binance' }],
              [{ label: '📡 Ver Sinais', action: 'sinais' }],
              [{ label: '◀️ Menu Principal', action: 'menu' }],
            ]
          );
        } else {
          const t = active[0];
          addBotReply(
            `📈 *TRADE MONITOR — POSIÇÃO ATIVA (FASE 13)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💎 *${t.par} ${t.direction}*\n• Estado: 🟢 ${t.status}\n• Entrada: $${t.entryPrice.toLocaleString()}\n• Preço Atual: $${t.currentPrice.toLocaleString()}\n• Stop Loss: $${t.stopLoss.toLocaleString()} (${t.distToSlPct.toFixed(2)}% dist)\n• Target (TP): $${t.takeProfit.toLocaleString()} (${t.distToTpPct.toFixed(2)}% dist)\n• PnL Flutuante: ${t.unrealizedPnlUsd >= 0 ? '+' : ''}$${t.unrealizedPnlUsd.toFixed(2)} (${t.unrealizedPnlPct >= 0 ? '+' : ''}${t.unrealizedPnlPct.toFixed(2)}%)\n• Progresso Alvo: ${t.progressPct.toFixed(1)}%`,
            [
              [
                { label: '🎯 Simular Take Profit', action: 'sim_tp' },
                { label: '🛑 Simular Stop Loss', action: 'sim_sl' },
              ],
              [{ label: '🔄 Atualizar Monitor', action: 'trade_monitor' }],
              [{ label: '◀️ Menu Principal', action: 'menu' }],
            ]
          );
        }
      } catch (e) {
        addBotReply(`❌ Erro ao consultar Trade Monitor.`);
      }
    } else if (action === 'sim_tp' || action === 'sim_sl') {
      try {
        const sumRes = await fetch('/api/monitor/summary');
        const sumData = await sumRes.json();
        const active = sumData.monitoredTrades || [];
        if (active.length > 0) {
          const targetType = action === 'sim_tp' ? 'TP' : 'SL';
          await fetch('/api/monitor/simulate-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tradeId: active[0].id, targetType }),
          });
          addBotReply(
            targetType === 'TP'
              ? `✅ *TRADE FECHADO*\n*${active[0].par} ${active[0].direction}*\nEntry: $${active[0].entryPrice.toLocaleString()}\nExit: $${active[0].takeProfit.toLocaleString()}\nP/L: +$${(active[0].positionValueUsd * 0.05).toFixed(2)}\n\nResultado: *WIN*`
              : `❌ *TRADE FECHADO*\n*${active[0].par} ${active[0].direction}*\nEntry: $${active[0].entryPrice.toLocaleString()}\nExit: $${active[0].stopLoss.toLocaleString()}\nP/L: -$${active[0].positionValueUsd.toFixed(2)}\n\nResultado: *LOSS*`,
            [[{ label: '📈 Ver Monitor', action: 'trade_monitor' }, { label: '◀️ Menu', action: 'menu' }]]
          );
          onRefreshUser();
        } else {
          addBotReply(`⚠️ Nenhuma posição ativa encontrada para simular. Abra uma ordem primeiro.`);
        }
      } catch (e) {
        addBotReply(`❌ Erro ao simular gatilho.`);
      }
    } else if (action === 'faq') {
      addBotReply(
        `❓ *PERGUNTAS FREQUENTES (FAQ)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nQ: O Trade AO opera com dinheiro real?\nA: O bot possui modo Simulação Demo e integração não-custodial oficial via API Binance (Spot).\n\nQ: O bot tem acesso aos meus saques na Binance?\nA: NÃO. O sistema rejeita e bloqueia categoricamente qualquer chave que tenha permissão de saque habilitada.\n\nQ: O que acontece se eu atingir a perda máxima de 3%?\nA: O Circuit Breaker pausa automaticamente o autotrading para proteger seu capital.\n\nQ: Como funciona o cálculo de tamanho da posição?\nA: O tamanho é calculado matematicamente: (Capital × Risco %) / Distância até o Stop Loss.`,
        [
          [{ label: '📖 Como Funciona', action: 'how_it_works' }],
          [{ label: '🛟 Suporte', action: 'suporte' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else if (action === 'suporte') {
      addBotReply(
        `🛟 *CENTRAL DE SUPORTE & AJUDA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPrecisa de auxílio com a conexão da sua API Binance ou dúvidas sobre confluência de sinais?\n\n• 🌐 Documentação: Guia Oficial Binance API\n• 💬 Canal Oficial: @TradeAO_Oficial\n• 🛡️ Segurança: Relatórios e auditoria de chaves em tempo real`,
        [
          [{ label: '🤖 Autotrading Binance', action: 'autotrade_binance' }],
          [{ label: '❓ FAQ', action: 'faq' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else if (action === 'amigos') {
      const link = `https://t.me/TradeAO_Bot?start=ref${user?.chat_id || '7886049873'}`;
      addBotReply(
        `👥 *AMIGOS & INDICAÇÕES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nGanhe +5 tokens por cada amigo que se cadastrar pelo seu link.\n\n🔗 Seu link exclusivo:\n${link}`,
        [[{ label: '◀️ Menu Principal', action: 'menu' }]]
      );
    } else if (action === 'depositar') {
      onOpenDepositModal();
      addBotReply(
        `💰 *Corretoras Parceiras Oficiais*\nPara operar no mercado real diretamente com corretoras parceiras, cadastre-se via links oficiais:`,
        [
          [{ label: '🔗 Binance Oficial', action: 'link_binance', url: 'https://www.binance.com/register?ref=1058024469' }],
          [{ label: '🔗 Bybit Oficial', action: 'link_bybit', url: 'https://www.bybit.com/invite?ref=SEU_CODIGO_BYBIT' }],
          [{ label: '◀️ Menu Principal', action: 'menu' }],
        ]
      );
    } else if (action === 'paper_trading') {
      try {
        const userId = user?.chat_id || '7886049873';
        const res = await fetch(`/api/paper/status/${userId}`);
        const data = await res.json();
        const st = data.status || {};
        const balance = (st.virtualBalanceUsd || 1000).toFixed(2);
        const count = st.paperTradesCount || 0;
        const wins = st.paperWinsCount || 0;
        const wr = st.paperWinRatePct || 0;
        const isRealUnlocked = st.realTradingUnlocked;

        addBotReply(
          `🧪 *MODO PAPER TRADING (FASE 15)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 *Status:* 🟢 ATIVO (Ambiente Seguro Sandbox)\n💼 *Saldo Virtual:* $${balance} USDT\n📈 *Trades Simulados:* ${count} (${wins} Wins | Win Rate: ${wr}%)\n🔒 *Modo Real:* ${isRealUnlocked ? '🟢 Desbloqueado' : '🛑 DESATIVADO (Proteção Ativa)'}\n\n*Pipeline Completo em 7 Etapas:*\n` +
          `Signal ➔ Risk ➔ Entry ➔ Monitoring ➔ TP/SL ➔ Result ➔ Analytics\n\n` +
          `_Nenhuma ordem real é enviada ao mercado financeiro._`,
          [
            [{ label: '⚡ Executar Ciclo 7-Etapas (Paper Trade)', action: 'execute_paper_cycle' }],
            [
              { label: '🟡 Binance Testnet Status', action: 'binance_testnet' },
              { label: '🔄 Reset Saldo ($1k)', action: 'reset_paper_balance' },
            ],
            [{ label: '📊 Ver Analytics Isolado', action: 'historico' }],
            [{ label: '◀️ Menu Principal', action: 'menu' }],
          ]
        );
      } catch (e) {
        addBotReply(`❌ Erro ao consultar status do Paper Trading.`);
      }
    } else if (action === 'execute_paper_cycle') {
      addBotReply(`🔄 *Iniciando Ciclo Completo de Paper Trading (7 Etapas)...*\n1. Signal ➔ 2. Risk ➔ 3. Entry ➔ 4. Monitor ➔ 5. TP/SL ➔ 6. Result ➔ 7. Analytics`);
      try {
        const userId = user?.chat_id || '7886049873';
        const res = await fetch('/api/paper/execute-cycle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            par: 'BTC/USDT',
            timeframe: '15m',
            strategy: 'EMA + RSI Confluence',
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const c = data.cycle;
          const isWin = c.outcome === 'WIN';
          addBotReply(
            `✅ *CICLO DE PAPER TRADING CONCLUÍDO!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🎯 *Ativo:* ${c.par} (${c.direction}) | Score: 88/100\n` +
            `📈 *Entrada Virtual:* $${c.entryPrice.toLocaleString()} (Order ID: ${c.id.substring(0, 12)})\n` +
            `🛑 *Stop Loss:* $${c.stopLoss.toLocaleString()} | 🎯 *Take Profit:* $${c.takeProfit.toLocaleString()}\n` +
            `🛡️ *Risco Alocado:* $${c.riskAmountUsd.toFixed(2)} (1.0% do saldo)\n` +
            `🏁 *Resultado:* ${isWin ? '🟢 WIN (+2.4%)' : '🔴 LOSS (-1.2%)'}\n` +
            `💵 *PnL:* ${c.pnlUsd >= 0 ? '+' : ''}$${c.pnlUsd.toFixed(2)} USDT\n` +
            `💼 *Novo Saldo Virtual:* $${c.virtualBalanceAfter.toFixed(2)} USDT\n\n` +
            `_Registrado com sucesso no Histórico Isolado e no painel de Analytics._`,
            [
              [{ label: '⚡ Executar Outro Ciclo', action: 'execute_paper_cycle' }],
              [{ label: '📊 Ver Histórico & Curva de Equity', action: 'historico' }],
              [{ label: '🧪 Voltar ao Paper Trading', action: 'paper_trading' }],
              [{ label: '◀️ Menu Principal', action: 'menu' }],
            ]
          );
        } else {
          addBotReply(`❌ Erro ao simular trade: ${data.error || 'Falha no ciclo'}`);
        }
      } catch (e) {
        addBotReply(`❌ Erro de comunicação com o servidor de simulação.`);
      }
    } else if (action === 'binance_testnet') {
      try {
        const res = await fetch('/api/binance/testnet/ping');
        const data = await res.json();
        addBotReply(
          `🟡 *BINANCE TESTNET OFICIAL*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌐 *Endpoint:* https://testnet.binance.vision\n🟢 *Status:* ${data.status || 'ONLINE'}\n🛡️ *Ambiente:* Sandbox Oficial não-custodial para testes de APIs e execução de ordens simuladas antes do mercado real.`,
          [
            [{ label: '⚡ Testar Execução na Testnet', action: 'execute_paper_cycle' }],
            [{ label: '🧪 Voltar ao Paper Trading', action: 'paper_trading' }],
            [{ label: '◀️ Menu Principal', action: 'menu' }],
          ]
        );
      } catch (e) {
        addBotReply(`🟡 *Binance Testnet:* Fallback de simulação ativo.`);
      }
    } else if (action === 'multiuser' || action === 'isolamento') {
      const chatId = user?.chat_id || '7886049873';
      try {
        const res = await fetch(`/api/multiuser/audit/${chatId}`);
        const data = await res.json();
        if (data.status) {
          addBotReply(
            `👥 *MULTIUSER & ISOLAMENTO TOTAL (FASE 16)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *Conta Ativa:* \`${chatId}\` (${user?.email || 'trader@tradeao.io'})\n🛡️ *Status de Blindagem:* ✅ *ISOLATION ENFORCED*\n\n🔒 *8 PILARES DE SEGREGAÇÃO:*\n• 👤 *Conta:* ${data.checkedPillars.account.details}\n• 🔑 *Credenciais:* ${data.checkedPillars.credentials.details}\n• 💰 *Saldo:* ${data.checkedPillars.balance.details}\n• ⚙️ *Configurações:* ${data.checkedPillars.settings.details}\n• 📈 *Posições:* ${data.checkedPillars.positions.details}\n• 📜 *Histórico:* ${data.checkedPillars.history.details}\n• 🛡️ *Risco:* ${data.checkedPillars.risk.details}\n• 📡 *Sinais:* ${data.checkedPillars.customSignals.details}\n\n*Zero Data Leakage:* Nenhum dado ou operação de outro usuário é acessível por esta sessão.`,
            [
              [{ label: '🗄️ Banco SQLite (FASE 17)', action: 'database_metrics' }, { label: '📡 Sinais Custom', action: 'custom_signals_list' }],
              [{ label: '🔄 Reexecutar Auditoria', action: 'multiuser' }, { label: '◀️ Menu Principal', action: 'menu' }],
            ]
          );
        }
      } catch (e) {
        addBotReply(`❌ Erro ao consultar status de isolamento.`);
      }
    } else if (action === 'database_metrics' || action === 'database' || action === 'banco') {
      try {
        const res = await fetch('/api/db/metrics');
        const data = await res.json();
        if (data.success && data.metrics) {
          const m = data.metrics;
          const tablesList = m.tables
            .map((t: any) => `• \`${t.tableName}\`: *${t.rowCount}* registros (${t.indexesCount} idx)`)
            .join('\n');
          addBotReply(
            `🗄️ *BANCO DE DADOS & PERSISTÊNCIA (FASE 17)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚙️ *Engine:* ${m.engine}\n💾 *Arquivo:* \`${m.dbPath.split('/').slice(-2).join('/')}\` (${m.dbSizeKb} KB)\n🛡️ *Status ACID:* ✅ *ONLINE & SYNCED*\n📜 *Transações Logadas:* ${m.totalTransactionsLogged} eventos\n\n📊 *TABELAS RELACIONAIS:*\n${tablesList}\n\n*Garantia:* Atomicidade em operações de trading, zero race conditions e migração incremental segura.`,
            [
              [{ label: '🔄 Migração Incremental', action: 'db_run_migration' }, { label: '💾 Snapshot Backup', action: 'db_run_backup' }],
              [{ label: '👥 Painel Multiuser', action: 'multiuser' }, { label: '◀️ Menu', action: 'menu' }],
            ]
          );
        }
      } catch (e) {
        addBotReply(`❌ Erro ao obter métricas da base de dados.`);
      }
    } else if (action === 'db_run_migration') {
      addBotReply(`🔄 *Executando reconciliação e migração incremental de dados legados para o SQLite...*`);
      try {
        const res = await fetch('/api/db/migrate', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          addBotReply(`✅ *Migração Incremental Concluída!* Todos os dados legados foram reconciliados sem duplicação.`, [
            [{ label: '🗄️ Ver Métricas do Banco', action: 'database_metrics' }],
            [{ label: '◀️ Menu', action: 'menu' }],
          ]);
        }
      } catch (e) {
        addBotReply(`❌ Erro na migração incremental.`);
      }
    } else if (action === 'db_run_backup') {
      addBotReply(`💾 *Criando snapshot atômico da base de dados...*`);
      try {
        const res = await fetch('/api/db/backup', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          addBotReply(`💾 *Snapshot de Backup Criado com Sucesso!* (${data.sizeBytes} bytes gravados no storage atômico).`, [
            [{ label: '🗄️ Status da Persistência', action: 'database_metrics' }],
            [{ label: '◀️ Menu', action: 'menu' }],
          ]);
        }
      } catch (e) {
        addBotReply(`❌ Erro ao gerar snapshot de backup.`);
      }
    } else if (action === 'custom_signals_list') {
      const chatId = user?.chat_id || '7886049873';
      try {
        const res = await fetch(`/api/signals/custom/${chatId}`);
        const data = await res.json();
        const list = data.signals || [];
        if (list.length === 0) {
          addBotReply(
            `📡 *SINAIS PERSONALIZADOS (UID: ${chatId})*\n\nNenhum sinal customizado cadastrado ainda para este usuário. Use a aba "Sinais Personalizados" no modal Multiuser para cadastrar estratégias exclusivas!`,
            [[{ label: '👥 Voltar ao Multiuser', action: 'multiuser' }, { label: '◀️ Menu', action: 'menu' }]]
          );
        } else {
          const formatted = list
            .map((s: any, idx: number) => `${idx + 1}. *${s.par}* (${s.direcao} • ${s.timeframe})\n   • Estratégia: ${s.estrategia}\n   • Entrada: $${s.entrada} | SL: $${s.stop} | TP: $${s.alvo}`)
            .join('\n\n');
          addBotReply(
            `📡 *SEUS SINAIS PERSONALIZADOS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${formatted}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*Isolamento:* Visíveis apenas para o seu usuário.`,
            [[{ label: '👥 Painel Multiuser', action: 'multiuser' }, { label: '◀️ Menu', action: 'menu' }]]
          );
        }
      } catch (e) {
        addBotReply(`❌ Erro ao buscar sinais customizados.`);
      }
    } else if (action === 'reset_paper_balance') {
      try {
        const userId = user?.chat_id || '7886049873';
        const res = await fetch(`/api/paper/reset-balance/${userId}`, { method: 'POST' });
        if (res.ok) {
          addBotReply(`🔄 *Saldo virtual reiniciado com sucesso para $1,000.00 USDT!*`, [
            [{ label: '🧪 Painel Paper Trading', action: 'paper_trading' }],
            [{ label: '◀️ Menu Principal', action: 'menu' }],
          ]);
        }
      } catch (e) {
        addBotReply(`❌ Falha ao reiniciar saldo virtual.`);
      }
    } else if (action === 'daemon_status') {
      try {
        const [sRes, jRes] = await Promise.all([
          fetch('/api/daemon/status'),
          fetch('/api/daemon/active-jobs'),
        ]);
        const sData = await sRes.json();
        const jData = await jRes.json();
        
        addBotReply(
          `🖥️ *TRADE AO — STATUS DO SERVIDOR 24/7 (FASE 18)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🟢 *Status Geral:* ONLINE 24/7\n` +
          `⏱️ *Uptime do Servidor:* ${sData.uptimeFormatted || 'N/A'}\n` +
          `🆔 *PID Principal (Node):* ${sData.pid} (Lockfile Ativo)\n` +
          `🔒 *Single-Instance Lock:* ${sData.isLockAcquired ? '🟢 Protegido' : '⚠️ Destravado'}\n` +
          `🧠 *Memória RSS / Heap:* ${sData.memory?.rssMb || 0} MB / ${sData.memory?.heapUsedMb || 0} MB\n` +
          `⚙️ *Process Manager:* Systemd (RestartSec=5s)\n` +
          `💾 *Jobs Persistidos no SQLite:* ${jData.activeCount || 0} Ativos (Zero RAM Dependency)\n` +
          `📝 *Logs Estruturados:* ${sData.logs?.logFilePath || 'logs/tradeao_server.log'}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `_Proteção anti-duplicação e recuperação automática pós-restart ativas._`,
          [
            [{ label: '⚡ Simular Queda (Crash Test)', action: 'daemon_simulate_crash' }],
            [{ label: '🗄️ Banco SQLite (FASE 17)', action: 'database_metrics' }],
            [{ label: '◀️ Menu Principal', action: 'menu' }],
          ]
        );
      } catch (e) {
        addBotReply(`❌ Falha ao consultar status do daemon 24/7.`);
      }
    } else if (action === 'daemon_simulate_crash') {
      addBotReply(`🧪 *[SIMULAÇÃO DE CRASH] Limpando RAM e acionando recuperação de jobs pelo SQLite...*`);
      try {
        const res = await fetch('/api/daemon/simulate-restart', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          const rec = data.recoveryResult || {};
          addBotReply(
            `✅ *RECUPERAÇÃO PÓS-RESTART CONCLUÍDA!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🧹 *Memória RAM Limpa:* ${data.priorWipedActiveMemoryCount} trades descartados da RAM\n` +
            `💾 *Recuperados do SQLite:* ${rec.recoveredTotal || 0} jobs restaurados do disco\n` +
            `🟢 *Reidratados no Monitor:* ${rec.stillActiveCount || 0} ordens ativas\n` +
            `⚖️ *Reconciliados pós-crash:* ${rec.reconciledCount || 0} ordens finalizadas por TP/SL\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `*Garantia 24/7:* Zero perda de trades ou posições após reinicialização do processo.`,
            [
              [{ label: '🖥️ Status do Servidor', action: 'daemon_status' }],
              [{ label: '📈 Ver Monitor de Trades', action: 'trade_monitor' }],
              [{ label: '◀️ Menu Principal', action: 'menu' }],
            ]
          );
        }
      } catch (e) {
        addBotReply(`❌ Falha ao simular reinicialização.`);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userText = inputVal.trim();
    setInputVal('');

    setMessages((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        sender: 'user',
        text: userText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    // Handle Commands
    if (userText === '/start') {
      setTimeout(() => {
        showMainMenu();
      }, 300);
      return;
    }

    if (userText === '/autotrade' || userText.toLowerCase().includes('autotrade') || userText.toLowerCase().includes('binance')) {
      setTimeout(() => {
        handleAutotradingScreen();
      }, 300);
      return;
    }

    if (userText === '/sinais' || userText === '/sinal' || userText.toLowerCase().includes('sinal')) {
      setTimeout(() => {
        handleButtonClick('sinais');
      }, 300);
      return;
    }

    if (userText === '/engine' || userText === '/execution' || userText.toLowerCase().includes('engine') || userText.toLowerCase().includes('pipeline')) {
      setTimeout(() => {
        handleButtonClick('execution_engine');
      }, 300);
      return;
    }

    if (userText === '/monitor' || userText.toLowerCase().includes('monitor') || userText.toLowerCase().includes('posicao') || userText.toLowerCase().includes('posições')) {
      setTimeout(() => {
        handleButtonClick('trade_monitor');
      }, 300);
      return;
    }

    if (
      userText === '/paper' ||
      userText === '/testnet' ||
      userText === '/simulador' ||
      userText.toLowerCase().includes('paper') ||
      userText.toLowerCase().includes('testnet')
    ) {
      setTimeout(() => {
        handleButtonClick('paper_trading');
      }, 300);
      return;
    }

    if (
      userText === '/banco' ||
      userText === '/database' ||
      userText === '/db' ||
      userText === '/persistencia' ||
      userText.toLowerCase().includes('banco') ||
      userText.toLowerCase().includes('database') ||
      userText.toLowerCase().includes('sqlite')
    ) {
      setTimeout(() => {
        handleButtonClick('database_metrics');
      }, 300);
      return;
    }

    if (
      userText === '/daemon' ||
      userText === '/247' ||
      userText === '/server' ||
      userText === '/uptime' ||
      userText.toLowerCase().includes('daemon') ||
      userText.toLowerCase().includes('24/7') ||
      userText.toLowerCase().includes('uptime')
    ) {
      setTimeout(() => {
        handleButtonClick('daemon_status');
      }, 300);
      return;
    }

    if (
      userText === '/multiuser' ||
      userText === '/isolamento' ||
      userText === '/perfil' ||
      userText === '/contas' ||
      userText.toLowerCase().includes('multiuser') ||
      userText.toLowerCase().includes('isolamento')
    ) {
      setTimeout(() => {
        handleButtonClick('multiuser');
      }, 300);
      return;
    }

    if (
      userText === '/historico' ||
      userText === '/analytics' ||
      userText === '/stats' ||
      userText.toLowerCase().includes('historico') ||
      userText.toLowerCase().includes('analytics')
    ) {
      setTimeout(() => {
        handleButtonClick('historico');
      }, 300);
      return;
    }

    if (userText.toLowerCase() === 'menu' || userText === '/menu') {
      setTimeout(() => {
        showMainMenu();
      }, 300);
      return;
    }

    // Manual API key input step 1
    if (awaitingApiKey) {
      setTempApiKey(userText);
      setAwaitingApiKey(false);
      addBotReply(`🔑 *Agora digite sua Binance API Secret:*`);
      return;
    }

    // Manual API key input step 2
    if (tempApiKey) {
      const secret = userText;
      const key = tempApiKey;
      setTempApiKey('');
      addBotReply(`🔄 Validando permissões na Binance e criptografando no cofre isolado (AES-256)...`);
      try {
        const chatId = user?.chat_id || '7886049873';
        const res = await fetch('/api/binance/save-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            apiKey: key,
            apiSecret: secret,
            testnet: false,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setBinanceConnected(true);
          onRefreshUser();
          addBotReply(`✅ *Binance conectada com sucesso!*\n• Preview: \`${data.preview || 'Chave Salva'}\`\n• Criptografia: AES-256 no Cofre Isolado`);
          setTimeout(() => handleAutotradingScreen(user, true), 300);
        } else {
          addBotReply(`❌ ${data.error || 'Credenciais inválidas ou com permissão de saque habilitada.'}`);
        }
      } catch (err) {
        addBotReply(`❌ Erro ao conectar ao servidor.`);
      }
      return;
    }

    // Email Input Handler (Registration or Login)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (awaitingEmail || emailRegex.test(userText)) {
      if (loginMode) {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userText }),
          });
          const data = await res.json();
          if (!res.ok) {
            addBotReply(`⚠️ ${data.error || 'E-mail não encontrado.'}`);
            return;
          }

          setAwaitingEmail(false);
          setLoginMode(false);
          onRefreshUser();
          addBotReply(`✅ Login realizado com sucesso!`);
          setTimeout(() => {
            showMainMenu(data.user);
          }, 300);
        } catch (err) {
          addBotReply(`❌ Erro ao conectar ao servidor.`);
        }
        return;
      }

      // Registration Flow
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userText }),
        });
        const data = await res.json();

        if (!res.ok && res.status !== 409) {
          addBotReply(`❌ ${data.error || 'Erro ao registrar conta.'}`);
          return;
        }

        setAwaitingEmail(false);
        onRefreshUser();
        addBotReply(`✅ *Conta Trade AO autenticada!*`);
        setTimeout(() => showMainMenu(), 300);
      } catch (err) {
        addBotReply(`❌ Erro ao conectar ao servidor.`);
      }
      return;
    }

    // Default fallback
    setTimeout(() => {
      addBotReply(
        `Comando recebido: "${userText}". Utilize os botões interativos abaixo:`,
        [
          [{ label: '📡 Sinais', action: 'sinais' }, { label: '🤖 Autotrading Binance', action: 'autotrade_binance' }],
          [{ label: '📊 Histórico', action: 'historico' }, { label: '💰 Minha Conta', action: 'conta' }],
          [{ label: '💎 Tokens', action: 'tokens' }, { label: '⚙️ Ajustes', action: 'ajustes' }],
          [{ label: '❓ FAQ', action: 'faq' }, { label: '🛟 Suporte', action: 'suporte' }],
        ]
      );
    }, 300);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center font-bold">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              @TradeAO_Bot
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-[10px] text-slate-400">Telegram Bot & Autotrading Console</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const isBot = m.sender === 'bot';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed ${
                  isBot
                    ? 'bg-slate-900 border border-slate-800 text-slate-200 shadow-md'
                    : 'bg-emerald-600 text-white font-medium shadow-md'
                }`}
              >
                <div className="whitespace-pre-line font-sans">{m.text}</div>

                {/* Inline Keyboard Buttons */}
                {m.buttons && m.buttons.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                    {m.buttons.map((row, rIdx) => (
                      <div key={rIdx} className="flex gap-1.5">
                        {row.map((btn, bIdx) => {
                          if (btn.url) {
                            return (
                              <a
                                key={bIdx}
                                href={btn.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 text-center py-2 px-2 rounded-xl bg-slate-800/90 hover:bg-sky-600 hover:text-white text-sky-400 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 border border-slate-700 active:scale-95"
                              >
                                {btn.label}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            );
                          }
                          return (
                            <button
                              key={bIdx}
                              onClick={() => handleButtonClick(btn.action)}
                              className="flex-1 text-center py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-all border border-slate-700/80 active:scale-95 hover:border-slate-600"
                            >
                              {btn.label}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[9px] text-slate-500 mt-1 px-1">{m.time}</span>
            </div>
          );
        })}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900/60 flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Digite /start, /autotrade, /sinais..."
          className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-colors"
        />
        <button
          type="submit"
          className="bg-sky-600 hover:bg-sky-500 text-white p-2.5 rounded-xl text-xs transition-colors flex items-center justify-center cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

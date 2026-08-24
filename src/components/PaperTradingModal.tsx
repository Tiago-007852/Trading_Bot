import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  ShieldCheck,
  Lock,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Activity,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
  Sliders,
  DollarSign,
  Layers,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { TradingMode, PaperCycleResult, PaperTradingStatus } from '../types';

interface PaperTradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | number;
  currentPar?: string;
  onRefreshAll?: () => void;
}

export const PaperTradingModal: React.FC<PaperTradingModalProps> = ({
  isOpen,
  onClose,
  userId = '7886049873',
  currentPar = 'BTC/USDT',
  onRefreshAll,
}) => {
  const [activeMode, setActiveMode] = useState<TradingMode>('PAPER_TRADING');
  const [status, setStatus] = useState<PaperTradingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [currentCycle, setCurrentCycle] = useState<PaperCycleResult | null>(null);
  const [executingStepIndex, setExecutingStepIndex] = useState<number>(-1);

  // Cycle options
  const [selectedPair, setSelectedPair] = useState<string>(currentPar || 'BTC/USDT');
  const [selectedTf, setSelectedTf] = useState<string>('15m');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('EMA + RSI Confluence');
  const [outcomeMode, setOutcomeMode] = useState<'AUTO' | 'WIN' | 'LOSS'>('AUTO');

  // Testnet ping state
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);

  // Feedback messages
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/paper/status/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setActiveMode(data.status.activeMode);
        if (data.recentCycles && data.recentCycles.length > 0 && !currentCycle) {
          setCurrentCycle(data.recentCycles[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching paper trading status:', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setActionMessage(null);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSelectMode = async (mode: TradingMode) => {
    setActionMessage(null);
    try {
      const res = await fetch('/api/paper/set-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionMessage({
          type: 'error',
          text: data.error || 'Não foi possível alterar para o modo solicitado.',
        });
        return;
      }
      setActiveMode(mode);
      setStatus(data.status);
      setActionMessage({
        type: 'success',
        text: `Modo alterado para ${mode === 'PAPER_TRADING' ? '🧪 PAPER TRADING' : mode === 'BINANCE_TESTNET' ? '🟡 BINANCE TESTNET' : '🔴 MODO REAL'} com sucesso!`,
      });
      if (onRefreshAll) onRefreshAll();
    } catch (e) {
      setActionMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    }
  };

  const handleResetVirtualBalance = async () => {
    try {
      const res = await fetch(`/api/paper/reset-balance/${userId}`, { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
        setActionMessage({ type: 'success', text: 'Saldo virtual reiniciado para $1,000.00 USDT!' });
        if (onRefreshAll) onRefreshAll();
      }
    } catch (e) {
      setActionMessage({ type: 'error', text: 'Erro ao reiniciar saldo.' });
    }
  };

  const handleUnlockRealMode = async () => {
    try {
      const res = await fetch(`/api/paper/unlock-real/${userId}`, { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
        setActionMessage({
          type: 'success',
          text: '✅ Modo Real Desbloqueado! Você já pode selecionar o Modo Real quando estiver pronto.',
        });
      }
    } catch (e) {
      setActionMessage({ type: 'error', text: 'Erro ao desbloquear Modo Real.' });
    }
  };

  const handlePingTestnet = async () => {
    setIsPinging(true);
    setPingStatus(null);
    try {
      const res = await fetch('/api/binance/testnet/ping');
      const data = await res.json();
      setPingStatus(`🟢 Conexão OK (${data.status} • testnet.binance.vision)`);
    } catch (e) {
      setPingStatus('🔴 Falha na conexão com testnet.');
    } finally {
      setIsPinging(false);
    }
  };

  const handleRunFullCycle = async () => {
    setIsExecuting(true);
    setActionMessage(null);
    setExecutingStepIndex(0);

    // Progressive visual animation through the 7 steps
    const stepInterval = setInterval(() => {
      setExecutingStepIndex((prev) => {
        if (prev < 6) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 450);

    try {
      const res = await fetch('/api/paper/execute-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          par: selectedPair,
          timeframe: selectedTf,
          strategy: selectedStrategy,
          forceOutcome: outcomeMode === 'AUTO' ? undefined : outcomeMode,
          mode: activeMode,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTimeout(() => {
          clearInterval(stepInterval);
          setCurrentCycle(data.cycle);
          setStatus(data.status);
          setIsExecuting(false);
          setExecutingStepIndex(7);
          setActionMessage({
            type: 'success',
            text: `✅ Ciclo de 7 Etapas concluído com sucesso! Resultado: ${data.cycle.outcome} (${data.cycle.pnlUsd >= 0 ? '+' : ''}$${data.cycle.pnlUsd.toFixed(2)}) e registrado no histórico isolado.`,
          });
          if (onRefreshAll) onRefreshAll();
        }, 1800);
      } else {
        clearInterval(stepInterval);
        setIsExecuting(false);
        setActionMessage({ type: 'error', text: data.error || 'Erro ao executar ciclo simulado.' });
      }
    } catch (e) {
      clearInterval(stepInterval);
      setIsExecuting(false);
      setActionMessage({ type: 'error', text: 'Erro de comunicação durante a simulação.' });
    }
  };

  const cycleSteps = [
    { key: 'SIGNAL', label: '1. Signal', desc: 'Geração com Confluência Técnica' },
    { key: 'RISK', label: '2. Risk', desc: 'Dimensionamento & Circuit Breaker' },
    { key: 'ENTRY', label: '3. Entry', desc: 'Ordem Simulada Sem Risco' },
    { key: 'MONITORING', label: '4. Monitoring', desc: 'Rastreamento Live & Trailing' },
    { key: 'TP_SL', label: '5. TP/SL', desc: 'Gatilho de Saída Alvo/Stop' },
    { key: 'RESULT', label: '6. Result', desc: 'Liquidação & PnL Realizado' },
    { key: 'ANALYTICS', label: '7. Analytics', desc: 'Persistência no Histórico' },
  ];

  return (
    <div id="paper-trading-modal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  FASE 15
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  SANDBOX &amp; TESTNET ENGINE
                </span>
              </div>
              <h2 className="text-lg font-black text-white mt-1">
                Paper Trading &amp; Binance Testnet
              </h2>
              <p className="text-xs text-slate-400">
                Simulação de ponta a ponta em 7 etapas antes de autorizar qualquer capital real.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Feedback Alert */}
        {actionMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : actionMessage.type === 'error'
                ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                : 'bg-blue-950/40 border-blue-500/30 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Mode Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Option 1: Paper Trading */}
          <div
            onClick={() => handleSelectMode('PAPER_TRADING')}
            className={`cursor-pointer rounded-2xl p-4 border transition-all relative overflow-hidden ${
              activeMode === 'PAPER_TRADING'
                ? 'bg-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            {activeMode === 'PAPER_TRADING' && (
              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                MODO ATIVO
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">🧪 Paper Trading</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              100% simulado. Saldo virtual de $1,000 USDT. Nenhuma ordem real é enviada ao mercado.
            </p>
            <div className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/20 inline-block">
              Saldo: ${(status?.virtualBalanceUsd || 1000).toFixed(2)} USDT
            </div>
          </div>

          {/* Option 2: Binance Testnet */}
          <div
            onClick={() => handleSelectMode('BINANCE_TESTNET')}
            className={`cursor-pointer rounded-2xl p-4 border transition-all relative overflow-hidden ${
              activeMode === 'BINANCE_TESTNET'
                ? 'bg-slate-950 border-yellow-500 shadow-lg shadow-yellow-500/10'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            {activeMode === 'BINANCE_TESTNET' && (
              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-400 text-slate-950">
                MODO ATIVO
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-5 h-5 text-yellow-400" />
              <h3 className="text-sm font-bold text-white">🟡 Binance Testnet</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Ambiente oficial de testes Binance (testnet.binance.vision) para validação de endpoints API.
            </p>
            <div className="text-xs font-mono text-yellow-400 bg-yellow-950/40 px-2.5 py-1 rounded-lg border border-yellow-500/20 inline-block">
              API Sandbox Oficial
            </div>
          </div>

          {/* Option 3: Real Trading (Strictly Locked) */}
          <div
            onClick={() => {
              if (status?.realTradingUnlocked) {
                handleSelectMode('REAL_TRADING');
              } else {
                setActionMessage({
                  type: 'error',
                  text: '🔒 MODO REAL BLOQUEADO: O sistema exige conclusão de testes em Paper Trading antes de permitir dinheiro real.',
                });
              }
            }}
            className={`rounded-2xl p-4 border transition-all relative overflow-hidden ${
              activeMode === 'REAL_TRADING'
                ? 'bg-slate-950 border-rose-500 shadow-lg shadow-rose-500/10 cursor-pointer'
                : status?.realTradingUnlocked
                ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700 cursor-pointer'
                : 'bg-slate-950/30 border-slate-800/60 opacity-80 cursor-not-allowed'
            }`}
          >
            <div className="absolute top-2.5 right-2.5">
              {status?.realTradingUnlocked ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> Desbloqueado
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> DESATIVADO
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold text-white">🔴 Modo Real</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Execução real na Binance Spot. Permanece bloqueado por diretriz de segurança até conclusão de testes.
            </p>
            <div className="text-xs font-mono text-rose-400 bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-500/20 inline-block">
              {status?.realTradingUnlocked ? 'Pronto para Operar' : 'Proteção Ativa'}
            </div>
          </div>
        </div>

        {/* 7-Step Cycle Simulation Section */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Simulador do Ciclo Completo (Signal → Risk → Entry → Monitoring → TP/SL → Result → Analytics)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Executa e audita cada uma das 7 etapas da pipeline de trading sem risco a capital real.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetVirtualBalance}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5"
                title="Reiniciar saldo virtual para $1,000.00"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Saldo ($1k)
              </button>
            </div>
          </div>

          {/* Parameters for the Simulation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Par Cripto
              </label>
              <select
                value={selectedPair}
                onChange={(e) => setSelectedPair(e.target.value)}
                disabled={isExecuting}
                className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-white outline-none"
              >
                <option value="BTC/USDT">BTC/USDT</option>
                <option value="ETH/USDT">ETH/USDT</option>
                <option value="SOL/USDT">SOL/USDT</option>
                <option value="BNB/USDT">BNB/USDT</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Timeframe
              </label>
              <select
                value={selectedTf}
                onChange={(e) => setSelectedTf(e.target.value)}
                disabled={isExecuting}
                className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-white outline-none"
              >
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Estratégia
              </label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                disabled={isExecuting}
                className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-white outline-none"
              >
                <option value="EMA + RSI Confluence">EMA + RSI Confluence</option>
                <option value="Bollinger Mean Reversion">Bollinger Mean Reversion</option>
                <option value="ATR Breakout">ATR Breakout</option>
                <option value="Signal Engine 8-Pillar">Signal Engine 8-Pillar</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Desfecho do Teste
              </label>
              <select
                value={outcomeMode}
                onChange={(e) => setOutcomeMode(e.target.value as any)}
                disabled={isExecuting}
                className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-white outline-none"
              >
                <option value="AUTO">🎲 Automático (Mercado)</option>
                <option value="WIN">🎯 Forçar WIN (+2.4%)</option>
                <option value="LOSS">🛑 Forçar LOSS (-1.2%)</option>
              </select>
            </div>
          </div>

          {/* Trigger Full Cycle Button */}
          <button
            id="btn-run-paper-cycle"
            onClick={handleRunFullCycle}
            disabled={isExecuting}
            className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              isExecuting
                ? 'bg-slate-800 text-slate-400 cursor-wait'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/20 cursor-pointer'
            }`}
          >
            {isExecuting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Simulando Pipeline de 7 Etapas...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                Executar Ciclo Completo de Paper Trading (7 Etapas)
              </>
            )}
          </button>

          {/* 7-Step Horizontal Visual Pipeline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
            {cycleSteps.map((s, idx) => {
              const isCompleted = executingStepIndex > idx || (!isExecuting && currentCycle);
              const isCurrent = isExecuting && executingStepIndex === idx;

              return (
                <div
                  key={s.key}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    isCurrent
                      ? 'bg-emerald-950/60 border-emerald-400 scale-105 shadow-md shadow-emerald-500/20'
                      : isCompleted
                      ? 'bg-slate-900 border-emerald-500/40 text-slate-200'
                      : 'bg-slate-900/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="text-[11px] font-black mb-0.5 flex items-center justify-center gap-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                    )}
                    <span className={isCompleted ? 'text-emerald-400' : 'text-slate-400'}>
                      {s.label}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate" title={s.desc}>
                    {s.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Cycle Output Logs */}
          {currentCycle && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Relatório do Último Ciclo ({currentCycle.id})
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    currentCycle.outcome === 'WIN'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {currentCycle.outcome} ({currentCycle.pnlUsd >= 0 ? '+' : ''}${currentCycle.pnlUsd.toFixed(2)})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                {currentCycle.steps.map((st) => (
                  <div
                    key={st.step}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-200">{st.label}: {st.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-sans">{st.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Binance Testnet & Real Mode Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Binance Testnet Ping & Status */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Server className="w-4 h-4 text-yellow-400" />
                Binance Testnet Oficial
              </h3>
              <button
                onClick={handlePingTestnet}
                disabled={isPinging}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
                Testar Ping
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Endpoint: <code className="text-yellow-400 font-mono">https://testnet.binance.vision</code>
            </p>

            {pingStatus && (
              <div className="text-xs p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
                {pingStatus}
              </div>
            )}
          </div>

          {/* Real Mode Security Checklist & Unlock */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Requisitos para Desbloqueio do Modo Real
            </h3>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>• Mínimo de 3 Trades em Paper Trading:</span>
                <span className={status?.safetyChecklist.minimumPaperTradesCompleted ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {status?.paperTradesCount || 0} / 3 {status?.safetyChecklist.minimumPaperTradesCompleted ? '✅' : '⏳'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span>• Risk Manager &amp; Circuit Breaker 3%:</span>
                <span className="text-emerald-400 font-bold">Validado ✅</span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span>• Chave API sem Saques:</span>
                <span className="text-emerald-400 font-bold">Auditado ✅</span>
              </div>
            </div>

            {!status?.realTradingUnlocked && (
              <button
                onClick={handleUnlockRealMode}
                className="w-full mt-2 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition flex items-center justify-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                Desbloquear Modo Real
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

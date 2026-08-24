import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  ShieldAlert,
  Zap,
  Activity,
  Layers,
  Clock,
  RotateCcw,
  Cpu,
  Send,
  Lock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  Server,
  Key,
  Database,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  ExecutionEngineStatus,
  ExecutionLogRecord,
  PipelineStepDetail,
  PipelineStepName,
} from '../types';

interface ExecutionEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBalance: number;
  currentPar: string;
  onTriggerAutotrade?: () => void;
}

const PIPELINE_STEPS: { name: PipelineStepName; desc: string; icon: string }[] = [
  { name: 'Market Scanner', desc: 'Leitura de ticker e candles 15m em tempo real', icon: '📡' },
  { name: 'Signal Engine', desc: 'Cálculo de 8 pilares técnicos (RSI, EMA, BB, MACD, Volume)', icon: '⚙️' },
  { name: 'Confidence/Confluence Score', desc: 'Validação de threshold mínimo (Score >= 70/100)', icon: '🎯' },
  { name: 'Risk Manager', desc: 'Dimensionamento exato, Stop Loss e Circuit Breaker 3%', icon: '🛡️' },
  { name: 'Trade Approval', desc: 'Auditoria anti-duplicação e checagem de TTL (<180s)', icon: '✍️' },
  { name: 'Binance Broker', desc: 'Envio Spot com clientOrderId e cofre isolado', icon: '🟡' },
  { name: 'Order Manager', desc: 'Registro de estado, preenchimento e alocação', icon: '📦' },
  { name: 'Trade Monitor', desc: 'Rastreamento ao vivo de preço vs Stop Loss & TP', icon: '👁️' },
  { name: 'Resultado', desc: 'Cálculo de WIN/LOSS, PnL líquido e retorno em %', icon: '🏁' },
  { name: 'Analytics', desc: 'Atualização de taxa de acerto, perdas e drawdown', icon: '📊' },
  { name: 'Telegram', desc: 'Notificação automática com card detalhado do trade', icon: '💬' },
];

export const ExecutionEngineModal: React.FC<ExecutionEngineModalProps> = ({
  isOpen,
  onClose,
  userBalance,
  currentPar,
  onTriggerAutotrade,
}) => {
  const [engineStatus, setEngineStatus] = useState<ExecutionEngineStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<ExecutionLogRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'guardrails' | 'audits' | 'tester'>('pipeline');
  const [selectedPair, setSelectedPair] = useState<string>(currentPar || 'BTC/USDT');
  const [testResult, setTestResult] = useState<any>(null);
  const [isExecutingTest, setIsExecutingTest] = useState<boolean>(false);
  const [lastIdempotencyKey, setLastIdempotencyKey] = useState<string>('');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [currentTradingMode, setCurrentTradingMode] = useState<'paper' | 'testnet' | 'live'>('paper');
  const [isUpdatingMode, setIsUpdatingMode] = useState<boolean>(false);
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState<boolean>(false);
  const [modeFeedback, setModeFeedback] = useState<string | null>(null);

  const fetchTradingMode = async () => {
    try {
      const res = await fetch('/api/trading-mode');
      if (res.ok) {
        const data = await res.json();
        setCurrentTradingMode(data.tradingMode || 'paper');
      }
    } catch (e) {
      console.error('Error fetching trading mode:', e);
    }
  };

  const handleSetTradingMode = async (mode: 'paper' | 'testnet' | 'live') => {
    if (mode === 'live') {
      setShowLiveConfirmModal(true);
      return;
    }
    executeModeChange(mode);
  };

  const executeModeChange = async (mode: 'paper' | 'testnet' | 'live') => {
    setIsUpdatingMode(true);
    setModeFeedback(null);
    try {
      const res = await fetch('/api/trading-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, updatedBy: 'execution_modal' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentTradingMode(data.tradingMode);
        setModeFeedback(`Modo alterado com sucesso para ${data.tradingMode.toUpperCase()}!`);
        fetchStatus();
      } else {
        setModeFeedback(`Erro: ${data.error || 'Falha ao alterar modo'}`);
      }
    } catch (e: any) {
      setModeFeedback(`Erro de rede: ${e.message}`);
    } finally {
      setIsUpdatingMode(false);
      setShowLiveConfirmModal(false);
    }
  };

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      fetchTradingMode();
      const res = await fetch('/api/execution/status?userId=7886049873');
      if (res.ok) {
        const data = await res.json();
        setEngineStatus(data);
        if (data.tradingMode) {
          setCurrentTradingMode(data.tradingMode);
        }
        if (data.recentExecutions && data.recentExecutions.length > 0 && !selectedLog) {
          setSelectedLog(data.recentExecutions[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching execution engine status:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunTestPipeline = async (reuseLastKey = false, triggerViolation = false) => {
    setIsExecutingTest(true);
    setTestResult(null);
    setActiveStepIndex(0);

    const key = reuseLastKey && lastIdempotencyKey
      ? lastIdempotencyKey
      : `idemp_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    if (!reuseLastKey) {
      setLastIdempotencyKey(key);
    }

    try {
      // Animate through initial steps
      for (let i = 0; i <= 4; i++) {
        setActiveStepIndex(i);
        await new Promise((r) => setTimeout(r, 250));
      }

      let payload: any = {
        userId: '7886049873',
        par: selectedPair,
        idempotencyKey: key,
        forceSimulation: true,
      };

      if (triggerViolation) {
        // Intentionally send an invalid signal with no stop loss to test guardrail
        payload.providedSignal = {
          par: selectedPair,
          direcao: 'LONG',
          entrada: 96000,
          stop: 0, // Violates Stop Loss Guard
          alvo: 99000,
          score: 85,
          timestamp: Date.now(),
        };
      }

      const res = await fetch('/api/execution/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setTestResult(data);

      if (data.record) {
        setSelectedLog(data.record);
      }

      setActiveStepIndex(10);
      fetchStatus();
      if (onTriggerAutotrade) onTriggerAutotrade();
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsExecutingTest(false);
    }
  };

  const g = engineStatus?.guardrails;
  const s = engineStatus?.stats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Execution Engine</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  FASE 12
                </span>
                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span>
                  11 Etapas Ativas
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Pipeline de alta segurança com travas anti-duplicação, checagem de TTL e idempotência de retry.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors border border-neutral-700 text-xs flex items-center space-x-1"
              title="Atualizar Status"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors border border-neutral-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-neutral-800 bg-neutral-900/40 text-xs font-medium space-x-1">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'pipeline'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pipeline (11 Etapas)</span>
          </button>
          <button
            onClick={() => setActiveTab('guardrails')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'guardrails'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Matriz de Guardrails</span>
          </button>
          <button
            onClick={() => setActiveTab('tester')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'tester'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Simulador & Teste de Retry</span>
          </button>
          <button
            onClick={() => setActiveTab('audits')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'audits'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Auditoria de Execuções ({engineStatus?.recentExecutions?.length || 0})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-neutral-950/20">
          {/* TAB 1: 11-Step Pipeline View */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              {/* Pipeline Overview Card */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-neutral-400 uppercase font-semibold">Executados</div>
                    <div className="text-lg font-bold text-white">{s?.totalExecuted || 0}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-neutral-400 uppercase font-semibold">Rejeitados por Risco</div>
                    <div className="text-lg font-bold text-rose-400">{s?.totalRejected || 0}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-neutral-400 uppercase font-semibold">Chaves Idempotentes</div>
                    <div className="text-lg font-bold text-cyan-400">{engineStatus?.idempotencyKeysCount || 0}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-neutral-400 uppercase font-semibold">Posições Abertas</div>
                    <div className="text-lg font-bold text-amber-300">{engineStatus?.activeExecutionsCount || 0}</div>
                  </div>
                </div>
              </div>

              {/* 11 Steps Horizontal/Vertical Visual Pipeline */}
              <div className="p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Fluxo Completo de Execução (11 Etapas Obrigatórias)</span>
                  </h3>
                  <span className="text-xs text-neutral-400">
                    Em conformidade com a FASE 12
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PIPELINE_STEPS.map((step, index) => {
                    const isPassed = selectedLog?.pipeline?.some(
                      (p) => p.name.toLowerCase() === step.name.toLowerCase() && p.status === 'success'
                    );
                    const isFailed = selectedLog?.pipeline?.some(
                      (p) => p.name.toLowerCase() === step.name.toLowerCase() && p.status === 'failed'
                    );

                    return (
                      <div
                        key={step.name}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isFailed
                            ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                            : isPassed
                            ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                            : 'bg-neutral-950/40 border-neutral-800/80 text-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-base">{step.icon}</span>
                            <span className="text-xs font-bold text-white">
                              {index + 1}. {step.name}
                            </span>
                          </div>
                          {isFailed ? (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          ) : isPassed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-neutral-600"></span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 line-clamp-2">
                          {step.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Latest Selected Log Details */}
              {selectedLog && (
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-neutral-400">Rastreio de Execução:</span>
                      <code className="text-xs font-mono bg-neutral-800 px-2 py-0.5 rounded text-amber-300">
                        {selectedLog.id}
                      </code>
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                          selectedLog.status === 'EXECUTED' || selectedLog.status === 'CLOSED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : selectedLog.status === 'APPROVED'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {selectedLog.status}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400 font-mono">
                      ClientOrderId: {selectedLog.clientOrderId}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800">
                      <span className="text-neutral-400 block">Par / Direção</span>
                      <span className="font-bold text-white">
                        {selectedLog.par} ({selectedLog.direction})
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800">
                      <span className="text-neutral-400 block">Entrada / Stop / TP</span>
                      <span className="font-bold text-white">
                        ${selectedLog.entryPrice.toLocaleString()} / ${selectedLog.stopLoss.toLocaleString()} / ${selectedLog.takeProfit.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800">
                      <span className="text-neutral-400 block">Alocação / Risco</span>
                      <span className="font-bold text-amber-300">
                        ${selectedLog.positionValueUsd.toFixed(2)} ({selectedLog.riskPercent}% Risco)
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800">
                      <span className="text-neutral-400 block">Score Confluência</span>
                      <span className="font-bold text-emerald-400">
                        {selectedLog.confidenceScore}/100 ({selectedLog.confluenceCategory})
                      </span>
                    </div>
                  </div>

                  {/* Step-by-step Trace */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-neutral-300">Etapas Processadas neste Ticket:</div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {selectedLog.pipeline.map((p, idx) => (
                        <div
                          key={idx}
                          className="text-xs p-2 rounded-lg bg-neutral-950/60 border border-neutral-800/80 flex items-start justify-between"
                        >
                          <div className="flex items-start space-x-2">
                            {p.status === 'success' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                            )}
                            <div>
                              <span className="font-semibold text-neutral-200 mr-2">
                                {p.name}:
                              </span>
                              <span className="text-neutral-400">{p.details}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono shrink-0 ml-2">
                            {new Date(p.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Guardrails Matrix */}
          {activeTab === 'guardrails' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs leading-relaxed">
                <strong>Diretrizes Mandatórias de Execução:</strong> O sistema de autotrading do Trade AO nunca opera de forma cega. Todas as ordens passam obrigatoriamente pelos 6 guardrails abaixo antes de qualquer disparo para a corretora.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Stop Loss Obrigatório */}
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🛑</span>
                      <h4 className="text-sm font-bold text-white">1. Stop Loss Obrigatório</h4>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ATIVO
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Nenhuma operação é aberta sem Stop Loss válido e calculado com base no ATR. Sinais com SL zerado são imediatamente rejeitados com a regra <code>missing_stop_loss</code>.
                  </p>
                </div>

                {/* 2. Trava de Risco Máximo */}
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🛡️</span>
                      <h4 className="text-sm font-bold text-white">2. Limite de Risco por Trade (1%)</h4>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {g?.maxRiskPerTradePct || 1.0}% MÁX
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    O tamanho da posição é dimensionado dinamicamente: <code>(Saldo × Risco%) ÷ Distância_Stop</code>. Impede alocação excessiva ou risco desproporcional.
                  </p>
                </div>

                {/* 3. Daily Loss Limit (Circuit Breaker) */}
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">⚡</span>
                      <h4 className="text-sm font-bold text-white">3. Circuit Breaker Diário (3%)</h4>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {g?.dailyLossLimitPct || 3.0}% LIMITE
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Se a perda acumulada do dia atingir 3.0%, o robô entra imediatamente em pausa de segurança, rejeitando qualquer nova ordem com a regra <code>daily_loss_reached</code>.
                  </p>
                </div>

                {/* 4. Anti-Duplicação */}
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🚫</span>
                      <h4 className="text-sm font-bold text-white">4. Bloqueio de Entradas Duplicadas</h4>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      DEDUPLICAÇÃO ATIVA
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Impede abrir mais de uma posição na mesma direção para o mesmo par enquanto a anterior estiver aberta. Rejeição com <code>duplicate_entry</code>.
                  </p>
                </div>

                {/* 5. Anti-Sinal Antigo (TTL) */}
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">⏳</span>
                      <h4 className="text-sm font-bold text-white">5. Anti-Sinal Antigo (TTL &lt; 180s)</h4>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      TTL 180s
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Sinais técnicos gerados há mais de 3 minutos são considerados expirados/defasados pelo mercado e são bloqueados com a regra <code>stale_signal</code>.
                  </p>
                </div>

                {/* 6. Idempotência de Retry */}
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🔒</span>
                      <h4 className="text-sm font-bold text-white">6. Idempotência &amp; ClientOrderId</h4>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      ANTI-RETRY DUPLICADO
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Cada ordem possui um <code>idempotencyKey</code> e um <code>clientOrderId</code> determinístico. Se a rede reenviar a mesma requisição, o sistema devolve a ordem existente sem duplicá-la.
                  </p>
                </div>

                {/* 7. Trava Mandatória de Modo de Trading (FASE 19) */}
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3 col-span-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🛡️</span>
                      <h4 className="text-sm font-bold text-white">7. Feature Flag de Segurança: TRADING_MODE (FASE 19)</h4>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase ${
                        currentTradingMode === 'live'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : currentTradingMode === 'testnet'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      MODO ATUAL: {currentTradingMode.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed">
                    <strong>Regra de Ouro:</strong> O sistema <em>nunca ativa trading real automaticamente</em>. O padrão obrigatório é <code>TRADING_MODE=paper</code>. Somente quando explicitamente configurado como <code>live</code> o sistema poderá enviar ordens reais para a Binance Spot.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-neutral-400 font-medium mr-2">Alternar Flag do Sistema:</span>
                    <button
                      onClick={() => handleSetTradingMode('paper')}
                      disabled={isUpdatingMode || currentTradingMode === 'paper'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        currentTradingMode === 'paper'
                          ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400/50'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      <span>🧪 Paper (Simulação Segura)</span>
                    </button>

                    <button
                      onClick={() => handleSetTradingMode('testnet')}
                      disabled={isUpdatingMode || currentTradingMode === 'testnet'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        currentTradingMode === 'testnet'
                          ? 'bg-amber-600 text-white shadow-lg ring-2 ring-amber-400/50'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      <span>🟡 Testnet (Sandbox Binance)</span>
                    </button>

                    <button
                      onClick={() => handleSetTradingMode('live')}
                      disabled={isUpdatingMode || currentTradingMode === 'live'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        currentTradingMode === 'live'
                          ? 'bg-rose-600 text-white shadow-lg ring-2 ring-rose-400/50 animate-pulse'
                          : 'bg-neutral-800 hover:bg-rose-950/60 text-rose-300 border border-rose-900/40'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>🔴 Live (Produção Real)</span>
                    </button>
                  </div>

                  {modeFeedback && (
                    <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-amber-300 font-mono">
                      {modeFeedback}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Simulator & Retry Tester */}
          {activeTab === 'tester' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Simulador de Execução & Teste de Idempotência</h3>
                    <p className="text-xs text-neutral-400">
                      Dispare o fluxo de 11 etapas em ambiente seguro e teste a imunidade contra duplicação de retry.
                    </p>
                  </div>
                  <select
                    value={selectedPair}
                    onChange={(e) => setSelectedPair(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
                  >
                    <option value="BTC/USDT">BTC/USDT</option>
                    <option value="ETH/USDT">ETH/USDT</option>
                    <option value="SOL/USDT">SOL/USDT</option>
                    <option value="BNB/USDT">BNB/USDT</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleRunTestPipeline(false, false)}
                    disabled={isExecutingTest}
                    className="p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex flex-col items-center justify-center space-y-1 transition-all shadow-lg disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Executar Pipeline Completo</span>
                    <span className="text-[10px] font-normal opacity-80">(Nova chave idempotente)</span>
                  </button>

                  <button
                    onClick={() => handleRunTestPipeline(true, false)}
                    disabled={isExecutingTest || !lastIdempotencyKey}
                    className="p-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex flex-col items-center justify-center space-y-1 transition-all shadow-lg disabled:opacity-40"
                  >
                    <Key className="w-4 h-4" />
                    <span>Testar Retry (Mesma Chave)</span>
                    <span className="text-[10px] font-normal opacity-80">(Verificar Idempotência)</span>
                  </button>

                  <button
                    onClick={() => handleRunTestPipeline(false, true)}
                    disabled={isExecutingTest}
                    className="p-3 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs flex flex-col items-center justify-center space-y-1 transition-all shadow-lg disabled:opacity-50"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Simular Violação (Sem Stop)</span>
                    <span className="text-[10px] font-normal opacity-80">(Testar Bloqueio de Risco)</span>
                  </button>
                </div>

                {lastIdempotencyKey && (
                  <div className="text-[11px] font-mono text-neutral-400 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between">
                    <span>Última chave utilizada: <strong className="text-amber-300">{lastIdempotencyKey}</strong></span>
                    <span className="text-emerald-400">Protegida</span>
                  </div>
                )}
              </div>

              {/* Real-time Execution Pipeline Live Status */}
              {isExecutingTest && (
                <div className="p-4 rounded-xl bg-neutral-900 border border-amber-500/30 animate-pulse flex items-center space-x-3 text-xs text-amber-300">
                  <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Processando Pipeline: Etapa {activeStepIndex + 1} de 11...</span>
                </div>
              )}

              {/* Test Result Display */}
              {testResult && (
                <div
                  className={`p-5 rounded-2xl border text-xs space-y-3 ${
                    testResult.idempotentReplay
                      ? 'bg-cyan-950/30 border-cyan-800 text-cyan-200'
                      : testResult.success
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/30 border-rose-800 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span className="flex items-center space-x-2">
                      {testResult.idempotentReplay ? (
                        <>
                          <Key className="w-4 h-4 text-cyan-400" />
                          <span>Intercepção Idempotente com Sucesso!</span>
                        </>
                      ) : testResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Pipeline Executado com Sucesso!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span>Operação Bloqueada pelo Guardrail</span>
                        </>
                      )}
                    </span>
                    <span className="font-mono text-xs opacity-80">
                      {testResult.record?.id || 'TEST'}
                    </span>
                  </div>

                  <p className="text-xs">
                    {testResult.idempotentReplay
                      ? 'A requisição repetida foi interceptada pelo store de idempotência. Nenhuma ordem duplicada foi enviada para o mercado.'
                      : testResult.error
                      ? `Motivo do Bloqueio: ${testResult.error}`
                      : `Ordem enviada com sucesso para o par ${testResult.record?.par} (${testResult.record?.direction}).`}
                  </p>

                  {testResult.record && (
                    <div className="pt-2 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                      <div>Status: {testResult.record.status}</div>
                      <div>SL: ${testResult.record.stopLoss}</div>
                      <div>TP: ${testResult.record.takeProfit}</div>
                      <div>Risco: {testResult.record.riskPercent}%</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Audits History */}
          {activeTab === 'audits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Log de Auditoria em Tempo Real</h3>
                <span className="text-xs text-neutral-400">
                  Mostrando os últimos {engineStatus?.recentExecutions?.length || 0} registros
                </span>
              </div>

              {engineStatus?.recentExecutions && engineStatus.recentExecutions.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {engineStatus.recentExecutions.map((log) => (
                    <div
                      key={log.id}
                      onClick={() => {
                        setSelectedLog(log);
                        setActiveTab('pipeline');
                      }}
                      className="p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            log.status === 'EXECUTED' || log.status === 'CLOSED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : log.status === 'APPROVED'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {log.status === 'EXECUTED' || log.status === 'CLOSED' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : log.status === 'APPROVED' ? (
                            <Zap className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white">{log.par}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                log.direction === 'LONG'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {log.direction}
                            </span>
                            <span className="text-neutral-400 text-[11px]">
                              Score: {log.confidenceScore}/100
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            {log.rejectionReason ? (
                              <span className="text-rose-400">Rejeitado: {log.rejectionReason}</span>
                            ) : (
                              <span>Alocação: ${log.positionValueUsd.toFixed(2)} | Stop: ${log.stopLoss.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] font-mono text-neutral-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-[10px] text-amber-400 flex items-center justify-end space-x-1 mt-0.5">
                          <span>Ver Pipeline</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-500 text-xs bg-neutral-900/40 rounded-xl border border-neutral-800">
                  Nenhuma execução registrada no momento. Dispare o simulador para testar.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Motor de Execução FASE 12 &amp; 19 Operacional (TRADING_MODE: {currentTradingMode.toUpperCase()})</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors"
          >
            Fechar Painel
          </button>
        </div>

        {/* Live Mode Confirmation Dialog (FASE 19 Protection) */}
        {showLiveConfirmModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4">
            <div className="bg-neutral-900 border-2 border-rose-500/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center space-x-3 text-rose-400">
                <ShieldAlert className="w-8 h-8 shrink-0 animate-bounce" />
                <div>
                  <h3 className="text-base font-bold text-white">Confirmação de Trading Real</h3>
                  <span className="text-xs text-rose-400 font-semibold">FASE 19 — PROTEÇÃO MANDATÓRIA</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-xs text-rose-200 leading-relaxed space-y-2">
                <p>
                  <strong>ATENÇÃO:</strong> Você está prestes a ativar <code>TRADING_MODE=live</code>.
                </p>
                <p>
                  Neste modo, ordens executadas pelo autotrader ou disparadas no terminal serão transmitidas como <strong>ordens reais na Binance Spot</strong> usando suas chaves de API conectadas.
                </p>
                <p className="text-[11px] text-rose-300/80">
                  O sistema continuará aplicando todos os 6 guardrails de risco (Stop Loss obrigatório, 1% de risco, Circuit Breaker de 3%, etc.).
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowLiveConfirmModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
                >
                  Cancelar (Manter Seguro)
                </button>
                <button
                  onClick={() => executeModeChange('live')}
                  disabled={isUpdatingMode}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center space-x-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isUpdatingMode ? 'Ativando...' : 'Confirmar e Ativar LIVE'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

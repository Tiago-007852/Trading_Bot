import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Clock,
  Sliders,
  Calculator,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Layers,
  Percent,
  TrendingDown,
  Lock,
  DollarSign,
  Info,
} from 'lucide-react';
import { RiskSettings, RiskStatus, PositionSizingResult } from '../types';

interface RiskManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBalance: number;
  currentPar: string;
  currentPrice: number;
  onRefreshRiskStatus?: () => void;
}

const AVAILABLE_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'SOL/USDT',
  'BNB/USDT',
  'ADA/USDT',
  'XRP/USDT',
  'AVAX/USDT',
  'DOGE/USDT',
];

export const RiskManagerModal: React.FC<RiskManagerModalProps> = ({
  isOpen,
  onClose,
  userBalance,
  currentPar,
  currentPrice,
  onRefreshRiskStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'settings' | 'calculator'>('status');
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(null);
  const [settingsForm, setSettingsForm] = useState<RiskSettings>({
    risk_per_trade_pct: 1.0,
    max_daily_loss_pct: 3.0,
    max_open_positions: 2,
    allowed_pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'],
    mandatory_stop_loss: true,
    min_risk_reward_ratio: 1.5,
    loss_cooldown_minutes: 15,
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resettingPause, setResettingPause] = useState(false);

  // Position Sizing Calculator state
  const [calcCapital, setCalcCapital] = useState<number>(userBalance || 100);
  const [calcRiskPct, setCalcRiskPct] = useState<number>(1.0);
  const [calcEntryPrice, setCalcEntryPrice] = useState<number>(currentPrice || 96000);
  const [calcStopLoss, setCalcStopLoss] = useState<number>(
    currentPrice ? Math.round(currentPrice * 0.985 * 100) / 100 : 94560
  );
  const [calcResult, setCalcResult] = useState<PositionSizingResult | null>(null);

  const fetchRiskData = async () => {
    try {
      const [resStatus, resSettings] = await Promise.all([
        fetch('/api/risk/status'),
        fetch('/api/risk/settings'),
      ]);

      if (resStatus.ok) {
        const data: RiskStatus = await resStatus.json();
        setRiskStatus(data);
      }

      if (resSettings.ok) {
        const data = await resSettings.json();
        if (data.settings) {
          setSettingsForm(data.settings);
          setCalcRiskPct(data.settings.risk_per_trade_pct || 1.0);
        }
      }
    } catch (e) {
      console.error('Error fetching risk data:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRiskData();
      if (userBalance > 0) setCalcCapital(userBalance);
      if (currentPrice > 0) {
        setCalcEntryPrice(currentPrice);
        setCalcStopLoss(Math.round(currentPrice * 0.985 * 100) / 100);
      }
    }
  }, [isOpen, userBalance, currentPrice]);

  // Recalculate position sizing on input changes
  useEffect(() => {
    const calc = () => {
      const capital = Number(calcCapital);
      const riskPct = Number(calcRiskPct);
      const entry = Number(calcEntryPrice);
      const sl = Number(calcStopLoss);

      if (capital <= 0 || entry <= 0 || sl <= 0 || entry === sl) {
        setCalcResult({
          valid: false,
          position_size: 0,
          position_value_usd: 0,
          risk_amount_usd: 0,
          distance_pct: 0,
          stop_distance_usd: 0,
          capital,
          risk_percent: riskPct,
          error: 'Valores inválidos ou Stop Loss idêntico ao preço de entrada.',
        });
        return;
      }

      const distance = Math.abs(entry - sl);
      const riskUsd = capital * (riskPct / 100.0);
      const distancePct = (distance / entry) * 100.0;
      const rawUnits = riskUsd / distance;
      let posValue = rawUnits * entry;

      const maxPos = capital * 0.95;
      let effectiveRisk = riskUsd;
      if (posValue > maxPos) {
        posValue = maxPos;
        effectiveRisk = (posValue / entry) * distance;
      }

      setCalcResult({
        valid: true,
        position_size: Math.round(rawUnits * 1000000) / 1000000,
        position_value_usd: Math.round(posValue * 100) / 100,
        risk_amount_usd: Math.round(effectiveRisk * 100) / 100,
        distance_pct: Math.round(distancePct * 100) / 100,
        stop_distance_usd: Math.round(distance * 100) / 100,
        capital,
        risk_percent: riskPct,
      });
    };

    calc();
  }, [calcCapital, calcRiskPct, calcEntryPrice, calcStopLoss]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/risk/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsForm }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        await fetchRiskData();
        if (onRefreshRiskStatus) onRefreshRiskStatus();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving risk settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetCircuitBreaker = async () => {
    setResettingPause(true);
    try {
      const res = await fetch('/api/risk/reset-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        await fetchRiskData();
        if (onRefreshRiskStatus) onRefreshRiskStatus();
      }
    } catch (e) {
      console.error('Error resetting pause:', e);
    } finally {
      setResettingPause(false);
    }
  };

  const togglePair = (pair: string) => {
    const current = settingsForm.allowed_pairs || [];
    if (current.includes(pair)) {
      if (current.length === 1) return; // at least 1 pair required
      setSettingsForm({ ...settingsForm, allowed_pairs: current.filter((p) => p !== pair) });
    } else {
      setSettingsForm({ ...settingsForm, allowed_pairs: [...current, pair] });
    }
  };

  if (!isOpen) return null;

  const maxDaily = riskStatus?.settings?.max_daily_loss_pct || 3.0;
  const currentDailyLoss = riskStatus?.daily_loss_pct || 0.0;
  const lossProgressPct = Math.min(100, (currentDailyLoss / maxDaily) * 100);

  return (
    <div
      id="risk-manager-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="risk-manager-container"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Trade AO Risk Manager</h2>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-wider">
                  Fase 9
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Proteção estrita de capital, circuit breaker e dimensionamento matemático
              </p>
            </div>
          </div>

          <button
            id="btn-close-risk-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2 gap-2">
          <button
            id="tab-risk-status"
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'status'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Status & Circuit Breaker</span>
          </button>

          <button
            id="tab-risk-settings"
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'settings'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configurações de Risco</span>
          </button>

          <button
            id="tab-risk-calculator"
            onClick={() => setActiveTab('calculator')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'calculator'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Calculadora de Posição</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200 text-sm">
          {/* TAB 1: STATUS & CIRCUIT BREAKER */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              {/* Circuit Breaker Banner */}
              <div
                id="circuit-breaker-banner"
                className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  riskStatus?.autotrade_paused
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    riskStatus?.autotrade_paused
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {riskStatus?.autotrade_paused ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">
                      {riskStatus?.autotrade_paused
                        ? 'CIRCUITO DE PROTEÇÃO DISPARADO (AUTOTRADING PAUSADO)'
                        : 'AUTOTRADING OPERANDO DENTRO DOS LIMITES DE RISCO'}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        riskStatus?.autotrade_paused
                          ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40 animate-pulse'
                          : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {riskStatus?.autotrade_paused ? 'PAUSADO' : 'ATIVO'}
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-slate-300">
                    {riskStatus?.pause_reason ||
                      'O autotrading monitora perdas contínuas e limites diários. Nenhuma operação fora dos parâmetros é permitida.'}
                  </p>

                  {riskStatus?.autotrade_paused && (
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        id="btn-reset-circuit-breaker"
                        onClick={handleResetCircuitBreaker}
                        disabled={resettingPause}
                        className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{resettingPause ? 'Reiniciando...' : 'Desbloquear / Reiniciar Autotrading'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Daily Loss Gauge */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-semibold">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                      Perda Diária
                    </span>
                    <span className="font-mono text-slate-300">Max {maxDaily}%</span>
                  </div>

                  <div className="flex items-baseline justify-between font-mono">
                    <span
                      className={`text-lg font-bold ${
                        currentDailyLoss >= maxDaily ? 'text-rose-400' : 'text-slate-100'
                      }`}
                    >
                      -{currentDailyLoss.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-400">limite: -{maxDaily.toFixed(1)}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        lossProgressPct >= 100
                          ? 'bg-rose-500'
                          : lossProgressPct >= 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${lossProgressPct}%` }}
                    />
                  </div>
                </div>

                {/* 2. Cooldown After Loss Status */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      Cooldown Pós-Loss
                    </span>
                    <span className="font-mono text-slate-300">
                      {riskStatus?.settings?.loss_cooldown_minutes || 15}m
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between font-mono">
                    <span
                      className={`text-lg font-bold ${
                        riskStatus?.in_cooldown ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
                      }`}
                    >
                      {riskStatus?.in_cooldown
                        ? `${riskStatus.cooldown_remaining_minutes} min`
                        : 'Livre'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {riskStatus?.in_cooldown ? 'Pausa protetiva' : 'Pronto p/ sinal'}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    {riskStatus?.in_cooldown
                      ? 'Cooldown ativo para evitar overtrading emocional.'
                      : 'Nenhum bloqueio temporal ativo no momento.'}
                  </p>
                </div>

                {/* 3. Open Positions Gauge */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-semibold">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Posições Abertas
                    </span>
                    <span className="font-mono text-slate-300">
                      Max {riskStatus?.settings?.max_open_positions || 2}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-lg font-bold text-slate-100">
                      {riskStatus?.open_positions_count || 0} / {riskStatus?.settings?.max_open_positions || 2}
                    </span>
                    <span className="text-xs text-slate-400">simultâneas</span>
                  </div>

                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (((riskStatus?.open_positions_count || 0) /
                            (riskStatus?.settings?.max_open_positions || 2)) *
                            100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Active Rules Checklist */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Diretrizes Mandatórias de Risco do Trade AO
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Risco por trade fixado em <strong>{settingsForm.risk_per_trade_pct}%</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Stop Loss <strong>obrigatório</strong> em toda ordem
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Relação Risco:Retorno mínima de <strong>{settingsForm.min_risk_reward_ratio}R</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Pares permitidos: <strong>{settingsForm.allowed_pairs?.length || 4} ativos</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURAÇÕES DE RISCO */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              {saveSuccess && (
                <div className="bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs p-3 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Configurações do Risk Manager salvas com sucesso!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Risco por Operação */}
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Risco por Operação (%)</span>
                    <span className="text-amber-400 font-mono">{settingsForm.risk_per_trade_pct}%</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Porcentagem máxima do capital que pode ser perdida em um único trade.
                  </p>
                  <input
                    type="range"
                    min="0.25"
                    max="5.0"
                    step="0.25"
                    value={settingsForm.risk_per_trade_pct}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, risk_per_trade_pct: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0.25% (Conservador)</span>
                    <span>1.0% (Padrão)</span>
                    <span>5.0% (Agressivo)</span>
                  </div>
                </div>

                {/* Perda Máxima Diária (Circuit Breaker) */}
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Perda Máxima Diária (%)</span>
                    <span className="text-rose-400 font-mono">{settingsForm.max_daily_loss_pct}%</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Limite que pausa o Autotrading automaticamente pelo resto do dia.
                  </p>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={settingsForm.max_daily_loss_pct}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, max_daily_loss_pct: parseFloat(e.target.value) })
                    }
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1.0%</span>
                    <span>3.0% (Recomendado)</span>
                    <span>10.0%</span>
                  </div>
                </div>

                {/* Máximo de Posições Simultâneas */}
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Máx. Posições Simultâneas</span>
                    <span className="text-indigo-400 font-mono">{settingsForm.max_open_positions}</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Número máximo de ordens abertas concorrentemente.
                  </p>
                  <select
                    value={settingsForm.max_open_positions}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, max_open_positions: parseInt(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-400"
                  >
                    <option value={1}>1 Posição (Máxima segurança)</option>
                    <option value={2}>2 Posições (Recomendado)</option>
                    <option value={3}>3 Posições</option>
                    <option value={5}>5 Posições</option>
                  </select>
                </div>

                {/* Cooldown após Loss */}
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Cooldown Pós-Loss (Minutos)</span>
                    <span className="text-sky-400 font-mono">{settingsForm.loss_cooldown_minutes} min</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Tempo de espera obrigatório antes do próximo trade após um stop atingido.
                  </p>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={settingsForm.loss_cooldown_minutes}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        loss_cooldown_minutes: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-400"
                  />
                </div>

                {/* Risco:Retorno Mínimo */}
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Relação Risco:Retorno Mínima</span>
                    <span className="text-emerald-400 font-mono">{settingsForm.min_risk_reward_ratio}R</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Take Profit deve ser pelo menos X vezes a distância do Stop Loss.
                  </p>
                  <select
                    value={settingsForm.min_risk_reward_ratio}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, min_risk_reward_ratio: parseFloat(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-400"
                  >
                    <option value={1.2}>1:1.2R</option>
                    <option value={1.5}>1:1.5R (Recomendado)</option>
                    <option value={2.0}>1:2.0R (Alta Assimetria)</option>
                    <option value={3.0}>1:3.0R (Sniper)</option>
                  </select>
                </div>

                {/* Stop Loss Obrigatório Toggle */}
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-300 block">Stop Loss Obrigatório</span>
                    <span className="text-[11px] text-slate-400">
                      Rejeita qualquer trade que não contenha Stop Loss.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsForm.mandatory_stop_loss}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, mandatory_stop_loss: e.target.checked })
                    }
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Pares Permitidos (Whitelist) */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Pares Permitidos para Autotrading (Whitelist)
                </label>
                <p className="text-[11px] text-slate-400">
                  O autotrade rejeitará automaticamente sinais de pares não autorizados.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {AVAILABLE_PAIRS.map((pair) => {
                    const isSelected = settingsForm.allowed_pairs?.includes(pair);
                    return (
                      <button
                        type="button"
                        key={pair}
                        onClick={() => togglePair(pair)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                            : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        {isSelected ? `✓ ${pair}` : `+ ${pair}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  {saving ? 'Salvando...' : 'Salvar Diretrizes de Risco'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: CALCULADORA DE POSIÇÃO */}
          {activeTab === 'calculator' && (
            <div className="space-y-5">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Info className="w-4 h-4" />
                  <span>Fórmula Matemática de Dimensionamento</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  Tamanho = (Capital × Risco %) ÷ |Preço de Entrada - Stop Loss|
                </p>
                <p className="text-[11px] text-slate-400">
                  Garante que você perca exatamente o valor do risco estipulado (ex: 1%) caso o stop seja atingido,
                  independentemente da volatilidade do ativo.
                </p>
              </div>

              {/* Calculator Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Capital Total ($ ou Tokens)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      value={calcCapital}
                      onChange={(e) => setCalcCapital(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">$</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Risco Desejado (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={calcRiskPct}
                      onChange={(e) => setCalcRiskPct(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">%</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Preço de Entrada ({currentPar})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={calcEntryPrice}
                      onChange={(e) => setCalcEntryPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">$</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Preço de Stop Loss ($)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={calcStopLoss}
                      onChange={(e) => setCalcStopLoss(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">$</span>
                  </div>
                </div>
              </div>

              {/* Sizing Output Card */}
              {calcResult && (
                <div
                  className={`border rounded-xl p-4 space-y-3 ${
                    calcResult.valid
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-100'
                      : 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Resultado do Dimensionamento Matemático</span>
                    <span>{calcResult.valid ? '✅ Cálculo Válido' : '⚠️ Inválido'}</span>
                  </div>

                  {calcResult.valid ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Risco em Dólar</span>
                        <strong className="text-rose-400 text-sm">
                          ${calcResult.risk_amount_usd.toFixed(2)}
                        </strong>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Distância Stop</span>
                        <strong className="text-amber-400 text-sm">
                          {calcResult.distance_pct.toFixed(2)}%
                        </strong>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Tamanho (Units)</span>
                        <strong className="text-slate-100 text-sm">
                          {calcResult.position_size.toFixed(4)}
                        </strong>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Valor Posição</span>
                        <strong className="text-emerald-400 text-sm">
                          ${calcResult.position_value_usd.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-rose-300">{calcResult.error}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>Trade AO v2.4 • Risk Management Guardrails</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { SignalItem, ConfluenceTier } from '../types';
import { Radio, CheckCircle2, XCircle, Clock, ArrowUpRight, ArrowDownRight, Sparkles, ChevronDown, ChevronUp, Info, Activity, Flame, Layers } from 'lucide-react';

interface SignalsTerminalProps {
  signals: SignalItem[];
  stats: {
    total: number;
    acertos: number;
    derrotas: number;
    winRatePct: number | null;
    pendentes: number;
  };
  generating: boolean;
  onGenerateSignal: () => void;
  onResolveSignal: (id: string, forceStatus?: 'win' | 'loss') => void;
}

type PlatformFilter = 'all' | 'binance' | 'bybit' | 'quotex' | 'pocket';

const getTierBadge = (tier?: ConfluenceTier, score?: number) => {
  const currentTier = tier || (score && score >= 90 ? 'VERY STRONG' : score && score >= 80 ? 'STRONG' : score && score >= 70 ? 'GOOD' : score && score >= 60 ? 'WEAK' : 'IGNORE');

  switch (currentTier) {
    case 'VERY STRONG':
      return {
        label: 'MUITO FORTE',
        color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        dot: 'bg-emerald-400',
      };
    case 'STRONG':
      return {
        label: 'FORTE',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-500',
      };
    case 'GOOD':
      return {
        label: 'BOM',
        color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        dot: 'bg-amber-400',
      };
    case 'WEAK':
      return {
        label: 'FRACO',
        color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        dot: 'bg-orange-400',
      };
    default:
      return {
        label: 'IGNORAR',
        color: 'bg-slate-700/40 text-slate-400 border-slate-700',
        dot: 'bg-slate-500',
      };
  }
};

export const SignalsTerminal: React.FC<SignalsTerminalProps> = ({
  signals,
  stats,
  generating,
  onGenerateSignal,
  onResolveSignal,
}) => {
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>('all');

  const toggleExpand = (id: string) => {
    setExpandedSignalId(prev => (prev === id ? null : id));
  };

  // Find the top signal (highest confluence score)
  const topSignal = signals.length > 0
    ? [...signals].sort((a, b) => (b.score || 0) - (a.score || 0))[0]
    : null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">📡 Signal Center</h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-semibold">
                Multi-Destino
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Varredura com Score de Confluência e Classificação por Plataforma</p>
          </div>
        </div>

        <button
          onClick={onGenerateSignal}
          disabled={generating}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Sparkles className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
          <span>{generating ? 'Varrendo Mercados...' : 'Atualizar Varredura'}</span>
        </button>
      </div>

      {/* Platform Classification Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 text-[11px]">
        <button
          onClick={() => setSelectedPlatform('all')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
            selectedPlatform === 'all'
              ? 'bg-slate-700 text-slate-100 shadow-sm'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3 h-3" />
          Todos os Mercados
        </button>

        <button
          onClick={() => setSelectedPlatform('binance')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
            selectedPlatform === 'binance'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-slate-800/60 text-slate-400 hover:text-amber-400'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          🟡 Binance (API)
        </button>

        <button
          onClick={() => setSelectedPlatform('bybit')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
            selectedPlatform === 'bybit'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-slate-800/60 text-slate-400 hover:text-blue-400'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          🔵 Bybit
        </button>

        <button
          onClick={() => setSelectedPlatform('quotex')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
            selectedPlatform === 'quotex'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'bg-slate-800/60 text-slate-400 hover:text-purple-400'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          🟣 Quotex (Manual)
        </button>

        <button
          onClick={() => setSelectedPlatform('pocket')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
            selectedPlatform === 'pocket'
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
              : 'bg-slate-800/60 text-slate-400 hover:text-orange-400'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          🟠 Pocket Option (Manual)
        </button>
      </div>

      {/* Win rate stats banner */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2 text-center">
          <span className="text-[10px] text-slate-400 font-medium block">Taxa de Acerto</span>
          <span className="text-xs font-bold text-emerald-400">
            {stats.winRatePct !== null ? `${stats.winRatePct}%` : 'Sem dados'}
          </span>
        </div>
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2 text-center">
          <span className="text-[10px] text-slate-400 font-medium block">Histórico Fechado</span>
          <span className="text-xs font-bold text-slate-200">
            {stats.acertos}W / {stats.derrotas}L
          </span>
        </div>
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2 text-center">
          <span className="text-[10px] text-slate-400 font-medium block">Sinais Ativos</span>
          <span className="text-xs font-bold text-amber-400">{stats.pendentes}</span>
        </div>
      </div>

      {/* Signals List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[340px]">
        {signals.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Nenhum sinal gerado ainda. Clique em "Atualizar Varredura" para escanear os pares.
          </div>
        ) : (
          signals.map((sig, idx) => {
            const sigId = sig.id || String(sig.ts || idx);
            const isLong = sig.direcao === 'LONG';
            const isPending = sig.status === 'pending';
            const isWin = sig.status === 'win';
            const score = typeof sig.score === 'number' ? sig.score : 75;
            const tierBadge = getTierBadge(sig.scoreCategory, score);
            const isExpanded = expandedSignalId === sigId;
            const isTop = topSignal && topSignal.id === sig.id;

            return (
              <div
                key={sigId}
                className={`bg-slate-950/90 border rounded-xl p-3 hover:border-slate-700 transition-colors ${
                  isTop ? 'border-amber-500/40 shadow-sm shadow-amber-500/10' : 'border-slate-800/80'
                }`}
              >
                {/* Top Signal Spotlight Banner */}
                {isTop && (
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-amber-500/20 text-[10px] font-bold text-amber-400">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      🔥 TOP SIGNAL DO MOMENTO (MAIOR CONFLUÊNCIA)
                    </span>
                    <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded">
                      Score #{score}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">{sig.par}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                      {sig.timeframe}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                        isLong
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {sig.direcao}
                    </span>

                    {/* Confluence Score Pill */}
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${tierBadge.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tierBadge.dot}`} />
                      <span>{score}/100 · {tierBadge.label}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {isPending ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-pulse" />
                        Pendente
                      </span>
                      <button
                        onClick={() => onResolveSignal(sigId)}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 ml-1 cursor-pointer"
                        title="Verificar se atingiu alvo ou stop"
                      >
                        Checar
                      </button>
                    </div>
                  ) : isWin ? (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      ALVO (WIN)
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      STOP LOSS
                    </span>
                  )}
                </div>

                {/* Price targets */}
                <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 mb-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">Entry</span>
                    <span className="text-slate-200 font-semibold">${sig.entrada.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-500 block font-sans">TP (Alvo)</span>
                    <span className="text-emerald-400 font-semibold">${sig.alvo.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-500 block font-sans">SL (Stop)</span>
                    <span className="text-rose-400 font-semibold">${sig.stop.toLocaleString()}</span>
                  </div>
                </div>

                {/* Confluence Score Progress Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Activity className="w-3 h-3 text-cyan-400" />
                      Confluência Técnica (8 Pilares)
                    </span>
                    <span className="font-bold text-slate-200">{score}/100</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : score >= 70 ? 'bg-gradient-to-r from-amber-500 to-emerald-400' : score >= 60 ? 'bg-orange-500' : 'bg-slate-600'
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>

                {/* Platform Destination Badges */}
                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 my-1.5 bg-slate-900/40 px-2 py-1 rounded">
                  <span className="text-slate-500 font-medium">Destinos:</span>
                  <span className="text-amber-400 bg-amber-500/10 px-1 rounded border border-amber-500/20">🟡 Binance</span>
                  <span className="text-blue-400 bg-blue-500/10 px-1 rounded border border-blue-500/20">🔵 Bybit</span>
                  <span className="text-purple-400 bg-purple-500/10 px-1 rounded border border-purple-500/20">🟣 Quotex (Manual)</span>
                  <span className="text-orange-400 bg-orange-500/10 px-1 rounded border border-orange-500/20">🟠 Pocket Option (Manual)</span>
                </div>

                {/* Toggle details */}
                <button
                  onClick={() => toggleExpand(sigId)}
                  className="w-full py-1 text-[10px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 border-t border-slate-900 cursor-pointer"
                >
                  {isExpanded ? (
                    <>
                      <span>Ocultar detalhes da confluência</span>
                      <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      <span>Ver confluência detalhada & indicadores</span>
                      <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>

                {/* Expanded breakdown */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-800 text-[10px] space-y-1.5">
                    {sig.reasons && sig.reasons.length > 0 && (
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80 space-y-1">
                        <span className="font-semibold text-slate-300 block">Fatores de Confluência:</span>
                        {sig.reasons.map((r, rIdx) => (
                          <div key={rIdx} className="text-slate-400 flex items-start gap-1">
                            <span className="text-emerald-400">•</span>
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-slate-400 bg-slate-900/50 p-2 rounded">
                      <div>
                        <span className="text-slate-500 block">RSI (14):</span>
                        <span className="text-slate-200 font-mono">{sig.rsi}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">EMA 9 / 21:</span>
                        <span className="text-slate-200 font-mono">${sig.ema9?.toLocaleString()} / ${sig.ema21?.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-500 italic">
                      Estratégia: {sig.estrategia || 'Trade AO Multi-Factor Confluence Engine v2'}
                    </div>
                  </div>
                )}

                {/* Timestamp footer */}
                <div className="flex items-center justify-between text-[9px] text-slate-500 mt-2">
                  <span>Timestamp: {new Date(sig.timestamp || sig.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="text-[9px] text-slate-500">Confluência ≠ Probabilidade de Lucro</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Educational & Platform Disclaimer */}
      <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-start gap-1.5 text-[10px] text-slate-500 leading-tight">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong className="text-slate-400">Classificação de Plataformas:</strong> Sinais compatíveis com Binance e Bybit. Quotex e Pocket Option atuam unicamente como destinos de referência para execução manual pelo usuário, sem automação desautorizada.
        </span>
      </div>
    </div>
  );
};

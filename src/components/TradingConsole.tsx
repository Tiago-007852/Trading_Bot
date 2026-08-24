import React, { useState, useEffect } from 'react';
import { UserProfile, ActiveTrade, CryptoTicker, RiskStatus } from '../types';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Zap,
  Timer,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

interface TradingConsoleProps {
  user: UserProfile | null;
  currentPar: string;
  ticker: CryptoTicker | null;
  onOpenTrade: (
    direcao: 'COMPRAR' | 'VENDER',
    valor: number,
    stopLoss?: number,
    takeProfit?: number
  ) => Promise<ActiveTrade | null>;
  onSettleTrade: (tradeId: string) => Promise<void>;
  onToggleAutotrade: (enabled: boolean) => Promise<void>;
  onChangeRisk: (risco: number) => Promise<void>;
  activeTrade: ActiveTrade | null;
  onOpenRiskManager?: () => void;
}

export const TradingConsole: React.FC<TradingConsoleProps> = ({
  user,
  currentPar,
  ticker,
  onOpenTrade,
  onSettleTrade,
  onToggleAutotrade,
  onChangeRisk,
  activeTrade,
  onOpenRiskManager,
}) => {
  const [stakeAmount, setStakeAmount] = useState<string>('5');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(null);

  const tokens = user ? user.tokens : 0;
  const autotradeOn = user ? user.autotrade : false;
  const currentRisk = user ? user.risco : 0.25;

  const currentPrice = ticker?.price || 0;

  // Set default SL and TP when current price loads or pair changes
  useEffect(() => {
    if (currentPrice > 0 && (!stopLoss || !takeProfit)) {
      setStopLoss((currentPrice * 0.985).toFixed(2));
      setTakeProfit((currentPrice * 1.025).toFixed(2));
    }
  }, [currentPrice, currentPar]);

  // Fetch live risk status
  const fetchRiskStatus = async () => {
    try {
      const res = await fetch('/api/risk/status');
      if (res.ok) {
        const data = await res.json();
        setRiskStatus(data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchRiskStatus();
    const interval = setInterval(fetchRiskStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for active 20s trade
  useEffect(() => {
    if (!activeTrade || activeTrade.status !== 'open') {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((activeTrade.fechaEm - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onSettleTrade(activeTrade.id);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [activeTrade]);

  const handleTrade = async (direcao: 'COMPRAR' | 'VENDER') => {
    setTradeError(null);
    const val = parseFloat(stakeAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0 || val > tokens) {
      setTradeError('Valor de stake inválido ou saldo insuficiente.');
      return;
    }

    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;

    setLoading(true);
    try {
      const res = await onOpenTrade(direcao, val, sl, tp);
      if (!res) {
        setTradeError('Operação rejeitada pelo Risk Manager ou falha na execução.');
      }
    } catch (err: any) {
      setTradeError(err.message || 'Erro ao executar ordem.');
    } finally {
      setLoading(false);
      fetchRiskStatus();
    }
  };

  const setPercentAmount = (pct: number) => {
    const calculated = Math.max(1, Math.floor(tokens * pct * 10) / 10);
    setStakeAmount(calculated.toString());
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col h-full space-y-4">
      {/* Autotrade Banner with Risk Manager Button */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${
              riskStatus?.autotrade_paused
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : autotradeOn
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {riskStatus?.autotrade_paused ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">Autotrading IA</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  riskStatus?.autotrade_paused
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : autotradeOn
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {riskStatus?.autotrade_paused
                  ? 'PAUSADO (RISCO)'
                  : autotradeOn
                  ? 'LIGADO'
                  : 'DESLIGADO'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Risco {riskStatus?.settings?.risk_per_trade_pct || Math.round(currentRisk * 100)}% •
              Max Diário {riskStatus?.settings?.max_daily_loss_pct || 3.0}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenRiskManager && (
            <button
              id="btn-open-risk-console"
              onClick={onOpenRiskManager}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
              title="Gerenciar Diretrizes de Risco"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onToggleAutotrade(!autotradeOn)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              riskStatus?.autotrade_paused
                ? 'bg-amber-600/80 hover:bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : autotradeOn
                ? 'bg-rose-600/80 hover:bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
            }`}
          >
            {riskStatus?.autotrade_paused
              ? 'Ver Risco'
              : autotradeOn
              ? 'Pausar'
              : 'Iniciar'}
          </button>
        </div>
      </div>

      {/* Live Risk Guardrail Indicator */}
      <div className="bg-slate-950/70 border border-slate-800/80 p-2.5 rounded-xl text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-300 font-medium">Risk Guard:</span>
          <span className="text-[11px] text-slate-400">
            Perda Diária:{' '}
            <strong
              className={
                (riskStatus?.daily_loss_pct || 0) >= (riskStatus?.settings?.max_daily_loss_pct || 3)
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }
            >
              -{(riskStatus?.daily_loss_pct || 0).toFixed(1)}%
            </strong>{' '}
            / -{(riskStatus?.settings?.max_daily_loss_pct || 3.0).toFixed(1)}%
          </span>
        </div>

        {riskStatus?.in_cooldown ? (
          <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-mono animate-pulse">
            Cooldown {riskStatus.cooldown_remaining_minutes}m
          </span>
        ) : (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
            SL Obrigatório ✓
          </span>
        )}
      </div>

      {/* Manual Trading Form */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">Operação Manual (20s)</span>
          <span className="text-xs text-slate-400 font-mono">
            Saldo: <strong className="text-emerald-400">{tokens.toFixed(2)} 💎</strong>
          </span>
        </div>

        {/* Stake input */}
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Valor em Tokens</span>
            <span>Lucro potencial: +5%</span>
          </div>
          <div className="relative">
            <input
              type="number"
              min="0.5"
              max={tokens}
              step="1"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm font-semibold text-white outline-none transition-colors"
              placeholder="Ex: 5"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">TOKENS</span>
          </div>

          {/* Quick buttons */}
          <div className="flex gap-1.5 mt-2">
            {[0.1, 0.25, 0.5, 1.0].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setPercentAmount(pct)}
                className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors"
              >
                {pct === 1.0 ? 'MAX' : `${pct * 100}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Stop Loss and Take Profit inputs */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <span className="text-[10px] text-slate-400 block mb-0.5">Stop Loss ($)</span>
            <input
              type="number"
              step="0.01"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="Ex: 94500"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block mb-0.5">Take Profit ($)</span>
            <input
              type="number"
              step="0.01"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Ex: 98000"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Trade Error / Risk Rejection Box */}
        {tradeError && (
          <div className="bg-rose-950/40 border border-rose-500/40 p-2.5 rounded-lg text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{tradeError}</span>
          </div>
        )}

        {/* Active Trade Box (if ongoing) */}
        {activeTrade && (
          <div
            className={`border rounded-xl p-3 space-y-2 ${
              activeTrade.status === 'open'
                ? 'bg-sky-950/40 border-sky-500/40 animate-pulse'
                : activeTrade.resultado === 'win'
                ? 'bg-emerald-950/40 border-emerald-500/40'
                : 'bg-rose-950/40 border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-slate-200">
                <Timer className="w-3.5 h-3.5 text-sky-400" />
                {activeTrade.status === 'open' ? 'Operação em Andamento' : 'Operação Concluída'}
              </span>
              <span className="font-mono font-bold text-sky-400">
                {activeTrade.status === 'open' ? `${timeLeft}s restantes` : activeTrade.resultado?.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/80 p-2 rounded-lg">
              <div>
                <span className="text-[10px] text-slate-400 block">Abertura ({activeTrade.direcao})</span>
                <span className="text-slate-200">${activeTrade.abertura.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Atual / Fechamento</span>
                <span className="text-slate-200">${(activeTrade.fechamento || ticker?.price || 0).toLocaleString()}</span>
              </div>
            </div>

            {activeTrade.status === 'closed' && (
              <div
                className={`text-xs font-bold text-center py-1 rounded-lg ${
                  activeTrade.resultado === 'win'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-rose-400 bg-rose-500/10'
                }`}
              >
                {activeTrade.resultado === 'win'
                  ? `✅ GANHOU +${activeTrade.lucro?.toFixed(2)} TOKENS (+5%)`
                  : `❌ PERDEU -${activeTrade.valor.toFixed(2)} TOKENS`}
              </div>
            )}
          </div>
        )}

        {/* Buy / Sell Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => handleTrade('COMPRAR')}
            disabled={loading || (activeTrade?.status === 'open') || tokens <= 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>COMPRAR (LONG)</span>
          </button>

          <button
            onClick={() => handleTrade('VENDER')}
            disabled={loading || (activeTrade?.status === 'open') || tokens <= 0}
            className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>VENDER (SHORT)</span>
          </button>
        </div>
      </div>

      {/* Educational notice */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-950/40 p-2 rounded-xl border border-slate-800/40">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
        <span>Simulador educativo. Dimensionamento de posição e proteção de capital estrita.</span>
      </div>
    </div>
  );
};


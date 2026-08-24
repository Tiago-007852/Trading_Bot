import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { CryptoTicker } from '../types';

interface LivePriceTickerProps {
  currentPar: string;
  onSelectPar: (par: string) => void;
  tickerData: Record<string, CryptoTicker | null>;
}

export const LivePriceTicker: React.FC<LivePriceTickerProps> = ({
  currentPar,
  onSelectPar,
  tickerData,
}) => {
  const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {PAIRS.map((par) => {
        const item = tickerData[par];
        const isSelected = currentPar === par;
        const isPositive = (item?.change24h || 0) >= 0;

        return (
          <button
            key={par}
            onClick={() => onSelectPar(par)}
            className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              isSelected
                ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                {par}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                  isPositive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {item ? `${isPositive ? '+' : ''}${item.change24h.toFixed(2)}%` : '...'}
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-white tracking-tight">
                {item
                  ? `$${item.price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : '$...'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Binance Live</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

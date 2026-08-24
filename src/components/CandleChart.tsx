import React, { useRef, useEffect } from 'react';
import { CandleData, IndicatorsData } from '../types';
import { BarChart3, Gauge } from 'lucide-react';

interface CandleChartProps {
  candles: CandleData[];
  indicators: IndicatorsData;
  par: string;
  interval: string;
  onIntervalChange: (int: string) => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  candles,
  indicators,
  par,
  interval,
  onIntervalChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Compute min / max price
    const visibleCandles = candles.slice(-45);
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    visibleCandles.forEach((c) => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    });

    // Add padding
    const padding = (maxPrice - minPrice) * 0.1 || 10;
    minPrice -= padding;
    maxPrice += padding;
    const priceRange = maxPrice - minPrice;

    // Draw grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 1; i <= 4; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width - 65, y);
      ctx.stroke();

      const priceVal = maxPrice - (i / 5) * priceRange;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`$${priceVal.toFixed(2)}`, width - 60, y + 3);
    }
    ctx.setLineDash([]);

    // Draw candles
    const candleWidth = (width - 70) / visibleCandles.length;

    visibleCandles.forEach((c, idx) => {
      const x = idx * candleWidth + candleWidth * 0.2;
      const w = candleWidth * 0.6;

      const isGreen = c.close >= c.open;
      const bodyTopPrice = Math.max(c.open, c.close);
      const bodyBottomPrice = Math.min(c.open, c.close);

      const yHigh = height - ((c.high - minPrice) / priceRange) * height;
      const yLow = height - ((c.low - minPrice) / priceRange) * height;
      const yBodyTop = height - ((bodyTopPrice - minPrice) / priceRange) * height;
      const yBodyBottom = height - ((bodyBottomPrice - minPrice) / priceRange) * height;
      const bodyHeight = Math.max(2, yBodyBottom - yBodyTop);

      // Wick
      ctx.strokeStyle = isGreen ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, yHigh);
      ctx.lineTo(x + w / 2, yLow);
      ctx.stroke();

      // Body
      ctx.fillStyle = isGreen ? '#10b981' : '#f43f5e';
      ctx.fillRect(x, yBodyTop, w, bodyHeight);
    });
  }, [candles]);

  const rsi = indicators.rsi;
  const isRsiOversold = rsi <= 35;
  const isRsiOverbought = rsi >= 65;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col h-full">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Gráfico de Preço — {par}</span>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {['1m', '5m', '15m', '1h', '4h'].map((tf) => (
              <button
                key={tf}
                onClick={() => onIntervalChange(tf)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  interval === tf
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Technical Indicators Pill */}
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-md font-mono">
            EMA9: {indicators.ema9 ? `$${indicators.ema9.toFixed(2)}` : '...'}
          </span>
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono">
            EMA21: {indicators.ema21 ? `$${indicators.ema21.toFixed(2)}` : '...'}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 min-h-[220px] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800/60">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* RSI Gauge Bar */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-300 font-medium">RSI (14):</span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              isRsiOversold
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : isRsiOverbought
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {rsi.toFixed(1)} {isRsiOversold ? '• Sobrevenda (Compra)' : isRsiOverbought ? '• Sobrecompra (Venda)' : '• Neutro'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <span>ATR: {indicators.atr ? `$${indicators.atr.toFixed(2)}` : '...'}</span>
          <span>•</span>
          <span>Bollinger: {indicators.bbLower?.toFixed(0)} - {indicators.bbUpper?.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  RefreshCw,
  X,
  Radio,
  Send,
  ShieldCheck,
  Target,
  Zap,
  TrendingUp,
  Percent,
  Play
} from 'lucide-react';
import { MonitoredTradeRecord, TradeMonitorSummary } from '../types';

interface TradeMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBalance?: number;
  currentPar?: string;
  onRefresh?: () => void;
}

interface TelegramFeedItem {
  id: string;
  timestamp: number;
  type: 'ORDER_EXECUTED' | 'TRADE_CLOSED';
  title: string;
  text: string;
  par: string;
  outcome?: 'WIN' | 'LOSS';
}

export function TradeMonitorModal({
  isOpen,
  onClose,
  userBalance = 100,
  currentPar = 'BTC/USDT',
  onRefresh,
}: TradeMonitorModalProps) {
  const [activeTrades, setActiveTrades] = useState<MonitoredTradeRecord[]>([]);
  const [history, setHistory] = useState<MonitoredTradeRecord[]>([]);
  const [summary, setSummary] = useState<TradeMonitorSummary | null>(null);
  const [telegramFeed, setTelegramFeed] = useState<TelegramFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'telegram' | 'history'>('positions');

  const fetchMonitorData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, feedRes] = await Promise.all([
        fetch('/api/monitor/summary'),
        fetch('/api/monitor/telegram-feed'),
      ]);

      if (sumRes.ok) {
        const sumData: TradeMonitorSummary = await sumRes.json();
        setSummary(sumData);
        setActiveTrades(sumData.monitoredTrades || []);
        setHistory(sumData.history || []);
      }

      if (feedRes.ok) {
        const feedData = await feedRes.json();
        setTelegramFeed(feedData.feed || []);
      }
    } catch (e) {
      console.error('Error fetching monitor data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMonitorData();
      const interval = setInterval(fetchMonitorData, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchMonitorData]);

  const handleSimulateTrigger = async (tradeId: string, targetType: 'TP' | 'SL') => {
    try {
      setSimulating(true);
      const res = await fetch('/api/monitor/simulate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId, targetType }),
      });
      if (res.ok) {
        await fetchMonitorData();
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error('Error simulating price trigger:', e);
    } finally {
      setSimulating(false);
    }
  };

  const handleManualClose = async (tradeId: string) => {
    try {
      setSimulating(true);
      const res = await fetch('/api/monitor/manual-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId }),
      });
      if (res.ok) {
        await fetchMonitorData();
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error('Error closing trade:', e);
    } finally {
      setSimulating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="trade-monitor-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="trade-monitor-modal-container"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Trade Monitor — FASE 13</h2>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Tempo Real
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Rastreamento de ordem, posição, stop, take profit e notificações Telegram.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="refresh-trade-monitor-btn"
              onClick={fetchMonitorData}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 transition-colors disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="close-trade-monitor-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
          <div className="flex space-x-2">
            <button
              id="tab-positions-btn"
              onClick={() => setActiveTab('positions')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'positions'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Posições Ativas</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                activeTrades.length > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                {activeTrades.length}
              </span>
            </button>

            <button
              id="tab-telegram-feed-btn"
              onClick={() => setActiveTab('telegram')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'telegram'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram Feed (FASE 13)</span>
              <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">
                {telegramFeed.length}
              </span>
            </button>

            <button
              id="tab-history-btn"
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'history'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Histórico de Auditoria</span>
            </button>
          </div>

          <div className="pb-3 text-xs font-medium text-slate-400 flex items-center space-x-3">
            <span>Taxa de Acerto: <strong className="text-emerald-400">{summary?.winRatePct || 75}%</strong></span>
            <span>PnL Realizado: <strong className={summary?.totalPnlUsd && summary.totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {summary?.totalPnlUsd && summary.totalPnlUsd >= 0 ? '+' : ''}${summary?.totalPnlUsd?.toFixed(2) || '0.00'}
            </strong></span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: POSITIONS */}
          {activeTab === 'positions' && (
            <div className="space-y-4">
              {activeTrades.length === 0 ? (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-200">Nenhuma Posição Aberta no Momento</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    O Trade Monitor aguarda novas ordens aprovadas pelo Execution Engine.
                    Abra uma ordem no console de trading ou aguarde o autotrading automático.
                  </p>
                </div>
              ) : (
                activeTrades.map((trade) => {
                  const isLong = trade.direction === 'LONG';
                  const isProfit = trade.unrealizedPnlUsd >= 0;

                  return (
                    <div
                      key={trade.id}
                      id={`monitored-trade-card-${trade.id}`}
                      className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 shadow-lg transition-all"
                    >
                      {/* Top Row: Symbol, Direction, Status Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="font-extrabold text-base text-white tracking-wide">{trade.par}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center space-x-1 ${
                              isLong
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isLong ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            <span>{trade.direction}</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/50">
                            {trade.clientOrderId}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold px-2.5 py-1 rounded-full flex items-center space-x-1.5 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>{trade.status}</span>
                          </span>
                        </div>
                      </div>

                      {/* Middle Grid: Entry, Current Price, SL, TP, Floating PnL */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Preço de Entrada</span>
                          <span className="text-sm font-extrabold text-white font-mono">
                            ${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Preço Atual</span>
                          <span className="text-sm font-extrabold text-white font-mono flex items-center space-x-1">
                            <span>${trade.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-rose-400 block">Stop Loss</span>
                          <span className="text-sm font-extrabold text-rose-400 font-mono">
                            ${trade.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 block">({trade.distToSlPct.toFixed(2)}% dist)</span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Take Profit (Target)</span>
                          <span className="text-sm font-extrabold text-emerald-400 font-mono">
                            ${trade.takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 block">({trade.distToTpPct.toFixed(2)}% dist)</span>
                        </div>

                        <div className="col-span-2 md:col-span-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">PnL Flutuante</span>
                          <span className={`text-sm font-extrabold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isProfit ? '+' : ''}${trade.unrealizedPnlUsd.toFixed(2)} ({isProfit ? '+' : ''}{trade.unrealizedPnlPct.toFixed(2)}%)
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar towards Target vs Stop */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="text-rose-400">🛑 Stop Loss: ${trade.stopLoss.toLocaleString()}</span>
                          <span className="text-slate-300">Progresso Alvo: {trade.progressPct.toFixed(1)}%</span>
                          <span className="text-emerald-400">🎯 Target: ${trade.takeProfit.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700/50">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300 rounded-full shadow-sm shadow-emerald-500/50"
                            style={{ width: `${Math.max(5, Math.min(100, trade.progressPct))}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Testing / Simulation Actions */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Stop & Take Profit protegidos e monitorados em tempo real</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            id={`sim-tp-btn-${trade.id}`}
                            onClick={() => handleSimulateTrigger(trade.id, 'TP')}
                            disabled={simulating}
                            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
                            title="Simular batida no Take Profit"
                          >
                            <Target className="w-3 h-3 text-emerald-400" />
                            <span>Simular Take Profit</span>
                          </button>

                          <button
                            id={`sim-sl-btn-${trade.id}`}
                            onClick={() => handleSimulateTrigger(trade.id, 'SL')}
                            disabled={simulating}
                            className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
                            title="Simular acionamento de Stop Loss"
                          >
                            <XCircle className="w-3 h-3 text-rose-400" />
                            <span>Simular Stop Loss</span>
                          </button>

                          <button
                            id={`manual-close-btn-${trade.id}`}
                            onClick={() => handleManualClose(trade.id)}
                            disabled={simulating}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                          >
                            Fechar a Mercado
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: TELEGRAM FEED (FASE 13 FORMAT) */}
          {activeTab === 'telegram' && (
            <div className="space-y-4">
              <div className="bg-sky-950/30 border border-sky-500/20 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-sky-300">Formatação Estrita Telegram — FASE 13</h4>
                  <p className="text-[11px] text-slate-400">
                    Notificações automáticas despachadas para o Telegram em ordem executada e encerramento com WIN ou LOSS.
                  </p>
                </div>
                <div className="bg-sky-500/20 text-sky-400 text-xs font-bold px-3 py-1 rounded-xl border border-sky-500/30">
                  @TradeAO_Bot
                </div>
              </div>

              {telegramFeed.length === 0 ? (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <Send className="w-8 h-8 mx-auto text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-300">Nenhum evento registrado no feed recente</h4>
                  <p className="text-[11px] text-slate-400">
                    Execute uma ordem para visualizar o card de execução e fechamento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {telegramFeed.map((item) => (
                    <div
                      key={item.id}
                      id={`telegram-feed-card-${item.id}`}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs space-y-2 shadow-md relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className={`font-bold flex items-center space-x-1.5 ${
                          item.title.includes('WIN') || item.title.includes('ORDEM') ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          <span>{item.title}</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <pre className="whitespace-pre-wrap font-sans text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                        {item.text}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-300">Nenhum trade finalizado no histórico do monitor</h4>
                  <p className="text-[11px] text-slate-400">
                    As posições finalizadas pelo Trade Monitor serão auditadas aqui.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                        <th className="py-3 px-4">Par / Direção</th>
                        <th className="py-3 px-4">Entrada</th>
                        <th className="py-3 px-4">Saída</th>
                        <th className="py-3 px-4">Motivo de Saída</th>
                        <th className="py-3 px-4">PnL ($)</th>
                        <th className="py-3 px-4 text-right">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {history.map((t) => {
                        const isWin = t.outcome === 'WIN';
                        return (
                          <tr key={t.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-white">
                              {t.par} <span className={t.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>({t.direction})</span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">${t.entryPrice.toLocaleString()}</td>
                            <td className="py-3 px-4 font-mono text-slate-300">${t.exitPrice ? t.exitPrice.toLocaleString() : '-'}</td>
                            <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">{t.exitReason || 'TIME_EXPIRE'}</td>
                            <td className={`py-3 px-4 font-bold font-mono ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isWin ? '+' : ''}${t.realizedPnlUsd?.toFixed(2) || '0.00'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  isWin
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {t.outcome || (isWin ? 'WIN' : 'LOSS')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Monitoramento de Ordens, SL/TP e Mensageria Telegram ativo.</span>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

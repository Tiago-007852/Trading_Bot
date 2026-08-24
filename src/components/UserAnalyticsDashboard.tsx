import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Percent,
  DollarSign,
  Layers,
  User,
  PlusCircle,
  Sparkles,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { UserAnalyticsStats, UserTradeRecord, UserProfile } from '../types';

interface UserAnalyticsDashboardProps {
  user: UserProfile;
  onRefreshUser?: () => void;
}

export const UserAnalyticsDashboard: React.FC<UserAnalyticsDashboardProps> = ({
  user,
  onRefreshUser,
}) => {
  const [activeUserId, setActiveUserId] = useState<string>(String(user.chat_id || '7886049873'));
  const [analytics, setAnalytics] = useState<UserAnalyticsStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'pairs' | 'timeframes' | 'strategies' | 'trades'>('overview');

  // Filters for trade table
  const [selectedPair, setSelectedPair] = useState<string>('ALL');
  const [selectedTf, setSelectedTf] = useState<string>('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('ALL');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Simulation modal
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [simPair, setSimPair] = useState<string>('BTC/USDT');
  const [simTf, setSimTf] = useState<string>('15m');
  const [simStrat, setSimStrat] = useState<string>('EMA + RSI Confluence');
  const [simDir, setSimDir] = useState<'LONG' | 'SHORT'>('LONG');
  const [simOutcome, setSimOutcome] = useState<'WIN' | 'LOSS'>('WIN');
  const [simPnl, setSimPnl] = useState<number>(0.25);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Available users for isolation testing
  const demoUsers = [
    { id: '7886049873', label: `Usuário Principal (${user.email || 'Demo'})` },
    { id: '9988776655', label: 'Usuário B (Ana Trader — Conta Isolada)' },
    { id: '1122334455', label: 'Usuário C (Carlos Scalper — Conta Isolada)' },
  ];

  const fetchAnalytics = async (uid = activeUserId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/user/${uid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAnalytics(data.analytics);
        }
      }
    } catch (e) {
      console.error('Error fetching user analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(activeUserId);
  }, [activeUserId]);

  const handleExportCsv = () => {
    window.open(`/api/analytics/export/csv/${activeUserId}`, '_blank');
  };

  const handleSimulateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    try {
      const entry = simPair === 'BTC/USDT' ? 68500 : simPair === 'ETH/USDT' ? 3450 : 190;
      const stop = simDir === 'LONG' ? entry * 0.99 : entry * 1.01;
      const target = simDir === 'LONG' ? entry * 1.02 : entry * 0.98;

      const res = await fetch(`/api/history/user/${activeUserId}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: 'BINANCE_SPOT',
          par: simPair,
          timeframe: simTf,
          estrategia: simStrat,
          direcao: simDir,
          entrada: entry,
          stop: stop,
          alvo: target,
          quantidade: 0.001,
          resultado: simOutcome,
          pnlUsd: simOutcome === 'WIN' ? Math.abs(simPnl) : -Math.abs(simPnl),
          pnlPct: simOutcome === 'WIN' ? 2.5 : -1.0,
          score: 85,
          positionValueUsd: 10.0,
        }),
      });

      if (res.ok) {
        setShowSimulateModal(false);
        fetchAnalytics(activeUserId);
        if (onRefreshUser) onRefreshUser();
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const filteredTrades = (analytics?.recent_trades || []).filter((t) => {
    if (selectedPair !== 'ALL' && t.par !== selectedPair) return false;
    if (selectedTf !== 'ALL' && t.timeframe !== selectedTf) return false;
    if (selectedOutcome !== 'ALL' && t.resultado !== selectedOutcome) return false;
    if (selectedStrategy !== 'ALL' && t.estrategia !== selectedStrategy) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.par.toLowerCase().includes(q) ||
        t.ordem.toLowerCase().includes(q) ||
        t.estrategia.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div id="user-analytics-dashboard" className="space-y-6">
      {/* Top Banner: User Isolation Notice */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                FASE 14 ATIVA
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Histórico Isolado por Usuário
              </span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Histórico & Analytics de Performance
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Métricas e registros auditados exclusivamente para o usuário selecionado. Dados segregados por User ID.
            </p>
          </div>

          {/* User selector & controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <User className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Conta Ativa
                </div>
                <select
                  id="user-analytics-selector"
                  value={activeUserId}
                  onChange={(e) => setActiveUserId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-1"
                >
                  {demoUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              id="btn-refresh-analytics"
              onClick={() => fetchAnalytics(activeUserId)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>

            <button
              id="btn-export-csv"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Exportar CSV com os 15 campos"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              CSV
            </button>

            <button
              id="btn-simulate-trade"
              onClick={() => setShowSimulateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Registrar Trade Teste
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards (All Requested Metrics in FASE 14) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Trades */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Trades</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {analytics?.total_trades || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold">{analytics?.wins || 0}W</span>
              <span>/</span>
              <span className="text-rose-400 font-semibold">{analytics?.losses || 0}L</span>
              <span>/</span>
              <span className="text-slate-400">{analytics?.breakevens || 0}E</span>
            </div>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Win Rate</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className={`text-2xl font-black ${(analytics?.win_rate_pct || 0) >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {analytics?.win_rate_pct || 0}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, analytics?.win_rate_pct || 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Total PnL */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">P/L Total</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className={`text-2xl font-black ${(analytics?.total_pnl_usd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(analytics?.total_pnl_usd || 0) >= 0 ? '+' : ''}${analytics?.total_pnl_usd?.toFixed(2) || '0.00'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              {(analytics?.total_pnl_pct || 0) >= 0 ? (
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-rose-400" />
              )}
              <span className={(analytics?.total_pnl_pct || 0) >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {analytics?.total_pnl_pct?.toFixed(2)}%
              </span>
              <span>retorno</span>
            </div>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Profit Factor</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-purple-300">
              {analytics?.profit_factor ? analytics.profit_factor.toFixed(2) : '1.00'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Ganhos: ${analytics?.gross_profit_usd?.toFixed(2) || '0.00'}
            </div>
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Max Drawdown</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400">
              -{analytics?.max_drawdown_pct?.toFixed(2) || '0.00'}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Max Queda: -${analytics?.max_drawdown_usd?.toFixed(2) || '0.00'}
            </div>
          </div>
        </div>

        {/* Payoff / Expectancy */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Payoff Ratio</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-cyan-300">
              {analytics?.payoff_ratio ? analytics.payoff_ratio.toFixed(2) : '0.00'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Méd: +${analytics?.avg_win_usd?.toFixed(2)} / -${analytics?.avg_loss_usd?.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Curva de Equity & Drawdown
        </button>

        <button
          onClick={() => setActiveTab('pairs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap ${
            activeTab === 'pairs'
              ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChartIcon className="w-3.5 h-3.5" />
          Performance por Par
        </button>

        <button
          onClick={() => setActiveTab('timeframes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap ${
            activeTab === 'timeframes'
              ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Performance por Timeframe
        </button>

        <button
          onClick={() => setActiveTab('strategies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap ${
            activeTab === 'strategies'
              ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Performance por Estratégia
        </button>

        <button
          onClick={() => setActiveTab('trades')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap ${
            activeTab === 'trades'
              ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Histórico Completo ({analytics?.recent_trades?.length || 0} Trades)
        </button>
      </div>

      {/* TAB 1: CURVA DE EQUITY & DRAWDOWN */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Equity Chart */}
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Evolução do Saldo & Curva de Equity (Trade a Trade)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Saldo inicial: $100.00 • Saldo Atual: ${analytics?.current_balance?.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {analytics?.equity_curve?.length || 0} Pontos Auditados
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              {analytics?.equity_curve && analytics.equity_curve.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.equity_curve}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="trade_num"
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(val) => `#${val}`}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      domain={['auto', 'auto']}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Saldo Total']}
                      labelFormatter={(label) => `Trade #${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#equityGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Nenhum dado de trade registrado ainda.
                </div>
              )}
            </div>
          </div>

          {/* Quick Performance Breakdown */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <Sliders className="w-4 h-4 text-blue-400" />
                Resumo Estatístico Isolado
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400">Total Ganho Bruto</span>
                  <span className="text-xs font-bold text-emerald-400">+${analytics?.gross_profit_usd?.toFixed(2) || '0.00'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400">Total Perda Bruta</span>
                  <span className="text-xs font-bold text-rose-400">-${analytics?.gross_loss_usd?.toFixed(2) || '0.00'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400">Ganho Médio por Win</span>
                  <span className="text-xs font-bold text-emerald-400">+${analytics?.avg_win_usd?.toFixed(2) || '0.00'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400">Perda Média por Loss</span>
                  <span className="text-xs font-bold text-rose-400">-${analytics?.avg_loss_usd?.toFixed(2) || '0.00'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400">Maior Queda Histórica</span>
                  <span className="text-xs font-bold text-rose-400">-{analytics?.max_drawdown_pct?.toFixed(2) || '0.00'}%</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
              ⚡ Base de cálculo: 15 campos obrigatórios armazenados por trade no registro seguro do usuário.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PERFORMANCE POR PAR */}
      {activeTab === 'pairs' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-emerald-400" />
              Performance Detalhada por Par Cripto
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(analytics?.performance_by_par || []).map((p) => (
                <div
                  key={p.par}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">{p.par}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        p.win_rate_pct >= 60
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {p.win_rate_pct}% WR
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Trades:</span>
                      <span className="font-semibold text-slate-200">
                        {p.total} ({p.wins}W / {p.losses}L)
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-400">
                      <span>P/L Realizado:</span>
                      <span
                        className={`font-bold ${p.pnl_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {p.pnl_usd >= 0 ? '+' : ''}${p.pnl_usd.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-400">
                      <span>Volume Alocado:</span>
                      <span className="font-semibold text-slate-300">
                        ${p.volume_usd?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, p.win_rate_pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Bar chart comparison */}
            <div className="mt-6 pt-6 border-t border-slate-800 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.performance_by_par || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="par" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="wins" name="Vitórias" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="losses" name="Derrotas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERFORMANCE POR TIMEFRAME */}
      {activeTab === 'timeframes' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-emerald-400" />
            Performance Detalhada por Timeframe (5m, 15m, 1h, 4h, 1d)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(analytics?.performance_by_timeframe || []).map((tf) => (
              <div
                key={tf.timeframe}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-black text-white">{tf.timeframe}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {tf.win_rate_pct}% WR
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Total Operações:</span>
                    <span className="font-semibold text-slate-200">
                      {tf.total} ({tf.wins}W / {tf.losses}L)
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Lucro Líquido (USD):</span>
                    <span
                      className={`font-bold ${tf.pnl_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {tf.pnl_usd >= 0 ? '+' : ''}${tf.pnl_usd.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-400 h-full rounded-full"
                    style={{ width: `${Math.min(100, tf.win_rate_pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PERFORMANCE POR ESTRATÉGIA */}
      {activeTab === 'strategies' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Performance Detalhada por Estratégia
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(analytics?.performance_by_strategy || []).map((strat) => (
              <div
                key={strat.estrategia}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">{strat.estrategia}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      strat.win_rate_pct >= 60
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {strat.win_rate_pct}% WR
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Total Trades</div>
                    <div className="font-bold text-white mt-0.5">{strat.total}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Vitórias / Derrotas</div>
                    <div className="font-bold text-emerald-400 mt-0.5">
                      {strat.wins}W / {strat.losses}L
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">P/L Acumulado</div>
                    <div
                      className={`font-bold mt-0.5 ${strat.pnl_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {strat.pnl_usd >= 0 ? '+' : ''}${strat.pnl_usd.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: TABELA COMPLETA DE TRADES (TODOS OS 15 CAMPOS EXIGIDOS NA FASE 14) */}
      {activeTab === 'trades' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Histórico Individual de Operações
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Contendo os 15 campos solicitados (User ID, Broker, Par, TF, Estratégia, Direção, Entrada, Stop, Alvo, Quantidade, Timestamp, Ordem, Resultado, P/L, Score)
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedPair}
                onChange={(e) => setSelectedPair(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 outline-none"
              >
                <option value="ALL">Todos os Pares</option>
                <option value="BTC/USDT">BTC/USDT</option>
                <option value="ETH/USDT">ETH/USDT</option>
                <option value="SOL/USDT">SOL/USDT</option>
                <option value="BNB/USDT">BNB/USDT</option>
              </select>

              <select
                value={selectedTf}
                onChange={(e) => setSelectedTf(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 outline-none"
              >
                <option value="ALL">Todos TFs</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
              </select>

              <select
                value={selectedOutcome}
                onChange={(e) => setSelectedOutcome(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 outline-none"
              >
                <option value="ALL">Todos Resultados</option>
                <option value="WIN">Apenas WIN</option>
                <option value="LOSS">Apenas LOSS</option>
              </select>

              <input
                type="text"
                placeholder="Buscar por ordem, par..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-1.5 text-slate-200 outline-none w-44"
              />
            </div>
          </div>

          {/* Full Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <th className="py-3 px-3">Data / Hora</th>
                  <th className="py-3 px-3">Par & TF</th>
                  <th className="py-3 px-3">Direção</th>
                  <th className="py-3 px-3">Estratégia</th>
                  <th className="py-3 px-3 text-right">Entrada</th>
                  <th className="py-3 px-3 text-right">Stop Loss</th>
                  <th className="py-3 px-3 text-right">Take Profit</th>
                  <th className="py-3 px-3 text-right">Quantidade</th>
                  <th className="py-3 px-3 text-center">Score</th>
                  <th className="py-3 px-3 text-center">Resultado</th>
                  <th className="py-3 px-3 text-right">P/L (USD & %)</th>
                  <th className="py-3 px-3">Ordem / Broker</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredTrades.length > 0 ? (
                  filteredTrades.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap text-[11px]">
                        {new Date(t.timestamp).toLocaleDateString('pt-BR')}{' '}
                        <span className="text-slate-500">
                          {new Date(t.timestamp).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Par & TF */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-bold text-white">{t.par}</span>
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                          {t.timeframe}
                        </span>
                      </td>

                      {/* Direção */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.direcao === 'LONG'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {t.direcao}
                        </span>
                      </td>

                      {/* Estratégia */}
                      <td className="py-2.5 px-3 text-slate-300 font-sans text-xs max-w-[150px] truncate">
                        {t.estrategia}
                      </td>

                      {/* Entrada */}
                      <td className="py-2.5 px-3 text-right text-slate-200 font-semibold">
                        ${t.entrada.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Stop */}
                      <td className="py-2.5 px-3 text-right text-rose-400">
                        ${t.stop.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Alvo */}
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        ${t.alvo.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Quantidade */}
                      <td className="py-2.5 px-3 text-right text-slate-300 text-[11px]">
                        {t.quantidade}
                      </td>

                      {/* Score */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {t.score}
                        </span>
                      </td>

                      {/* Resultado */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                            t.resultado === 'WIN'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {t.resultado === 'WIN' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {t.resultado}
                        </span>
                      </td>

                      {/* PnL */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div
                          className={`font-bold ${
                            t.pnl_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {t.pnl_usd >= 0 ? '+' : ''}${t.pnl_usd.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%
                        </div>
                      </td>

                      {/* Ordem & Broker */}
                      <td className="py-2.5 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                        <div className="text-slate-300 font-semibold">{t.broker}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[110px]" title={t.ordem}>
                          {t.ordem}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-500 font-sans text-xs">
                      Nenhuma operação encontrada com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Registrar Trade Teste (Manual / Audit Simulation) */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                Registrar Trade no Histórico do Usuário
              </h3>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateTrade} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Usuário Destino
                </label>
                <input
                  type="text"
                  disabled
                  value={`ID: ${activeUserId}`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Par Cripto
                  </label>
                  <select
                    value={simPair}
                    onChange={(e) => setSimPair(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="BTC/USDT">BTC/USDT</option>
                    <option value="ETH/USDT">ETH/USDT</option>
                    <option value="SOL/USDT">SOL/USDT</option>
                    <option value="BNB/USDT">BNB/USDT</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Timeframe
                  </label>
                  <select
                    value={simTf}
                    onChange={(e) => setSimTf(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Direção
                  </label>
                  <select
                    value={simDir}
                    onChange={(e) => setSimDir(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="LONG">LONG (Compra)</option>
                    <option value="SHORT">SHORT (Venda)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Resultado
                  </label>
                  <select
                    value={simOutcome}
                    onChange={(e) => setSimOutcome(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="WIN">WIN (Ganho)</option>
                    <option value="LOSS">LOSS (Perda)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Estratégia
                </label>
                <select
                  value={simStrat}
                  onChange={(e) => setSimStrat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="EMA + RSI Confluence">EMA + RSI Confluence</option>
                  <option value="Bollinger Mean Reversion">Bollinger Mean Reversion</option>
                  <option value="ATR Breakout">ATR Breakout</option>
                  <option value="Signal Engine 8-Pillar">Signal Engine 8-Pillar</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Valor P/L (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={simPnl}
                  onChange={(e) => setSimPnl(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5"
                >
                  {isSimulating ? 'Salvando...' : 'Salvar no Histórico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

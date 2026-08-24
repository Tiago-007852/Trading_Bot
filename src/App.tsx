import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LivePriceTicker } from './components/LivePriceTicker';
import { CandleChart } from './components/CandleChart';
import { SignalsTerminal } from './components/SignalsTerminal';
import { TradingConsole } from './components/TradingConsole';
import { TelegramBotSimulator } from './components/TelegramBotSimulator';
import { AccountModal } from './components/AccountModal';
import { AffiliateBanner } from './components/AffiliateBanner';
import { RiskManagerModal } from './components/RiskManagerModal';
import { RiskConfirmationModal } from './components/RiskConfirmationModal';
import { ExecutionEngineModal } from './components/ExecutionEngineModal';
import { TradeMonitorModal } from './components/TradeMonitorModal';
import { UserAnalyticsDashboard } from './components/UserAnalyticsDashboard';
import { PaperTradingModal } from './components/PaperTradingModal';
import { MultiUserManagerModal } from './components/MultiUserManagerModal';
import { DatabasePersistenceModal } from './components/DatabasePersistenceModal';
import { Daemon247Modal } from './components/Daemon247Modal';
import { TestRunnerModal } from './components/TestRunnerModal';
import { UserProfile, CryptoTicker, CandleData, IndicatorsData, SignalItem, ActiveTrade } from './types';

export default function App() {
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    return localStorage.getItem('tradeao_active_user') || '7886049873';
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<'trading' | 'analytics'>('trading');
  const [currentPar, setCurrentPar] = useState<string>('BTC/USDT');
  const [interval, setInterval] = useState<string>('15m');
  const [tickerData, setTickerData] = useState<Record<string, CryptoTicker | null>>({});
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [indicators, setIndicators] = useState<IndicatorsData>({
    rsi: 50,
    ema9: null,
    ema21: null,
    ema50: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    atr: null,
  });

  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [signalStats, setSignalStats] = useState({
    total: 0,
    acertos: 0,
    derrotas: 0,
    winRatePct: null as number | null,
    pendentes: 0,
  });

  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);
  const [activeTradesCount, setActiveTradesCount] = useState<number>(0);
  const [generatingSignal, setGeneratingSignal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Panels
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isRiskManagerOpen, setIsRiskManagerOpen] = useState(false);
  const [isRiskConfirmationOpen, setIsRiskConfirmationOpen] = useState(false);
  const [isExecutionEngineOpen, setIsExecutionEngineOpen] = useState(false);
  const [isTradeMonitorOpen, setIsTradeMonitorOpen] = useState(false);
  const [isPaperTradingOpen, setIsPaperTradingOpen] = useState(false);
  const [isMultiUserOpen, setIsMultiUserOpen] = useState(false);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const [isDaemonOpen, setIsDaemonOpen] = useState(false);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);

  // Fetch Active Monitored Trades Count
  const fetchMonitorCount = useCallback(async () => {
    try {
      const res = await fetch('/api/monitor/active');
      if (res.ok) {
        const data = await res.json();
        setActiveTradesCount(data.activeCount || 0);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Fetch User
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/user?userId=${activeUserId}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {
      console.error('Error fetching user:', e);
    }
  }, [activeUserId]);

  // Fetch Tickers
  const fetchTickers = useCallback(async () => {
    const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
    for (const par of pairs) {
      try {
        const res = await fetch(`/api/price?par=${encodeURIComponent(par)}`);
        if (res.ok) {
          const data: CryptoTicker = await res.json();
          setTickerData((prev) => ({ ...prev, [par]: data }));
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Fetch Candles and Indicators for active pair
  const fetchCandlesAndIndicators = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/candles?par=${encodeURIComponent(currentPar)}&interval=${interval}&limit=70`
      );
      if (res.ok) {
        const data = await res.json();
        setCandles(data.candles || []);
        if (data.indicators) {
          setIndicators(data.indicators);
        }
      }
    } catch (e) {
      console.error('Error fetching candles:', e);
    }
  }, [currentPar, interval]);

  // Fetch Signals & Win Rate Stats
  const fetchSignalsHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/signals/history');
      if (res.ok) {
        const data = await res.json();
        setSignals(data.history || []);
        if (data.stats) {
          setSignalStats(data.stats);
        }
      }
    } catch (e) {
      console.error('Error fetching signals:', e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchUser();
    fetchTickers();
    fetchCandlesAndIndicators();
    fetchSignalsHistory();
    fetchMonitorCount();

    const priceTimer = setInterval(() => {
      fetchTickers();
      fetchMonitorCount();
    }, 4000);

    const candleTimer = setInterval(() => {
      fetchCandlesAndIndicators();
    }, 10000);

    return () => {
      clearInterval(priceTimer);
      clearInterval(candleTimer);
    };
  }, [fetchUser, fetchTickers, fetchCandlesAndIndicators, fetchSignalsHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchUser(),
      fetchTickers(),
      fetchCandlesAndIndicators(),
      fetchSignalsHistory(),
    ]);
    setTimeout(() => setRefreshing(false), 500);
  };

  // Generate Signal
  const handleGenerateSignal = async () => {
    setGeneratingSignal(true);
    try {
      const res = await fetch(`/api/signals/generate?par=${encodeURIComponent(currentPar)}`);
      if (res.ok) {
        await fetchSignalsHistory();
      }
    } finally {
      setGeneratingSignal(false);
    }
  };

  // Resolve Signal
  const handleResolveSignal = async (id: string, forceStatus?: 'win' | 'loss') => {
    try {
      const res = await fetch('/api/signals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: id, forceStatus }),
      });
      if (res.ok) {
        await fetchSignalsHistory();
      }
    } catch (e) {
      console.error('Error resolving signal:', e);
    }
  };

  // Open Manual Trade
  const handleOpenTrade = async (
    direcao: 'COMPRAR' | 'VENDER',
    valor: number,
    stopLoss?: number,
    takeProfit?: number
  ) => {
    try {
      const res = await fetch('/api/trades/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          par: currentPar,
          direcao,
          valor,
          stop_loss: stopLoss,
          take_profit: takeProfit,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTrade(data.trade);
        if (user) {
          setUser({ ...user, tokens: data.userBalance });
        }
        return data.trade;
      } else {
        const errData = await res.json();
        console.warn('Trade rejected by Risk Manager:', errData.error);
        return null;
      }
    } catch (e) {
      console.error('Error opening trade:', e);
    }
    return null;
  };

  // Settle Trade
  const handleSettleTrade = async (tradeId: string) => {
    try {
      const res = await fetch('/api/trades/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTrade(data.trade);
        if (user) {
          setUser({
            ...user,
            tokens: data.userBalance,
            trades: data.userStats?.trades ?? user.trades + 1,
            vitorias: data.userStats?.vitorias ?? user.vitorias,
          });
        }
      }
    } catch (e) {
      console.error('Error settling trade:', e);
    }
  };

  // Toggle Autotrade
  const handleToggleAutotrade = async (enabled: boolean) => {
    if (enabled && !user?.autotrade_confirmed) {
      setIsRiskConfirmationOpen(true);
      return;
    }

    await executeToggleAutotrade(enabled);
  };

  const executeToggleAutotrade = async (enabled: boolean, confirmed = true) => {
    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autotrade: enabled,
          autotrade_confirmed: confirmed,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);

        if (enabled) {
          // trigger immediate cycle
          const tradeRes = await fetch('/api/trades/autotrade-cycle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ par: currentPar }),
          });
          if (tradeRes.ok) {
            const tradeData = await tradeRes.json();
            setActiveTrade(tradeData.trade);
            if (user) {
              setUser({ ...user, autotrade: true, tokens: tradeData.userBalance, autotrade_confirmed: true });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error updating autotrade:', e);
    }
  };

  // Change Risk
  const handleChangeRisk = async (risco: number) => {
    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ risco }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {
      console.error('Error updating risk:', e);
    }
  };

  // Claim Deposit Bonus (+5 tokens)
  const handleClaimDepositBonus = async () => {
    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimDepositBonus: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {
      console.error('Error claiming deposit bonus:', e);
    }
  };

  // Claim Invite (+5 tokens)
  const handleClaimInvite = async () => {
    try {
      const res = await fetch('/api/user/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (user) {
          setUser({ ...user, tokens: data.tokens });
        }
      }
    } catch (e) {
      console.error('Error claiming invite:', e);
    }
  };

  // Update Email
  const handleUpdateEmail = async (email: string) => {
    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {
      console.error('Error updating email:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        user={user}
        activeView={activeView}
        onToggleView={(view) => setActiveView(view)}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenDeposit={() => setIsDepositOpen(true)}
        onOpenTelegramSim={() => setIsTelegramOpen(!isTelegramOpen)}
        onOpenRiskManager={() => setIsRiskManagerOpen(true)}
        onOpenExecutionEngine={() => setIsExecutionEngineOpen(true)}
        onOpenTradeMonitor={() => setIsTradeMonitorOpen(true)}
        onOpenPaperTrading={() => setIsPaperTradingOpen(true)}
        onOpenMultiUser={() => setIsMultiUserOpen(true)}
        onOpenDatabase={() => setIsDatabaseOpen(true)}
        onOpenDaemon247={() => setIsDaemonOpen(true)}
        onOpenTestRunner={() => setIsTestRunnerOpen(true)}
        isTelegramOpen={isTelegramOpen}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        activeTradesCount={activeTradesCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">
        {/* Ticker Row */}
        <LivePriceTicker
          currentPar={currentPar}
          onSelectPar={(par) => setCurrentPar(par)}
          tickerData={tickerData}
        />

        {activeView === 'analytics' ? (
          /* FASE 14 — Isolated User History & Performance Analytics */
          <UserAnalyticsDashboard
            user={user || {
              email: 'trader.demo@tradeao.io',
              tokens: 100,
              chat_id: '7886049873',
              registro: new Date().toISOString(),
              trades: 13,
              vitorias: 9,
              autotrade: false,
              risco: 0.25,
              clicou_depositar: false,
              convidado_por: null,
            }}
            onRefreshUser={fetchUser}
          />
        ) : (
          /* Core Trading & Terminal Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Main Chart Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              <div className="flex-1 min-h-[380px]">
                <CandleChart
                  candles={candles}
                  indicators={indicators}
                  par={currentPar}
                  interval={interval}
                  onIntervalChange={(newInt) => setInterval(newInt)}
                />
              </div>

              {/* Signals Terminal */}
              <div className="flex-1 min-h-[320px]">
                <SignalsTerminal
                  signals={signals}
                  stats={signalStats}
                  generating={generatingSignal}
                  onGenerateSignal={handleGenerateSignal}
                  onResolveSignal={handleResolveSignal}
                />
              </div>
            </div>

            {/* Trading Controls Column (5 cols) */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              <TradingConsole
                user={user}
                currentPar={currentPar}
                ticker={tickerData[currentPar] || null}
                onOpenTrade={handleOpenTrade}
                onSettleTrade={handleSettleTrade}
                onToggleAutotrade={handleToggleAutotrade}
                onChangeRisk={handleChangeRisk}
                activeTrade={activeTrade}
                onOpenRiskManager={() => setIsRiskManagerOpen(true)}
              />

              {/* Quick Analytics & Telegram Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-300 block">FASE 14 • Analytics</span>
                    <span className="text-[11px] text-slate-400">
                      Histórico individual e estatísticas por usuário.
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveView('analytics')}
                    className="mt-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer text-center"
                  >
                    Ver Analytics Completo
                  </button>
                </div>

                <div className="bg-gradient-to-r from-sky-950/40 to-slate-900 border border-sky-500/20 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-sky-300 block">Telegram Bot Integrado</span>
                    <span className="text-[11px] text-slate-400">
                      Use o comando /historico e /stats no bot.
                    </span>
                  </div>
                  <button
                    onClick={() => setIsTelegramOpen(true)}
                    className="mt-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all shadow-md shadow-sky-600/20 cursor-pointer text-center"
                  >
                    Abrir Bot
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Telegram Bot Simulator Drawer */}
      <TelegramBotSimulator
        user={user}
        ticker={tickerData[currentPar] || null}
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
        onRefreshUser={fetchUser}
        onOpenDepositModal={() => setIsDepositOpen(true)}
        onGenerateSignal={handleGenerateSignal}
      />

      {/* Account Info Modal */}
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        user={user}
        onClaimInvite={handleClaimInvite}
        onUpdateEmail={handleUpdateEmail}
      />

      {/* Affiliate / Deposit Real Modal */}
      <AffiliateBanner
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        user={user}
        onClaimBonus={handleClaimDepositBonus}
      />

      {/* Trade AO Risk Manager Modal (Fase 9) */}
      <RiskManagerModal
        isOpen={isRiskManagerOpen}
        onClose={() => setIsRiskManagerOpen(false)}
        userBalance={user?.tokens || 100}
        currentPar={currentPar}
        currentPrice={tickerData[currentPar]?.price || 96000}
        onRefreshRiskStatus={fetchUser}
      />

      {/* Risk Confirmation Modal Before First Activation (Fase 11) */}
      <RiskConfirmationModal
        isOpen={isRiskConfirmationOpen}
        onClose={() => setIsRiskConfirmationOpen(false)}
        onConfirm={async () => {
          await executeToggleAutotrade(true, true);
        }}
        riskPerTrade={1.0}
        maxDailyLoss={3.0}
      />

      {/* Trade AO Execution Engine Modal (FASE 12) */}
      <ExecutionEngineModal
        isOpen={isExecutionEngineOpen}
        onClose={() => setIsExecutionEngineOpen(false)}
        userBalance={user?.tokens || 100}
        currentPar={currentPar}
        onTriggerAutotrade={fetchUser}
      />

      {/* Trade AO Trade Monitor Modal (FASE 13) */}
      <TradeMonitorModal
        isOpen={isTradeMonitorOpen}
        onClose={() => setIsTradeMonitorOpen(false)}
        userBalance={user?.tokens || 100}
        currentPar={currentPar}
        onRefresh={fetchUser}
      />

      {/* Trade AO Paper Trading & Testnet Modal (FASE 15) */}
      <PaperTradingModal
        isOpen={isPaperTradingOpen}
        onClose={() => setIsPaperTradingOpen(false)}
        userId={user?.chat_id || activeUserId}
        currentPar={currentPar}
        onRefreshAll={handleRefresh}
      />

      {/* Trade AO Multiuser & Isolation Manager (FASE 16) */}
      <MultiUserManagerModal
        isOpen={isMultiUserOpen}
        onClose={() => setIsMultiUserOpen(false)}
        activeUserId={activeUserId}
        onSwitchUser={(newUid) => {
          setActiveUserId(newUid);
          localStorage.setItem('tradeao_active_user', newUid);
        }}
        onRefreshParent={handleRefresh}
      />

      {/* Trade AO Database & Persistence Inspector (FASE 17) */}
      <DatabasePersistenceModal
        isOpen={isDatabaseOpen}
        onClose={() => setIsDatabaseOpen(false)}
        onRefreshParent={handleRefresh}
      />

      {/* Trade AO 24/7 Daemon & Resilience Inspector (FASE 18) */}
      <Daemon247Modal
        isOpen={isDaemonOpen}
        onClose={() => setIsDaemonOpen(false)}
        onRefreshAppState={handleRefresh}
      />

      {/* Trade AO Quality, Test Automation & Structured Logs Modal (FASE 20) */}
      <TestRunnerModal
        isOpen={isTestRunnerOpen}
        onClose={() => setIsTestRunnerOpen(false)}
      />
    </div>
  );
}

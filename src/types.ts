export interface UserProfile {
  email: string;
  senha?: string;
  tokens: number;
  chat_id: number | string;
  registro: string;
  trades: number;
  vitorias: number;
  autotrade: boolean;
  risco: number;
  clicou_depositar: boolean;
  convidado_por: string | null;
  autotrade_confirmed?: boolean;
  broker_connections?: {
    binance?: {
      connected: boolean;
      preview?: string;
      testnet?: boolean;
      connectedAt?: string;
    };
  };
}

export interface CryptoTicker {
  par: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: number;
  timestamp: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorsData {
  rsi: number;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  atr: number | null;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  volumeRatio?: number;
}

export type ConfluenceTier = 'IGNORE' | 'WEAK' | 'GOOD' | 'STRONG' | 'VERY STRONG';

export interface SignalItem {
  id?: string;
  par: string;
  timeframe: string;
  direcao: 'LONG' | 'SHORT';
  entrada: number;
  alvo: number;
  stop: number;
  score: number;
  scoreCategory: ConfluenceTier;
  estrategia?: string;
  rsi: number;
  ema9: number;
  ema21: number;
  ema50?: number;
  atr?: number;
  bbUpper?: number;
  bbLower?: number;
  indicadores?: {
    rsi: number;
    ema9: number;
    ema21: number;
    ema50: number;
    atr: number;
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
      bandwidth: number;
    };
    macd?: {
      macd: number;
      signal: number;
      histogram: number;
      histogram_growing?: boolean;
    };
    volume?: {
      current_volume: number;
      avg_volume: number;
      ratio: number;
      is_high_volume: boolean;
      is_bullish_volume: boolean;
    };
    market_structure?: {
      structure: string;
      bias: string;
      breakout?: string | null;
    };
  };
  confluenceBreakdown?: Record<string, number>;
  ts: number;
  timestamp?: number;
  status: 'pending' | 'win' | 'loss';
  resolvidoEm?: number;
  reasons?: string[];
}

export interface ActiveTrade {
  id: string;
  email: string;
  par: string;
  direcao: 'COMPRAR' | 'VENDER';
  valor: number;
  abertura: number;
  fechamento?: number;
  stopLoss?: number;
  takeProfit?: number;
  resultado?: 'win' | 'loss';
  lucro?: number;
  status: 'open' | 'closed';
  criadoEm: number;
  fechaEm: number;
}

export interface RiskSettings {
  risk_per_trade_pct: number;
  max_daily_loss_pct: number;
  max_open_positions: number;
  allowed_pairs: string[];
  mandatory_stop_loss: boolean;
  min_risk_reward_ratio: number;
  loss_cooldown_minutes: number;
}

export interface RiskDailyStats {
  date: string;
  total_pnl_usd: number;
  total_pnl_pct: number;
  trades_count: number;
  losses_count: number;
  wins_count: number;
}

export interface RiskStatus {
  chat_id: string | number;
  settings: RiskSettings;
  daily_stats: RiskDailyStats;
  daily_loss_pct: number;
  daily_loss_reached: boolean;
  in_cooldown: boolean;
  cooldown_remaining_seconds: number;
  cooldown_remaining_minutes: number;
  autotrade_paused: boolean;
  pause_reason?: string | null;
  open_positions_count?: number;
}

export interface PositionSizingResult {
  valid: boolean;
  position_size: number;
  position_value_usd: number;
  risk_amount_usd: number;
  distance_pct: number;
  stop_distance_usd: number;
  capital: number;
  risk_percent: number;
  error?: string;
}

export type PipelineStepName =
  | 'Market Scanner'
  | 'Signal Engine'
  | 'Confidence/Confluence Score'
  | 'Risk Manager'
  | 'Trade Approval'
  | 'Binance Broker'
  | 'Order Manager'
  | 'Trade Monitor'
  | 'Resultado'
  | 'Analytics'
  | 'Telegram';

export interface PipelineStepDetail {
  name: PipelineStepName;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  details: string;
  durationMs?: number;
  timestamp: number;
}

export interface ExecutionGuardrailsAudit {
  stopLossPresent: boolean;
  riskWithinLimits: boolean;
  dailyLossPermitted: boolean;
  noDuplicateEntry: boolean;
  signalNotStale: boolean;
  idempotencyValid: boolean;
}

export interface ExecutionLogRecord {
  id: string;
  idempotencyKey: string;
  clientOrderId: string;
  timestamp: number;
  par: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  positionValueUsd: number;
  riskAmountUsd: number;
  riskPercent: number;
  confidenceScore: number;
  confluenceCategory: ConfluenceTier;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'MONITORING' | 'CLOSED' | 'FAILED';
  rejectionReason?: string;
  rejectionRule?: string;
  outcome?: {
    result: 'WIN' | 'LOSS' | 'BREAKEVEN';
    pnlUsd: number;
    pnlPct: number;
    closedAt: number;
    closePrice: number;
    exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TIME_EXPIRE' | 'MANUAL';
  };
  pipeline: PipelineStepDetail[];
  guardrails: ExecutionGuardrailsAudit;
  binanceOrder?: {
    orderId: string | number;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: string;
    origQty: number;
    executedQty: number;
    status: string;
    mode: 'testnet' | 'live' | 'paper_simulation';
  };
}

export interface ExecutionEngineStatus {
  enabled: boolean;
  activeExecutionsCount: number;
  idempotencyKeysCount: number;
  guardrails: {
    mandatoryStopLoss: boolean;
    maxRiskPerTradePct: number;
    dailyLossLimitPct: number;
    staleSignalTtlSeconds: number;
    deduplicationEnabled: boolean;
    idempotencyEnabled: boolean;
    minConfidenceScore: number;
  };
  stats: {
    totalEvaluated: number;
    totalApproved: number;
    totalRejected: number;
    totalExecuted: number;
    rejectionsByRule: {
      missing_stop_loss: number;
      risk_exceeded: number;
      daily_loss_reached: number;
      duplicate_entry: number;
      stale_signal: number;
      idempotency_duplicate: number;
      low_confidence: number;
      in_cooldown: number;
      max_positions_reached: number;
      pair_not_allowed: number;
    };
  };
  recentExecutions: ExecutionLogRecord[];
}

export type MonitoredTradeStatus =
  | 'PENDING'
  | 'FILLED'
  | 'MONITORING'
  | 'TP_HIT'
  | 'SL_HIT'
  | 'TIME_EXPIRED'
  | 'CLOSED'
  | 'CANCELLED';

export interface MonitoredTradeRecord {
  id: string;
  clientOrderId: string;
  par: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  positionValueUsd: number;
  riskPercent: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  distToTpPct: number;
  distToSlPct: number;
  progressPct: number;
  status: MonitoredTradeStatus;
  createdAt: number;
  expiresAt: number;
  closedAt?: number | null;
  exitPrice?: number | null;
  realizedPnlUsd?: number;
  realizedPnlPct?: number;
  outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN' | null;
  exitReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TIME_EXPIRE' | 'MANUAL' | null;
  notificationsSent: string[];
}

export interface TradeMonitorSummary {
  activeCount: number;
  monitoredTrades: MonitoredTradeRecord[];
  history: MonitoredTradeRecord[];
  totalWins: number;
  totalLosses: number;
  winRatePct: number;
  totalPnlUsd: number;
}

// ================= FASE 14 — HISTÓRICO & ANALYTICS POR USUÁRIO =================

export interface UserTradeRecord {
  id: string;
  user_id: string;
  broker: string;
  par: string;
  timeframe: string;
  estrategia: string;
  direcao: 'LONG' | 'SHORT';
  entrada: number;
  stop: number;
  alvo: number;
  quantidade: number;
  timestamp: number;
  ordem: string;
  resultado: 'WIN' | 'LOSS' | 'BREAKEVEN';
  pnl_usd: number;
  pnl_pct: number;
  score: number;
  position_value_usd?: number;
}

export interface PairPerformance {
  par: string;
  total: number;
  wins: number;
  losses: number;
  win_rate_pct: number;
  pnl_usd: number;
  volume_usd?: number;
}

export interface TimeframePerformance {
  timeframe: string;
  total: number;
  wins: number;
  losses: number;
  win_rate_pct: number;
  pnl_usd: number;
}

export interface StrategyPerformance {
  estrategia: string;
  total: number;
  wins: number;
  losses: number;
  win_rate_pct: number;
  pnl_usd: number;
}

export interface EquityPoint {
  trade_num: number;
  timestamp: number;
  pnl_usd: number;
  cumulative_pnl: number;
  balance: number;
  drawdown_usd: number;
  drawdown_pct: number;
  par?: string;
  resultado?: string;
}

export interface UserAnalyticsStats {
  user_id: string;
  total_trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  win_rate_pct: number;
  total_pnl_usd: number;
  total_pnl_pct: number;
  profit_factor: number;
  max_drawdown_usd: number;
  max_drawdown_pct: number;
  gross_profit_usd: number;
  gross_loss_usd: number;
  avg_win_usd: number;
  avg_loss_usd: number;
  payoff_ratio: number;
  current_balance: number;
  performance_by_par: PairPerformance[];
  performance_by_timeframe: TimeframePerformance[];
  performance_by_strategy: StrategyPerformance[];
  equity_curve: EquityPoint[];
  recent_trades: UserTradeRecord[];
}

// ================= FASE 15 & 19 — TRADING MODE & LIVE GUARDRAIL TYPES =================

export type TradingMode = 'paper' | 'testnet' | 'live' | 'PAPER_TRADING' | 'BINANCE_TESTNET' | 'REAL_TRADING';

export type PaperCycleStepName =
  | 'SIGNAL'
  | 'RISK'
  | 'ENTRY'
  | 'MONITORING'
  | 'TP_SL'
  | 'RESULT'
  | 'ANALYTICS';

export interface PaperStepLog {
  step: PaperCycleStepName;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  title: string;
  details: string;
  data?: Record<string, any>;
  timestamp: number;
}

export interface PaperCycleResult {
  id: string;
  mode: TradingMode;
  user_id: string;
  par: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  positionValueUsd: number;
  riskAmountUsd: number;
  exitPrice: number;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
  pnlUsd: number;
  pnlPct: number;
  virtualBalanceBefore: number;
  virtualBalanceAfter: number;
  steps: PaperStepLog[];
  completedAt: number;
}

export interface PaperTradingStatus {
  activeMode: TradingMode;
  virtualBalanceUsd: number;
  realTradingUnlocked: boolean;
  paperTradesCount: number;
  paperWinsCount: number;
  paperWinRatePct: number;
  testnetConnected: boolean;
  testnetBalanceUsd?: number;
  safetyChecklist: {
    minimumPaperTradesCompleted: boolean;
    paperTradesCount: number;
    requiredPaperTrades: number;
    riskAcknowledged: boolean;
    circuitBreakerTested: boolean;
    apiKeysValidatedNonWithdrawal: boolean;
  };
}

// ================= FASE 16 — MULTIUSER ISOLATION TYPES =================

export interface MultiUserAccountSummary {
  userId: string;
  name: string;
  email: string;
  tokens: number;
  paperBalance: number;
  tradesCount: number;
  winRatePct: number;
  binanceConnected: boolean;
  autotradeActive: boolean;
  tradingMode: TradingMode;
  riskPerTradePct: number;
  maxDailyLossPct: number;
  activePositionsCount: number;
  customSignalsCount: number;
  registeredAt: string;
}

export interface UserCustomSignal {
  id: string;
  userId: string;
  par: string;
  timeframe: string;
  estrategia: string;
  direcao: 'LONG' | 'SHORT';
  entrada: number;
  alvo: number;
  stop: number;
  score: number;
  nota?: string;
  criadoEm: number;
}

export interface MultiUserIsolationAudit {
  status: 'ISOLATION_ENFORCED' | 'LEAK_DETECTED';
  activeUser: string;
  checkedPillars: {
    account: { isolated: boolean; details: string };
    credentials: { isolated: boolean; details: string };
    balance: { isolated: boolean; details: string };
    settings: { isolated: boolean; details: string };
    positions: { isolated: boolean; details: string };
    history: { isolated: boolean; details: string };
    risk: { isolated: boolean; details: string };
    customSignals: { isolated: boolean; details: string };
  };
  totalUsersInSystem: number;
  timestamp: number;
}

// ================= FASE 17 — PERSISTENCE & DATABASE TYPES =================

export interface DatabaseTableInfo {
  tableName: string;
  rowCount: number;
  indexesCount: number;
}

export interface DatabaseMetrics {
  engine: string;
  isPersistent: boolean;
  dbPath: string;
  dbSizeBytes: number;
  dbSizeKb: number;
  tables: DatabaseTableInfo[];
  totalTransactionsLogged: number;
  migrationVersion: number;
  lastMigrationTime: string;
  isWalActive: boolean;
  status: 'ONLINE' | 'MIGRATED' | 'SYNCED' | 'FALLBACK';
}

export interface DatabaseAuditLogEntry {
  id: number;
  user_id: string;
  action: string;
  table_name: string;
  record_id?: string;
  details: string;
  timestamp: number;
}





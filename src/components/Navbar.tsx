import React from 'react';
import { Bot, Coins, ShieldCheck, UserCheck, RefreshCw, Send, ShieldAlert, Cpu, Activity, BarChart3, LineChart, FlaskConical, Users, Database, Server } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  activeView: 'trading' | 'analytics';
  onToggleView: (view: 'trading' | 'analytics') => void;
  onOpenAccount: () => void;
  onOpenDeposit: () => void;
  onOpenTelegramSim: () => void;
  onOpenRiskManager: () => void;
  onOpenExecutionEngine: () => void;
  onOpenTradeMonitor: () => void;
  onOpenPaperTrading: () => void;
  onOpenMultiUser: () => void;
  onOpenDatabase: () => void;
  onOpenDaemon247: () => void;
  onOpenTestRunner: () => void;
  isTelegramOpen: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  activeTradesCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  onToggleView,
  onOpenAccount,
  onOpenDeposit,
  onOpenTelegramSim,
  onOpenRiskManager,
  onOpenExecutionEngine,
  onOpenTradeMonitor,
  onOpenPaperTrading,
  onOpenMultiUser,
  onOpenDatabase,
  onOpenDaemon247,
  onOpenTestRunner,
  isTelegramOpen,
  refreshing,
  onRefresh,
  activeTradesCount = 0,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-100 tracking-tight">TradeAO Engine</h1>
            <span className="bg-cyan-500/15 text-cyan-300 text-xs px-2 py-0.5 rounded-full border border-cyan-500/30 font-medium font-mono">
              FASE 20
            </span>
            <span className="bg-emerald-500/15 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold font-mono tracking-wider">
              16/16 TESTES ✅
            </span>
          </div>
          <p className="text-xs text-slate-400">Qualidade, Suíte de Testes, Logs Estruturados &amp; Zero Credential Leak</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* QA & Tests Modal Trigger (FASE 20) */}
        <button
          id="btn-nav-qa-tests"
          onClick={onOpenTestRunner}
          className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-cyan-500/20 cursor-pointer"
          title="Abrir Suíte de Testes Automatizados e Logs Sanitizados (FASE 20)"
        >
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span className="flex items-center gap-1">
            <span>🧪 QA &amp; Testes</span>
          </span>
        </button>

        {/* 24/7 Daemon Modal Trigger (FASE 18) */}
        <button
          id="btn-nav-daemon"
          onClick={onOpenDaemon247}
          className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-500/10 cursor-pointer"
          title="Painel de Execução Contínua 24/7, Process Manager, Systemd e Recuperação Pós-Restart (FASE 18)"
        >
          <Server className="w-4 h-4 text-emerald-400" />
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            24/7 Daemon
          </span>
        </button>

        {/* Database & Persistence Modal Trigger (FASE 17) */}
        <button
          id="btn-nav-database"
          onClick={onOpenDatabase}
          className="bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-cyan-500/10 cursor-pointer hidden sm:flex"
          title="Inspetor de Banco de Dados Relacional, Esquema e Transações ACID (FASE 17)"
        >
          <Database className="w-4 h-4 text-cyan-400" />
          <span>Banco de Dados</span>
        </button>

        {/* Multiuser Modal Trigger Button (FASE 16) */}
        <button
          id="btn-nav-multiuser"
          onClick={onOpenMultiUser}
          className="bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-purple-500/10 cursor-pointer hidden md:flex"
          title="Gerenciador Multiuser e Auditoria de Isolamento Total (FASE 16)"
        >
          <Users className="w-4 h-4 text-purple-400" />
          <span>Multiuser</span>
        </button>

        {/* Paper Trading Modal Trigger Button (FASE 15) */}
        <button
          id="btn-nav-paper-trading"
          onClick={onOpenPaperTrading}
          className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-500/10 cursor-pointer hidden sm:flex"
          title="Abrir Paper Trading (Simulação Completa em 7 Etapas e Binance Testnet)"
        >
          <FlaskConical className="w-4 h-4 text-emerald-400" />
          <span>🧪 Paper Trading</span>
        </button>

        {/* View Switcher Tabs: Trading vs Analytics */}
        <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
          <button
            id="nav-tab-trading"
            onClick={() => onToggleView('trading')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeView === 'trading'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Terminal</span>
          </button>

          <button
            id="nav-tab-analytics"
            onClick={() => onToggleView('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeView === 'analytics'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics &amp; Histórico</span>
          </button>
        </div>

        {/* Token Balance Pill */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 flex items-center gap-2 hidden lg:flex">
          <Coins className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="text-[10px] text-slate-400 block leading-tight">Tokens Demo</span>
            <span className="text-xs font-semibold text-emerald-400">
              {user ? user.tokens.toFixed(2) : '0.00'} 💎
            </span>
          </div>
        </div>

        {/* Trade Monitor Button (FASE 13) */}
        <button
          id="btn-nav-trade-monitor"
          onClick={onOpenTradeMonitor}
          className="bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-500/10 cursor-pointer"
          title="Abrir Trade Monitor (FASE 13 — Rastreamento de Ordens, Posições e SL/TP)"
        >
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="hidden md:inline">Monitor</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
            activeTradesCount > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
          }`}>
            {activeTradesCount > 0 ? `${activeTradesCount} Ativo` : '0'}
          </span>
        </button>

        {/* Execution Engine Button (FASE 12) */}
        <button
          id="btn-nav-execution-engine"
          onClick={onOpenExecutionEngine}
          className="bg-neutral-900 hover:bg-neutral-800 border border-cyan-500/40 text-cyan-300 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm shadow-cyan-500/10 cursor-pointer hidden sm:flex"
          title="Abrir Execution Engine (11 Etapas & Guardrails)"
        >
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="hidden md:inline">Execution Engine</span>
        </button>

        {/* Risk Manager Button */}
        <button
          id="btn-nav-risk-manager"
          onClick={onOpenRiskManager}
          className="bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm shadow-amber-500/10 cursor-pointer hidden md:flex"
          title="Abrir Trade AO Risk Manager (Fase 9)"
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Risk Manager</span>
        </button>

        {/* Telegram Bot Toggle */}
        <button
          onClick={onOpenTelegramSim}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isTelegramOpen
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Abrir Simulador do Bot de Telegram"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Bot</span>
        </button>

        {/* User Account */}
        <button
          onClick={onOpenAccount}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <UserCheck className="w-4 h-4 text-slate-400" />
          <span className="hidden md:inline">{user ? user.email.split('@')[0] : 'Conta'}</span>
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className={`p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer ${
            refreshing ? 'animate-spin text-emerald-400' : ''
          }`}
          title="Atualizar dados"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

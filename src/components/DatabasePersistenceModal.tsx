import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Server,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Download,
  Terminal,
  Shield,
  Layers,
  ArrowRight,
  Clock,
  Search,
  Check,
  Zap,
  Lock,
  FileCode2,
  TableProperties
} from 'lucide-react';
import { DatabaseMetrics, DatabaseAuditLogEntry } from '../types';

interface DatabasePersistenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
}

export function DatabasePersistenceModal({
  isOpen,
  onClose,
  onRefreshParent,
}: DatabasePersistenceModalProps) {
  const [metrics, setMetrics] = useState<DatabaseMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<DatabaseAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tables' | 'query' | 'audit' | 'architecture'>('overview');
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT chat_id, email, tokens, trades, vitorias, autotrade, risco FROM users LIMIT 10;');
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const fetchMetricsAndLogs = useCallback(async () => {
    setLoading(true);
    try {
      const [resMetrics, resAudit] = await Promise.all([
        fetch('/api/db/metrics'),
        fetch('/api/db/audit?limit=30')
      ]);

      if (resMetrics.ok) {
        const data = await resMetrics.json();
        setMetrics(data.metrics);
      }
      if (resAudit.ok) {
        const data = await resAudit.json();
        setAuditLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Error loading db metrics:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMetricsAndLogs();
      setActionSuccess(null);
    }
  }, [isOpen, fetchMetricsAndLogs]);

  // Run SQL Query
  const handleExecuteQuery = async (queryToRun?: string) => {
    const q = queryToRun || sqlQuery;
    setIsQuerying(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: q }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQueryResult(data.results);
      } else {
        setQueryError(data.error || 'Erro ao executar consulta SQL.');
      }
    } catch (err: any) {
      setQueryError(err.message || 'Falha de comunicação.');
    } finally {
      setIsQuerying(false);
    }
  };

  // Run Incremental Migration
  const handleRunMigration = async () => {
    setIsMigrating(true);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/db/migrate', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess('✅ Migração incremental concluída com sucesso! Dados legados reconciliados no SQLite.');
        fetchMetricsAndLogs();
        if (onRefreshParent) onRefreshParent();
      } else {
        setQueryError(data.error || 'Falha na migração.');
      }
    } catch (err: any) {
      setQueryError(err.message || 'Erro ao acionar migração.');
    } finally {
      setIsMigrating(false);
    }
  };

  // Create Snapshot Backup
  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/db/backup', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess(`💾 Snapshot atômico de backup criado com sucesso (${data.sizeBytes} bytes)!`);
        fetchMetricsAndLogs();
      } else {
        setQueryError(data.error || 'Falha ao criar backup.');
      }
    } catch (err: any) {
      setQueryError(err.message || 'Erro ao criar backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!isOpen) return null;

  const quickQueries = [
    { label: '👥 Usuários e Saldos', sql: 'SELECT chat_id, email, tokens, paper_balance, trades, autotrade FROM users;' },
    { label: '📊 Últimos 10 Trades', sql: 'SELECT id, user_id, par, direcao, preco_entrada, lucro_usd, status FROM user_trades ORDER BY timestamp DESC LIMIT 10;' },
    { label: '🛡️ Configurações de Risco', sql: 'SELECT user_id, risk_per_trade_pct, max_daily_loss_pct, circuit_breaker_active FROM risk_settings;' },
    { label: '📡 Sinais Customizados', sql: 'SELECT id, user_id, par, timeframe, estrategia, direcao, score FROM custom_signals;' },
    { label: '📜 Log de Auditoria ACID', sql: 'SELECT id, user_id, action, table_name, details, datetime(timestamp/1000, "unixepoch") as data FROM db_audit_log ORDER BY id DESC LIMIT 10;' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Trade AO — Banco de Dados Relacional &amp; Persistência</h2>
                <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full text-xs font-mono font-semibold">
                  FASE 17
                </span>
                <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-xs font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  SQLITE ACID ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Avaliação de persistência, migração incremental, transações atômicas e isolamento relacional
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMetricsAndLogs}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Atualizar Métricas"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Action Notifications */}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-200 text-xs">✕</button>
          </div>
        )}

        {queryError && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{queryError}</span>
            </div>
            <button onClick={() => setQueryError(null)} className="text-slate-400 hover:text-slate-200 text-xs">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-cyan-500 text-cyan-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Visão Geral &amp; Métricas
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'tables'
                ? 'border-cyan-500 text-cyan-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            Tabelas &amp; Esquema ({metrics?.tables?.length || 7})
          </button>
          <button
            onClick={() => setActiveTab('query')}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'query'
                ? 'border-cyan-500 text-cyan-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Inspetor SQL (Read-Only)
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-cyan-500 text-cyan-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Log de Transações ACID ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'architecture'
                ? 'border-cyan-500 text-cyan-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Avaliação Arquitetural (JSON vs. DB)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Engine do Banco</span>
                    <Database className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-100">SQLite 3 (Relacional)</div>
                  <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                    <Check className="w-3 h-3" /> WASM Engine + Arquivo Atômico
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Tamanho do Arquivo</span>
                    <HardDrive className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-lg font-bold text-slate-100">{metrics?.dbSizeKb || 0} KB</div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono truncate" title={metrics?.dbPath}>
                    /storage/tradeao.sqlite
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Tabelas / Índices B-Tree</span>
                    <Layers className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-lg font-bold text-slate-100">
                    {metrics?.tables?.length || 7} tabelas
                  </div>
                  <div className="text-[11px] text-blue-400 mt-1 font-mono">
                    5 índices de busca rápida ativos
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Auditoria de Transações</span>
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-lg font-bold text-slate-100">
                    {metrics?.totalTransactionsLogged || 0} eventos
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1 font-mono">
                    ACID Commit Logs ativos
                  </div>
                </div>
              </div>

              {/* Incremental Migration & Maintenance Action Hub */}
              <div className="bg-gradient-to-r from-slate-950 to-cyan-950/20 border border-cyan-500/20 rounded-2xl p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      Ações de Migração Incremental &amp; Backup
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      A base de dados SQLite mantém sincronização incremental e idempotente. 
                      Novos usuários ou dados salvos em JSON legados são automaticamente reconciliados sem perdas.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleRunMigration}
                      disabled={isMigrating}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all flex items-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
                      <span>{isMigrating ? 'Migrando...' : 'Reexecutar Migração Incremental'}</span>
                    </button>

                    <button
                      onClick={handleCreateBackup}
                      disabled={isBackingUp}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isBackingUp ? 'Gerando...' : 'Snapshot Backup'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Table Summary List */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Resumo das Tabelas no Banco Relacional</span>
                  <span className="text-[11px] text-slate-400 font-mono">Versão do Esquema: v{metrics?.migrationVersion || 1}</span>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {metrics?.tables?.map((tbl) => (
                    <div key={tbl.tableName} className="px-4 py-3 flex items-center justify-between hover:bg-slate-900/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <TableProperties className="w-4 h-4 text-cyan-400" />
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-200">{tbl.tableName}</span>
                          <span className="text-[11px] text-slate-400 ml-2">
                            {tbl.tableName === 'users' && '— Contas, saldos e preferências'}
                            {tbl.tableName === 'user_trades' && '— Histórico individual de ordens'}
                            {tbl.tableName === 'custom_signals' && '— Estratégias e alertas customizados'}
                            {tbl.tableName === 'risk_settings' && '— Parâmetros e Circuit Breaker'}
                            {tbl.tableName === 'vault_credentials' && '— Chaves mascaradas e seguras'}
                            {tbl.tableName === 'signals_history' && '— Registro global de sinais técnicos'}
                            {tbl.tableName === 'db_audit_log' && '— Logs de transações atômicas'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">
                          <strong>{tbl.rowCount}</strong> registros
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {tbl.indexesCount} índice(s)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TABLES & SCHEMA */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Estrutura relacional do banco de dados com chaves primárias, estrangeiras e tipos de dados estritos:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Table: users */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-cyan-300 font-bold">
                    <span>users</span>
                    <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded">PRIMARY KEY (chat_id)</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-300">
                    <li><span className="text-amber-400">chat_id</span> TEXT (PK)</li>
                    <li><span className="text-slate-400">email</span> TEXT UNIQUE NOT NULL</li>
                    <li><span className="text-slate-400">tokens</span> REAL DEFAULT 20.0</li>
                    <li><span className="text-slate-400">paper_balance</span> REAL DEFAULT 1000.0</li>
                    <li><span className="text-slate-400">trading_mode</span> TEXT DEFAULT 'PAPER_TRADING'</li>
                    <li><span className="text-slate-400">trades</span> INTEGER / <span className="text-slate-400">vitorias</span> INTEGER</li>
                    <li><span className="text-slate-400">autotrade</span> INTEGER (0 ou 1)</li>
                    <li><span className="text-slate-400">risco</span> REAL DEFAULT 1.0</li>
                    <li><span className="text-slate-400">created_at / updated_at</span> INTEGER</li>
                  </ul>
                </div>

                {/* Table: user_trades */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-purple-300 font-bold">
                    <span>user_trades</span>
                    <span className="text-[10px] bg-purple-950 text-purple-400 border border-purple-800 px-2 py-0.5 rounded">FK (user_id ➔ users)</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-300">
                    <li><span className="text-amber-400">id</span> TEXT (PK)</li>
                    <li><span className="text-purple-400">user_id</span> TEXT (FK, Indexado)</li>
                    <li><span className="text-slate-400">par</span> TEXT / <span className="text-slate-400">direcao</span> TEXT</li>
                    <li><span className="text-slate-400">preco_entrada / preco_saida</span> REAL</li>
                    <li><span className="text-slate-400">alvo / stop / quantidade</span> REAL</li>
                    <li><span className="text-slate-400">lucro_usd / lucro_pct</span> REAL</li>
                    <li><span className="text-slate-400">status</span> TEXT ('FECHADO', 'ABERTO')</li>
                    <li><span className="text-slate-400">timestamp</span> INTEGER (Indexado DESC)</li>
                  </ul>
                </div>

                {/* Table: custom_signals */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-emerald-300 font-bold">
                    <span>custom_signals</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">FK (user_id ➔ users)</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-300">
                    <li><span className="text-amber-400">id</span> TEXT (PK)</li>
                    <li><span className="text-emerald-400">user_id</span> TEXT (FK, Indexado)</li>
                    <li><span className="text-slate-400">par / timeframe / estrategia</span> TEXT</li>
                    <li><span className="text-slate-400">direcao</span> TEXT ('LONG'/'SHORT')</li>
                    <li><span className="text-slate-400">entrada / alvo / stop</span> REAL</li>
                    <li><span className="text-slate-400">score</span> INTEGER / <span className="text-slate-400">nota</span> TEXT</li>
                    <li><span className="text-slate-400">criado_em</span> INTEGER</li>
                  </ul>
                </div>

                {/* Table: risk_settings */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-amber-300 font-bold">
                    <span>risk_settings</span>
                    <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded">FK (user_id ➔ users)</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-300">
                    <li><span className="text-amber-400">user_id</span> TEXT (PK, FK)</li>
                    <li><span className="text-slate-400">risk_per_trade_pct</span> REAL DEFAULT 1.0</li>
                    <li><span className="text-slate-400">max_daily_loss_pct</span> REAL DEFAULT 3.0</li>
                    <li><span className="text-slate-400">max_consecutive_losses</span> INTEGER</li>
                    <li><span className="text-slate-400">circuit_breaker_active</span> INTEGER (0/1)</li>
                    <li><span className="text-slate-400">autotrade_paused</span> INTEGER</li>
                    <li><span className="text-slate-400">updated_at</span> INTEGER</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SQL QUERY INSPECTOR */}
          {activeTab === 'query' && (
            <div className="space-y-4">
              {/* Quick Query Templates */}
              <div>
                <span className="text-xs font-bold text-slate-400 mb-2 block">Consultas Rápidas Pré-configuradas:</span>
                <div className="flex flex-wrap gap-2">
                  {quickQueries.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSqlQuery(item.sql);
                        handleExecuteQuery(item.sql);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all font-mono"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SQL Input Area */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 font-mono">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>SQL Query (Read-Only: SELECT / PRAGMA)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Motor SQLite 3 nativo</span>
                </div>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  rows={3}
                  className="w-full bg-transparent text-slate-100 font-mono text-xs focus:outline-none resize-none"
                  placeholder="SELECT * FROM users;"
                />
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400">Pressione Executar para rodar a query na base SQLite</span>
                  <button
                    onClick={() => handleExecuteQuery()}
                    disabled={isQuerying || !sqlQuery.trim()}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-600/20"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isQuerying ? 'Consultando...' : 'Executar Query'}</span>
                  </button>
                </div>
              </div>

              {/* Query Results */}
              {queryResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">
                      Resultado ({queryResult.length} linha(s) retornada(s))
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono">Query executada com sucesso</span>
                  </div>

                  {queryResult.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 font-mono">
                      Nenhum registro retornado para esta consulta.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                          <tr>
                            {Object.keys(queryResult[0]).map((col) => (
                              <th key={col} className="px-3 py-2 font-semibold">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-200">
                          {queryResult.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-900/40">
                              {Object.values(row).map((val: any, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 whitespace-nowrap">
                                  {val === null ? <span className="text-slate-400">NULL</span> : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ACID TRANSACTION LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Registro cronológico de transações ACID e eventos de persistência:</span>
                <span className="font-mono text-cyan-400">{auditLogs.length} eventos recentes</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
                  {auditLogs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Nenhum registro de log de auditoria encontrado.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="p-3.5 hover:bg-slate-900/50 transition-colors flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                              {log.action}
                            </span>
                            <span className="font-mono text-slate-300 font-semibold">{log.table_name}</span>
                            <span className="text-slate-400 text-[11px]">User: <strong className="text-slate-300">{log.user_id}</strong></span>
                          </div>
                          <p className="text-slate-400 text-[11px] font-mono">{log.details}</p>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ARCHITECTURAL EVALUATION */}
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* JSON Limitation Analysis */}
                <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Por que arquivos JSON tornaram-se inadequados?</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✕</span>
                      <span><strong>Condições de Corrida (Race Conditions):</strong> Autotrade bots, webhooks e polling simultâneos regravam o arquivo inteiro (`fs.writeFileSync`), podendo causar perdas de ordens concorrentes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✕</span>
                      <span><strong>Falta de Atomicidade (ACID):</strong> Debitar saldo de um usuário e registrar uma nova posição aberta não ocorrem em uma transação atômica protegida.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✕</span>
                      <span><strong>Sem Índices B-Tree:</strong> Buscar histórico de 10.000 trades de um único usuário exige varrer o arquivo JSON inteiro em memória O(N).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✕</span>
                      <span><strong>Sem Integridade Referencial:</strong> Sem chave estrangeira que garanta que uma posição pertence estritamente a um usuário cadastrado.</span>
                    </li>
                  </ul>
                </div>

                {/* SQLite Relational Advantages */}
                <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span>Vantagens do SQLite Relacional (FASE 17)</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">✓</span>
                      <span><strong>Transações Atômicas (ACID):</strong> Garantia de que atualizações de risco, saldos e ordens ocorrem ou falham de forma segura (`BEGIN ... COMMIT`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">✓</span>
                      <span><strong>Migração Incremental &amp; Zero Data Loss:</strong> Lê e reconcilia dados legados de arquivos JSON preservando 100% dos usuários existentes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">✓</span>
                      <span><strong>Performance Indexada:</strong> Índices em `user_id`, `timestamp` e `status` garantem consultas instantâneas em microssegundos.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">✓</span>
                      <span><strong>Cofre &amp; Auditoria:</strong> Auditoria completa de todas as mutações e isolamento estrito de credenciais por usuário.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-mono">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>SQLite Engine Relacional ativo com persistência atômica</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}

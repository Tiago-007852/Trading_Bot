import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Activity,
  ShieldCheck,
  RefreshCw,
  X,
  FileCode,
  Terminal,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Cpu,
  Layers,
  Database,
  Copy,
  Check,
  Zap,
} from 'lucide-react';

interface Daemon247ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshAppState?: () => void;
}

interface DaemonStatus {
  status: string;
  uptimeSeconds: number;
  uptimeFormatted: string;
  pid: number;
  isLockAcquired: boolean;
  lockfile: {
    path: string;
    isActive: boolean;
    lockedPid: number | null;
  };
  botDaemon: {
    pidFile: string;
    pid: number | null;
    isRunning: boolean;
  };
  systemd: {
    serviceName: string;
    botServiceName: string;
    autoRestart: boolean;
    restartSec: number;
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  persistenceRecovery: {
    jobsInPersistence: number;
    lastRecovery: any;
    zeroMemoryDependency: boolean;
  };
  logs: {
    totalRingLogs: number;
    logFilePath: string;
  };
  serverTime: number;
}

interface DaemonLog {
  id: string;
  timestamp: number;
  timeStr: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'RECOVERY' | 'CRITICAL' | 'SHUTDOWN';
  category: 'SYSTEM' | 'MONITOR' | 'DATABASE' | 'RISK' | 'BROKER' | 'RECOVERY';
  message: string;
  details?: any;
}

export const Daemon247Modal: React.FC<Daemon247ModalProps> = ({
  isOpen,
  onClose,
  onRefreshAppState,
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'recovery' | 'deployment' | 'logs'>('monitor');
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [logs, setLogs] = useState<DaemonLog[]>([]);
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [simulatingCrash, setSimulatingCrash] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchDaemonData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, logsRes, jobsRes] = await Promise.all([
        fetch('/api/daemon/status'),
        fetch(`/api/daemon/logs?limit=150&level=${selectedLogLevel}`),
        fetch('/api/daemon/active-jobs'),
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        setStatus(sData);
      }
      if (logsRes.ok) {
        const lData = await logsRes.json();
        setLogs(lData.logs || []);
      }
      if (jobsRes.ok) {
        const jData = await jobsRes.json();
        setActiveJobs(jData.activeJobs || []);
        setHistoryJobs(jData.historyJobs || []);
      }
    } catch (err) {
      console.error('Error fetching daemon data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedLogLevel]);

  useEffect(() => {
    if (isOpen) {
      fetchDaemonData();
      const timer = setInterval(fetchDaemonData, 5000);
      return () => clearInterval(timer);
    }
  }, [isOpen, fetchDaemonData]);

  const handleSimulateCrash = async () => {
    try {
      setSimulatingCrash(true);
      setSimulationResult(null);
      const res = await fetch('/api/daemon/simulate-restart', {
        method: 'POST',
      });
      const data = await res.json();
      setSimulationResult(data);
      await fetchDaemonData();
      if (onRefreshAppState) onRefreshAppState();
    } catch (err: any) {
      console.error('Error simulating crash:', err);
    } finally {
      setSimulatingCrash(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Trade AO — Servidor 24/7 &amp; Process Manager
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE 24/7
                </span>
                <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-0.5 rounded-full border border-cyan-500/20 font-mono">
                  FASE 18
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Execução contínua, Single-Instance Lock, Systemd, Rotação de Logs e Recuperação de Jobs Persistidos (Zero RAM Loss)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDaemonData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
              title="Atualizar Métricas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 px-4 sm:px-6">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'monitor'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Monitor 24/7 &amp; Processos</span>
          </button>

          <button
            onClick={() => setActiveTab('recovery')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'recovery'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Recuperação Pós-Crash ({activeJobs.length} Jobs)</span>
          </button>

          <button
            onClick={() => setActiveTab('deployment')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'deployment'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Deploy &amp; Systemd Units</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Logs em Tempo Real ({logs.length})</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: MONITOR & HEALTH METRICS */}
          {activeTab === 'monitor' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Primary Stat Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Uptime do Servidor</span>
                  </div>
                  <div className="text-lg font-bold text-white font-mono">
                    {status?.uptimeFormatted || 'Calculando...'}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium">Execução contínua</span>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span>PID Principal</span>
                  </div>
                  <div className="text-lg font-bold text-cyan-300 font-mono">
                    PID {status?.pid || process.pid}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Lockfile Ativo</span>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Memória (RSS / Heap)</span>
                  </div>
                  <div className="text-lg font-bold text-purple-300 font-mono">
                    {status?.memory.rssMb || 0} MB
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Heap: {status?.memory.heapUsedMb || 0} MB
                  </span>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span>Jobs em Monitoramento</span>
                  </div>
                  <div className="text-lg font-bold text-amber-300 font-mono">
                    {activeJobs.length} Ativos
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    100% Persistidos no SQLite
                  </span>
                </div>
              </div>

              {/* 5 Pillars of 24/7 Resilience Card */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Mecanismos de Resiliência 24/7 Ativos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-200 block">Single-Instance PID Lockfile</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Garante que instâncias duplicadas do bot ou servidor sejam bloqueadas instantaneamente através de travas exclusivas em <code className="text-cyan-400 font-mono">storage/tradeao_*.pid</code>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-200 block">Zero Perda de Memória (SQLite ACID)</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Jobs de trading são persistidos em disco antes da confirmação. Quedas ou reinicializações do processo reconstituem as ordens automaticamente.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-200 block">Auto-Restart com Systemd (RestartSec=5s)</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Configuração de watchdog em nível de sistema operacional com reinício imediato em caso de falha não tratada ou crash do sistema.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-200 block">Rotação de Logs Automática (10MB c/ 5 backups)</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Previne estouro de disco mantendo rotação estruturada em <code className="text-cyan-400 font-mono">logs/tradeao_*.log</code> e integração com logrotate.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Banner: Crash Test Simulator */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-slate-900/60 border border-emerald-500/30 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Teste de Resiliência: Simulação de Queda de Servidor (Crash Test)
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl">
                    Limpa a memória RAM do processo e aciona o motor de recuperação para verificar a reconstituição e reconciliação dos trades persistidos no SQLite.
                  </p>
                </div>

                <button
                  onClick={handleSimulateCrash}
                  disabled={simulatingCrash}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`w-4 h-4 ${simulatingCrash ? 'animate-spin' : ''}`} />
                  <span>{simulatingCrash ? 'Reconstituindo...' : 'Simular Queda (Crash Test)'}</span>
                </button>
              </div>

              {/* Simulation Result Alert */}
              {simulationResult && (
                <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      Resultado da Reconstituição Pós-Restart
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">RAM Limpa</span>
                      <span className="font-bold text-amber-400">
                        {simulationResult.priorWipedActiveMemoryCount} trades
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Recuperados do SQLite</span>
                      <span className="font-bold text-emerald-400">
                        {simulationResult.recoveryResult?.recoveredTotal || 0} trades
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Reidratados na RAM</span>
                      <span className="font-bold text-cyan-400">
                        {simulationResult.recoveryResult?.stillActiveCount || 0} trades
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Reconciliados Pós-Restart</span>
                      <span className="font-bold text-purple-400">
                        {simulationResult.recoveryResult?.reconciledCount || 0} fechados
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVE PERSISTED JOBS & RECOVERY */}
          {activeTab === 'recovery' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Tabela SQLite: <code className="text-cyan-400 font-mono">active_monitored_jobs</code>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Jobs ativos gravados em disco. Sem dependência exclusiva de memória RAM.
                  </p>
                </div>
                <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg text-slate-300 font-mono">
                  {activeJobs.length} monitorados | {historyJobs.length} históricos
                </span>
              </div>

              {activeJobs.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                  <Database className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-bold">Nenhum trade em monitoramento no momento</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Execute uma ordem pelo Terminal ou Bot para observar o registro persistente e automático no SQLite.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-300 border-b border-slate-800">
                        <th className="p-3 font-semibold">Trade ID</th>
                        <th className="p-3 font-semibold">Par</th>
                        <th className="p-3 font-semibold">Direção</th>
                        <th className="p-3 font-semibold">Entrada</th>
                        <th className="p-3 font-semibold">Stop Loss</th>
                        <th className="p-3 font-semibold">Take Profit</th>
                        <th className="p-3 font-semibold">Stake USD</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold">Criado em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-mono text-cyan-300">{job.id.substring(0, 16)}...</td>
                          <td className="p-3 font-bold text-white">{job.par}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              job.direction === 'LONG' || job.direction === 'COMPRAR'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {job.direction}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-200">${Number(job.entry_price).toFixed(2)}</td>
                          <td className="p-3 font-mono text-rose-400">${Number(job.stop_loss).toFixed(2)}</td>
                          <td className="p-3 font-mono text-emerald-400">${Number(job.take_profit).toFixed(2)}</td>
                          <td className="p-3 font-mono text-slate-200">${Number(job.position_value_usd || 15.0).toFixed(2)}</td>
                          <td className="p-3">
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                              {job.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {job.created_at ? new Date(job.created_at).toLocaleTimeString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* History Reconciled Table */}
              {historyJobs.length > 0 && (
                <div className="space-y-2 mt-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Últimos Jobs Reconciliados &amp; Finalizados no SQLite
                  </h4>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-800 text-[11px]">
                          <th className="p-2.5 font-semibold">Trade ID</th>
                          <th className="p-2.5 font-semibold">Par</th>
                          <th className="p-2.5 font-semibold">Direção</th>
                          <th className="p-2.5 font-semibold">Preço Saída</th>
                          <th className="p-2.5 font-semibold">Resultado</th>
                          <th className="p-2.5 font-semibold">Motivo Saída</th>
                          <th className="p-2.5 font-semibold">PnL USD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {historyJobs.slice(0, 5).map((job) => (
                          <tr key={job.id} className="hover:bg-slate-900/30">
                            <td className="p-2.5 font-mono text-slate-400">{job.id.substring(0, 14)}...</td>
                            <td className="p-2.5 font-bold text-slate-200">{job.par}</td>
                            <td className="p-2.5 text-slate-400">{job.direction}</td>
                            <td className="p-2.5 font-mono text-slate-300">
                              {job.exit_price ? `$${Number(job.exit_price).toFixed(2)}` : '-'}
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                job.outcome === 'WIN' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                              }`}>
                                {job.outcome || 'RESOLVED'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-400 text-[11px] font-mono">{job.exit_reason || '-'}</td>
                            <td className={`p-2.5 font-mono font-bold ${
                              (job.realized_pnl_usd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {(job.realized_pnl_usd || 0) >= 0 ? `+$${Number(job.realized_pnl_usd).toFixed(2)}` : `-$${Math.abs(Number(job.realized_pnl_usd)).toFixed(2)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DEPLOYMENT & SYSTEMD CONFIGURATION */}
          {activeTab === 'deployment' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-purple-400" />
                  Instruções de Inicialização e Virtualenv
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  O diretório <code className="text-rose-400 font-mono">venv/</code> não é versionado. O servidor cria seu próprio ambiente isolado:
                </p>

                <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-lg relative font-mono text-xs text-emerald-300 space-y-1">
                  <button
                    onClick={() => copyToClipboard('python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt', 'venv_cmd')}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    {copiedKey === 'venv_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'venv_cmd' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                  <p className="text-slate-500"># 1. Criar e ativar o ambiente virtual Python</p>
                  <p>python3 -m venv venv</p>
                  <p>source venv/bin/activate</p>
                  <p className="text-slate-500 mt-2"># 2. Instalar dependências</p>
                  <p>pip install -r requirements.txt</p>
                </div>
              </div>

              {/* Systemd Units */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-cyan-300 font-mono">
                      /etc/systemd/system/tradeao-bot.service (Python Daemon)
                    </span>
                    <button
                      onClick={() => copyToClipboard(`[Unit]
Description=Trade AO Telegram Bot Daemon (24/7 Execution & Signal Engine)
After=network.target tradeao-engine.service
Wants=tradeao-engine.service

[Service]
Type=simple
User=tradeao
WorkingDirectory=/opt/tradeao
EnvironmentFile=-/opt/tradeao/.env
ExecStart=/opt/tradeao/venv/bin/python bot.py
Restart=always
RestartSec=5s
KillMode=process
TimeoutStopSec=20s
StandardOutput=append:/opt/tradeao/logs/tradeao_bot.log
StandardError=append:/opt/tradeao/logs/tradeao_bot.log

[Install]
WantedBy=multi-user.target`, 'bot_service')}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'bot_service' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copiar Unit</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
{`[Unit]
Description=Trade AO Telegram Bot Daemon (24/7 Execution & Signal Engine)
After=network.target tradeao-engine.service
Wants=tradeao-engine.service

[Service]
Type=simple
User=tradeao
WorkingDirectory=/opt/tradeao
EnvironmentFile=-/opt/tradeao/.env
ExecStart=/opt/tradeao/venv/bin/python bot.py
Restart=always
RestartSec=5s
KillMode=process
TimeoutStopSec=20s
StandardOutput=append:/opt/tradeao/logs/tradeao_bot.log
StandardError=append:/opt/tradeao/logs/tradeao_bot.log

[Install]
WantedBy=multi-user.target`}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-purple-300 font-mono">
                      /etc/systemd/system/tradeao-engine.service (Node &amp; SQLite)
                    </span>
                    <button
                      onClick={() => copyToClipboard(`[Unit]
Description=Trade AO Server & SQLite Persistence Engine (24/7 Trading Daemon)
After=network.target

[Service]
Type=simple
User=tradeao
WorkingDirectory=/opt/tradeao
Environment="NODE_ENV=production"
Environment="PORT=3000"
EnvironmentFile=-/opt/tradeao/.env
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
RestartSec=5s
KillMode=process
TimeoutStopSec=25s
StandardOutput=append:/opt/tradeao/logs/tradeao_server.log
StandardError=append:/opt/tradeao/logs/tradeao_server.log

[Install]
WantedBy=multi-user.target`, 'engine_service')}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'engine_service' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copiar Unit</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
{`[Unit]
Description=Trade AO Server & SQLite Persistence Engine (24/7 Trading Daemon)
After=network.target

[Service]
Type=simple
User=tradeao
WorkingDirectory=/opt/tradeao
Environment="NODE_ENV=production"
Environment="PORT=3000"
EnvironmentFile=-/opt/tradeao/.env
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
RestartSec=5s
KillMode=process
TimeoutStopSec=25s
StandardOutput=append:/opt/tradeao/logs/tradeao_server.log
StandardError=append:/opt/tradeao/logs/tradeao_server.log

[Install]
WantedBy=multi-user.target`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REAL-TIME DAEMON LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Filtro de Nível:</span>
                  <div className="flex gap-1">
                    {['ALL', 'INFO', 'WARN', 'ERROR', 'RECOVERY'].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setSelectedLogLevel(lvl)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                          selectedLogLevel === lvl
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <span className="text-xs text-slate-400 font-mono">
                  Arquivo: <span className="text-cyan-400">logs/tradeao_server.log</span>
                </span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs max-h-96 overflow-y-auto space-y-1.5">
                {logs.length === 0 ? (
                  <p className="text-slate-500 text-center py-6">Nenhum log registrado para o filtro selecionado.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed hover:bg-slate-900/50 p-1 rounded">
                      <span className="text-slate-500 shrink-0 text-[10px] mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                        log.level === 'INFO'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : log.level === 'WARN'
                          ? 'bg-amber-500/20 text-amber-300'
                          : log.level === 'ERROR' || log.level === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300'
                          : log.level === 'RECOVERY'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-slate-400 shrink-0 text-[10px]">[{log.category}]</span>
                      <span className="text-slate-200 break-all">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Watchdog Ativo</span>
            <span className="text-slate-600">|</span>
            <span>Auto-Restart: Habilitado</span>
            <span className="text-slate-600">|</span>
            <span>PID Lock: Protegido</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};

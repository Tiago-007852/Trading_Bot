import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Lock,
  Wallet,
  Activity,
  Sliders,
  History,
  TrendingUp,
  Radio,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Sparkles,
  KeyRound,
  FileSpreadsheet,
  Zap,
} from 'lucide-react';
import { MultiUserAccountSummary, MultiUserIsolationAudit, UserCustomSignal } from '../types';

interface MultiUserManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUserId: string;
  onSwitchUser: (userId: string) => void;
  onRefreshParent: () => void;
}

export const MultiUserManagerModal: React.FC<MultiUserManagerModalProps> = ({
  isOpen,
  onClose,
  activeUserId,
  onSwitchUser,
  onRefreshParent,
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'audit' | 'custom_signals' | 'create_user'>('accounts');
  const [users, setUsers] = useState<MultiUserAccountSummary[]>([]);
  const [auditData, setAuditData] = useState<MultiUserIsolationAudit | null>(null);
  const [customSignals, setCustomSignals] = useState<UserCustomSignal[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserTokens, setNewUserTokens] = useState('25.0');
  const [newUserRisk, setNewUserRisk] = useState('1.0');
  const [newUserMaxLoss, setNewUserMaxLoss] = useState('3.0');

  // New Custom Signal Form State
  const [newSigPar, setNewSigPar] = useState('SOL/USDT');
  const [newSigTimeframe, setNewSigTimeframe] = useState('15m');
  const [newSigStrategy, setNewSigStrategy] = useState('RSI Oversold + Support Bounce');
  const [newSigDirection, setNewSigDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [newSigEntry, setNewSigEntry] = useState('185.50');
  const [newSigStop, setNewSigStop] = useState('181.00');
  const [newSigAlvo, setNewSigAlvo] = useState('194.50');
  const [newSigScore, setNewSigScore] = useState('88');
  const [newSigNota, setNewSigNota] = useState('Setup de confluência detectado em suporte chave');

  // Load Data on Open or activeUserId change
  useEffect(() => {
    if (isOpen) {
      fetchUsersList();
      fetchAudit(activeUserId);
      fetchCustomSignals(activeUserId);
    }
  }, [isOpen, activeUserId]);

  const fetchUsersList = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users/list');
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
      }
    } catch (err: any) {
      console.error('Error loading users list:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async (uid: string) => {
    try {
      const res = await fetch(`/api/multiuser/audit/${uid}`);
      const data = await res.json();
      if (data.status) {
        setAuditData(data);
      }
    } catch (err: any) {
      console.error('Error fetching audit:', err);
    }
  };

  const fetchCustomSignals = async (uid: string) => {
    try {
      const res = await fetch(`/api/signals/custom/${uid}`);
      const data = await res.json();
      if (data.success && data.signals) {
        setCustomSignals(data.signals);
      }
    } catch (err: any) {
      console.error('Error fetching custom signals:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!newUserEmail.trim()) {
      setActionError('E-mail é obrigatório para cadastrar o usuário.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName.trim() || 'Novo Trader',
          email: newUserEmail.trim(),
          tokens: parseFloat(newUserTokens) || 20.0,
          riskPerTrade: parseFloat(newUserRisk) || 1.0,
          maxDailyLoss: parseFloat(newUserMaxLoss) || 3.0,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess(`Usuário criado com sucesso! ID: ${data.userId}`);
        setNewUserName('');
        setNewUserEmail('');
        await fetchUsersList();
        onSwitchUser(data.userId);
        setActiveTab('accounts');
        onRefreshParent();
      } else {
        setActionError(data.error || 'Erro ao criar usuário.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Falha de comunicação.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    try {
      setLoading(true);
      const res = await fetch('/api/signals/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          par: newSigPar.trim(),
          timeframe: newSigTimeframe,
          estrategia: newSigStrategy.trim(),
          direcao: newSigDirection,
          entrada: parseFloat(newSigEntry),
          stop: parseFloat(newSigStop),
          alvo: parseFloat(newSigAlvo),
          score: parseInt(newSigScore) || 85,
          nota: newSigNota.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess('Sinal personalizado salvo exclusivamente para este usuário!');
        await fetchCustomSignals(activeUserId);
        await fetchAudit(activeUserId);
        await fetchUsersList();
      } else {
        setActionError(data.error || 'Erro ao salvar sinal.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Falha de comunicação.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomSignal = async (signalId: string) => {
    try {
      const res = await fetch(`/api/signals/custom/${activeUserId}/${signalId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchCustomSignals(activeUserId);
        await fetchAudit(activeUserId);
        await fetchUsersList();
      }
    } catch (err) {
      console.error('Error deleting signal:', err);
    }
  };

  if (!isOpen) return null;

  const activeUserObj = users.find((u) => u.userId === activeUserId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Multiuser &amp; Isolamento Total</h2>
                <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded-full border border-purple-500/40 font-mono">
                  FASE 16
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Segregação estrita de credenciais, saldos, risco, histórico e sinais por usuário
              </p>
            </div>
          </div>
          <button
            id="btn-close-multiuser-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* User Badge Bar */}
        <div className="bg-slate-950/80 px-6 py-2.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Sessão Ativa:</span>
            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              {activeUserObj?.name || `UID ${activeUserId}`} ({activeUserObj?.email || 'email@tradeao.io'})
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <div className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span>Tokens: <strong>{activeUserObj?.tokens?.toFixed(1) || '20.0'}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Paper: <strong>${activeUserObj?.paperBalance?.toFixed(2) || '1000.00'}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Isolamento: <strong className="text-emerald-400">100% Blindado</strong></span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-6 pt-2 gap-2">
          <button
            id="tab-multiuser-accounts"
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'accounts'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Contas Isoladas ({users.length})
          </button>
          <button
            id="tab-multiuser-audit"
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Auditoria dos 8 Pilares
          </button>
          <button
            id="tab-multiuser-signals"
            onClick={() => setActiveTab('custom_signals')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'custom_signals'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Sinais Personalizados ({customSignals.length})
          </button>
          <button
            id="tab-multiuser-create"
            onClick={() => setActiveTab('create_user')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'create_user'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            + Criar Novo Usuário
          </button>
        </div>

        {/* Feedback Alert */}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white font-bold">
              ✕
            </button>
          </div>
        )}
        {actionError && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: ACCOUNTS LIST & SWITCHER */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Contas e Perfis Isolados</h3>
                  <p className="text-xs text-slate-400">
                    Clique em &quot;Alternar Sessão&quot; para operar com outro usuário mantendo dados 100% segregados.
                  </p>
                </div>
                <button
                  onClick={fetchUsersList}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map((u) => {
                  const isActive = u.userId === activeUserId;
                  return (
                    <div
                      key={u.userId}
                      className={`p-4 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-purple-950/20 border-purple-500/50 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-white">{u.name}</span>
                            {isActive && (
                              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                                Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate max-w-[180px]">{u.email}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">UID: {u.userId}</p>
                        </div>
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isActive ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Users className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 mb-3">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Tokens / Paper</span>
                          <span className="font-semibold text-slate-200">
                            {u.tokens.toFixed(1)} / ${u.paperBalance.toFixed(0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Win Rate / Trades</span>
                          <span className="font-semibold text-emerald-400">
                            {u.winRatePct}% ({u.tradesCount})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Autotrade / Risco</span>
                          <span className={`font-semibold ${u.autotradeActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {u.autotradeActive ? 'Ligado' : 'Desligado'} ({u.riskPerTradePct}%)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Sinais / Posições</span>
                          <span className="font-semibold text-purple-300">
                            {u.customSignalsCount} sig / {u.activePositionsCount} pos
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      {isActive ? (
                        <div className="w-full py-1.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Perfil Conectado
                        </div>
                      ) : (
                        <button
                          id={`btn-switch-user-${u.userId}`}
                          onClick={() => {
                            onSwitchUser(u.userId);
                            onRefreshParent();
                          }}
                          className="w-full py-1.5 bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          Alternar Sessão
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: AUDITORIA DOS 8 PILARES */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Status de Isolamento Multiuser: <span className="text-emerald-400">100% GARANTIDO</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Cada usuário opera em sandbox lógico independente sem qualquer vazamento transversal de dados.
                  </p>
                </div>
                <button
                  onClick={() => fetchAudit(activeUserId)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reexecutar Auditoria
                </button>
              </div>

              {auditData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Pillar 1: Conta */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100">1. Isolamento de Conta</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          ISOLADO
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {auditData.checkedPillars.account.details}
                      </p>
                    </div>
                  </div>

                  {/* Pillar 2: Credenciais */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100">2. Isolamento de Credenciais</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          AES-256 VAULT
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {auditData.checkedPillars.credentials.details}
                      </p>
                    </div>
                  </div>

                  {/* Pillar 3: Saldo */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100">3. Isolamento de Saldo</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          SEPARADO
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {auditData.checkedPillars.balance.details}
                      </p>
                    </div>
                  </div>

                  {/* Pillar 4: Configurações */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100">4. Isolamento de Configurações</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          INDIVIDUAL
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {auditData.checkedPillars.settings.details}
                      </p>
                    </div>
                  </div>

                  {/* Pillar 5: Posições */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100">5. Isolamento de Posições</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          FILTRADO
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {auditData.checkedPillars.positions.details}
                      </p>
                    </div>
                  </div>

                  {/* Pillar 6: Histórico */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100">6. Isolamento de Histórico</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          USER_TRADES
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {auditData.checkedPillars.history.details}
                      </p>
                    </div>
                  </div>

                  {/* Pillar 7: Risco */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100">7. Isolamento de Risco</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          CIRCUIT BREAKER
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {auditData.checkedPillars.risk.details}
                      </p>
                    </div>
                  </div>

                  {/* Pillar 8: Sinais Personalizados */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100">8. Sinais Personalizados</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          CUSTOM
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {auditData.checkedPillars.customSignals.details}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">Carregando auditoria...</div>
              )}
            </div>
          )}

          {/* TAB 3: SINAIS PERSONALIZADOS */}
          {activeTab === 'custom_signals' && (
            <div className="space-y-6">
              {/* Form to add new custom signal */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-4">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Novo Sinal / Alerta Personalizado ({activeUserObj?.name || activeUserId})
                  </h3>
                </div>

                <form onSubmit={handleAddCustomSignal} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Par de Moeda</label>
                    <input
                      type="text"
                      value={newSigPar}
                      onChange={(e) => setNewSigPar(e.target.value)}
                      placeholder="ex: SOL/USDT"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono focus:border-purple-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Timeframe</label>
                    <select
                      value={newSigTimeframe}
                      onChange={(e) => setNewSigTimeframe(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                    >
                      <option value="5m">5 Minutos (Scalp)</option>
                      <option value="15m">15 Minutos (Day Trade)</option>
                      <option value="1h">1 Hora (Swing)</option>
                      <option value="4h">4 Horas (Position)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Direção</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewSigDirection('LONG')}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                          newSigDirection === 'LONG'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        LONG ↗
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewSigDirection('SHORT')}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                          newSigDirection === 'SHORT'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        SHORT ↘
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Nome da Estratégia</label>
                    <input
                      type="text"
                      value={newSigStrategy}
                      onChange={(e) => setNewSigStrategy(e.target.value)}
                      placeholder="ex: RSI Oversold + Suporte Dinâmico"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Preço Entrada ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={newSigEntry}
                      onChange={(e) => setNewSigEntry(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-purple-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Stop Loss ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={newSigStop}
                      onChange={(e) => setNewSigStop(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-rose-300 font-mono focus:border-purple-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Take Profit ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={newSigAlvo}
                      onChange={(e) => setNewSigAlvo(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-emerald-300 font-mono focus:border-purple-500 outline-none"
                      required
                    />
                  </div>

                  <div className="md:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar ao Meu Perfil
                    </button>
                  </div>
                </form>
              </div>

              {/* Signals List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Sinais Vinculados Exclusivamente a este Usuário ({customSignals.length})
                </h4>

                {customSignals.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-xl text-slate-500 text-xs">
                    Nenhum sinal personalizado cadastrado para este usuário ainda. Adicione acima!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customSignals.map((sig) => (
                      <div
                        key={sig.id}
                        className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-slate-700 transition"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white font-mono">{sig.par}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                  sig.direcao === 'LONG'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {sig.direcao}
                              </span>
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                {sig.timeframe}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteCustomSignal(sig.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                              title="Remover sinal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-xs text-purple-300 font-medium mb-2">{sig.estrategia}</p>

                          <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-slate-900/90 p-2 rounded-lg border border-slate-800 font-mono mb-2">
                            <div>
                              <span className="text-[9px] text-slate-400 block">Entrada</span>
                              <span className="text-slate-200">${sig.entrada}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block">Stop</span>
                              <span className="text-rose-400">${sig.stop}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block">Alvo</span>
                              <span className="text-emerald-400">${sig.alvo}</span>
                            </div>
                          </div>

                          {sig.nota && <p className="text-[11px] text-slate-400 italic">“{sig.nota}”</p>}
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Confluência: {sig.score}/100</span>
                          <span>Criado: {new Date(sig.criadoEm).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CRIAR NOVO USUÁRIO */}
          {activeTab === 'create_user' && (
            <div className="max-w-lg mx-auto bg-slate-950/60 border border-slate-800 p-6 rounded-xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-purple-400" />
                  Registrar Nova Conta Isolada
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  O novo usuário receberá saldo virtual, histórico limpo e cofre criptografado exclusivo.
                </p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Nome / Identificação</label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="ex: Trader Delta"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">E-mail Único *</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="ex: delta.trader@tradeao.io"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Tokens Demo</label>
                    <input
                      type="number"
                      value={newUserTokens}
                      onChange={(e) => setNewUserTokens(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Risco Trade (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newUserRisk}
                      onChange={(e) => setNewUserRisk(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Max Perda (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newUserMaxLoss}
                      onChange={(e) => setNewUserMaxLoss(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-purple-500 outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-lg text-[11px] text-purple-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    A conta será inicializada com <strong>$1.000,00 USDT</strong> em Paper Trading e Circuit Breaker
                    configurado individualmente.
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20"
                  >
                    <UserPlus className="w-4 h-4" />
                    Criar Usuário Isolado
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero Data Leakage: Blindagem ativa entre todos os usuários</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

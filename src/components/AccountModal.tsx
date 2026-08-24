import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  X,
  Key,
  Mail,
  UserPlus,
  ShieldCheck,
  Copy,
  Check,
  Link2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  ShieldAlert,
  Trash2,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onClaimInvite: () => Promise<void>;
  onUpdateEmail: (newEmail: string) => Promise<void>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  user,
  onClaimInvite,
  onUpdateEmail,
}) => {
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState(user?.email || '');
  const [savedMsg, setSavedMsg] = useState(false);

  // Binance API Config state
  const [binanceKey, setBinanceKey] = useState('');
  const [binanceSecret, setBinanceSecret] = useState('');
  const [isTestnet, setIsTestnet] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Status & Validation
  const [validating, setValidating] = useState(false);
  const [savingVault, setSavingVault] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<{
    connected: boolean;
    preview?: string;
    testnet?: boolean;
    savedAt?: string;
    permissionsAudit?: any;
    balances?: Record<string, number>;
  } | null>(null);

  const [validationResult, setValidationResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    securityRejection?: boolean;
    audit?: any;
    balances?: Record<string, number>;
  } | null>(null);

  // Load vault status on open
  useEffect(() => {
    if (isOpen && user?.chat_id) {
      loadVaultStatus();
    }
  }, [isOpen, user?.chat_id]);

  const loadVaultStatus = async () => {
    if (!user?.chat_id) return;
    try {
      const res = await fetch(`/api/binance/status?chatId=${user.chat_id}`);
      const data = await res.json();
      if (data.connected) {
        setVaultStatus(data);
        // Also fetch balance
        const balRes = await fetch(`/api/binance/balance?chatId=${user.chat_id}`);
        const balData = await balRes.json();
        setVaultStatus((prev) => (prev ? { ...prev, balances: balData.balances } : null));
      } else {
        setVaultStatus(null);
      }
    } catch (e) {
      console.error('Error fetching vault status:', e);
    }
  };

  if (!isOpen || !user) return null;

  const inviteLink = `https://t.me/TradeAO_Bot?start=ref${user.chat_id || '7886049873'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    await onUpdateEmail(emailInput.trim());
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  // Validate API key permissions before saving
  const handleValidatePermissions = async () => {
    if (!binanceKey.trim() || !binanceSecret.trim()) {
      setValidationResult({
        tested: true,
        success: false,
        message: 'Por favor, preencha a API Key e Secret antes de validar.',
      });
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const res = await fetch('/api/binance/validate-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: binanceKey.trim(),
          apiSecret: binanceSecret.trim(),
          testnet: isTestnet,
        }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        // Fetch balance with tested keys
        const balRes = await fetch(
          `/api/binance/balance?testnet=${isTestnet}&apiKey=${encodeURIComponent(binanceKey.trim())}&apiSecret=${encodeURIComponent(binanceSecret.trim())}`
        );
        const balData = await balRes.json();

        setValidationResult({
          tested: true,
          success: true,
          message: 'Permissões validadas com sucesso! Chave segura para Spot Trading.',
          audit: data,
          balances: balData.balances,
        });
      } else {
        setValidationResult({
          tested: true,
          success: false,
          securityRejection: data.securityRejection,
          message: data.error || 'Falha ao validar permissões na Binance.',
          audit: data.restrictions,
        });
      }
    } catch (err: any) {
      setValidationResult({
        tested: true,
        success: false,
        message: err.message || 'Erro de conexão ao validar permissões.',
      });
    } finally {
      setValidating(false);
    }
  };

  // Save and encrypt in secure vault
  const handleSaveToVault = async () => {
    if (!binanceKey.trim() || !binanceSecret.trim()) return;
    setSavingVault(true);
    try {
      const res = await fetch('/api/binance/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: user.chat_id,
          apiKey: binanceKey.trim(),
          apiSecret: binanceSecret.trim(),
          testnet: isTestnet,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setBinanceKey('');
        setBinanceSecret('');
        setValidationResult(null);
        await loadVaultStatus();
      } else {
        setValidationResult({
          tested: true,
          success: false,
          securityRejection: data.securityRejection,
          message: data.error || 'Erro ao salvar no cofre seguro.',
        });
      }
    } catch (err: any) {
      setValidationResult({
        tested: true,
        success: false,
        message: err.message || 'Erro ao persistir credenciais.',
      });
    } finally {
      setSavingVault(false);
    }
  };

  // Disconnect and wipe credentials
  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar e revogar suas credenciais Binance do Trade AO?')) return;
    setDisconnecting(true);
    try {
      await fetch('/api/binance/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: user.chat_id }),
      });
      setVaultStatus(null);
      setValidationResult(null);
    } catch (err) {
      console.error('Error disconnecting:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div id="account-modal-backdrop" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="account-modal-container" className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <button
          id="btn-close-account-modal"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Minha Conta & Segurança
          </h2>
          <p className="text-xs text-slate-400">Credenciais, cofre criptografado e conexão Binance Oficial</p>
        </div>

        {/* Security Statement Banner */}
        <div id="security-rules-banner" className="bg-slate-950/80 border border-emerald-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
            <Lock className="w-4 h-4" />
            <span>GARANTIAS DE SEGURANÇA ESTATUTÁRIA</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>NUNCA pedimos senha da Binance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>NUNCA pedimos 2FA ou Seed Phrase</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Criptografia AES-256 em repouso</span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Saques bloqueados e proibidos</span>
            </div>
          </div>
        </div>

        {/* Credentials box */}
        <form onSubmit={handleSaveEmail} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
          <div>
            <label className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5" /> E-mail de Registro:
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Salvar
              </button>
            </div>
            {savedMsg && <span className="text-[10px] text-emerald-400 mt-1 block">E-mail atualizado!</span>}
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> Senha Gerada:
            </span>
            <code className="bg-slate-900 px-2 py-0.5 rounded text-emerald-400 font-mono">
              {user.senha || 'GTcbM6m45SQT'}
            </code>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">ID do Chat Telegram:</span>
            <span className="font-mono text-slate-300">{user.chat_id || '7886049873'}</span>
          </div>
        </form>

        {/* Binance Official Authorization & Secure Vault */}
        <div id="binance-auth-section" className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-amber-400" />
              🟡 Conexão Oficial Binance (API REST v3)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsTestnet(!isTestnet)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  isTestnet
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {isTestnet ? 'Testnet Spot' : 'Produção Real'}
              </button>
            </div>
          </div>

          {/* Active Vault Connection Status */}
          {vaultStatus?.connected ? (
            <div id="vault-active-card" className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-300">Conectado com Sucesso</span>
                </div>
                <span className="text-[10px] font-mono bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200">
                  {vaultStatus.testnet ? 'Testnet' : 'Produção'}
                </span>
              </div>

              <div className="text-[11px] text-slate-300 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Chave Criptografada:</span>
                  <span className="text-emerald-400">{vaultStatus.preview || 'ab12...89ef'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Armazenamento:</span>
                  <span className="text-slate-200">Cofre Isolado (AES-256-GCM)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Permissão Saques:</span>
                  <span className="text-emerald-400 font-bold">🚫 DESATIVADA (SEGURO)</span>
                </div>
              </div>

              {vaultStatus.balances && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-sans">Saldo Spot:</span>
                  <span className="text-amber-400 font-bold">
                    USDT ${vaultStatus.balances.USDT || 0} · BTC {vaultStatus.balances.BTC || 0}
                  </span>
                </div>
              )}

              <button
                id="btn-disconnect-binance"
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full mt-2 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/40 text-rose-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{disconnecting ? 'Revogando...' : 'Desconectar / Revogar Chave do Cofre'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Collapsible How-To Guide */}
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="w-full text-left p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-xs text-slate-300 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 font-medium text-amber-300">
                  <Info className="w-3.5 h-3.5" />
                  Como gerar sua chave oficial na Binance (Passo a Passo)
                </span>
                {showGuide ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showGuide && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 text-[11px] text-slate-300">
                  <p className="font-semibold text-slate-200">Siga as instruções oficiais:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                    <li>Acesse sua conta na Binance e abra o menu de perfil &gt; <strong className="text-slate-200">Gerenciamento de API</strong>.</li>
                    <li>Clique em <strong className="text-slate-200">Criar API</strong> (Gerada pelo Sistema).</li>
                    <li>Dê o nome de <strong className="text-slate-200">Trade AO</strong>.</li>
                    <li>Nas permissões, marque <span className="text-emerald-400 font-semibold">Enable Reading</span> e <span className="text-emerald-400 font-semibold">Enable Spot & Margin Trading</span>.</li>
                    <li><strong className="text-rose-400">NUNCA MARQUE "Enable Withdrawals"</strong>. O Trade AO rejeita chaves com saque.</li>
                  </ol>
                  <a
                    href="https://www.binance.com/en/my/settings/api-management"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:underline pt-1"
                  >
                    <span>Abrir Gerenciador de API Binance</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Form to validate & save credentials */}
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Binance API Key:
                  </label>
                  <input
                    id="input-binance-key"
                    type="text"
                    placeholder="Insira sua API Key oficial..."
                    value={binanceKey}
                    onChange={(e) => setBinanceKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Binance Secret Key:
                  </label>
                  <input
                    id="input-binance-secret"
                    type="password"
                    placeholder="Insira sua Secret Key..."
                    value={binanceSecret}
                    onChange={(e) => setBinanceSecret(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none font-mono"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    id="btn-validate-permissions"
                    type="button"
                    onClick={handleValidatePermissions}
                    disabled={validating || !binanceKey || !binanceSecret}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {validating ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{validating ? 'Auditando Permissões...' : '1. Validar Permissões'}</span>
                  </button>

                  <button
                    id="btn-save-vault"
                    type="button"
                    onClick={handleSaveToVault}
                    disabled={savingVault || !binanceKey || !binanceSecret}
                    className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {savingVault ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>{savingVault ? 'Criptografando...' : '2. Salvar no Cofre'}</span>
                  </button>
                </div>
              </div>

              {/* Validation Result Box */}
              {validationResult && (
                <div
                  id="validation-result-box"
                  className={`p-3 rounded-xl border text-xs space-y-2 ${
                    validationResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : validationResult.securityRejection
                      ? 'bg-rose-950/70 border-rose-500/60 text-rose-200'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-start gap-2 font-semibold">
                    {validationResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span>{validationResult.message}</span>
                  </div>

                  {validationResult.success && (
                    <div className="space-y-1 pt-1.5 border-t border-emerald-500/20 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Permissão de Leitura:</span>
                        <span className="text-emerald-400 font-bold">✅ Habilitada</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Trading Spot & Margin:</span>
                        <span className="text-emerald-400 font-bold">✅ Habilitada</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Permissão de Saques:</span>
                        <span className="text-emerald-400 font-bold">🚫 DESATIVADA (Seguro)</span>
                      </div>
                      {validationResult.balances && (
                        <div className="flex justify-between pt-1 font-mono text-[10px] text-slate-300">
                          <span>Saldos Spot:</span>
                          <span>USDT ${validationResult.balances.USDT || 0} · BTC {validationResult.balances.BTC || 0}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 block">Total Trades</span>
            <span className="text-sm font-bold text-slate-200">{user.trades}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 block">Vitórias</span>
            <span className="text-sm font-bold text-emerald-400">{user.vitorias}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 block">Tokens Saldo</span>
            <span className="text-sm font-bold text-amber-400">{user.tokens.toFixed(2)} 💎</span>
          </div>
        </div>

        {/* Invite link section */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-sky-400" />
              Convide Amigos (+5 Tokens)
            </span>
            <button
              onClick={onClaimInvite}
              className="text-[11px] bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Simular Convite
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Ganhe 5 tokens virtuais para cada amigo que se cadastrar pelo seu link.
          </p>
          <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="bg-transparent text-[11px] text-slate-300 flex-1 font-mono outline-none"
            />
            <button
              onClick={handleCopy}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

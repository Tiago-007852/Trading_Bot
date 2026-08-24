import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, X, AlertTriangle, CheckSquare, Square } from 'lucide-react';

interface RiskConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  riskPerTrade?: number;
  maxDailyLoss?: number;
}

export const RiskConfirmationModal: React.FC<RiskConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  riskPerTrade = 1.0,
  maxDailyLoss = 3.0,
}) => {
  const [understoodRisks, setUnderstoodRisks] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleActivate = async () => {
    if (!understoodRisks) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-slate-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              🛡️ CONFIRMAÇÃO DE AUTOTRADING
            </h3>
            <p className="text-xs text-slate-400">Autorização prévia obrigatória</p>
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-4 space-y-3.5 text-xs text-slate-300 leading-relaxed">
          <p className="font-medium text-slate-200">
            Você está autorizando o Trade AO a enviar ordens para sua conta Binance.
          </p>

          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2.5 flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>O sistema <strong>não terá permissão</strong> para sacar fundos.</span>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-1.5 font-sans">
            <div className="flex justify-between items-center text-slate-300">
              <span>Risco por operação:</span>
              <span className="font-bold text-amber-400">{riskPerTrade}%</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>Perda diária máxima:</span>
              <span className="font-bold text-rose-400">{maxDailyLoss}%</span>
            </div>
          </div>
        </div>

        {/* Checkbox Acknowledgment */}
        <div
          onClick={() => setUnderstoodRisks(!understoodRisks)}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center gap-3 select-none ${
            understoodRisks
              ? 'bg-sky-950/40 border-sky-500 text-sky-200 shadow-sm'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="shrink-0 text-sky-400">
            {understoodRisks ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5 text-slate-500" />
            )}
          </div>
          <span className="text-xs font-semibold text-slate-200">
            [ ☑️ ENTENDI OS RISCOS ]
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!understoodRisks || loading}
            onClick={handleActivate}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 ${
              understoodRisks && !loading
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-600/20 active:scale-98'
                : 'bg-slate-800/80 text-slate-500 border border-slate-800 cursor-not-allowed'
            }`}
          >
            {loading ? 'Ativando...' : '[ 🟢 ATIVAR AUTOTRADING ]'}
          </button>
        </div>
      </div>
    </div>
  );
};

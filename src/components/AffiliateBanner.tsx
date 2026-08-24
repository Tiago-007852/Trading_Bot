import React from 'react';
import { ShieldCheck, ExternalLink, AlertTriangle, X, CheckCircle2, Gift } from 'lucide-react';
import { UserProfile } from '../types';

interface AffiliateBannerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onClaimBonus: () => void;
}

export const AffiliateBanner: React.FC<AffiliateBannerProps> = ({
  isOpen,
  onClose,
  user,
  onClaimBonus,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Depositar — Modo Real</h2>
            <p className="text-xs text-slate-400">Corretoras parceiras credenciadas</p>
          </div>
        </div>

        {/* Bonus reward alert */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Gift className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-emerald-300 block">Bônus Educacional</span>
              <span className="text-[11px] text-slate-300">
                Ganhe +5 tokens virtuais ao conferir os parceiros oficiais.
              </span>
            </div>
          </div>
          {!user?.clicou_depositar ? (
            <button
              onClick={onClaimBonus}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md transition-colors"
            >
              Resgatar +5
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Resgatado
            </span>
          )}
        </div>

        {/* Informational Text matching Phase 3 */}
        <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
          <p className="font-semibold text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            ⚠️ IMPORTANTE
          </p>
          <p>
            A criação da conta e qualquer depósito devem ser realizados exclusivamente através dos links oficiais apresentados abaixo.
          </p>
          <p>
            O Trade AO <strong>não recebe depósitos</strong> e nenhum dinheiro real passa por aqui.
          </p>
          <p className="text-rose-300 font-medium">
            🔒 Nunca envie sua senha ou código 2FA para o bot.
          </p>
        </div>

        {/* Partner Buttons */}
        <div className="space-y-2.5">
          <a
            href="https://www.binance.com/register?ref=1058024469"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 font-bold flex items-center justify-center text-sm border border-amber-400/20">
                🟡
              </div>
              <div>
                <span className="text-xs font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                  CRIAR CONTA NA BINANCE
                </span>
                <p className="text-[10px] text-slate-400">Maior liquidez e volume global de criptomoedas</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-amber-400" />
          </a>

          <a
            href="https://www.bybit.com/invite?ref=SEU_CODIGO_BYBIT"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-400/10 text-sky-400 font-bold flex items-center justify-center text-sm border border-sky-400/20">
                🔵
              </div>
              <div>
                <span className="text-xs font-bold text-slate-100 group-hover:text-sky-400 transition-colors">
                  CRIAR CONTA NA BYBIT
                </span>
                <p className="text-[10px] text-slate-400">Plataforma parceira para operações e derivativos</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-sky-400" />
          </a>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Divulgação de Risco:</strong> Operações no mercado de criptoativos envolvem alto risco de perda do capital investido. Resultados passados não garantem lucros futuros.
          </span>
        </div>
      </div>
    </div>
  );
};

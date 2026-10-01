import React from 'react';
import {
  X,
  ShieldAlert,
  MessageCircle,
  Key,
  Users,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/qr/FVT7IK7T3SAGC1';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenOwnerPanel: () => void;
  onOpenBuyRoom?: () => void;
}

export const RestrictedRoomNoticeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenOwnerPanel,
  onOpenBuyRoom,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="restricted-room-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="restricted-room-modal-content"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl border border-amber-500/40 bg-slate-900/95 p-4 sm:p-8 text-slate-100 shadow-2xl shadow-amber-950/30 overflow-y-auto max-h-[92dvh]"
      >
        {/* Top Accent Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />

        {/* Close Button */}
        <button
          id="close-restricted-modal-btn"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 sm:right-5 sm:top-5 h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0 z-10"
          title="Fechar aviso"
          aria-label="Fechar aviso"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Badge & Title */}
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-4 shadow-inner">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mb-2">
            Acesso Restrito & Controle Exclusivo
          </span>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Criação de Salas pelo Desenvolvedor
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-1">
            Salas privadas e temporizadas não podem ser criadas por usuários comuns.
          </p>
        </div>

        {/* Policy Explanations Card */}
        <div className="space-y-3 rounded-2xl bg-slate-950/70 border border-slate-800 p-4 sm:p-5 text-xs text-slate-300">
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="text-white">Segurança & Autonomia Total:</strong>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Apenas o desenvolvedor / administrador deste sistema possui autorização para criar novas salas e liberar sessões de bate-papo com contagem de tempo.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Users className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="text-white">Capacidade & Duração Personalizada:</strong>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                As salas suportam até <strong>10 pessoas</strong> simultâneas. O desenvolvedor ativa a sala com o tempo contratado (ex: 30min, 1h, 2h, 4h, 24h) e fornece o link de acesso direto.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="text-white">100% Anônimo e Autodestrutivo:</strong>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Ao término do tempo contratado, a sala é finalizada imediatamente e todo o histórico é destruído.
              </p>
            </div>
          </div>
        </div>

        {/* Buy with Pix or WhatsApp CTA */}
        <div className="mt-5 space-y-2.5">
          <p className="text-center text-xs font-semibold text-slate-300">
            Adquira uma sala exclusiva para você ou seu grupo:
          </p>

          {onOpenBuyRoom && (
            <button
              id="restricted-modal-buy-pix-btn"
              type="button"
              onClick={() => {
                onClose();
                onOpenBuyRoom();
              }}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm transition-all shadow-xl shadow-emerald-950/60 ring-1 ring-emerald-400/40 cursor-pointer active:scale-98"
            >
              <ShoppingBag className="h-5 w-5" />
              <span>Comprar Sala Privada via Pix (a partir de R$ 0,90)</span>
            </button>
          )}

          <a
            id="restricted-modal-whatsapp-btn"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all"
          >
            <MessageCircle className="h-4 w-4 text-emerald-400" />
            <span>Falar com o Suporte no WhatsApp</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70 ml-1" />
          </a>
        </div>

        {/* Developer / Owner Exclusive Access Notice */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Key className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Você é o desenvolvedor/dono do sistema?</span>
          </div>

          <button
            id="restricted-modal-open-owner-panel-btn"
            type="button"
            onClick={() => {
              onClose();
              onOpenOwnerPanel();
            }}
            className="text-xs font-bold text-amber-300 hover:text-amber-200 underline decoration-amber-500/50 underline-offset-4 cursor-pointer transition-colors"
          >
            Acessar Painel do Dono
          </button>
        </div>
      </div>
    </div>
  );
};

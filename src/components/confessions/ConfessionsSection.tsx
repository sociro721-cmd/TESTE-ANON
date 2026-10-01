import React from 'react';
import { Lock, Sparkles, Plus, ArrowRight, Eye } from 'lucide-react';
import { AnonQrMascot } from '../AnonQrMascot';

interface ConfessionsSectionProps {
  onOpenCreateModal: () => void;
  onOpenDetailModal?: (id: string) => void;
  onViewAll: () => void;
}

export const ConfessionsSection: React.FC<ConfessionsSectionProps> = ({
  onOpenCreateModal,
  onViewAll,
}) => {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 my-4 sm:my-8">
      {/* Seção-Convite do Mural das Confissões */}
      <div
        onClick={onViewAll}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onViewAll();
          }
        }}
        className="group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950 p-5 sm:p-8 shadow-xl shadow-emerald-950/20 hover:border-emerald-500/60 hover:shadow-2xl hover:shadow-emerald-950/40 transition-all duration-300 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 active:scale-[0.99]"
      >
        {/* Glows Decorativos de Fundo */}
        <div className="absolute -top-20 -right-20 h-48 w-48 sm:h-64 sm:w-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/15 transition-all pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-48 w-48 sm:h-64 sm:w-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto space-y-3 sm:space-y-4">
          {/* Ícone, Mascote e Badge */}
          <div className="flex items-center gap-2">
            <AnonQrMascot variant="confession" size="sm" className="w-8 h-8" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-sm">
              <span>🕯️</span>
              <span>MURAL DAS CONFISSÕES</span>
            </div>
          </div>

          {/* Título Principal Reflexivo */}
          <h2 className="text-lg sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug sm:leading-tight">
            “O que você nunca confessaria usando seu nome?”
          </h2>

          {/* Frase Secundária de Curiosidade */}
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Talvez alguém esteja sentindo exatamente o mesmo.
          </p>

          {/* Botões de Ação */}
          <div className="pt-2 sm:pt-3 flex flex-wrap items-center justify-center gap-3 w-full">
            {/* Botão Principal de Convite */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewAll();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-950/60 transition-all cursor-pointer ring-2 ring-emerald-400/30 group-hover:scale-105 active:scale-95"
            >
              <Eye className="h-4 w-4" />
              <span>🔓 Ver as confissões</span>
            </button>

            {/* Botão de Apoio: Fazer Confissão */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateModal();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4 text-emerald-400" />
              <span>Fazer uma confissão</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

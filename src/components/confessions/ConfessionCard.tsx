import React from 'react';
import { Confession } from '../../types/confessions';
import { MessageSquare } from 'lucide-react';

interface ConfessionCardProps {
  confession: Confession;
  onClick: () => void;
}

export const ConfessionCard: React.FC<ConfessionCardProps> = ({ confession, onClick }) => {
  // Somatório total de reações
  const topReactionEntry = Object.entries(confession.reactions || {}).sort((a: [string, any], b: [string, any]) => Number(b[1]) - Number(a[1]))[0];
  const topReactionText = topReactionEntry ? `${topReactionEntry[0]} (${topReactionEntry[1]})` : '🫂 1 "eu também"';

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 p-3.5 sm:p-5 shadow-lg hover:border-emerald-500/40 hover:shadow-emerald-950/20 transition-all duration-200 cursor-pointer w-[78vw] max-w-[290px] sm:w-[340px] sm:max-w-[380px] shrink-0 select-none overflow-hidden"
    >
      {/* Background Glow sutil */}
      <div className="absolute -top-10 -right-10 h-20 w-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />

      {/* Top Meta: Categoria & Ícone */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs shrink-0">
            🕯️
          </span>
          {confession.category && (
            <span className="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700/60 text-[10px] sm:text-[11px] font-semibold text-emerald-300 truncate max-w-[120px]">
              {confession.category}
            </span>
          )}
        </div>
        <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono shrink-0">
          {new Date(confession.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        </span>
      </div>

      {/* Content */}
      <div className="my-1.5 flex-1">
        <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed italic line-clamp-3">
          “{confession.content}”
        </p>
      </div>

      {/* Author & Footer stats */}
      <div className="pt-2 mt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] sm:text-xs text-slate-400">
        <span className="font-mono text-[10px] text-emerald-400 font-bold truncate max-w-[100px]">
          — {confession.authorNick || 'Anônimo'}
        </span>

        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-medium shrink-0">
          <div className="flex items-center gap-1 text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
            <span>{topReactionText}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <MessageSquare className="h-3 w-3 text-slate-400" />
            <span>{confession.repliesCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

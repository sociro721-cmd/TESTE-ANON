import React from 'react';
import { Compass, Sparkles, Clock, Heart, Target } from 'lucide-react';
import { UserPresentation } from '../constants/presentation';

interface Props {
  presentation?: Partial<UserPresentation> | null;
  className?: string;
  emptyFallback?: React.ReactNode;
}

export const UserPresentationView: React.FC<Props> = ({
  presentation,
  className = '',
  emptyFallback = null,
}) => {
  if (!presentation) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  const lookingFor = Array.isArray(presentation.profileLookingFor)
    ? presentation.profileLookingFor.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

  const interests = Array.isArray(presentation.profileInterests)
    ? presentation.profileInterests.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

  const availability = presentation.profileAvailability && typeof presentation.profileAvailability === 'string' && presentation.profileAvailability.trim()
    ? presentation.profileAvailability.trim()
    : null;

  const desires = Array.isArray(presentation.profileDesires)
    ? presentation.profileDesires.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

  const hasAnyContent = lookingFor.length > 0 || interests.length > 0 || !!availability || desires.length > 0;

  if (!hasAnyContent) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  return (
    <div className={`space-y-3.5 text-left ${className}`}>
      <div className="flex items-center gap-1.5 pb-1 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        <Compass className="h-3.5 w-3.5 text-emerald-400" />
        <span>Sobre mim / O que procuro</span>
      </div>

      {/* 1. À procura de */}
      {lookingFor.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Target className="h-3.5 w-3.5 text-teal-400 shrink-0" />
            <span>À procura de</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lookingFor.map((item, idx) => (
              <span
                key={`lf-${idx}-${item}`}
                className="inline-flex items-center px-2.5 py-1 rounded-xl bg-teal-950/40 border border-teal-500/30 text-teal-200 text-xs font-medium shadow-sm transition-all"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 2. Interesses */}
      {interests.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Interesses</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((item, idx) => (
              <span
                key={`int-${idx}-${item}`}
                className="inline-flex items-center px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs font-medium shadow-sm transition-all"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Estou disponível para (seleção única) */}
      {availability && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Estou disponível para</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center px-3 py-1 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs font-medium shadow-sm">
              {availability}
            </span>
          </div>
        </div>
      )}

      {/* 4. Desejos */}
      {desires.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Heart className="h-3.5 w-3.5 text-rose-400 shrink-0" />
            <span>Desejos</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {desires.map((item, idx) => (
              <span
                key={`des-${idx}-${item}`}
                className="inline-flex items-center px-2.5 py-1 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs font-medium shadow-sm transition-all"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

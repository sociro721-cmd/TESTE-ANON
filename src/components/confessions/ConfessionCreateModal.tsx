import React, { useState } from 'react';
import { X, Sparkles, ShieldCheck, Loader2 } from 'lucide-react';
import { ConfessionCategory, CONFESSION_CATEGORIES } from '../../types/confessions';

interface ConfessionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ConfessionCreateModal: React.FC<ConfessionCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ConfessionCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = content.trim();
    if (!clean) {
      setErrorMsg('Escreva sua confissão antes de publicar.');
      return;
    }
    if (clean.length > 1000) {
      setErrorMsg('A confissão excede o limite de 1000 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Gera ID de autor temporário anônimo em localStorage se não existir
      let anonId = localStorage.getItem('anonqr_confession_author_id');
      if (!anonId) {
        anonId = 'anon_' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('anonqr_confession_author_id', anonId);
      }
      let anonNick = localStorage.getItem('anonqr_confession_author_nick');
      if (!anonNick) {
        anonNick = `Anônimo #${Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem('anonqr_confession_author_nick', anonNick);
      }

      const res = await fetch('/api/confessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: clean,
          category: selectedCategory,
          authorId: anonId,
          authorNick: anonNick,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao publicar confissão.');
      }

      setContent('');
      setSelectedCategory(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao publicar confissão. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl p-6 sm:p-7 my-auto shrink-0 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-lg shadow-inner">
              🕯️
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Faça uma confissão</h3>
              <p className="text-xs text-slate-400">“Diga algo que você nunca diria usando seu nome.”</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              placeholder="Escreva sua confissão anônima aqui..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
            />
            <div className="flex justify-end mt-1 text-[11px] text-slate-500 font-mono">
              <span>{content.length}/1000</span>
            </div>
          </div>

          {/* Categories Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Categoria (Opcional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CONFESSION_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/40'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Notice & Submit */}
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Sua identidade real NUNCA será revelada.</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Publicando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Publicar anonimamente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

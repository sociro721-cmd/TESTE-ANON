import React, { useState } from 'react';
import { X, MessageSquare, Send, ShieldCheck, Loader2 } from 'lucide-react';
import { Confession, CONFESSION_REACTION_TYPES } from '../../types/confessions';

interface ConfessionDetailModalProps {
  confessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const ConfessionDetailModal: React.FC<ConfessionDetailModalProps> = ({
  confessionId,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [confession, setConfession] = useState<Confession | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [replyContent, setReplyContent] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const fetchConfessionDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/confessions/${confessionId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao carregar confissão.');
      }
      setConfession(data.confession);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar detalhes.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && confessionId) {
      fetchConfessionDetails();
    }
  }, [isOpen, confessionId]);

  if (!isOpen) return null;

  const getAuthorId = () => {
    let anonId = localStorage.getItem('anonqr_confession_author_id');
    if (!anonId) {
      anonId = 'anon_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('anonqr_confession_author_id', anonId);
    }
    return anonId;
  };

  const getAuthorNick = () => {
    let anonNick = localStorage.getItem('anonqr_confession_author_nick');
    if (!anonNick) {
      anonNick = `Anônimo #${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('anonqr_confession_author_nick', anonNick);
    }
    return anonNick;
  };

  const handleReactionClick = async (reactionType: string) => {
    try {
      const userId = getAuthorId();
      const res = await fetch(`/api/confessions/${confessionId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType, userId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfession((prev) => prev ? { ...prev, reactions: data.reactions } : null);
        onUpdated();
      }
    } catch (err) {
      console.error('Erro ao reagir:', err);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = replyContent.trim();
    if (!clean) return;
    if (clean.length > 500) {
      setReplyError('A resposta excede 500 caracteres.');
      return;
    }

    setIsSendingReply(true);
    setReplyError(null);

    try {
      const authorId = getAuthorId();
      const authorNick = getAuthorNick();

      const res = await fetch(`/api/confessions/${confessionId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: clean, authorId, authorNick }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao enviar resposta.');
      }

      setReplyContent('');
      setConfession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          replies: [...prev.replies, data.reply],
          repliesCount: data.repliesCount,
        };
      });
      onUpdated();
    } catch (err: any) {
      setReplyError(err.message || 'Erro ao enviar resposta.');
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-3xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl p-6 sm:p-8 my-auto shrink-0 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-base">
              🕯️
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Confissão Anônima</h3>
              <p className="text-xs text-slate-400">Espaço protegido de identificação</p>
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-xs text-slate-400">Carregando confissão...</p>
          </div>
        ) : errorMsg || !confession ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg || 'Confissão não encontrada.'}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Confession Box */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-950/90 border border-slate-800 space-y-4 shadow-inner">
              {confession.category && (
                <div className="inline-flex px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                  {confession.category}
                </div>
              )}

              <p className="text-base sm:text-lg text-slate-100 font-medium italic leading-relaxed">
                “{confession.content}”
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                <span className="font-mono font-bold text-emerald-400">— {confession.authorNick}</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {new Date(confession.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Reações Interativas */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Reaja à confissão
              </h4>
              <div className="flex flex-wrap gap-2">
                {CONFESSION_REACTION_TYPES.map((reaction) => {
                  const count = confession.reactions?.[reaction] || 0;
                  const userId = getAuthorId();
                  const hasReacted = confession.userReactions?.[userId]?.includes(reaction);

                  return (
                    <button
                      key={reaction}
                      type="button"
                      onClick={() => handleReactionClick(reaction)}
                      className={`px-3 py-2 rounded-2xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                        hasReacted
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-950/50'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <span>{reaction}</span>
                      {count > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-bold font-mono text-emerald-400">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Respostas Anônimas */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Respostas Anônimas ({confession.repliesCount || 0})
                </h4>
              </div>

              {/* Lista de Respostas */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {confession.replies && confession.replies.length > 0 ? (
                  confession.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 animate-in fade-in"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-emerald-400">
                          {reply.authorNick || 'Anônimo'}
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          {new Date(reply.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {reply.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                    Nenhuma resposta ainda. Seja o primeiro a responder anonimamente.
                  </p>
                )}
              </div>

              {/* Formulário de Resposta */}
              {replyError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {replyError}
                </div>
              )}

              <form onSubmit={handleSendReply} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  maxLength={500}
                  placeholder="Responder anonimamente..."
                  className="flex-1 h-11 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSendingReply || !replyContent.trim()}
                  className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md shadow-emerald-950/40"
                >
                  {isSendingReply ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Responder</span>
                      <Send className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  MessageCircle,
  X,
  Search,
  Mic,
  Camera,
  Clock,
  ShieldCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { PrivateConversationSummary } from '../types';
import { UserSearchResult } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversations: PrivateConversationSummary[];
  onSelectConversation: (targetUser: UserSearchResult) => void;
}

export const MinhasConversasModal: React.FC<Props> = ({
  isOpen,
  onClose,
  conversations,
  onSelectConversation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filtered = conversations.filter((c) => {
    const nick = (c.otherParticipant?.nick || '').toLowerCase();
    const name = (c.otherParticipant?.name || '').toLowerCase();
    const query = searchTerm.toLowerCase().trim();
    return nick.includes(query) || name.includes(query);
  });

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const now = new Date();
    const msgDate = new Date(timestamp);
    const isToday =
      now.getDate() === msgDate.getDate() &&
      now.getMonth() === msgDate.getMonth() &&
      now.getFullYear() === msgDate.getFullYear();

    const hours = msgDate.getHours().toString().padStart(2, '0');
    const mins = msgDate.getMinutes().toString().padStart(2, '0');

    if (isToday) {
      return `${hours}:${mins}`;
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      yesterday.getDate() === msgDate.getDate() &&
      yesterday.getMonth() === msgDate.getMonth() &&
      yesterday.getFullYear() === msgDate.getFullYear();

    if (isYesterday) {
      return `Ontem, ${hours}:${mins}`;
    }

    const day = msgDate.getDate().toString().padStart(2, '0');
    const month = (msgDate.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  };

  const handleConversationClick = (c: PrivateConversationSummary) => {
    const target: UserSearchResult = {
      id: c.otherParticipant.id,
      nick: c.otherParticipant.nick,
      name: c.otherParticipant.name || c.otherParticipant.nick,
      avatar_url: c.otherParticipant.avatar_url || null,
    };
    onSelectConversation(target);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="minhas-conversas-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 sm:px-6 py-4 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="minhas-conversas-title" className="text-base sm:text-lg font-bold text-white">
                  Minhas Conversas
                </h2>
                {conversations.length > 0 && (
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                    {conversations.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Conversas privadas 1×1 com criptografia anônima em memória
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Fechar"
            aria-label="Fechar modal de conversas"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de Pesquisa Rápida */}
        {conversations.length > 0 && (
          <div className="p-3 sm:px-6 sm:pt-3 sm:pb-2 border-b border-slate-800/60 bg-slate-950/40 shrink-0">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por @nick ou nome..."
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5 overscroll-contain">
          {conversations.length === 0 ? (
            /* Estado Vazio */
            <div className="py-12 px-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700 text-emerald-400 mb-3 shadow-inner">
                <MessageCircle className="h-7 w-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white mb-1">
                Nenhuma conversa privada ainda
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed mb-4">
                Para iniciar uma conversa exclusiva 1×1, pesquise o @Nick de outro usuário na página inicial e clique em{' '}
                <strong className="text-emerald-400 font-semibold">"💬 Enviar mensagem"</strong>.
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 text-[11px] text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Conversas protegidas e temporárias em memória</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            /* Nenhum Resultado para o Filtro */
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhuma conversa encontrada com o termo{' '}
              <strong className="text-white font-mono font-bold">"{searchTerm}"</strong>.
            </div>
          ) : (
            /* Cards de Conversa */
            filtered.map((c) => {
              const other = c.otherParticipant;
              const hasUnread = c.unreadCount > 0;

              return (
                <button
                  type="button"
                  key={c.conversationId}
                  onClick={() => handleConversationClick(c)}
                  className={`w-full text-left p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                    hasUnread
                      ? 'bg-slate-800/70 border-emerald-500/50 hover:bg-slate-800 hover:border-emerald-400 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar com Indicador Online */}
                    <div className="relative shrink-0">
                      {other.avatar_url ? (
                        <img
                          src={other.avatar_url}
                          alt={other.nick}
                          className="h-11 w-11 rounded-2xl object-cover border border-slate-700 shadow-sm"
                        />
                      ) : (
                        <div
                          className="h-11 w-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                          style={{ backgroundColor: other.avatarColor || '#06b6d4' }}
                        >
                          {other.nick.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Bolinha de Status Online/Offline */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${
                          other.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                        }`}
                        title={other.isOnline ? 'Online agora' : 'Offline'}
                      />
                    </div>

                    {/* Informações da Conversa */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm truncate">
                            @{other.nick}
                          </span>
                          {other.name && other.name.toLowerCase() !== other.nick.toLowerCase() && (
                            <span className="text-[11px] text-slate-400 truncate hidden xs:inline">
                              ({other.name})
                            </span>
                          )}
                        </div>

                        {/* Horário */}
                        <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                          {formatTime(c.lastMessageAt)}
                        </span>
                      </div>

                      {/* Prévia da Mensagem */}
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs truncate ${
                            hasUnread ? 'text-slate-200 font-semibold' : 'text-slate-400 font-normal'
                          }`}
                        >
                          {c.lastMessageType === 'audio' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <Mic className="h-3 w-3" />
                              <span>Áudio gravado</span>
                            </span>
                          ) : c.lastMessageType === 'image' ? (
                            <span className="inline-flex items-center gap-1 text-teal-400">
                              <Camera className="h-3 w-3" />
                              <span>Foto</span>
                            </span>
                          ) : c.lastMessage ? (
                            c.lastMessage
                          ) : (
                            <span className="text-slate-500 italic">Conversa iniciada</span>
                          )}
                        </p>

                        {/* Badge de Mensagens Não Lidas */}
                        {hasUnread && (
                          <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] shrink-0 shadow-md shadow-emerald-950/60 animate-bounce">
                            {c.unreadCount} {c.unreadCount === 1 ? 'nova' : 'novas'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0 hidden sm:block">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-center shrink-0">
          <p className="text-[10px] text-slate-500">
            Histórico temporário em memória RAM • Limite de até 100 mensagens por conversa
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Users,
  Clock,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Smartphone,
  KeyRound,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { ThemedRoom } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  roomId: string | null;
  initialPasscode?: string;
  onClose: () => void;
  onSuccess: (room: ThemedRoom, accessKey: string) => void;
  onRoomDeleted?: () => void;
}

export const PasscodePromptModal: React.FC<Props> = ({
  isOpen,
  roomId,
  initialPasscode = '',
  onClose,
  onSuccess,
  onRoomDeleted,
}) => {
  const [passcode, setPasscode] = useState(initialPasscode);
  const [loading, setLoading] = useState(false);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingTimeStr, setRemainingTimeStr] = useState<string>('');

  // Delete Room via Code (8090) State
  const [isDeleteSectionOpen, setIsDeleteSectionOpen] = useState(false);
  const [deleteCodeInput, setDeleteCodeInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (initialPasscode) {
      setPasscode(initialPasscode);
    }
  }, [initialPasscode]);

  useEffect(() => {
    if (!isOpen || !roomId) {
      setRoomInfo(null);
      setError(null);
      return;
    }

    setLoading(true);
    fetch(`/api/rooms/${roomId}/info`)
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return res.json();
        }
        return { error: 'Servidor indisponível no momento.' };
      })
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setRoomInfo(data);
          const isPerm = !!data.isPermanent || data.roomType === 'group_perm' || data.roomType === 'duo_perm' || data.durationMinutes === 0;
          // Calculate remaining time only for temporary rooms
          if (!isPerm && data.expiresAt) {
            const diff = Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000));
            const mins = Math.floor(diff / 60);
            const secs = diff % 60;
            setRemainingTimeStr(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
          } else {
            setRemainingTimeStr('');
          }
        }
      })
      .catch(() => {
        setError('Não foi possível carregar as informações desta sala.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, roomId]);

  if (!isOpen || !roomId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Por favor, digite o código de acesso informado pelo criador.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch('/api/rooms/join-verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          roomId,
          passcode: passcode.trim(),
          accessToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Código incorreto ou sala indisponível.');
      }

      onSuccess(data.room, data.accessKey);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Código de acesso incorreto.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoomByCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (deleteCodeInput.trim() !== '8090') {
      setDeleteError('Código de autorização incorreto.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/delete-by-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteCode: deleteCodeInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsDeleteSectionOpen(false);
        onRoomDeleted?.();
        onClose();
      } else {
        setDeleteError(data.error || 'Erro ao excluir sala.');
      }
    } catch (err: any) {
      setDeleteError('Erro de conexão ao tentar excluir a sala.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isPermanent = roomInfo && (!!roomInfo.isPermanent || roomInfo.roomType === 'group_perm' || roomInfo.roomType === 'duo_perm' || roomInfo.durationMinutes === 0);
  const isFull = roomInfo && roomInfo.onlineCount >= (roomInfo.maxParticipants || 10);
  const isExpired = roomInfo && !isPermanent && roomInfo.isExpired;

  return (
    <div
      id="passcode-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="passcode-modal-content"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5 text-emerald-400 mb-2">
            <Lock className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Acesso Protegido por Código
            </span>
          </div>

          <h3 className="text-lg font-bold text-white mb-1 truncate">
            {roomInfo ? roomInfo.name : 'Ingressar na Sala Privada'}
          </h3>

          <p className="text-xs text-slate-400">
            O criador desta sala definiu um código de segurança para liberar a entrada.
          </p>
        </div>

        {/* Room Status Pills */}
        {roomInfo && (
          <div className="px-6 py-3 bg-slate-800/40 border-b border-slate-800/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <span>
                Vagas: <strong>{roomInfo.onlineCount} / {roomInfo.maxParticipants || 10}</strong> pessoas
              </span>
            </div>

            {isPermanent ? (
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Sala Permanente</span>
              </div>
            ) : remainingTimeStr ? (
              <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>Tempo restante: {remainingTimeStr}</span>
              </div>
            ) : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isFull ? (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-300 text-xs text-center space-y-1">
              <p className="font-bold text-white">Sala Lotada (Limite de 10 Pessoas Atingido)</p>
              <p className="text-slate-400">
                Esta sala atingiu a capacidade máxima de 10 participantes simultâneos. Aguarde alguém sair para tentar novamente.
              </p>
            </div>
          ) : isExpired ? (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-600/40 text-rose-300 text-xs text-center space-y-1">
              <p className="font-bold text-white">Tempo Esgotado</p>
              <p className="text-slate-400">
                O tempo contratado para esta sala expirou e ela foi encerrada.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {roomInfo?.hasMultiChat
                  ? 'Senha de Acesso (Senha Mestre ou Senha do Chat Específico) *'
                  : 'Código de Acesso Fornecido pelo Criador *'}
              </label>

              {roomInfo?.hasMultiChat && (
                <div className="mb-2.5 p-3 rounded-xl bg-pink-950/40 border border-pink-500/30 text-xs text-pink-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-pink-300">
                    <ShieldCheck className="h-4 w-4 text-pink-400" />
                    <span>Modalidade: 5 Chats no Mesmo Link</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    • <strong>Senha do seu Chat (ex: C1-XXXX, C2-XXXX...):</strong> Você entrará exclusivamente no chat correspondente, com total sigilo e sem ver as mensagens dos outros chats.<br />
                    • <strong>Senha Mestre:</strong> Dá acesso para alternar entre todos os 5 chats.
                  </p>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="passcode-input-field"
                  type="text"
                  required
                  autoFocus
                  placeholder={roomInfo?.hasMultiChat ? 'Ex: C1-8492 ou Senha Mestre' : 'Ex: 8492'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-10 pr-3.5 py-3 text-base font-mono font-bold tracking-widest text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:font-sans placeholder:tracking-normal placeholder:text-xs"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {roomInfo?.hasMultiChat
                  ? 'Digite a senha do chat que o anfitrião enviou para você.'
                  : 'Peça o código ao anfitrião que compartilhou o link ou QR Code com você.'}
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            {!isFull && !isExpired && (
              <button
                id="submit-passcode-btn"
                type="submit"
                disabled={loading || !passcode.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50 active:scale-98"
              >
                {loading ? (
                  <span>Validando...</span>
                ) : (
                  <>
                    <span>Entrar no Chat</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </form>

        {/* Excluir sala via código (Requer Autorização 8090) */}
        <div className="px-6 pb-6 pt-2 border-t border-slate-800/80">
          {!isDeleteSectionOpen ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/20">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Trash2 className="h-4 w-4 text-rose-400 shrink-0" />
                <span className="text-[11px] text-slate-400">Deseja apagar esta sala?</span>
              </div>
              <button
                id="btn-open-delete-prompt-modal"
                type="button"
                onClick={() => {
                  setIsDeleteSectionOpen(true);
                  setDeleteCodeInput('');
                  setDeleteError(null);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir sala via código</span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-rose-400">
                  <ShieldAlert className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Autorização Necessária
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteSectionOpen(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                Para excluir e encerrar permanentemente esta sala agora, digite o código de autorização:
              </p>

              <form onSubmit={handleDeleteRoomByCode} className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    id="input-delete-code-prompt"
                    type="password"
                    autoFocus
                    placeholder="Digite a senha de autorização..."
                    value={deleteCodeInput}
                    onChange={(e) => {
                      setDeleteCodeInput(e.target.value);
                      setDeleteError(null);
                    }}
                    className="flex-1 rounded-lg border border-rose-500/40 bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold tracking-widest text-rose-200 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
                  />
                  <button
                    id="btn-confirm-delete-prompt"
                    type="submit"
                    disabled={isDeleting || !deleteCodeInput.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-rose-950/60 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
                  </button>
                </div>

                {deleteError && (
                  <div className="p-2 rounded-lg bg-rose-900/60 border border-rose-500/40 text-[11px] text-rose-200 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

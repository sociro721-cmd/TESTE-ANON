import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  Share2,
  Users,
  Clock,
  KeyRound,
  Shield,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Trash2,
  ShieldAlert,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import { ThemedRoom } from '../types';
import { buildShareableRoomLink } from '../utils/url';

interface Props {
  isOpen: boolean;
  room: ThemedRoom;
  creatorPasscode?: string;
  onClose: () => void;
  onRoomDeleted?: () => void;
}

export const ShareRoomModal: React.FC<Props> = ({
  isOpen,
  room,
  creatorPasscode,
  onClose,
  onRoomDeleted,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [passcode, setPasscode] = useState(creatorPasscode || room.creatorPasscode || '');
  const [accessKey, setAccessKey] = useState(room.accessKey || '');
  const [channelPasscodes, setChannelPasscodes] = useState<Record<string, string>>(room.channelPasscodes || {});
  const [copiedChannelCode, setCopiedChannelCode] = useState<string | null>(null);
  const [copiedChannelLink, setCopiedChannelLink] = useState<string | null>(null);
  const [remainingTimeStr, setRemainingTimeStr] = useState<string>('');
  const isPermanent = !!room.isPermanent || room.roomType === 'group_perm' || room.roomType === 'duo_perm' || room.durationMinutes === 0 || !!room.isOpenRoom;

  // Delete Room via Code (8090) State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteCodeInput, setDeleteCodeInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const keyToUse = accessKey || room.accessKey || '';
  const roomLink = buildShareableRoomLink(room.id, keyToUse);

  // If passcode or accessKey or channelPasscodes was not passed, fetch ticket
  useEffect(() => {
    if (isOpen) {
      fetch(`/api/rooms/${room.id}/ticket`)
        .then((res) => res.json())
        .then((data) => {
          if (data.creatorPasscode) {
            setPasscode(data.creatorPasscode);
          }
          if (data.accessKey) {
            setAccessKey(data.accessKey);
          }
          if (data.channelPasscodes) {
            setChannelPasscodes(data.channelPasscodes);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, room.id]);

  // Generate QR Code image
  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(roomLink, {
        width: 320,
        margin: 2,
        color: {
          dark: '#020617',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR Generation failed:', err));
    }
  }, [isOpen, roomLink]);

  // Update timer display (only if not permanent)
  useEffect(() => {
    if (!isOpen || isPermanent) return;

    const updateTimer = () => {
      if (room.expiresAt) {
        const diff = Math.max(0, Math.floor((room.expiresAt - Date.now()) / 1000));
        const hours = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        const secs = diff % 60;
        if (hours > 0) {
          setRemainingTimeStr(`${hours}h ${mins}m ${secs}s`);
        } else {
          setRemainingTimeStr(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, room.expiresAt, isPermanent]);

  if (!isOpen) return null;

  const copyText = (text: string, type: 'link' | 'code' | 'all') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  const formattedInviteText = `🔒 *Convite para Chat Anônimo: "${room.name}"*

🔗 *Link de Entrada Direta (basta clicar para entrar):*
${roomLink}

👥 *Capacidade:* Até 10 pessoas simultâneas
⏳ *Tempo Restante:* ${remainingTimeStr || 'Sessão temporizada'}
🔑 *Código de Acesso:* ${passcode || 'Liberado automaticamente pelo link'}

_Basta clicar no link acima para entrar diretamente no chat. Sem cadastro e 100% anônimo!_`;

  const handleShareMobile = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Convite de Chat: ${room.name}`,
          text: formattedInviteText,
          url: roomLink,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    // Direct WhatsApp link
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(formattedInviteText)}`;
    window.open(waUrl, '_blank');
  };

  const handleDeleteRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (deleteCodeInput.trim() !== '8090') {
      setDeleteError('Código de autorização incorreto.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(room.id)}/delete-by-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteCode: deleteCodeInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsDeleteConfirmOpen(false);
        onRoomDeleted?.();
        onClose();
      } else {
        setDeleteError(data.error || 'Erro ao autorizar a exclusão da sala.');
      }
    } catch (err: any) {
      setDeleteError('Erro de conexão ao tentar excluir a sala.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      id="share-room-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="share-room-modal-content"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl my-auto max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Convidar Pessoas para o Chat</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Capacidade de até 10 pessoas • Entrada direta pelo link
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {/* Status summary pills */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300">
              <Users className="h-4 w-4 text-indigo-400 shrink-0" />
              <span>
                Capacidade: <strong>Até 10 pessoas</strong>
              </span>
            </div>

            {isPermanent ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  Tempo: <strong>Permanente (Sem Expiração)</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-amber-300">
                <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                <span>
                  Restam: <strong>{remainingTimeStr || 'Calculando...'}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Direct Link Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Link de Entrada Direta (Para Compartilhar)
              </label>
              <span className="text-[10px] text-slate-400">Todos com este link acessam</span>
            </div>

            <div className="flex items-center gap-2 p-1.5 sm:p-2 rounded-xl bg-slate-950 border border-slate-800">
              <input
                type="text"
                readOnly
                value={roomLink}
                className="flex-1 bg-transparent px-2 text-xs font-mono text-emerald-300 outline-none select-all min-w-0"
              />
              <button
                onClick={() => copyText(roomLink, 'link')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shrink-0 shadow-md shadow-emerald-950/40 cursor-pointer"
                aria-label="Copiar link de entrada direta"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-slate-400">
                Qualquer pessoa que clicar neste link entrará na sala imediatamente pelo celular ou computador.
              </p>
              <a
                href={roomLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
                Testar Link
              </a>
            </div>
          </div>

          {/* Smartphone Compatibility Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs leading-relaxed">
            <Smartphone className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-300 block mb-0.5">Acesso 100% Liberado para Celulares (Android e iPhone)</strong>
              <span>
                Celulares diferentes podem acessar a sala diretamente pelo link gerado ou escaneando o QR Code com a câmera. Não requer instalação de aplicativo nem cadastro!
              </span>
            </div>
          </div>

          {/* Mobile Sharing Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleShareMobile}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 transition-all active:scale-98 cursor-pointer"
              title="Compartilhar no WhatsApp ou abrir compartilhamento do celular"
            >
              <MessageCircle className="h-4 w-4 text-emerald-200" />
              <span>Enviar via WhatsApp / Celular</span>
            </button>

            <button
              type="button"
              onClick={() => copyText(formattedInviteText, 'all')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-lg transition-all active:scale-98 cursor-pointer"
            >
              {copiedAll ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>Copiado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-slate-300" />
                  <span>Copiar Texto Completo</span>
                </>
              )}
            </button>
          </div>

          {/* Passcode Card (Alternative for manual entry) */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                Código Alternativo de Acesso Manual
              </span>
              <span className="text-[10px] text-slate-500">Para quem entrar pelo site</span>
            </div>

            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-base font-mono font-bold tracking-widest text-amber-300">
                {passcode || '------'}
              </span>
              <button
                onClick={() => copyText(passcode, 'code')}
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition-colors cursor-pointer"
                aria-label="Copiar código de acesso"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCode ? 'Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>
          </div>

          {/* 5-Chat Specific Passcodes (If Multi-Chat) */}
          {room.hasMultiChat && (
            <div className="p-4 rounded-2xl bg-pink-950/20 border border-pink-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-pink-400" />
                  Senhas Exclusivas dos 5 Chats Individuais
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-900/60 text-pink-200 border border-pink-500/40 font-semibold">
                  1 Link • 5 Chats Sigilosos
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Envie uma senha para cada pessoa. Quem acessar com a senha de um chat <strong>não consegue ver nem acessar os outros 4 chats</strong>!
              </p>

              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((num) => {
                  const chKey = `chat_${num}`;
                  const fallbackCode = passcode ? `C${num}-${passcode}` : `C${num}-8492`;
                  const code = channelPasscodes[chKey] || fallbackCode;
                  const directLink = buildShareableRoomLink(room.id, undefined, chKey);

                  const isCodeCopied = copiedChannelCode === chKey;
                  const isLinkCopied = copiedChannelLink === chKey;

                  return (
                    <div
                      key={chKey}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-pink-600 text-white font-bold text-xs">
                          Chat {num}
                        </span>
                        <span className="text-xs font-mono font-bold text-pink-300 tracking-wider">
                          {code}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(code);
                            setCopiedChannelCode(chKey);
                            setTimeout(() => setCopiedChannelCode(null), 2000);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                          aria-label="Copiar senha do chat"
                        >
                          {isCodeCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{isCodeCopied ? 'Senha Copiada!' : 'Copiar Senha'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(directLink);
                            setCopiedChannelLink(chKey);
                            setTimeout(() => setCopiedChannelLink(null), 2000);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-xs font-semibold text-pink-200 border border-pink-500/30 transition-colors cursor-pointer"
                          aria-label="Copiar link direto do chat"
                        >
                          {isLinkCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <ExternalLink className="h-3.5 w-3.5" />}
                          <span>{isLinkCopied ? 'Link Copiado!' : 'Copiar Link'}</span>
                        </button>

                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                            `Bate-papo privativo no Chat ${num} da sala:\nLink: ${directLink}\nSenha de acesso exclusiva: ${code}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 text-xs font-semibold text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                          aria-label="Compartilhar no WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* QR Code Section */}
          <div className="pt-2 border-t border-slate-800 flex flex-col items-center text-center">
            <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-emerald-400" />
              Ou escaneie com a câmera do celular:
            </p>
            {qrDataUrl ? (
              <div className="p-2.5 rounded-2xl bg-white border border-slate-700 shadow-xl inline-block">
                <img
                  src={qrDataUrl}
                  alt={`QR Code para ${room.name}`}
                  className="h-44 w-44 object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="h-44 w-44 flex items-center justify-center bg-slate-800 rounded-2xl text-xs text-slate-500">
                Gerando QR...
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2 max-w-xs leading-tight">
              Aponte a câmera de qualquer celular (iPhone ou Android) para abrir a sala automaticamente.
            </p>
          </div>

          {/* Excluir sala via código (Requer Autorização) */}
          <div className="pt-3 border-t border-slate-800">
            {!isDeleteConfirmOpen ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-rose-950/20 border border-rose-500/20">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Trash2 className="h-4 w-4 text-rose-400 shrink-0" />
                  <div>
                    <span className="font-semibold block text-slate-200">Excluir esta sala via código</span>
                    <span className="text-[11px] text-slate-400">Encerrar e deletar a sala imediatamente</span>
                  </div>
                </div>
                <button
                  id="btn-open-delete-share-modal"
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(true);
                    setDeleteCodeInput('');
                    setDeleteError(null);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Excluir sala via código</span>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-400">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                      Autorização Necessária
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Para excluir permanentemente a sala <strong className="text-white">"{room.name}"</strong> e desconectar todos os participantes imediatamente, digite o código de autorização:
                </p>

                <form onSubmit={handleDeleteRoom} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      id="input-delete-code-share"
                      type="password"
                      autoFocus
                      placeholder="Digite a senha de autorização..."
                      value={deleteCodeInput}
                      onChange={(e) => {
                        setDeleteCodeInput(e.target.value);
                        setDeleteError(null);
                      }}
                      className="flex-1 rounded-xl border border-rose-500/40 bg-slate-900 px-3 py-2 text-xs font-mono font-bold tracking-widest text-rose-200 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
                    />
                    <button
                      id="btn-confirm-delete-share"
                      type="submit"
                      disabled={isDeleting || !deleteCodeInput.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-rose-950/60 cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
                    </button>
                  </div>

                  {deleteError && (
                    <div className="p-2.5 rounded-lg bg-rose-900/60 border border-rose-500/40 text-[11px] text-rose-200 flex items-center gap-2">
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
    </div>
  );
};

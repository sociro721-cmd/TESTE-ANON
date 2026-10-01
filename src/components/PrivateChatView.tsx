import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Send,
  Mic,
  Camera,
  Square,
  Trash2,
  Loader2,
  ShieldCheck,
  Radio,
  Sparkles,
  X,
  Maximize2,
  Image as ImageIcon,
} from 'lucide-react';
import { AnonymousUser, PrivateChatMessage, buildPrivateConversationId } from '../types';
import { UserSearchResult } from '../lib/supabase';
import {
  sounds,
  getSupportedAudioMimeType,
  blobToDataUrl,
  MAX_AUDIO_DURATION_SECONDS,
  MAX_AUDIO_SIZE_BYTES,
} from '../utils/audio';
import { AudioPlayer } from './AudioPlayer';

interface Props {
  targetUser: UserSearchResult;
  currentUser: AnonymousUser;
  onBack: () => void;
}

export const PrivateChatView: React.FC<Props> = ({
  targetUser,
  currentUser,
  onBack,
}) => {
  const [messages, setMessages] = useState<PrivateChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [isPeerOnline, setIsPeerOnline] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);

  // Audio recording states
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [previewAudioBlob, setPreviewAudioBlob] = useState<Blob | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Image upload & preview states
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingDurationRef = useRef<number>(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Deterministic Conversation ID
  const conversationId = buildPrivateConversationId(currentUser.id, targetUser.id);

  // Auto-scroll to latest message
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages]);

  // WebSocket Connection & Reconnection Management
  useEffect(() => {
    isMountedRef.current = true;

    function connectWebSocket() {
      if (!isMountedRef.current) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        setWsConnected(true);

        // Enviar evento de join na conversa privada com validação dos IDs
        ws.send(
          JSON.stringify({
            type: 'private_join',
            conversationId,
            user: {
              id: currentUser.id,
              name: currentUser.name,
              nick: (currentUser as any).nick,
              avatarUrl: (currentUser as any).avatarUrl,
              avatarColor: currentUser.avatarColor,
              avatarIcon: currentUser.avatarIcon,
            },
            peerUser: {
              id: targetUser.id,
              name: targetUser.name,
              nick: targetUser.nick,
              avatarUrl: targetUser.avatar_url,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'private_state': {
              if (data.conversationId === conversationId && Array.isArray(data.messages)) {
                // Deduplicação estrita por msg.id ao carregar histórico
                setMessages((prev) => {
                  const map = new Map<string, PrivateChatMessage>();
                  for (const m of data.messages) {
                    map.set(m.id, m);
                  }
                  for (const m of prev) {
                    if (!map.has(m.id)) {
                      map.set(m.id, m);
                    }
                  }
                  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
                });
              }
              if (typeof data.peerOnline === 'boolean') {
                setIsPeerOnline(data.peerOnline);
              }
              break;
            }

            case 'private_new_message': {
              if (data.conversationId === conversationId && data.message) {
                const newMsg = data.message as PrivateChatMessage;
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });

                // Reproduzir som de recebimento se não for do próprio usuário
                if (newMsg.senderId !== currentUser.id) {
                  sounds.playMessageReceived();
                }
              }
              break;
            }

            case 'private_peer_status': {
              if (data.conversationId === conversationId && typeof data.isOnline === 'boolean') {
                setIsPeerOnline(data.isOnline);
              }
              break;
            }

            case 'private_typing': {
              if (data.conversationId === conversationId && data.userId !== currentUser.id) {
                setIsPeerTyping(!!data.isTyping);
                if (data.isTyping) {
                  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = setTimeout(() => {
                    setIsPeerTyping(false);
                  }, 3000);
                }
              }
              break;
            }

            case 'private_error': {
              console.warn('[PrivateChatView] Erro do servidor:', data.message);
              break;
            }
          }
        } catch (err) {
          console.error('[PrivateChatView] Erro ao processar mensagem WS:', err);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setWsConnected(false);
        setIsPeerOnline(false);

        // Auto-reconexão suave após 2.5s mantendo todo o histórico existente
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2500);
      };

      ws.onerror = (err) => {
        console.warn('[PrivateChatView] WebSocket error:', err);
      };
    }

    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'private_leave',
            conversationId,
          })
        );
        wsRef.current.close();
      }
    };
  }, [conversationId, currentUser.id, targetUser.id]);

  // Indicador de digitação
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'private_typing',
          conversationId,
          isTyping: e.target.value.trim().length > 0,
        })
      );
    }
  };

  // Envio de mensagem de texto
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const tempId = 'pmsg_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const msgPayload = {
      id: tempId,
      type: 'private_message',
      conversationId,
      content: clean,
      messageType: 'text' as const,
    };

    wsRef.current.send(JSON.stringify(msgPayload));
    sounds.playMessageSent();
    setInputText('');

    // Avisa que parou de digitar
    wsRef.current.send(
      JSON.stringify({
        type: 'private_typing',
        conversationId,
        isTyping: false,
      })
    );
  };

  // --- SELEÇÃO, PREVIEW E ENVIO DE FOTOS TEMPORÁRIAS EM MEMÓRIA ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setAudioError('Formato inválido. Selecione uma foto JPG, PNG ou WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const MAX_SIZE = 3 * 1024 * 1024; // 3MB
    if (file.size > MAX_SIZE) {
      setAudioError('A imagem selecionada é muito grande. O limite máximo é de 3MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setSelectedImagePreviewUrl(objectUrl);
    setAudioError(null);
  };

  const handleCancelImagePreview = () => {
    if (selectedImagePreviewUrl) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    }
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendImage = async () => {
    if (!selectedImageFile || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    setIsSendingImage(true);
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedImageFile);
      });

      const tempId = 'pmsg_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const caption = inputText.trim();

      wsRef.current.send(
        JSON.stringify({
          id: tempId,
          type: 'private_message',
          conversationId,
          content: caption || 'Foto enviada',
          messageType: 'image',
          imageUrl: base64Data,
          imageName: selectedImageFile.name,
        })
      );

      sounds.playMessageSent();
      handleCancelImagePreview();
      setInputText('');
    } catch (err) {
      console.error('[PrivateChatView] Erro ao enviar foto:', err);
      setAudioError('Falha ao processar e enviar a foto. Tente novamente.');
    } finally {
      setIsSendingImage(false);
    }
  };

  // --- GRAVAÇÃO DE ÁUDIO REUTILIZANDO PADRÕES DO ANÔNQR ---
  const handleStartRecording = async () => {
    setAudioError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setAudioError('Gravação não suportada neste navegador.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingDurationRef.current = 0;
      setRecordingDuration(0);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        const effectiveMime = recorder.mimeType || mimeType || 'audio/webm';
        const finalBlob = new Blob(audioChunksRef.current, { type: effectiveMime });

        if (finalBlob.size > MAX_AUDIO_SIZE_BYTES) {
          setAudioError('Áudio excede o limite máximo de 500 KB.');
          setRecordingState('idle');
          return;
        }

        if (recordingDurationRef.current < 1) {
          setAudioError('Áudio muito curto. Mantenha gravando por pelo menos 1 segundo.');
          setRecordingState('idle');
          return;
        }

        const audioUrl = URL.createObjectURL(finalBlob);
        setPreviewAudioBlob(finalBlob);
        setPreviewAudioUrl(audioUrl);
        setPreviewDuration(recordingDurationRef.current);
        setRecordingState('preview');
      };

      recorder.start(100);
      setRecordingState('recording');

      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(recordingDurationRef.current);

        if (recordingDurationRef.current >= MAX_AUDIO_DURATION_SECONDS) {
          handleStopRecording();
        }
      }, 1000);
    } catch (err: any) {
      console.warn('[PrivateChatView] Erro ao iniciar microfone:', err);
      setAudioError('Permissão de microfone negada ou indisponível.');
      setRecordingState('idle');
    }
  };

  const handleStopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
    }
    audioChunksRef.current = [];
    setPreviewAudioBlob(null);
    setPreviewAudioUrl(null);
    setPreviewDuration(0);
    setRecordingDuration(0);
    setRecordingState('idle');
    setAudioError(null);
  };

  const handleSendAudio = async () => {
    if (!previewAudioBlob || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const dataUrl = await blobToDataUrl(previewAudioBlob);
      const tempId = 'pmsg_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

      wsRef.current.send(
        JSON.stringify({
          id: tempId,
          type: 'private_message',
          conversationId,
          messageType: 'audio',
          audioUrl: dataUrl,
          audioDuration: previewDuration,
        })
      );

      sounds.playMessageSent();
      handleCancelRecording();
    } catch (err: any) {
      console.error('[PrivateChatView] Erro ao enviar áudio:', err);
      setAudioError('Falha ao processar arquivo de áudio para envio.');
    }
  };

  const formatRecordingTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMessageTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header Responsivo */}
      <header className="h-16 px-3 sm:px-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-9 w-9 -ml-1 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Voltar ao início"
            aria-label="Voltar ao início"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Avatar do Destinatário */}
          <div className="relative shrink-0">
            {targetUser.avatar_url ? (
              <img
                src={targetUser.avatar_url}
                alt={targetUser.nick || targetUser.name}
                className="h-10 w-10 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-sm"
              />
            ) : (
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-sm shadow-sm">
                {(targetUser.nick || targetUser.name).charAt(0).toUpperCase()}
              </div>
            )}
            {/* Status Online/Offline */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${
                isPeerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
              }`}
              title={isPeerOnline ? 'Online agora' : 'Offline'}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-emerald-400 text-sm truncate">
                @{targetUser.nick}
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.2 rounded hidden sm:inline-flex">
                Privado 1×1
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {isPeerTyping ? (
                <span className="text-emerald-400 text-xs font-medium animate-pulse flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                  digitando...
                </span>
              ) : isPeerOnline ? (
                <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                  Online
                </span>
              ) : (
                <span className="text-slate-500 text-[11px]">
                  {targetUser.name || 'Offline'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Indicador de Conexão WebSocket Segura */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-medium">
            <Radio className={`h-3 w-3 ${wsConnected ? 'text-emerald-400' : 'text-amber-400 animate-spin'}`} />
            <span className="hidden xs:inline">{wsConnected ? 'Cifrado' : 'Conectando'}</span>
          </div>
        </div>
      </header>

      {/* Área de Mensagens com Rolagem */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 overscroll-contain">
        {/* Banner Informativo de Conversa 1x1 Exclusiva */}
        <div className="mx-auto max-w-sm py-2 px-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold">
            <ShieldCheck className="h-4 w-4" />
            <span>Conversa Privada Exclusiva</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Mensagens enviadas diretamente entre você e @{targetUser.nick}. Sem armazenamento permanente em banco.
          </p>
        </div>

        {/* Lista de Mensagens */}
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-1 duration-150`}
            >
              <div
                className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 shadow-md ${
                  isMe
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                }`}
              >
                {/* Nome do Remetente em mensagens recebidas */}
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono font-bold text-emerald-400">
                    <span>@{msg.senderNick || targetUser.nick}</span>
                  </div>
                )}

                {/* Conteúdo de Foto / Imagem */}
                {msg.type === 'image' && msg.imageUrl && (
                  <div className="mb-1.5">
                    <div
                      className="relative group/photo overflow-hidden rounded-xl bg-black/40 border border-black/20 cursor-pointer shadow-inner"
                      onClick={() => setLightboxImage({ url: msg.imageUrl!, name: msg.imageName })}
                      title="Clique para ampliar a foto"
                    >
                      <img
                        src={msg.imageUrl}
                        alt={msg.imageName || 'Foto enviada'}
                        className="max-h-64 sm:max-h-80 w-auto rounded-xl object-contain hover:scale-[1.01] transition-transform duration-200"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover/photo:opacity-100">
                        <span className="p-2 rounded-xl bg-slate-900/80 text-white shadow-lg backdrop-blur-sm flex items-center gap-1.5 text-xs font-semibold">
                          <Maximize2 className="h-4 w-4" />
                          <span>Ampliar</span>
                        </span>
                      </div>
                    </div>
                    {msg.content && msg.content !== 'Foto enviada' && msg.content !== 'Foto' && (
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed mt-1.5">
                        {msg.content}
                      </p>
                    )}
                  </div>
                )}

                {/* Conteúdo de Áudio */}
                {msg.type === 'audio' && msg.audioUrl ? (
                  <div className="py-1">
                    <AudioPlayer
                      src={msg.audioUrl}
                      audioUrl={msg.audioUrl}
                      duration={msg.audioDuration}
                      isMe={isMe}
                    />
                  </div>
                ) : msg.type === 'text' ? (
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {msg.content}
                  </p>
                ) : null}

                {/* Horário */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isMe ? 'text-emerald-200' : 'text-slate-500'
                  }`}
                >
                  <span>{formatMessageTime(msg.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Indicador de Digitando na Área de Mensagens */}
        {isPeerTyping && (
          <div className="flex items-center gap-2 text-slate-400 text-xs italic px-2">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>@{targetUser.nick} está digitando...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Alerta de erro de áudio se houver */}
      {audioError && (
        <div className="px-4 py-2 bg-rose-950/80 border-t border-rose-800/80 text-rose-200 text-xs flex items-center justify-between">
          <span>{audioError}</span>
          <button
            type="button"
            onClick={() => setAudioError(null)}
            className="text-rose-400 hover:text-white font-bold"
          >
            OK
          </button>
        </div>
      )}

      {/* Barra de Rodapé / Entrada de Mensagens */}
      <footer className="p-2.5 sm:p-3 border-t border-slate-800 bg-slate-900/90 backdrop-blur-md shrink-0 space-y-2">
        {/* Preview de Foto Selecionada antes do envio */}
        {selectedImagePreviewUrl && (
          <div className="flex items-center justify-between gap-3 bg-slate-950 p-2.5 rounded-2xl border border-emerald-500/40 animate-in fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={selectedImagePreviewUrl}
                  alt="Preview da foto selecionada"
                  className="h-12 w-12 rounded-xl object-cover border border-emerald-500/30 shadow-md"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                  {selectedImageFile?.name || 'Foto selecionada'}
                </p>
                <p className="text-[10px] text-emerald-400">
                  {selectedImageFile ? `${(selectedImageFile.size / 1024).toFixed(0)} KB • Pronto para envio` : 'Foto pronta'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCancelImagePreview}
                disabled={isSendingImage}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                title="Descartar foto"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleSendImage}
                disabled={isSendingImage}
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950/50"
              >
                {isSendingImage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar Foto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Modo 1: Gravando Áudio */}
        {recordingState === 'recording' && (
          <div className="flex items-center justify-between gap-3 bg-slate-950 px-3.5 py-2.5 rounded-2xl border border-rose-500/40 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-bold text-rose-400 font-mono">
                Gravando: {formatRecordingTime(recordingDuration)} / 1:00
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelRecording}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                title="Descartar gravação"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-white" />
                <span>Concluir</span>
              </button>
            </div>
          </div>
        )}

        {/* Modo 2: Preview do Áudio Gravado */}
        {recordingState === 'preview' && previewAudioUrl && (
          <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
            <div className="flex-1 min-w-0 pr-2">
              <AudioPlayer audioUrl={previewAudioUrl} duration={previewDuration} />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCancelRecording}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                title="Descartar áudio"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleSendAudio}
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950/50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Enviar</span>
              </button>
            </div>
          </div>
        )}

        {/* Modo 3: Entrada Padrão Completa: [📷 Foto] [campo de texto] [🎤 Áudio] [Enviar] */}
        {recordingState === 'idle' && (
          <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
            {/* 1. Botão de Foto / Imagem */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,image/jpg"
              className="hidden"
              onChange={handleImageSelect}
              disabled={isSendingImage}
            />
            <button
              type="button"
              id="btn-private-chat-photo"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSendingImage}
              className="h-11 w-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              title="Enviar foto ou imagem (JPG, PNG, WebP)"
              aria-label="Enviar foto"
            >
              <Camera className="h-5 w-5" />
            </button>

            {/* 2. Campo de Entrada de Mensagem de Texto */}
            <input
              type="text"
              id="input-private-chat-message"
              value={inputText}
              onChange={handleInputChange}
              placeholder={selectedImagePreviewUrl ? 'Adicionar legenda para a foto...' : `Mensagem privada para @${targetUser.nick}...`}
              maxLength={1000}
              className="flex-1 h-11 px-3.5 sm:px-4 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors min-w-0"
            />

            {/* 3. Botão de Gravar Áudio */}
            <button
              type="button"
              id="btn-private-chat-mic"
              onClick={handleStartRecording}
              disabled={isSendingImage || !!selectedImagePreviewUrl}
              className="h-11 w-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center transition-colors shrink-0 cursor-pointer disabled:opacity-40"
              title="Gravar mensagem de áudio (até 60s)"
              aria-label="Gravar áudio"
            >
              <Mic className="h-5 w-5" />
            </button>

            {/* 4. Botão de Enviar */}
            {selectedImagePreviewUrl ? (
              <button
                type="button"
                id="btn-private-chat-send-photo"
                onClick={handleSendImage}
                disabled={isSendingImage}
                className="h-11 px-3.5 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md shadow-emerald-950/40"
                aria-label="Enviar foto"
              >
                {isSendingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span className="hidden xs:inline">Enviar</span>
                    <Send className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="submit"
                id="btn-private-chat-send-text"
                disabled={!inputText.trim()}
                className="h-11 px-3.5 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-emerald-950/40"
                aria-label="Enviar mensagem"
              >
                <span className="hidden xs:inline">Enviar</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        )}
      </footer>

      {/* Visualizador Lightbox de Foto em Tela Cheia */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white transition-colors cursor-pointer z-10"
            title="Fechar foto"
            aria-label="Fechar foto ampliada"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxImage.url}
            alt={lightboxImage.name || 'Foto ampliada'}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

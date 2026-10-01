import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Send,
  Users,
  QrCode,
  LogOut,
  Shield,
  Smile,
  Lock,
  Sparkles,
  Info,
  Radio,
  Clock,
  Share2,
  KeyRound,
  AlertTriangle,
  ShieldAlert,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  X,
  Paperclip,
  Image,
  Film,
  Loader2,
  Maximize2,
  Mic,
  Square,
  Trash2,
} from 'lucide-react';
import { AnonymousUser, ChatMessage, ThemedRoom, ChatAttachment } from '../types';
import {
  sounds,
  getSupportedAudioMimeType,
  blobToDataUrl,
  MAX_AUDIO_DURATION_SECONDS,
  MAX_AUDIO_SIZE_BYTES,
} from '../utils/audio';
import { AudioPlayer } from './AudioPlayer';
import { ShareRoomModal } from './ShareRoomModal';
import { buildShareableRoomLink } from '../utils/url';

interface Props {
  room: ThemedRoom;
  accessKey: string;
  currentUser: AnonymousUser;
  onLeaveRoom: () => void;
  onOpenRoomQR: () => void;
  onRegenerateUser: () => void;
}

const QUICK_REACTIONS = ['❤️', '🔥', '🤫', '⚡', '👏', '👀'];

export const ChatRoomView: React.FC<Props> = ({
  room,
  accessKey,
  currentUser,
  onLeaveRoom,
  onOpenRoomQR,
  onRegenerateUser,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<AnonymousUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);

  // Room type details (Strictly single chat for all rooms)
  const isDuo = room.roomType?.startsWith('duo_') || room.maxParticipants === 2;
  const isPermanent = !!room.isPermanent || room.roomType === 'group_perm' || room.roomType === 'duo_perm' || room.durationMinutes === 0 || !!room.isOpenRoom;
  const maxCapacity = isDuo ? 2 : (room.maxParticipants || 10);
  const isOpenRoom = !!room.isOpenRoom;

  // File attachment state
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<ChatAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio recording states
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [previewAudioBlob, setPreviewAudioBlob] = useState<Blob | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingDurationRef = useRef<number>(0);

  // Expiration and Timer State (Autoridade exclusiva do Servidor)
  const [expiresAt, setExpiresAt] = useState<number>(isPermanent ? 0 : (room.expiresAt || 0));
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(() => {
    if (isPermanent) return 999999;
    if (!room.expiresAt) return 0;
    return Math.max(0, Math.floor((room.expiresAt - Date.now()) / 1000));
  });
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);
  const [terminationReason, setTerminationReason] = useState<string | null>(null);
  const [creatorPasscode, setCreatorPasscode] = useState<string>(room.creatorPasscode || '');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);

  const handleCopyRoomLink = async () => {
    // Generates clean room access link - requires the passcode created for the room
    const link = `${window.location.origin}/?room=${encodeURIComponent(room.id)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedRoomLink(true);
      setTimeout(() => setCopiedRoomLink(false), 2500);
    } catch {
      prompt('Copie o link de acesso da sala:', link);
    }
  };

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  // Timer Tick Interval (Only if not permanent)
  useEffect(() => {
    if (isPermanent) return;

    const checkTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);
      if (remaining <= 0) {
        setIsSessionExpired(true);
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isPermanent]);

  // WebSocket connection lifecycle
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(
        JSON.stringify({
          type: 'join',
          roomId: room.id,
          accessKey,
          user: currentUser,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'room_state': {
            const incoming: ChatMessage[] = data.messages || [];
            setMessages((prev) => {
              const map = new Map<string, ChatMessage>();
              // Manter mensagens que já tínhamos localmente
              for (const m of prev) {
                if (m && m.id) map.set(m.id, m);
              }
              // Inserir / mesclar mensagens recebidas do servidor
              for (const m of incoming) {
                if (m && m.id) map.set(m.id, m);
              }
              // Ordenar cronologicamente por timestamp
              return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
            });
            setOnlineUsers(data.onlineUsers || []);
            if (data.room?.expiresAt) {
              setExpiresAt(data.room.expiresAt);
            }
            if (data.room?.creatorPasscode) {
              setCreatorPasscode(data.room.creatorPasscode);
            }
            break;
          }
          case 'new_message': {
            const incomingMsg: ChatMessage = data.message;
            if (!incomingMsg || !incomingMsg.id) break;
            setMessages((prev) => {
              if (prev.some((m) => m.id === incomingMsg.id)) {
                return prev;
              }
              return [...prev, incomingMsg];
            });
            if (incomingMsg.sender.id !== currentUser.id) {
              sounds.playMessageReceived();
            }
            break;
          }
          case 'user_joined': {
            if (data.systemMessage && data.systemMessage.id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.systemMessage.id)) {
                  return prev;
                }
                return [...prev, data.systemMessage];
              });
            }
            if (data.onlineUsers) {
              setOnlineUsers(data.onlineUsers);
            }
            break;
          }
          case 'user_left': {
            if (data.systemMessage && data.systemMessage.id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.systemMessage.id)) {
                  return prev;
                }
                return [...prev, data.systemMessage];
              });
            }
            if (data.onlineUsers) {
              setOnlineUsers(data.onlineUsers);
            }
            break;
          }
          case 'room_expired': {
            setIsSessionExpired(true);
            setMessages([]);
            sounds.playError();
            break;
          }
          case 'room_deleted': {
            setIsSessionExpired(true);
            setMessages([]);
            setTerminationReason(data.reason || 'Esta sala e link de acesso foram excluídos pelo dono do painel com código de segurança.');
            sounds.playError();
            break;
          }
          case 'reaction_update': {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === data.messageId
                  ? { ...msg, reactions: data.reactions }
                  : msg
              )
            );
            break;
          }
          case 'typing_update': {
            if (data.userId !== currentUser.id) {
              setTypingUsers((prev) => {
                if (data.isTyping) {
                  return Array.from(new Set([...prev, data.userName]));
                } else {
                  return prev.filter((name) => name !== data.userName);
                }
              });
            }
            break;
          }
          case 'error': {
            alert(data.message || 'Erro de comunicação na sala');
            if (data.message?.includes('expirou') || data.message?.includes('lotada')) {
              onLeaveRoom();
            }
            break;
          }
        }
      } catch (e) {
        console.error('Error handling WS message:', e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave' }));
      }
      ws.close();
    };
  }, [room.id, accessKey, currentUser]);

  // Typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          isTyping: true,
          channelId: 'chat_1',
        })
      );

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'typing',
              isTyping: false,
              channelId: 'chat_1',
            })
          );
        }
      }, 1500);
    }
  };

  // Cleanup helper for audio tracks & timers
  const cleanupAudioStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Cleanup on unmount or URL change
  useEffect(() => {
    return () => {
      cleanupAudioStream();
      if (previewAudioUrl) {
        try {
          URL.revokeObjectURL(previewAudioUrl);
        } catch {}
      }
    };
  }, [previewAudioUrl]);

  // Start recording audio
  const startAudioRecording = async () => {
    if (isSessionExpired) return;
    setAudioError(null);

    // Verify browser support
    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof window.MediaRecorder === 'undefined'
    ) {
      setAudioError('Seu navegador não suporta gravação de áudio nativa.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingDurationRef.current = 0;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        cleanupAudioStream();
        if (audioChunksRef.current.length > 0) {
          const finalBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || mimeType || 'audio/webm',
          });
          const objectUrl = URL.createObjectURL(finalBlob);
          setPreviewAudioBlob(finalBlob);
          setPreviewAudioUrl(objectUrl);
          setPreviewDuration(recordingDurationRef.current || 1);
          setRecordingState('preview');
        } else {
          setRecordingState('idle');
          setRecordingDuration(0);
        }
      };

      recorder.onerror = (err) => {
        console.error('[Audio Recording] Erro no MediaRecorder:', err);
        cleanupAudioStream();
        setRecordingState('idle');
        setAudioError('Ocorreu um erro durante a gravação de áudio.');
      };

      // Start recording with timeslice of 250ms
      recorder.start(250);
      setRecordingState('recording');
      setRecordingDuration(0);

      // Start recording duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          recordingDurationRef.current = next;
          if (next >= MAX_AUDIO_DURATION_SECONDS) {
            // Auto stop at max duration limit (60s)
            stopAudioRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err: any) {
      console.warn('[Audio Recording] Permissão ou acesso recusado:', err);
      cleanupAudioStream();
      setRecordingState('idle');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setAudioError('Permissão do microfone negada. Permita o microfone no navegador para gravar áudios.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setAudioError('Nenhum microfone foi detectado neste dispositivo.');
      } else {
        setAudioError('Não foi possível iniciar a gravação de áudio.');
      }
    }
  };

  // Stop recording and go to preview
  const stopAudioRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (err) {
        console.error('[Audio Recording] Erro ao parar gravador:', err);
        cleanupAudioStream();
        setRecordingState('idle');
      }
    } else {
      cleanupAudioStream();
      setRecordingState('idle');
    }
  };

  // Cancel recording and discard stream
  const cancelAudioRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null; // Ignore onstop to avoid generating preview
      try {
        recorder.stop();
      } catch {}
    }
    cleanupAudioStream();
    audioChunksRef.current = [];
    recordingDurationRef.current = 0;
    setRecordingState('idle');
    setRecordingDuration(0);
    setAudioError(null);
  };

  // Discard preview and return to idle
  const discardAudioPreview = () => {
    if (previewAudioUrl) {
      try {
        URL.revokeObjectURL(previewAudioUrl);
      } catch {}
    }
    setPreviewAudioBlob(null);
    setPreviewAudioUrl(null);
    setPreviewDuration(0);
    setRecordingState('idle');
    setRecordingDuration(0);
    setAudioError(null);
  };

  // Send recorded audio via WebSocket
  const sendAudioMessage = async () => {
    if (isSessionExpired || !previewAudioBlob) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setAudioError('Conexão perdida. Aguarde reconectar para enviar o áudio.');
      return;
    }

    try {
      const dataUrl = await blobToDataUrl(previewAudioBlob);
      // Validar tamanho máximo (~500 KB)
      if (dataUrl.length > 700000) {
        setAudioError('Áudio gravado excede o limite máximo permitido de 500 KB.');
        return;
      }

      const dur = Math.max(1, previewDuration);
      const minutes = Math.floor(dur / 60);
      const seconds = Math.floor(dur % 60);
      const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      wsRef.current.send(
        JSON.stringify({
          type: 'message',
          messageType: 'audio',
          audioUrl: dataUrl,
          audioDuration: dur,
          content: `Mensagem de áudio (${formattedDuration})`,
          channelId: 'chat_1',
        })
      );

      sounds.playMessageSent();
      discardAudioPreview();
    } catch (err: any) {
      console.error('[sendAudioMessage] Erro ao preparar áudio:', err);
      setAudioError('Falha ao processar arquivo de áudio para envio.');
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSessionExpired) return;

    const content = inputText.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        type: 'message',
        content,
        channelId: 'chat_1',
      })
    );

    sounds.playMessageSent();
    setInputText('');

    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          isTyping: false,
          channelId: 'chat_1',
        })
      );
    }
  };

  // Upload file (Photo or Video)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so user can re-upload if needed
    e.target.value = '';

    if (isOpenRoom) {
      alert('O envio de fotos e vídeos não é permitido no grupo aberto (apenas texto).');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      alert('O arquivo selecionado é muito grande. O limite máximo é de 30MB.');
      return;
    }

    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');

    if (!isImg && !isVid) {
      alert('Selecione apenas arquivos de imagem (fotos) ou vídeo.');
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const res = await fetch(`/api/rooms/${encodeURIComponent(room.id)}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataBase64: base64Data,
          fileData: base64Data,
          fileName: file.name,
          fileType: file.type,
          mimeType: file.type,
          accessKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.attachment) {
        throw new Error(data.error || 'Falha ao enviar arquivo.');
      }

      // Send WebSocket message containing attachment
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'message',
            content: inputText.trim(),
            attachment: data.attachment,
            channelId: 'chat_1',
          })
        );
        sounds.playMessageSent();
        setInputText('');
      } else {
        alert('Conexão instável. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      alert(err.message || 'Erro ao enviar mídia.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendReaction = (messageId: string, emoji: string) => {
    if (isSessionExpired) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'reaction',
          messageId,
          emoji,
        })
      );
    }
    setShowEmojiPickerFor(null);
  };

  // Format time left
  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    if (hours > 0) {
      return `${hours}h ${pad(mins)}m ${pad(secs)}s`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  return (
    <div
      id="chat-room-container"
      className="relative flex h-[100dvh] w-full flex-col bg-slate-950 text-slate-100 overflow-hidden"
    >
      {/* Session Expired / Terminated Overlay */}
      {isSessionExpired && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="max-w-md w-full rounded-3xl border border-rose-500/40 bg-slate-900/95 p-6 text-center space-y-4 shadow-2xl shadow-rose-950/40">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
              <ShieldAlert className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Sessão Encerrada</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {terminationReason || 'O tempo contratado para esta sala expirou e o canal foi fechado com segurança.'}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onLeaveRoom}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors border border-slate-700"
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-2 sm:px-4 backdrop-blur-md gap-1 sm:gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            id="back-to-lobby-btn"
            onClick={onLeaveRoom}
            className="flex h-10 w-10 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Sair da sala"
            aria-label="Sair da sala"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-inner font-bold text-xs sm:text-sm"
            style={{ backgroundColor: room.color || '#10b981' }}
          >
            {isDuo ? '2P' : <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[90px] xs:max-w-[130px] sm:max-w-xs">
                {room.name}
              </h2>
              {isOpenRoom ? (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
                  Grupo Aberto
                </span>
              ) : isDuo ? (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                  Sala Dupla (2P)
                </span>
              ) : (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 shrink-0">
                  Grupo (Até 10)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full shrink-0 ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <span>{onlineUsers.length}</span>
                <span className="hidden sm:inline">online (máx {maxCapacity})</span>
              </span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline truncate">{room.category}</span>
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Timer Display */}
          {isOpenRoom || isPermanent ? (
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-emerald-300 text-xs font-bold font-mono min-h-[38px]">
              <Shield className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="hidden xs:inline">Permanente</span>
              <span className="xs:hidden">Perm</span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-bold min-h-[38px] shrink-0 ${
                timeLeftSeconds < 300
                  ? 'border-rose-500/40 bg-rose-950/40 text-rose-300 animate-pulse'
                  : 'border-amber-500/30 bg-amber-950/30 text-amber-300'
              }`}
              title="Tempo restante desta sessão"
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{formatTimer(timeLeftSeconds)}</span>
            </div>
          )}

          {/* Direct Copy Room Link Button */}
          {!isOpenRoom && (
            <button
              type="button"
              id="copy-room-link-btn"
              onClick={handleCopyRoomLink}
              className="flex h-10 w-10 sm:h-auto sm:px-3 sm:py-1.5 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0 min-h-[38px] min-w-[38px]"
              title="Copiar link de acesso para convidados entrarem com a senha"
              aria-label="Copiar link de acesso da sala"
            >
              {copiedRoomLink ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Copiar Link</span>
                </>
              )}
            </button>
          )}

          {/* Participants Toggle */}
          <button
            type="button"
            onClick={() => setShowUsersPanel(!showUsersPanel)}
            className={`flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer shrink-0 min-h-[38px] min-w-[38px] ${
              showUsersPanel
                ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300'
                : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Ver participantes online"
            aria-label="Ver participantes online"
          >
            <Users className="h-4 w-4" />
          </button>

          {/* Leave Button */}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/50 text-rose-300 transition-colors cursor-pointer shrink-0 min-h-[38px] min-w-[38px]"
            title="Sair do bate-papo"
            aria-label="Sair do bate-papo"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Chat Stream */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto px-4 py-6 space-y-4">
          {/* Room Security & Info Banner */}
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-center space-y-2">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Shield className="h-4 w-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-white">
              {isOpenRoom
                ? 'Grupo Aberto Oficial • Livre e Sem Expiração'
                : isDuo
                ? 'Sala Dupla Privativa (2 Participantes)'
                : `Bate-Papo Privado em Grupo (Até ${maxCapacity} Pessoas)`}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Você está conectado anonimamente como <span className="font-semibold text-emerald-400">{currentUser.name}</span>.
              {isOpenRoom ? (
                <span className="block mt-1 text-slate-400 text-[11px]">
                  No grupo aberto, é permitido apenas o envio de mensagens de texto.
                </span>
              ) : (
                <span className="block mt-1 text-emerald-300 text-[11px]">
                  Envio de fotos e vídeos liberado com criptografia e privacidade.
                </span>
              )}
            </p>
          </div>

          {/* Messages list */}
          {messages.map((msg) => {
            const isMe = msg.sender.id === currentUser.id;
            const isSystem = msg.type === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-400 font-mono">
                    <Info className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span>{msg.content}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`group flex items-start gap-2.5 ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-bold text-xs shadow-md border border-white/10"
                  style={{ backgroundColor: msg.sender.avatarColor || '#6366f1' }}
                  title={msg.sender.name}
                >
                  {msg.sender.name.charAt(0).toUpperCase()}
                </div>

                <div
                  className={`relative max-w-[85%] sm:max-w-md rounded-2xl px-4 py-2.5 shadow-sm transition-all ${
                    isMe
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-slate-800/90 border border-slate-700/60 text-slate-100 rounded-tl-none'
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 mb-1 text-[11px] ${
                      isMe ? 'text-emerald-100 justify-end' : 'text-slate-400'
                    }`}
                  >
                    <span className="font-semibold">{isMe ? 'Você' : msg.sender.name}</span>
                    <span className="text-[10px] opacity-75">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Attachment Media Rendering (Photos & Videos) */}
                  {msg.attachment && (
                    <div className="my-2 overflow-hidden rounded-xl bg-black/25">
                      {msg.attachment.type === 'image' ? (
                        <div
                          className="relative group/img cursor-pointer"
                          onClick={() => setLightboxMedia(msg.attachment!)}
                        >
                          <img
                            src={msg.attachment.url}
                            alt={msg.attachment.name || 'Foto compartilhada'}
                            referrerPolicy="no-referrer"
                            className="max-h-72 max-w-full rounded-xl object-cover hover:opacity-95 transition-all"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 flex items-center justify-center transition-all opacity-0 group-hover/img:opacity-100">
                            <span className="px-3 py-1 rounded-full bg-slate-900/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                              <Maximize2 className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Ampliar</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 p-1">
                          <video
                            src={msg.attachment.url}
                            controls
                            preload="metadata"
                            className="max-h-80 w-full rounded-xl bg-black shadow-inner"
                          />
                          <div className="flex items-center justify-between px-1.5 text-[11px] text-slate-300">
                            <span className="truncate max-w-[180px]">{msg.attachment.name}</span>
                            <a
                              href={msg.attachment.url}
                              download={msg.attachment.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:underline text-[10px] font-semibold"
                            >
                              Baixar
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audio Message Rendering */}
                  {msg.audioUrl && (
                    <div className="my-1.5 min-w-[220px] sm:min-w-[260px]">
                      <AudioPlayer
                        src={msg.audioUrl}
                        duration={msg.audioDuration}
                        isMe={isMe}
                      />
                    </div>
                  )}

                  {/* Message Text Content */}
                  {msg.content && msg.type !== 'audio' && (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed font-sans">
                      {msg.content}
                    </p>
                  )}

                  {/* Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-1 border-t border-white/10">
                      {Object.entries(msg.reactions).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => handleSendReaction(msg.id, emoji)}
                          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-transform active:scale-95 ${
                            isMe
                              ? 'bg-emerald-700/60 text-white'
                              : 'bg-slate-700/70 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] font-bold">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Reaction Toolbar */}
                  <div
                    className={`absolute -top-3 ${
                      isMe ? 'left-2' : 'right-2'
                    } hidden group-hover:flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-full px-2 py-0.5 shadow-lg z-10`}
                  >
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleSendReaction(msg.id, emoji)}
                        className="hover:scale-125 transition-transform text-xs p-0.5"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Sidebar: Online Participants */}
        {showUsersPanel && (
          <aside className="absolute inset-y-0 right-0 z-30 w-72 max-w-[85vw] sm:static sm:w-64 border-l border-slate-800 bg-slate-900/98 sm:bg-slate-900/95 p-4 flex flex-col shrink-0 shadow-2xl sm:shadow-none backdrop-blur-md animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                Participantes ({onlineUsers.length} / {maxCapacity})
              </h4>
              <button
                type="button"
                onClick={() => setShowUsersPanel(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white sm:hidden cursor-pointer"
                aria-label="Fechar lista de participantes"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {onlineUsers.map((u) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${
                    u.id === currentUser.id
                      ? 'border-emerald-500/40 bg-emerald-950/20'
                      : 'border-slate-800/80 bg-slate-800/40'
                  }`}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-bold shadow-inner"
                    style={{ backgroundColor: u.avatarColor || '#06b6d4' }}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {u.name} {u.id === currentUser.id && '(Você)'}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-mono">Presente</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" />
                Convidar Amigo (Link/Código)
              </button>
              <button
                id="change-identity-in-chat-btn"
                onClick={onRegenerateUser}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-amber-400" />
                Trocar Pseudônimo
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="px-5 py-1 text-[11px] text-slate-400 italic flex items-center gap-2 bg-slate-950/60">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce delay-100" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce delay-200" />
          </div>
          <span>
            {typingUsers.join(', ')}{' '}
            {typingUsers.length > 1 ? 'estão digitando...' : 'está digitando...'}
          </span>
        </div>
      )}

      {/* Uploading progress notification */}
      {isUploading && (
        <div className="px-5 py-1.5 text-xs text-emerald-300 bg-emerald-950/80 border-t border-emerald-500/30 flex items-center gap-2 animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
          <span>Enviando foto/vídeo para o chat...</span>
        </div>
      )}

      {/* Message Composer Footer */}
      <footer className="shrink-0 border-t border-slate-800 bg-slate-900/90 p-2.5 sm:p-4 backdrop-blur-md">
        {/* Audio Recording Error Toast */}
        {audioError && (
          <div className="mx-auto max-w-4xl mb-2 px-3.5 py-2 text-xs text-rose-300 bg-rose-950/80 border border-rose-500/40 rounded-xl flex items-center justify-between gap-2 shadow-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{audioError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAudioError(null)}
              className="text-rose-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* MODE 1: RECORDING IN PROGRESS */}
        {recordingState === 'recording' && (
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 p-2 sm:p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 shadow-inner">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500" />
              </span>
              <span className="font-bold text-xs text-rose-200 uppercase tracking-wider hidden sm:inline">
                Gravando Áudio
              </span>
              <span className="font-mono font-bold text-sm text-white">
                {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </span>
              <span className="text-[10px] text-slate-400">/ 01:00</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={cancelAudioRecording}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                title="Cancelar gravação"
              >
                <Trash2 className="h-4 w-4 text-rose-400" />
                <span>Cancelar</span>
              </button>

              <button
                type="button"
                onClick={stopAudioRecording}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                title="Concluir gravação"
              >
                <Check className="h-4 w-4" />
                <span>Concluir</span>
              </button>
            </div>
          </div>
        )}

        {/* MODE 2: AUDIO PREVIEW (BEFORE SENDING) */}
        {recordingState === 'preview' && previewAudioUrl && (
          <div className="mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-slate-800/90 border border-slate-700 shadow-xl">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5" />
                <span>Prévia do áudio gravado — ouça antes de enviar:</span>
              </div>
              <AudioPlayer src={previewAudioUrl} duration={previewDuration} isMe={false} />
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0 pt-1 sm:pt-0">
              <button
                type="button"
                onClick={discardAudioPreview}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                title="Descartar áudio"
              >
                <Trash2 className="h-4 w-4 text-rose-400" />
                <span>Descartar</span>
              </button>

              <button
                type="button"
                onClick={sendAudioMessage}
                disabled={isSessionExpired}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/60 disabled:opacity-40 cursor-pointer"
                title="Enviar áudio para o chat"
              >
                <Send className="h-4 w-4" />
                <span>Enviar Áudio</span>
              </button>
            </div>
          </div>
        )}

        {/* MODE 3: STANDARD MESSAGE COMPOSER */}
        {recordingState === 'idle' && (
          <form onSubmit={handleSendMessage} className="mx-auto flex max-w-4xl items-center gap-1.5 sm:gap-2">
            {/* Quick emoji button */}
            <div className="relative">
              <button
                type="button"
                id="chat-quick-emoji-btn"
                disabled={isSessionExpired}
                onClick={() => setShowEmojiPickerFor(showEmojiPickerFor ? null : 'input')}
                className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-400 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
                title="Inserir reação"
                aria-label="Inserir reação"
              >
                <Smile className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>

              {showEmojiPickerFor === 'input' && (
                <div className="absolute bottom-14 left-0 flex items-center gap-1 p-2 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl z-20">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setInputText((prev) => prev + emoji);
                        setShowEmojiPickerFor(null);
                      }}
                      className="h-9 w-9 flex items-center justify-center hover:scale-125 transition-transform text-lg cursor-pointer rounded-lg hover:bg-slate-700/60"
                      aria-label={`Emoji ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Attachment upload button (Available in all rooms EXCEPT Open Group) */}
            {!isOpenRoom && (
              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileSelected}
                  disabled={isSessionExpired || isUploading}
                />
                <button
                  type="button"
                  id="chat-upload-media-btn"
                  disabled={isSessionExpired || isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-400 hover:text-emerald-400 hover:border-slate-600 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                  title="Enviar foto ou vídeo"
                  aria-label="Enviar foto ou vídeo"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}

            {/* Microphone Button (Audio Recording) */}
            <button
              type="button"
              id="chat-mic-record-btn"
              disabled={isSessionExpired || isUploading}
              onClick={startAudioRecording}
              className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
              title="Gravar mensagem de áudio"
              aria-label="Gravar mensagem de áudio"
            >
              <Mic className="h-4 w-4 text-emerald-400" />
            </button>

            <input
              id="chat-message-input"
              type="text"
              disabled={isSessionExpired}
              placeholder={
                isSessionExpired
                  ? 'Tempo esgotado. Esta sessão foi encerrada.'
                  : isOpenRoom
                  ? `Conversar anonimamente no Grupo Aberto...`
                  : `Mensagem ou legenda para fotos/vídeos...`
              }
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 sm:px-4 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-40 min-h-[44px] min-w-0"
            />

            <button
              id="send-message-btn"
              type="submit"
              disabled={!inputText.trim() || isSessionExpired || isUploading}
              className="flex h-11 w-11 sm:w-auto sm:px-4 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-md shadow-emerald-950/60 disabled:opacity-40 disabled:hover:bg-emerald-600 cursor-pointer shrink-0 min-h-[44px] min-w-[44px]"
              aria-label="Enviar mensagem"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        )}
      </footer>

      {/* Share Room Modal */}
      <ShareRoomModal
        isOpen={isShareModalOpen}
        room={room}
        creatorPasscode={creatorPasscode}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Fullscreen Lightbox Preview for Photos & Videos */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setLightboxMedia(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxMedia(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            {lightboxMedia.type === 'image' ? (
              <img
                src={lightboxMedia.url}
                alt={lightboxMedia.name}
                className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
            ) : (
              <video
                src={lightboxMedia.url}
                controls
                autoPlay
                className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl bg-black"
              />
            )}

            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-300 px-2">
              <span className="truncate max-w-xs">{lightboxMedia.name}</span>
              <a
                href={lightboxMedia.url}
                download={lightboxMedia.name}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Baixar Arquivo</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

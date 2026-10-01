import React, { useEffect, useState, useMemo } from 'react';
import { Header } from './components/Header';
import { LobbyView } from './components/LobbyView';
import { ChatRoomView } from './components/ChatRoomView';
import { QRScannerModal } from './components/QRScannerModal';
import { QRCodeDisplayModal } from './components/QRCodeDisplayModal';
import { CreateRoomModal } from './components/CreateRoomModal';
import { OwnerAdminModal } from './components/OwnerAdminModal';
import { ShareRoomModal } from './components/ShareRoomModal';
import { PasscodePromptModal } from './components/PasscodePromptModal';
import { RestrictedRoomNoticeModal } from './components/RestrictedRoomNoticeModal';
import { BuyRoomModal } from './components/BuyRoomModal';
import { AuthModal } from './components/AuthModal';
import { CompraSalaModal } from './components/CompraSalaModal';
import { MinhasComprasModal } from './components/MinhasComprasModal';
import { MinhasConversasModal } from './components/MinhasConversasModal';
import { ConfirmarEmailPage } from './components/ConfirmarEmailPage';
import { Footer } from './components/Footer';
import { InstitutionalPage } from './components/InstitutionalPage';
import { PrivateChatView } from './components/PrivateChatView';
import { ConfessionsSection } from './components/confessions/ConfessionsSection';
import { ConfessionsPage } from './components/confessions/ConfessionsPage';
import { ConfessionCreateModal } from './components/confessions/ConfessionCreateModal';
import { ConfessionDetailModal } from './components/confessions/ConfessionDetailModal';
import { TruthOrDareGameModal } from './components/truthOrDare/TruthOrDareGameModal';
import { FindTheImpostorGameModal } from './components/findTheImpostor/FindTheImpostorGameModal';
import { usePrivateConversations } from './hooks/usePrivateConversations';
import { AnonymousUser, ThemedRoom, SalaProduto, CompraOrdem, buildPrivateConversationId } from './types';
import { createFreshAnonymousUser, getOrCreateAnonymousUser } from './utils/anonymous';
import { sounds } from './utils/audio';
import { Loader2, AlertCircle, Smartphone, X, KeyRound, Sparkles } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { supabase, getSalas, DEFAULT_SALAS_PRODUTOS, UserSearchResult } from './lib/supabase';

const DEFAULT_OPEN_ROOMS: ThemedRoom[] = [
  {
    id: 'sala-aberta-1',
    name: 'Lounge Principal (Bate-Papo Aberto)',
    description: 'Espaço comunitário aberto para todos conversarem livremente sobre qualquer assunto de forma anônima.',
    category: 'Bate-Papo Livre',
    icon: 'Sparkles',
    color: '#06b6d4',
    accessKey: 'open_key_1',
    createdAt: 1789692712500,
    durationMinutes: 0,
    expiresAt: 0,
    isPermanent: true,
    isOpenRoom: true,
    maxParticipants: 100,
    hasPasscode: false,
    isCustom: false,
    onlineCount: 0,
  },
  {
    id: 'sala-aberta-2',
    name: 'Desabafos & Histórias Anônimas',
    description: 'Espaço acolhedor para compartilhar relatos, pedir conselhos e desabafar sem julgamentos.',
    category: 'Apoio & Emoção',
    icon: 'Lock',
    color: '#ec4899',
    accessKey: 'open_key_2',
    createdAt: 1789692712500,
    durationMinutes: 0,
    expiresAt: 0,
    isPermanent: true,
    isOpenRoom: true,
    maxParticipants: 100,
    hasPasscode: false,
    isCustom: false,
    onlineCount: 0,
  },
  {
    id: 'sala-aberta-3',
    name: 'Mundo Tech, IA & Curiosidades',
    description: 'Conversas e novidades sobre tecnologia, inteligência artificial, internet, jogos e futuro.',
    category: 'Tecnologia',
    icon: 'Terminal',
    color: '#10b981',
    accessKey: 'open_key_3',
    createdAt: 1789692712501,
    durationMinutes: 0,
    expiresAt: 0,
    isPermanent: true,
    isOpenRoom: true,
    maxParticipants: 100,
    hasPasscode: false,
    isCustom: false,
    onlineCount: 0,
  },
];

export default function App() {
  const { user, session, displayName, userNick, avatarUrl } = useAuth();
  const [currentUser, setCurrentUser] = useState<AnonymousUser>(getOrCreateAnonymousUser());
  const [rooms, setRooms] = useState<ThemedRoom[]>(DEFAULT_OPEN_ROOMS);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Active Session State
  const [activeRoom, setActiveRoom] = useState<ThemedRoom | null>(null);
  const [activeAccessKey, setActiveAccessKey] = useState<string | null>(null);

  // Active Private Chat 1x1 State (com suporte a F5/reconexão via sessionStorage)
  const [activePrivateChat, setActivePrivateChat] = useState<UserSearchResult | null>(() => {
    try {
      const saved = sessionStorage.getItem('anonqr_active_dm');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.id && parsed?.nick) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  // Identidade exclusiva para o chat privado vinculada estritamente ao login real (Supabase)
  const privateChatUser = useMemo<AnonymousUser | null>(() => {
    if (!user?.id) return null;
    return {
      id: user.id,
      name: displayName || currentUser.name,
      nick: userNick || (currentUser as any)?.nick,
      avatarUrl: avatarUrl || (currentUser as any)?.avatarUrl,
      avatarColor: currentUser.avatarColor,
      avatarIcon: currentUser.avatarIcon,
    };
  }, [user?.id, displayName, userNick, avatarUrl, currentUser]);

  // Hook isolado para gerenciamento em tempo real de "Minhas conversas" (somente conecta se user?.id existir)
  const {
    conversations: privateConversationsList,
    totalUnread: totalPrivateUnread,
    markAsRead: markPrivateConversationAsRead,
    fetchConversations: refreshPrivateConversations,
  } = usePrivateConversations(privateChatUser);

  const [isMinhasConversasOpen, setIsMinhasConversasOpen] = useState(false);
  const [isTruthOrDareOpen, setIsTruthOrDareOpen] = useState(false);
  const [truthOrDareRoomId, setTruthOrDareRoomId] = useState<string | undefined>(undefined);
  const [isFindTheImpostorOpen, setIsFindTheImpostorOpen] = useState(false);
  const [findTheImpostorRoomId, setFindTheImpostorRoomId] = useState<string | undefined>(undefined);

  // Checar se há convite direto de jogos na URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const todRoom = params.get('tod_room') || params.get('todRoom');
      if (todRoom) {
        setTruthOrDareRoomId(todRoom);
        setIsTruthOrDareOpen(true);
      }
      const impRoom = params.get('imp_room') || params.get('impRoom');
      if (impRoom) {
        setFindTheImpostorRoomId(impRoom);
        setIsFindTheImpostorOpen(true);
      }
    } catch {}
  }, []);

  // Fecha o modal de conversas privadas e encerra chat privado se o usuário deslogar
  useEffect(() => {
    if (!user?.id) {
      setIsMinhasConversasOpen(false);
      setActivePrivateChat(null);
      try {
        sessionStorage.removeItem('anonqr_active_dm');
      } catch {}
    }
  }, [user?.id]);

  const handleStartPrivateChat = (targetUser: UserSearchResult) => {
    if (!user?.id) {
      setIsAuthModalOpen(true);
      return;
    }
    // Se estava em sala pública, sai antes de abrir conversa privada
    if (activeRoom) {
      setActiveRoom(null);
      setActiveAccessKey(null);
    }
    const myId = user.id;
    const convId = buildPrivateConversationId(myId, targetUser.id);
    markPrivateConversationAsRead(convId);
    setActivePrivateChat(targetUser);
    try {
      sessionStorage.setItem('anonqr_active_dm', JSON.stringify(targetUser));
    } catch {}
  };

  const handleClosePrivateChat = () => {
    setActivePrivateChat(null);
    try {
      sessionStorage.removeItem('anonqr_active_dm');
    } catch {}
  };

  // Simple Path-based Navigation for /confirmar-email and Institutional Pages
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const INSTITUTIONAL_PATHS = [
    '/quem-somos',
    '/como-funciona',
    '/termos',
    '/privacidade',
    '/regras',
    '/suporte',
    '/denunciar',
  ];

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [isRestrictedNoticeOpen, setIsRestrictedNoticeOpen] = useState(false);
  const [isBuyRoomOpen, setIsBuyRoomOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Mural das Confissões States
  const [isConfessionCreateOpen, setIsConfessionCreateOpen] = useState(false);
  const [selectedConfessionDetailId, setSelectedConfessionDetailId] = useState<string | null>(null);
  const [confessionsRefreshKey, setConfessionsRefreshKey] = useState(0);

  // Salas como Produtos Individuais (Supabase)
  const [salasProdutos, setSalasProdutos] = useState<SalaProduto[]>(DEFAULT_SALAS_PRODUTOS);
  const [selectedSalaParaComprar, setSelectedSalaParaComprar] = useState<SalaProduto | null>(null);
  const [isCompraSalaModalOpen, setIsCompraSalaModalOpen] = useState(false);
  const [isMinhasComprasOpen, setIsMinhasComprasOpen] = useState(false);
  const [pendingSalaToBuyAfterAuth, setPendingSalaToBuyAfterAuth] = useState<SalaProduto | null>(null);

  // Synchronize authenticated Supabase user with current user profile
  useEffect(() => {
    if (user && displayName) {
      setCurrentUser((prev) => ({
        ...prev,
        name: displayName,
      }));
    }
  }, [user, displayName]);

  // Se o usuário clicou em comprar uma sala sem estar autenticado,
  // após concluir login/cadastro abrimos automaticamente a sala que ele tentava comprar.
  useEffect(() => {
    if (user && pendingSalaToBuyAfterAuth) {
      setSelectedSalaParaComprar(pendingSalaToBuyAfterAuth);
      setIsCompraSalaModalOpen(true);
      setPendingSalaToBuyAfterAuth(null);
    }
  }, [user, pendingSalaToBuyAfterAuth]);

  // Carregar produtos/salas do Supabase
  const fetchSalasProdutos = async () => {
    try {
      const data = await getSalas();
      if (Array.isArray(data) && data.length > 0) {
        const seen = new Set<string>();
        const deduped = data.filter((s) => {
          if (!s || !s.id || seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
        setSalasProdutos(deduped);
      }
    } catch (err) {
      console.warn('Usando catálogo inicial enquanto sincroniza Supabase:', err);
    }
  };

  useEffect(() => {
    fetchSalasProdutos();
    const interval = setInterval(fetchSalasProdutos, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleBuySalaClick = (sala: SalaProduto) => {
    if (!user) {
      setPendingSalaToBuyAfterAuth(sala);
      setIsAuthModalOpen(true);
      setToastMessage(`Faça login ou cadastre-se para comprar a ${sala.nome}.`);
      return;
    }
    setSelectedSalaParaComprar(sala);
    setIsCompraSalaModalOpen(true);
  };

  // Active Voucher & Passcode Flow State
  const [activeVoucherToken, setActiveVoucherToken] = useState<string | null>(null);
  const [roomForPasscode, setRoomForPasscode] = useState<string | null>(null);
  const [initialPasscodeForModal, setInitialPasscodeForModal] = useState<string>('');
  const [roomForShare, setRoomForShare] = useState<ThemedRoom | null>(null);
  const [latestCreatedPasscode, setLatestCreatedPasscode] = useState<string>('');

  // Mobile / URL Auto-Join State
  const [isJoiningFromUrl, setIsJoiningFromUrl] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch active rooms from server
  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setRooms(data);
        }
      }
    } catch (err) {
      console.warn('Sincronização temporária de salas com o servidor:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 6000);
    return () => clearInterval(interval);
  }, []);

  // Parse URL query parameters, pathnames, and hashes (Vouchers or Room links for Android and iOS)
  useEffect(() => {
    try {
      // 1. Check search params
      const searchParams = new URLSearchParams(window.location.search);
      let voucherParam = searchParams.get('voucher') || searchParams.get('token');
      let roomParam = searchParams.get('room') || searchParams.get('roomId');
      let keyParam = searchParams.get('key') || searchParams.get('accessKey');
      let passcodeParam = searchParams.get('passcode') || searchParams.get('code') || searchParams.get('senha');
      const buyParam = searchParams.get('buy') || searchParams.get('pix') || searchParams.get('comprar');

      // 2. Check path segments (/voucher/TOKEN or /room/ID)
      const pathname = window.location.pathname.replace(/\/+$/, '');
      const pathParts = pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        if (pathParts[0] === 'voucher') {
          voucherParam = voucherParam || decodeURIComponent(pathParts[1]);
        } else if (pathParts[0] === 'room') {
          roomParam = roomParam || decodeURIComponent(pathParts[1]);
        }
      }

      // 3. Check hash (#/voucher/TOKEN or #voucher=TOKEN or #/room/ID or #room=ID)
      if (window.location.hash) {
        const hashClean = window.location.hash.replace(/^#\/?/, '');
        if (hashClean.includes('=')) {
          const hashParams = new URLSearchParams(hashClean.startsWith('?') ? hashClean : '?' + hashClean);
          voucherParam = voucherParam || hashParams.get('voucher') || hashParams.get('token');
          roomParam = roomParam || hashParams.get('room') || hashParams.get('roomId');
          keyParam = keyParam || hashParams.get('key') || hashParams.get('accessKey');
          passcodeParam = passcodeParam || hashParams.get('passcode') || hashParams.get('code') || hashParams.get('senha');
        } else {
          const hashParts = hashClean.split('/').filter(Boolean);
          if (hashParts[0] === 'voucher' && hashParts[1]) {
            voucherParam = voucherParam || decodeURIComponent(hashParts[1]);
          } else if (hashParts[0] === 'room' && hashParts[1]) {
            roomParam = roomParam || decodeURIComponent(hashParts[1]);
          }
        }
      }

      if (buyParam === 'true' || buyParam === '1') {
        setIsBuyRoomOpen(true);
      }

      // Handle Room Link
      if (roomParam) {
        const targetRoom = roomParam.trim();
        setIsJoiningFromUrl(true);
        setJoinError(null);
        if (passcodeParam) {
          setInitialPasscodeForModal(passcodeParam.trim());
        }

        supabase.auth.getSession().then(({ data: sessionData }) => {
          const accessToken = sessionData?.session?.access_token;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
          }

          return fetch('/api/rooms/join-verify', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              roomId: targetRoom,
              accessKey: keyParam?.trim() || undefined,
              passcode: passcodeParam?.trim() || undefined,
              accessToken,
            }),
          });
        })
          .then(async (res) => {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              return res.json();
            }
            return { error: 'Servidor indisponível no momento.' };
          })
          .then((data) => {
            if (data.valid && data.room && data.accessKey) {
              sounds.playScanSuccess();
              setActiveRoom(data.room);
              setActiveAccessKey(data.accessKey);
            } else if (data.requiresPasscode) {
              setRoomForPasscode(targetRoom);
            } else {
              setJoinError(data.error || 'Código ou chave de sala inválida/expirada.');
              sounds.playError();
            }
          })
          .catch(() => {
            setJoinError('Não foi possível autenticar a sala no servidor.');
            sounds.playError();
          })
          .finally(() => {
            setIsJoiningFromUrl(false);
            window.history.replaceState({}, document.title, '/');
          });
        return;
      }

      // Handle Voucher Link (Creator activating room on mobile)
      let storedVoucher: string | null = null;
      try {
        storedVoucher = sessionStorage.getItem('anonqr_pending_voucher');
      } catch (_) {}

      const tokenToUse = (voucherParam || storedVoucher || '').trim();
      if (tokenToUse) {
        // Check if a room was already created for this voucher
        fetch(`/api/vouchers/${encodeURIComponent(tokenToUse)}`)
          .then(async (res) => {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              return res.json();
            }
            return { error: 'Voucher indisponível ou resposta inválida.' };
          })
          .then((data) => {
            if (data.existingRoom?.id) {
              // Room was already created! Origin link converts purely to access the room via passcode:
              try {
                sessionStorage.removeItem('anonqr_pending_voucher');
              } catch (_) {}
              setActiveVoucherToken(null);
              setIsCreateRoomOpen(false);
              setRoomForPasscode(data.existingRoom.id);
            } else if (!data.error && !data.isExpired) {
              try {
                sessionStorage.setItem('anonqr_pending_voucher', tokenToUse);
              } catch (_) {}
              setActiveVoucherToken(tokenToUse);
              setIsCreateRoomOpen(true);
            } else if (data.error) {
              setJoinError(data.error);
            }
          })
          .catch(() => {
            try {
              sessionStorage.setItem('anonqr_pending_voucher', tokenToUse);
            } catch (_) {}
            setActiveVoucherToken(tokenToUse);
            setIsCreateRoomOpen(true);
          })
          .finally(() => {
            window.history.replaceState({}, document.title, '/');
          });
        return;
      }
    } catch (e) {
      console.error('Error parsing URL query params:', e);
    }
  }, []);

  // Handle successful room verification (from QR or Passcode)
  const handleRoomAccessGranted = (room: ThemedRoom, accessKey: string) => {
    sounds.playScanSuccess();
    setActiveRoom(room);
    setActiveAccessKey(accessKey);
    setRoomForPasscode(null);
    setIsScannerOpen(false);
  };

  // Leave active room
  const handleLeaveRoom = () => {
    setActiveRoom(null);
    setActiveAccessKey(null);
    fetchRooms();
  };

  // Direct enter room handler (for open rooms, purchases, or direct links)
  const handleDirectEnterRoom = async (roomId: string, compraId?: string) => {
    try {
      setIsJoiningFromUrl(true);
      setJoinError(null);

      // Obter access token JWT da sessão ativa para validação de RLS no backend
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || session?.access_token;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch('/api/rooms/join-verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          roomId,
          compraId,
          userId: user?.id,
          accessToken,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setJoinError('Servidor indisponível no momento. Tente novamente.');
        return;
      }

      const data = await res.json();
      if (res.ok && data.valid && data.room && data.accessKey) {
        sounds.playScanSuccess();
        handleRoomAccessGranted(data.room, data.accessKey);
      } else if (data.requiresPasscode) {
        setRoomForPasscode(roomId);
      } else {
        setJoinError(data.error || 'Não foi possível entrar na sala.');
        sounds.playError();
      }
    } catch (err) {
      setJoinError('Erro de conexão ao acessar a sala.');
      sounds.playError();
    } finally {
      setIsJoiningFromUrl(false);
    }
  };

  // Regenerate identity
  const handleRegenerateIdentity = () => {
    const fresh = createFreshAnonymousUser();
    setCurrentUser(fresh);
  };

  // When room is created by host (from voucher or regular)
  const handleRoomCreated = (newRoom: ThemedRoom, shareUrl: string, creatorPasscode: string) => {
    setRooms((prev) => [newRoom, ...prev]);
    setActiveVoucherToken(null);
    try {
      sessionStorage.removeItem('anonqr_pending_voucher');
    } catch (_) {}
    setLatestCreatedPasscode(creatorPasscode);

    // Auto-enter created room as host directly - NO QR code modal or extra tabs
    setActiveRoom(newRoom);
    setActiveAccessKey(newRoom.accessKey);

    sounds.playScanSuccess();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Sticky Banner when user arrived with a paid voucher link */}
      {activeVoucherToken && !activeRoom && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xl sticky top-0 z-40 border-b border-emerald-400/30">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-200 animate-ping" />
            <span>
              <strong>Acesso Pago Liberado!</strong> Seu link exclusivo de comprador está ativo para criar a sala com tempo regressivo.
            </span>
          </div>
          <button
            onClick={() => setIsCreateRoomOpen(true)}
            className="px-3.5 py-1.5 bg-white text-emerald-900 rounded-xl font-bold text-xs hover:bg-emerald-50 transition-all shadow shrink-0 ml-3 cursor-pointer"
          >
            Criar Sala Agora
          </button>
        </div>
      )}

      {/* Visual loader when joining via link */}
      {isJoiningFromUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="flex flex-col items-center max-w-sm text-center p-6 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-2xl">
            <div className="relative mb-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Smartphone className="h-8 w-8 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Validando Acesso à Sala...</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Autenticando sessão temporizada e gerando seu pseudônimo anônimo.
            </p>
          </div>
        </div>
      )}

      {/* Error alert toast */}
      {joinError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{joinError}</span>
            </div>
            <button
              onClick={() => setJoinError(null)}
              className="p-1 text-rose-400 hover:text-white rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main View Router */}
      {currentPath.startsWith('/confirmar-email') ? (
        <ConfirmarEmailPage
          onNavigateHome={() => navigateTo('/')}
          onOpenAuthModal={() => {
            navigateTo('/');
            setIsAuthModalOpen(true);
          }}
        />
      ) : currentPath.startsWith('/mural') ? (
        <ConfessionsPage
          onBack={() => navigateTo('/')}
          onOpenCreateModal={() => setIsConfessionCreateOpen(true)}
          onOpenDetailModal={(id) => setSelectedConfessionDetailId(id)}
        />
      ) : activePrivateChat ? (
        <PrivateChatView
          targetUser={activePrivateChat}
          currentUser={privateChatUser || currentUser}
          onBack={handleClosePrivateChat}
        />
      ) : activeRoom && activeAccessKey ? (
        <ChatRoomView
          room={activeRoom}
          accessKey={activeAccessKey}
          currentUser={currentUser}
          onLeaveRoom={handleLeaveRoom}
          onOpenRoomQR={() => setRoomForShare(activeRoom)}
          onRegenerateUser={handleRegenerateIdentity}
        />
      ) : INSTITUTIONAL_PATHS.some((p) => currentPath.startsWith(p)) ? (
        <div className="flex flex-col min-h-screen">
          <Header
            currentUser={currentUser}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenCreateRoom={() => setIsRestrictedNoticeOpen(true)}
            onRegenerateIdentity={handleRegenerateIdentity}
            onOpenOwnerPanel={() => setIsOwnerModalOpen(true)}
            onOpenBuyRoom={() => setIsBuyRoomOpen(true)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenMinhasCompras={() => setIsMinhasComprasOpen(true)}
            onOpenMinhasConversas={user?.id ? () => setIsMinhasConversasOpen(true) : undefined}
            unreadConversationsCount={user?.id ? totalPrivateUnread : 0}
            onNavigateHome={() => navigateTo('/')}
          />

          <InstitutionalPage
            currentPath={currentPath}
            onNavigate={navigateTo}
            onOpenBuyRoom={() => setIsBuyRoomOpen(true)}
          />

          <Footer
            onNavigate={navigateTo}
            onOpenBuyRoom={() => setIsBuyRoomOpen(true)}
            onOpenOwnerPanel={() => setIsOwnerModalOpen(true)}
          />
        </div>
      ) : (
        <div className="flex flex-col min-h-screen">
           <Header
            currentUser={currentUser}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenCreateRoom={() => setIsRestrictedNoticeOpen(true)}
            onRegenerateIdentity={handleRegenerateIdentity}
            onOpenOwnerPanel={() => setIsOwnerModalOpen(true)}
            onOpenBuyRoom={() => setIsBuyRoomOpen(true)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenMinhasCompras={() => setIsMinhasComprasOpen(true)}
            onOpenMinhasConversas={user?.id ? () => setIsMinhasConversasOpen(true) : undefined}
            unreadConversationsCount={user?.id ? totalPrivateUnread : 0}
            onNavigateHome={() => navigateTo('/')}
          />

          <LobbyView
            rooms={rooms}
            salasProdutos={salasProdutos}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenCreateRoom={() => setIsRestrictedNoticeOpen(true)}
            onViewRoomQR={(room) => setRoomForShare(room)}
            onJoinRoomWithCode={(room) => {
              if (room.isOpenRoom && !room.hasPasscode) {
                handleDirectEnterRoom(room.id);
              } else {
                setRoomForPasscode(room.id);
              }
            }}
            onOpenOwnerPanel={() => setIsOwnerModalOpen(true)}
            onDirectEnterRoom={handleDirectEnterRoom}
            onOpenBuyRoom={() => setIsBuyRoomOpen(true)}
            onBuySala={handleBuySalaClick}
            onOpenMinhasCompras={() => setIsMinhasComprasOpen(true)}
            onOpenTruthOrDare={() => {
              setTruthOrDareRoomId(undefined);
              setIsTruthOrDareOpen(true);
            }}
            onOpenFindTheImpostor={() => {
              setFindTheImpostorRoomId(undefined);
              setIsFindTheImpostorOpen(true);
            }}
            onStartPrivateChat={handleStartPrivateChat}
            onOpenCreateConfession={() => setIsConfessionCreateOpen(true)}
            onViewMural={() => navigateTo('/mural')}
          />

          <Footer
            onNavigate={navigateTo}
            onOpenBuyRoom={() => setIsBuyRoomOpen(true)}
            onOpenOwnerPanel={() => setIsOwnerModalOpen(true)}
          />
        </div>
      )}

      {/* Owner/Admin Panel Modal (to generate paid links by time, create rooms directly and manage sessions) */}
      <OwnerAdminModal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
        onActivateVoucherClientSide={(token) => {
          setActiveVoucherToken(token);
          setIsCreateRoomOpen(true);
        }}
        onRoomsChanged={fetchRooms}
        onEnterRoomDirectly={(room, accessKey) => handleRoomAccessGranted(room, accessKey)}
      />

      {/* Buy Room with Pix Modal */}
      <BuyRoomModal
        isOpen={isBuyRoomOpen}
        onClose={() => setIsBuyRoomOpen(false)}
        onRoomCreatedAndApproved={(room, accessKey) => {
          fetchRooms();
          handleRoomAccessGranted(room, accessKey);
        }}
      />

      {/* Informative Notice Modal: Blocks public room creation, directs to WhatsApp or Owner Panel */}
      <RestrictedRoomNoticeModal
        isOpen={isRestrictedNoticeOpen}
        onClose={() => setIsRestrictedNoticeOpen(false)}
        onOpenOwnerPanel={() => {
          setIsRestrictedNoticeOpen(false);
          setIsOwnerModalOpen(true);
        }}
        onOpenBuyRoom={() => {
          setIsRestrictedNoticeOpen(false);
          setIsBuyRoomOpen(true);
        }}
      />

      {/* Passcode Entry Modal (Guest enters creator's passcode) */}
      <PasscodePromptModal
        isOpen={!!roomForPasscode}
        roomId={roomForPasscode}
        initialPasscode={initialPasscodeForModal}
        onClose={() => {
          setRoomForPasscode(null);
          setInitialPasscodeForModal('');
        }}
        onSuccess={(room, accessKey) => {
          setInitialPasscodeForModal('');
          handleRoomAccessGranted(room, accessKey);
        }}
        onRoomDeleted={() => {
          fetchRooms();
          if (activeRoom && activeRoom.id === roomForPasscode) {
            handleLeaveRoom();
          }
        }}
      />

      {/* Share / Invite Modal (Displays Link, Passcode, QR Code & 10 people limit) */}
      {roomForShare && (
        <ShareRoomModal
          isOpen={!!roomForShare}
          room={roomForShare}
          creatorPasscode={latestCreatedPasscode || roomForShare.creatorPasscode}
          onClose={() => setRoomForShare(null)}
          onRoomDeleted={() => {
            fetchRooms();
            if (activeRoom && activeRoom.id === roomForShare.id) {
              handleLeaveRoom();
            }
          }}
        />
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        voucherToken={activeVoucherToken}
        onClose={() => {
          setIsCreateRoomOpen(false);
        }}
        onCreated={handleRoomCreated}
      />

      {/* Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={handleRoomAccessGranted}
        presetRooms={rooms}
      />

      {/* Supabase Authentication & Profile Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Modal de Compra Individual de Sala (Supabase) */}
      <CompraSalaModal
        isOpen={isCompraSalaModalOpen}
        onClose={() => {
          setIsCompraSalaModalOpen(false);
          setSelectedSalaParaComprar(null);
        }}
        sala={selectedSalaParaComprar}
        onRequireAuth={() => {
          setIsCompraSalaModalOpen(false);
          setPendingSalaToBuyAfterAuth(selectedSalaParaComprar);
          setIsAuthModalOpen(true);
        }}
        onOrderCreated={(_order) => {
          fetchSalasProdutos();
        }}
      />

      {/* Modal de Histórico de Compras do Usuário (Supabase) */}
      <MinhasComprasModal
        isOpen={isMinhasComprasOpen}
        onClose={() => setIsMinhasComprasOpen(false)}
        onEnterRoom={(salaId, compraId) => handleDirectEnterRoom(salaId, compraId)}
      />

      {/* Modal de Minhas Conversas Privadas 1x1 (disponível exclusivamente para usuário realmente autenticado) */}
      {Boolean(user?.id) && (
        <MinhasConversasModal
          isOpen={isMinhasConversasOpen}
          onClose={() => setIsMinhasConversasOpen(false)}
          conversations={privateConversationsList}
          onSelectConversation={(targetUser) => {
            setIsMinhasConversasOpen(false);
            handleStartPrivateChat(targetUser);
          }}
        />
      )}

      {/* Mural das Confissões Modals */}
      <ConfessionCreateModal
        isOpen={isConfessionCreateOpen}
        onClose={() => setIsConfessionCreateOpen(false)}
        onSuccess={() => setConfessionsRefreshKey((k) => k + 1)}
      />

      <ConfessionDetailModal
        isOpen={Boolean(selectedConfessionDetailId)}
        confessionId={selectedConfessionDetailId || ''}
        onClose={() => setSelectedConfessionDetailId(null)}
        onUpdated={() => setConfessionsRefreshKey((k) => k + 1)}
      />

      {/* Jogo Verdade ou Desafio (Modo Jogo) */}
      <TruthOrDareGameModal
        isOpen={isTruthOrDareOpen}
        onClose={() => setIsTruthOrDareOpen(false)}
        currentUser={currentUser}
        roomId={truthOrDareRoomId}
      />

      {/* Jogo Ache o Impostor (Modo Jogo) */}
      <FindTheImpostorGameModal
        isOpen={isFindTheImpostorOpen}
        onClose={() => setIsFindTheImpostorOpen(false)}
        currentUser={currentUser}
        roomId={findTheImpostorRoomId}
      />
    </div>
  );
}

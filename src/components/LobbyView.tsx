import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Lock,
  Users,
  Search,
  PlusCircle,
  Eye,
  Camera,
  ShieldCheck,
  Zap,
  Sparkles,
  Terminal,
  Film,
  Coffee,
  Gamepad2,
  Clock,
  Key,
  Share2,
  KeyRound,
  ArrowRight,
  Trash2,
  MessageCircle,
  MessageSquare,
  ShoppingBag,
  Check,
  UserCheck,
  Info,
  X,
  Loader2,
  User as UserIcon,
} from 'lucide-react';
import { ThemedRoom, SalaProduto } from '../types';
import { buscarUsuariosPorNick, UserSearchResult, obterApresentacaoUsuario } from '../lib/supabase';
import { UserPresentation } from '../constants/presentation';
import { UserPresentationView } from './UserPresentationView';
import { CommercialRoomSelector } from './CommercialRoomSelector';
import { AnonQrMascot } from './AnonQrMascot';
import { ConfessionsSection } from './confessions/ConfessionsSection';

interface Props {
  rooms: ThemedRoom[];
  salasProdutos?: SalaProduto[];
  onOpenScanner: () => void;
  onOpenCreateRoom: () => void;
  onViewRoomQR: (room: ThemedRoom) => void;
  onJoinRoomWithCode: (room: ThemedRoom) => void;
  onOpenOwnerPanel: () => void;
  onDirectEnterRoom: (roomId: string) => void;
  onOpenBuyRoom?: () => void;
  onBuySala?: (sala: SalaProduto) => void;
  onOpenMinhasCompras?: () => void;
  onOpenTruthOrDare?: () => void;
  onOpenFindTheImpostor?: () => void;
  onStartPrivateChat?: (targetUser: UserSearchResult) => void;
  onOpenCreateConfession?: () => void;
  onViewMural?: () => void;
}

const CATEGORIES = [
  'Todas',
  'Mente & Pensamento',
  'Apoio & Emoção',
  'Tecnologia',
  'Cultura & Arte',
  'Geral',
];

const ICON_MAP: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="h-5 w-5" />,
  Lock: <Lock className="h-5 w-5" />,
  Film: <Film className="h-5 w-5" />,
  Terminal: <Terminal className="h-5 w-5" />,
  Coffee: <Coffee className="h-5 w-5" />,
  Gamepad2: <Gamepad2 className="h-5 w-5" />,
};

export const LobbyView: React.FC<Props> = ({
  rooms,
  salasProdutos = [],
  onOpenScanner,
  onOpenCreateRoom,
  onViewRoomQR,
  onJoinRoomWithCode,
  onOpenOwnerPanel,
  onDirectEnterRoom,
  onOpenBuyRoom,
  onBuySala,
  onOpenMinhasCompras,
  onOpenTruthOrDare,
  onOpenFindTheImpostor,
  onStartPrivateChat,
  onOpenCreateConfession,
  onViewMural,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickRoomInput, setQuickRoomInput] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [viewingUserProfile, setViewingUserProfile] = useState<UserSearchResult | null>(null);
  const [viewingUserPresentation, setViewingUserPresentation] = useState<UserPresentation | null>(null);
  const [, setNow] = useState(Date.now());

  // Carrega ou sincroniza a apresentação do perfil aberto ("Sobre mim / O que procuro")
  useEffect(() => {
    if (viewingUserProfile) {
      if (
        Array.isArray(viewingUserProfile.profileLookingFor) ||
        Array.isArray(viewingUserProfile.profileInterests) ||
        viewingUserProfile.profileAvailability ||
        Array.isArray(viewingUserProfile.profileDesires)
      ) {
        setViewingUserPresentation({
          profileLookingFor: viewingUserProfile.profileLookingFor || [],
          profileInterests: viewingUserProfile.profileInterests || [],
          profileAvailability: viewingUserProfile.profileAvailability || null,
          profileDesires: viewingUserProfile.profileDesires || [],
        });
      } else {
        setViewingUserPresentation(null);
      }

      obterApresentacaoUsuario(viewingUserProfile.id)
        .then((pres) => {
          if (pres) {
            setViewingUserPresentation(pres);
          }
        })
        .catch(() => {});
    } else {
      setViewingUserPresentation(null);
    }
  }, [viewingUserProfile?.id]);

  // Debounced search for Users by Nick & Room Filter
  useEffect(() => {
    const term = quickRoomInput.trim();
    setSearchQuery(term);

    const cleanTerm = term.replace(/^@+/, '').trim();
    if (cleanTerm.length < 1) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const users = await buscarUsuariosPorNick(cleanTerm);
        setUserSearchResults(users);
      } catch (e) {
        setUserSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [quickRoomInput]);

  // Keep countdown updated
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredRooms = rooms.filter((r) => {
    const matchesCat =
      selectedCategory === 'Todas' || r.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleQuickEnterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = quickRoomInput.trim();
    if (!val) return;

    if (val.includes('room=')) {
      try {
        const url = new URL(val.startsWith('http') ? val : `https://dummy.local/${val}`);
        const rId = url.searchParams.get('room');
        if (rId) {
          onDirectEnterRoom(rId);
          setQuickRoomInput('');
          return;
        }
      } catch {}
    }

    onDirectEnterRoom(val);
    setQuickRoomInput('');
  };

  const formatRemainingTime = (expiresAt: number) => {
    const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    if (diff <= 0) return 'Expirada';
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  return (
    <div className="flex-1 bg-slate-950 pb-12 text-slate-100">
      {/* Top Banner: Status */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 px-4 py-2.5 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-400">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Sistema AnonQR: Salas Privadas Temporizadas (Limite de até 10 pessoas por sala)</span>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 px-4 py-12 sm:px-6 sm:py-16 text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto text-center lg:text-left">
          {/* COMPOSIÇÃO RESPONSIVA: DESKTOP (2 COLUNAS) x MOBILE (VERTICAL) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* NO MOBILE: MASCOTE NO TOPO DO HERO */}
            <div className="lg:hidden flex flex-col items-center justify-center pt-2 pb-1">
              <AnonQrMascot variant="hero" size="lg" className="mb-2" />
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" />
                Anôn • ET Alienígena AnônQr
              </span>
            </div>

            {/* COLUNA ESQUERDA (TEXTOS, BUSCA E CTAS) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Badge Desktop */}
              <div className="hidden lg:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" />
                <span>Conversas Anônimas • Salas Privadas • Jogos Presenciais</span>
              </div>

              {/* Título Principal */}
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Converse sem{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
                  mostrar quem você é.
                </span>
              </h2>

              <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
                Entre em salas, converse, jogue e compartilhe sem precisar se identificar. Tudo criptografado e sem registro de rastros.
              </p>

              {/* Campo de Busca de Salas / @nick de Usuários */}
              <div className="relative max-w-md mx-auto lg:mx-0 text-left pt-1">
                <form onSubmit={handleQuickEnterSubmit}>
                  <label htmlFor="hero-main-search-input" className="sr-only">
                    Pesquisar nick de usuário, link ou ID da sala
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-xl focus-within:border-emerald-500/80 transition-all">
                    <Search className="h-4 w-4 text-slate-500 ml-2.5 shrink-0" />
                    <input
                      type="text"
                      id="hero-main-search-input"
                      value={quickRoomInput}
                      onChange={(e) => setQuickRoomInput(e.target.value)}
                      placeholder="Pesquisar @nick de usuário, link ou ID da sala..."
                      className="flex-1 bg-transparent px-2 py-2 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none min-w-0"
                    />
                    {quickRoomInput && (
                      <button
                        type="button"
                        onClick={() => setQuickRoomInput('')}
                        className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                        title="Limpar pesquisa"
                        aria-label="Limpar pesquisa"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-md shadow-emerald-950/40"
                      aria-label="Entrar na sala ou buscar"
                    >
                      <span>Entrar</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </form>

                {/* Dropdown de Resultados da Pesquisa por Nick */}
                {quickRoomInput.trim().length >= 1 && (
                  <div
                    id="search-user-nick-dropdown"
                    className="absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl p-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5 font-bold text-white uppercase tracking-wider">
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                        Usuários por Nick
                      </span>
                      {isSearchingUsers && <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />}
                    </div>

                    {userSearchResults.length > 0 ? (
                      <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto mt-1">
                        {userSearchResults.map((u) => (
                          <div
                            key={u.id}
                            className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-800/60 rounded-xl transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {u.avatar_url ? (
                                <img
                                  src={u.avatar_url}
                                  alt={u.nick || u.name}
                                  className="h-8 w-8 rounded-full object-cover border border-emerald-500/40 shrink-0 shadow-sm"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm">
                                  {(u.nick || u.name).charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-emerald-400 text-xs truncate">
                                    @{u.nick}
                                  </span>
                                  <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                    Perfil
                                  </span>
                                </div>
                                {u.name && u.name.toLowerCase() !== u.nick.toLowerCase() && (
                                  <p className="text-[11px] text-slate-400 truncate">{u.name}</p>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setViewingUserProfile(u)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all shrink-0 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Ver Perfil</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      !isSearchingUsers && (
                        <div className="py-3 text-center text-xs text-slate-400">
                          Nenhum usuário encontrado com o nick{' '}
                          <strong className="text-white font-mono">
                            {quickRoomInput.startsWith('@') ? quickRoomInput : `@${quickRoomInput}`}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Botões CTA Principais */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 w-full sm:w-auto pt-2">
                <button
                  id="hero-scan-qr-btn"
                  onClick={onOpenScanner}
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-950/60 transition-all active:scale-95 cursor-pointer"
                >
                  <Camera className="h-5 w-5" />
                  <span>Escanear QR Code</span>
                </button>

                {onOpenBuyRoom && (
                  <button
                    id="hero-buy-room-pix-btn"
                    onClick={onOpenBuyRoom}
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-950/60 transition-all active:scale-95 cursor-pointer ring-2 ring-emerald-400/30"
                  >
                    <ShoppingBag className="h-5 w-5" />
                    <span>Comprar Sala Privada (PIX)</span>
                  </button>
                )}
              </div>
            </div>

            {/* COLUNA DIREITA (DESKTOP: MASCOTE GRANDE + CHAT DEMONSTRATIVO) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              {/* Mascote em Destaque no Desktop */}
              <div className="hidden lg:flex flex-col items-center justify-center relative mb-4">
                <AnonQrMascot variant="hero" size="xl" />
                <span className="mt-2 text-xs font-bold text-slate-300 font-mono bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800 shadow-md">
                  Anôn • ET Alienígena AnônQr
                </span>
              </div>

              {/* Ilustração Visual Demonstrativa de Conversa Anônima */}
              <div className="w-full max-w-sm p-3.5 sm:p-4 rounded-2xl border border-slate-800/90 bg-slate-900/80 shadow-xl backdrop-blur-sm pointer-events-none select-none text-left">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <span>🕶️</span>
                    <span>Conversa anônima</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Demonstração
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Mensagem 1 - Você */}
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] font-mono font-bold text-slate-400 mb-0.5 ml-1">Você</span>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-slate-800/90 border border-slate-700/70 px-3 py-1.5 text-slate-200 shadow-sm">
                      Aqui a gente pode conversar?
                    </div>
                  </div>

                  {/* Mensagem 2 - Anônimo */}
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-mono font-bold text-emerald-400 mb-0.5 mr-1">Anônimo</span>
                    <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-emerald-950/70 border border-emerald-500/30 px-3 py-1.5 text-emerald-200 shadow-sm">
                      Sim, claro. Sem rastros. 🤫
                    </div>
                  </div>

                  {/* Mensagem 3 - Você */}
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] font-mono font-bold text-slate-400 mb-0.5 ml-1">Você</span>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-slate-800/90 border border-slate-700/70 px-3 py-1.5 text-slate-200 shadow-sm">
                      E ninguém precisa saber quem somos?
                    </div>
                  </div>

                  {/* Mensagem 4 - Anônimo */}
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-mono font-bold text-emerald-400 mb-0.5 mr-1">Anônimo</span>
                    <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-emerald-950/70 border border-emerald-500/30 px-3 py-1.5 text-emerald-200 shadow-sm">
                      Exatamente. 😉
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-8">
        {/* 2. 🎭 JOGOS PRESENCIAIS (IMEDIATAMENTE ABAIXO DO HERO) */}
        <section className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950 p-5 sm:p-7 mb-10 shadow-2xl shadow-purple-950/20">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 text-lg">
              🎭
            </span>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                🎭 Jogos Presenciais
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                Transforme o celular em parte da brincadeira.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Verdade ou Desafio */}
            {onOpenTruthOrDare && (
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-lg">
                <div className="space-y-2 mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase">
                    <span>❤️</span>
                    <span>Presencial • Perguntas & Desafios</span>
                  </div>
                  <h4 className="text-lg font-black text-white">
                    ❤️ Verdade ou Desafio
                  </h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    Jogo presencial de perguntas e desafios. Vocês fazem a brincadeira.
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-start-truth-or-dare"
                  onClick={onOpenTruthOrDare}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-black shadow-lg shadow-emerald-950/50 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 ring-2 ring-emerald-400/30"
                >
                  <span>Jogar Verdade ou Desafio</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Card 2: Ache o Impostor */}
            {onOpenFindTheImpostor && (
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-slate-900/90 border border-purple-500/30 hover:border-purple-500/60 transition-all shadow-lg">
                <div className="space-y-2 mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-black uppercase">
                    <span>🎭</span>
                    <span>Presencial • Dedução & Mistério</span>
                  </div>
                  <h4 className="text-lg font-black text-white">
                    🎭 Ache o Impostor
                  </h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    Todos sabem o cenário. Menos um. Converse, observe e descubra quem está fingindo saber.
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-start-find-the-impostor"
                  onClick={onOpenFindTheImpostor}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-950/50 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 ring-2 ring-purple-400/30"
                >
                  <span>Jogar Ache o Impostor</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 3. 📝 MURAL DAS CONFISSÕES (IMEDIATAMENTE ABAIXO DOS JOGOS) */}
        <div className="mb-10">
          <ConfessionsSection
            onOpenCreateModal={onOpenCreateConfession || (() => {})}
            onViewAll={onViewMural || (() => {})}
          />
        </div>

        {/* 4. DEMAIS SEÇÕES EXISTENTES */}
        {/* Catálogo Oficial de Salas Privadas Unificado */}
        {onBuySala && (
          <CommercialRoomSelector
            onBuySala={onBuySala}
            onOpenMinhasCompras={onOpenMinhasCompras}
          />
        )}

        {/* Section Title for Open Rooms */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Aba Principal • Salas Oficiais do Site</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Salas Abertas da Comunidade (3 Salas)
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Somente quem acessar a sala pode visualizar e fazer parte do bate-papo. O conteúdo das conversas não é exibido publicamente; apenas o número de pessoas ativas na sala.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              <span>3 Salas Abertas Disponíveis</span>
            </span>
          </div>
        </div>

        {/* 3 Open Rooms Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {filteredRooms.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-slate-800 bg-slate-900/60 p-8 sm:p-12 text-center shadow-xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-emerald-400 border border-slate-700/80 mb-4 shadow-inner">
                <MessageSquare className="h-7 w-7" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-white mb-1.5">
                Carregando salas abertas do site...
              </h4>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
                As 3 salas abertas oficiais estão sendo sincronizadas com o servidor.
              </p>
            </div>
          ) : (
            filteredRooms.map((room, idx) => {
              return (
                <div
                  key={`${room.id}-${idx}`}
                  id={`room-card-${room.id}`}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-xl transition-all hover:border-emerald-500/50 hover:bg-slate-900"
                >
                  {/* Top Accent line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
                    style={{ backgroundColor: room.color || '#10b981' }}
                  />

                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60">
                        {room.category}
                      </span>

                      {/* Open Room Badge */}
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-lg">
                        <Sparkles className="h-3 w-3" />
                        <span>Aberta • Permanente</span>
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 group-hover:text-emerald-300 transition-colors">
                      {room.name}
                    </h3>

                    <p className="text-xs text-slate-400 leading-relaxed mb-5">
                      {room.description}
                    </p>
                  </div>

                  <div>
                    {/* Participant count indicator (STRICT PRIVACY: Shows only participant count, NO chat text) */}
                    <div className="flex items-center justify-between gap-2 mb-4 py-2.5 px-3 rounded-xl bg-slate-950/70 border border-slate-800/90 text-xs">
                      <div className="flex items-center gap-2 text-slate-200">
                        <Users className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>
                          Pessoas na sala: <strong className="text-emerald-400 font-bold">{room.onlineCount} online</strong>
                        </span>
                      </div>

                      <span className="text-[10.5px] text-slate-400 font-mono">
                        Privacidade Ativa
                      </span>
                    </div>

                    {/* Join button: direct access for open rooms */}
                    <button
                      id={`btn-join-room-${room.id}`}
                      onClick={() => onDirectEnterRoom(room.id)}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>Entrar na Sala Agora</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* How It Works Section */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-10 mb-8">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="h-4 w-4" />
              Salas Exclusivas por Tempo & Segurança
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Como funciona o Bate-Papo Temporizado (Até 10 Pessoas)?
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
                <MessageCircle className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">1. Contato no WhatsApp</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Você solicita o tempo de sala desejado diretamente com o desenvolvedor responsável.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
                <Key className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">2. Painel do Dono</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                O desenvolvedor configura a duração da sala e gera o link direto de acesso com criptografia.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
                <Share2 className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">3. Entrada até 10 Pessoas</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Todos com o link ou QR Code entram instantaneamente no chat sem precisar de cadastro.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-3">
                <Clock className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">4. Fim de Sessão Automático</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Quando o cronômetro chega a zero, a sala expira e todos os dados são apagados do servidor.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Modal de Visualização do Perfil Público por Nick */}
      {viewingUserProfile && (
        <div
          id="modal-view-user-profile"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setViewingUserProfile(null)}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl p-5 sm:p-6 max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Perfil Público</h4>
              </div>
              <button
                id="btn-close-view-profile"
                onClick={() => setViewingUserProfile(null)}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Fechar perfil"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="pt-6 pb-4 flex flex-col items-center text-center">
              {viewingUserProfile.avatar_url ? (
                <img
                  src={viewingUserProfile.avatar_url}
                  alt={viewingUserProfile.nick || viewingUserProfile.name}
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-xl shadow-emerald-950/50 mb-3.5"
                />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-950/50 mb-3.5">
                  {(viewingUserProfile.nick || viewingUserProfile.name).charAt(0).toUpperCase()}
                </div>
              )}

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-sm mb-1.5">
                <span>@{viewingUserProfile.nick}</span>
              </div>

              {viewingUserProfile.name && viewingUserProfile.name.toLowerCase() !== viewingUserProfile.nick.toLowerCase() && (
                <p className="text-sm font-semibold text-white mb-1">
                  {viewingUserProfile.name}
                </p>
              )}

              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Usuário autenticado e verificado no sistema AnônQr.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs mb-4">
              <div className="flex items-center justify-between text-slate-400">
                <span>Status da Conta:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verificado
                </span>
              </div>
            </div>

            {/* Apresentação: Sobre mim / O que procuro */}
            <UserPresentationView
              presentation={viewingUserPresentation}
              className="mb-4 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80"
            />

            {onStartPrivateChat && (
              <button
                type="button"
                id="btn-send-private-message"
                onClick={() => {
                  const target = viewingUserProfile;
                  setViewingUserProfile(null);
                  onStartPrivateChat(target);
                }}
                className="w-full py-3 min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer mb-2.5"
              >
                <MessageCircle className="h-4 w-4" />
                <span>💬 Enviar mensagem</span>
              </button>
            )}

            <button
              onClick={() => setViewingUserProfile(null)}
              className="w-full py-3 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

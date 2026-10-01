import React, { useState, useEffect, useRef } from 'react';
import {
  ImpostorGamePhase,
  ImpostorPlayer,
  ImpostorGameState,
  ImpostorScenario,
} from '../../types/findTheImpostor';
import { AnonymousUser } from '../../types';
import {
  Users,
  Copy,
  Check,
  X,
  Play,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  HelpCircle,
  Vote,
  Award,
  AlertTriangle,
  Radio,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';

interface FindTheImpostorGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AnonymousUser;
  roomId?: string;
}

export const FindTheImpostorGameModal: React.FC<FindTheImpostorGameModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  roomId,
}) => {
  const [gameState, setGameState] = useState<ImpostorGameState | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [socketError, setSocketError] = useState<string | null>(null);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const [showSecretRole, setShowSecretRole] = useState(false);
  const [selectedImpostorGuess, setSelectedImpostorGuess] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // ID persistente do jogo para esta sessão
  const [fallbackRoomId] = useState(() => 'imp_' + Math.random().toString(36).substring(2, 8));
  const gameRoomId = roomId || fallbackRoomId;
  const shareUrl = `${window.location.origin}/?imp_room=${gameRoomId}`;

  // Gerar QR Code para convite da partida
  useEffect(() => {
    if (gameRoomId) {
      QRCode.toDataURL(shareUrl, { width: 220, margin: 1 })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => {});
    }
  }, [gameRoomId, shareUrl]);

  // Conectar via WebSocket na rota /ws idêntica à das salas de chat do AnônQr
  useEffect(() => {
    if (!isOpen) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setGameState(null);
      setWsConnected(false);
      return;
    }

    let isSubscribed = true;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!isSubscribed) return;
          setWsConnected(true);
          setSocketError(null);

          // Entrar ou criar partida de Ache o Impostor no servidor
          ws.send(
            JSON.stringify({
              type: 'impostor_action',
              action: 'join_game',
              roomId: gameRoomId,
              user: currentUser,
            })
          );
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'impostor_state' && msg.gameState) {
              setGameState(msg.gameState);
              setWsConnected(true);
              setSocketError(null);
            } else if (msg.type === 'impostor_error') {
              setSocketError(msg.message || 'Erro do servidor.');
            }
          } catch (err) {
            console.error('Erro ao processar estado do jogo:', err);
          }
        };

        ws.onerror = () => {
          if (!isSubscribed) return;
        };

        ws.onclose = () => {
          if (!isSubscribed) return;
          setWsConnected(false);
          reconnectTimer = setTimeout(() => {
            if (isSubscribed && isOpen) {
              connectWebSocket();
            }
          }, 2000);
        };
      } catch (err) {
        console.error('Erro ao abrir WebSocket do Impostor:', err);
      }
    };

    connectWebSocket();

    return () => {
      isSubscribed = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [isOpen, gameRoomId, currentUser.id]);

  if (!isOpen) return null;

  const isHost = gameState ? gameState.hostId === currentUser.id : true;
  const myPlayer = gameState?.players.find((p) => p.id === currentUser.id);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const sendAction = (action: string, payload: Record<string, any> = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'impostor_action',
          action,
          roomId: gameRoomId,
          userId: currentUser.id,
          ...payload,
        })
      );
    }
  };

  const handleToggleReady = () => sendAction('toggle_ready');
  const handleStartGame = () => sendAction('start_game');
  const handleNextSpeaker = () => sendAction('next_speaker');
  const handleStartInvestigation = () => sendAction('start_investigation');
  const handleStartIdentityReveal = () => sendAction('start_identity_reveal');
  const handleStartSuspicions = () => sendAction('start_suspicions');
  const handleStartVoting = () => sendAction('start_voting');
  const handleConfirmVote = () => {
    if (selectedVoteId) {
      sendAction('submit_vote', { votedForId: selectedVoteId });
    }
  };
  const handleRevealMostVoted = () => sendAction('reveal_most_voted');
  const handleSubmitImpostorGuess = () => {
    if (selectedImpostorGuess) {
      sendAction('submit_impostor_guess', { guessScenarioId: selectedImpostorGuess });
    }
  };
  const handleRestartGame = () => sendAction('restart_game');
  const handleEndGame = () => sendAction('end_game');

  const handleManualReconnect = () => {
    setSocketError(null);
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  const currentSpeaker = gameState && gameState.speakingOrder && gameState.speakingOrder[gameState.currentSpeakerIndex]
    ? gameState.players.find((p) => p.id === gameState.speakingOrder[gameState.currentSpeakerIndex])
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-purple-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 text-slate-100 shadow-2xl p-4 sm:p-6 max-h-[94dvh] overflow-y-auto">
        {/* Glows Decorativos de Fundo */}
        <div className="absolute -top-20 -right-20 h-56 w-56 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-56 w-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 text-base">
              🎭
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                ACHE O IMPOSTOR
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
                Todos sabem o cenário. Menos um.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Fechar jogo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Alerta discreto de conexão */}
        {!wsConnected && !gameState && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
              <span>Conectando à partida do Impostor...</span>
            </div>
            <button
              type="button"
              onClick={handleManualReconnect}
              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-bold cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Reconectar</span>
            </button>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL DO JOGO DE ACORDO COM A FASE */}
        {!gameState ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto" />
            <p className="text-xs text-slate-300 font-bold">Criando/Entrando na partida...</p>
          </div>
        ) : (
          <div className="relative z-10 pt-4 space-y-4">

            {/* FASE 1: LOBBY */}
            {gameState.phase === 'lobby' && (
              <div className="space-y-4">
                {/* Banner Descritivo */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-500/30 text-center space-y-1">
                  <p className="text-xs font-black text-purple-300 uppercase tracking-wider">
                    🎭 Jogo Presencial de Dedução
                  </p>
                  <p className="text-xs text-slate-300 font-medium">
                    Converse, observe e descubra quem está fingindo saber o cenário!
                  </p>
                </div>

                {/* Lista de Jogadores no Lobby */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-bold border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-purple-400" />
                      <span>Jogadores Conectados</span>
                    </span>
                    <span className="text-purple-400 font-mono">
                      👥 {gameState.players.length} participante{gameState.players.length !== 1 ? 's' : ''} (mín. 3)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {gameState.players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-white font-bold text-xs shrink-0"
                            style={{ backgroundColor: p.avatarColor || '#8b5cf6' }}
                          >
                            {p.gameNick.split(' ')[0] || '🦊'}
                          </span>
                          <span className="font-bold text-slate-200 truncate max-w-[130px]">
                            {p.gameNick}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {p.isHost && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Líder
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                              p.isReady
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {p.isReady ? 'PRONTO' : 'AGUARDANDO'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Código e QR Code para Entrada de Amigos */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-200">
                        Convide os amigos para jogar presencialmente:
                      </p>
                      <p className="text-[11px] font-mono text-purple-400">
                        Código da partida: <strong>{gameRoomId}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer shrink-0"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Link copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-purple-400" />
                          <span>Copiar link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {qrCodeDataUrl && (
                    <div className="flex items-center justify-center pt-1">
                      <div className="p-2 rounded-2xl bg-white shadow-lg">
                        <img
                          src={qrCodeDataUrl}
                          alt="QR Code da Partida"
                          className="h-28 w-28 object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Botões de Ação do Lobby */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleToggleReady}
                    className={`w-full py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer shadow-lg active:scale-95 ${
                      myPlayer?.isReady
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/50'
                    }`}
                  >
                    {myPlayer?.isReady ? '✓ Você está pronto' : 'Estou pronto!'}
                  </button>

                  {isHost && (
                    <button
                      type="button"
                      disabled={gameState.players.length < 3}
                      onClick={handleStartGame}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-xl shadow-purple-950/60 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 ring-2 ring-purple-400/30"
                    >
                      <Play className="h-4 w-4 fill-white" />
                      <span>COMEÇAR PARTIDA ({gameState.players.length}/3 mín.)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* FASE 2: REVELAÇÃO SECRETA DO PAPEL */}
            {gameState.phase === 'role_distribution' && (
              <div className="py-4 space-y-5 text-center">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <p className="text-xs text-slate-400 uppercase font-bold">Sua Identidade nesta partida:</p>
                  <p className="text-xl font-black text-white">{myPlayer?.gameNick}</p>
                </div>

                {/* Card do Papel Secreto */}
                {myPlayer?.isImpostor ? (
                  /* CARD DO IMPOSTOR */
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-950/80 via-slate-950 to-slate-950 border-2 border-rose-500/50 shadow-2xl space-y-3">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-3xl">
                      😈
                    </div>
                    <h4 className="text-2xl font-black text-rose-400 tracking-tight">
                      VOCÊ É O IMPOSTOR
                    </h4>
                    <p className="text-sm font-bold text-slate-200 leading-relaxed">
                      Você NÃO sabe qual é o cenário!
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      Escute com muita atenção o que os outros jogadores falarem, fingindo saber onde todos estão sem deixar suspeitas.
                    </p>
                  </div>
                ) : (
                  /* CARD DO INOCENTE */
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/80 via-slate-950 to-slate-950 border-2 border-emerald-500/50 shadow-2xl space-y-3">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-3xl">
                      {gameState.scenario?.icon || '📍'}
                    </div>
                    <p className="text-xs font-black uppercase text-emerald-400 tracking-widest">
                      SEU CENÁRIO DA PARTIDA:
                    </p>
                    <h4 className="text-3xl font-black text-white tracking-tight uppercase">
                      {gameState.scenario?.name}
                    </h4>
                    <p className="text-xs font-extrabold text-emerald-300 bg-emerald-500/10 py-1.5 px-3 rounded-full border border-emerald-500/20 inline-block">
                      ✓ Você NÃO é o impostor
                    </p>
                  </div>
                )}

                {isHost && (
                  <button
                    type="button"
                    onClick={handleNextSpeaker}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-purple-950/60 transition-all cursor-pointer ring-2 ring-purple-400/30 active:scale-95"
                  >
                    Entendi! Ir para as rodadas de fala →
                  </button>
                )}
              </div>
            )}

            {/* FASE 3: RODADAS DE FALAS COM SUGESTÕES PRESENCIAIS */}
            {gameState.phase === 'round_speaking' && (
              <div className="space-y-5 py-2">
                {/* Header de Rodadas */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-black uppercase">
                    <span>🎙️ RODADA #{gameState.currentRound} de 3</span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium">
                    Jogador {gameState.currentSpeakerIndex + 1} de {gameState.speakingOrder.length} nesta rodada
                  </p>
                </div>

                {/* PAINEL DO JOGADOR DA VEZ */}
                {currentSpeaker?.id === currentUser.id ? (
                  /* SE FOR A VEZ DO PRÓPRIO DISPOSITIVO FALAR */
                  <div className="p-5 rounded-3xl bg-gradient-to-b from-purple-950/60 via-slate-900 to-slate-950 border-2 border-purple-500/40 text-center space-y-4 shadow-2xl">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-black">
                      <span>🎙️ SUA VEZ DE FALAR!</span>
                    </div>

                    <h4 className="text-2xl font-black text-white">
                      {currentUser.name} ({myPlayer?.gameNick})
                    </h4>

                    {/* Sugestão de fala presencial */}
                    {gameState.currentPromptSuggestion && (
                      <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-1">
                        <p className="text-[10px] font-black uppercase text-purple-400 tracking-wider">
                          💡 Sugestão de fala do AnônQr:
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed italic">
                          “{gameState.currentPromptSuggestion}”
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-slate-400 leading-relaxed">
                      Fale alguma coisa presencialmente sobre o ambiente sem revelar diretamente o cenário!
                    </p>

                    <button
                      type="button"
                      onClick={handleNextSpeaker}
                      className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-purple-950/60 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 ring-2 ring-purple-400/30"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>JÁ FALEI ✓</span>
                    </button>
                  </div>
                ) : (
                  /* SE FOR A VEZ DE OUTRO JOGADOR FALAR PRESENCIALMENTE */
                  <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 text-center space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      🎭 A investigação continua...
                    </p>
                    <p className="text-xs text-slate-300">Agora é a vez de falar presencialmente:</p>
                    <p className="text-2xl font-black text-purple-400">
                      {currentSpeaker?.gameNick || 'Outro participante'}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-800">
                      Escute com atenção o que ele falar no mundo real para tentar descobrir se é o impostor!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* FASE 4: INVESTIGAÇÃO LIVRE */}
            {gameState.phase === 'free_investigation' && (
              <div className="py-6 text-center space-y-5">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black uppercase">
                  <span>🕵️ FASE DE INVESTIGAÇÃO LIVRE</span>
                </div>

                <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <h4 className="text-xl font-black text-white">
                    As 3 rodadas de falas foram concluídas!
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Agora vocês têm tempo livre para fazer perguntas entre si no mundo real e tentar descobrir quem está fingindo saber o cenário.
                  </p>
                </div>

                {isHost && (
                  <button
                    type="button"
                    onClick={handleStartIdentityReveal}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs sm:text-sm shadow-xl transition-all cursor-pointer ring-2 ring-amber-400/30 active:scale-95"
                  >
                    🚨 ENCERRAR INVESTIGAÇÃO →
                  </button>
                )}
              </div>
            )}

            {/* FASE 5: REVELAÇÃO PÚBLICA DE IDENTIDADES */}
            {gameState.phase === 'identity_reveal' && (
              <div className="py-4 space-y-4 text-center">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-extrabold uppercase">
                  <span>🪪 REVELAÇÃO DAS IDENTIDADES</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs text-slate-300">
                  <p className="font-bold text-white text-sm">
                    Cada jogador deve dizer em voz alta para todos qual identidade recebeu no aplicativo.
                  </p>
                  <p className="text-slate-400">
                    Isso garante que todos saibam quem é quem presencialmente (Pessoa Física ↔ Nome no App).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {gameState.players.map((p) => (
                    <div key={p.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-bold text-slate-200">
                      {p.gameNick}
                    </div>
                  ))}
                </div>

                {isHost && (
                  <button
                    type="button"
                    onClick={handleStartSuspicions}
                    className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm transition-all cursor-pointer ring-2 ring-purple-400/30 active:scale-95"
                  >
                    Ir para Declaração de Suspeitas →
                  </button>
                )}
              </div>
            )}

            {/* FASE 6: DECLARAÇÃO DE SUSPEITAS */}
            {gameState.phase === 'suspicions_declaration' && (
              <div className="py-4 space-y-4 text-center">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-extrabold uppercase">
                  <span>🗣️ HORA DAS SUSPEITAS</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs text-slate-300">
                  <p className="font-bold text-white text-sm">
                    Cada jogador deve declarar em voz alta presencialmente quem acredita ser o impostor.
                  </p>
                  <p className="text-slate-400">
                    Essa declaração é pública antes da votação secreta no aplicativo.
                  </p>
                </div>

                {isHost && (
                  <button
                    type="button"
                    onClick={handleStartVoting}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm transition-all cursor-pointer ring-2 ring-purple-400/30 active:scale-95"
                  >
                    🗳️ Ir para Votação Secreta →
                  </button>
                )}
              </div>
            )}

            {/* FASE 7: VOTAÇÃO SECRETA */}
            {gameState.phase === 'voting' && (
              <div className="py-4 space-y-4 text-center">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-extrabold uppercase">
                  <span>🗳️ VOTAÇÃO SECRETA</span>
                </div>

                {myPlayer?.hasVoted ? (
                  <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                    <p className="text-emerald-400 font-bold text-sm">
                      ✅ Seu voto foi registrado secretamente!
                    </p>
                    <p className="text-xs text-slate-400">
                      Aguardando os outros jogadores concluírem a votação...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 text-left">
                    <p className="text-xs font-bold text-slate-300 text-center">
                      Selecione quem você suspeita que seja o Impostor:
                    </p>

                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {gameState.players
                        .filter((p) => p.id !== currentUser.id)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedVoteId(p.id)}
                            className={`w-full p-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                              selectedVoteId === p.id
                                ? 'bg-purple-600 text-white border-purple-400 shadow-lg'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span>{p.gameNick}</span>
                            {selectedVoteId === p.id && <Check className="h-4 w-4 text-white" />}
                          </button>
                        ))}
                    </div>

                    <button
                      type="button"
                      disabled={!selectedVoteId}
                      onClick={handleConfirmVote}
                      className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm shadow-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ring-2 ring-purple-400/30"
                    >
                      CONFIRMAR VOTO SECRETO
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* FASE 8: EMPATE NA VOTAÇÃO */}
            {gameState.phase === 'tie_break_discussion' && (
              <div className="py-6 text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  <span>🗳️ EMPATE NA VOTAÇÃO!</span>
                </div>

                <p className="text-sm font-bold text-white">
                  Houve um empate no número de votos. Vocês têm mais uma oportunidade para discutir antes da votação final de desempate!
                </p>

                {isHost && (
                  <button
                    type="button"
                    onClick={handleStartVoting}
                    className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition-all cursor-pointer"
                  >
                    Votar Novamente →
                  </button>
                )}
              </div>
            )}

            {/* FASE 9: REVELAÇÃO DO MAIS VOTADO */}
            {gameState.phase === 'vote_reveal' && (
              <div className="py-6 text-center space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase">
                  <span>🎭 O MOMENTO DA VERDADE</span>
                </div>

                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                  <p className="text-xs text-slate-400 uppercase font-bold">
                    A maioria suspeitou de:
                  </p>
                  <h4 className="text-3xl font-black text-purple-400">
                    {gameState.players.find((p) => p.id === gameState.mostVotedPlayerId)?.gameNick}
                  </h4>
                </div>

                {isHost && (
                  <button
                    type="button"
                    onClick={handleRevealMostVoted}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-xl transition-all cursor-pointer ring-2 ring-purple-400/30"
                  >
                    REVELAR RESULTADO →
                  </button>
                )}
              </div>
            )}

            {/* FASE 10: ÚLTIMA CHANCE DO IMPOSTOR */}
            {gameState.phase === 'impostor_last_chance' && (
              <div className="py-6 text-center space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-black uppercase">
                  <span>🎭 VOCÊS ENCONTRARAM O IMPOSTOR!</span>
                </div>

                <p className="text-sm font-bold text-white">
                  <strong>{gameState.players.find((p) => p.isImpostor)?.gameNick}</strong> era o impostor!
                </p>

                {myPlayer?.isImpostor ? (
                  /* PAINEL DA ÚLTIMA CHANCE DO IMPOSTOR */
                  <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-950/80 via-slate-900 to-slate-950 border-2 border-rose-500/50 space-y-4 text-left">
                    <p className="text-xs font-black text-rose-300 uppercase tracking-wider text-center">
                      😈 ÚLTIMA CHANCE! Você foi descoberto.
                    </p>
                    <p className="text-xs text-slate-300 text-center">
                      Mas você ainda pode vencer se acertar qual era o cenário da partida:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {gameState.scenarioOptions?.map((sc) => (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => setSelectedImpostorGuess(sc.id)}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            selectedImpostorGuess === sc.id
                              ? 'bg-rose-600 text-white border-rose-400 shadow-lg'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span>{sc.icon}</span>
                          <span>{sc.name}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={!selectedImpostorGuess}
                      onClick={handleSubmitImpostorGuess}
                      className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm shadow-xl transition-all cursor-pointer disabled:opacity-50 ring-2 ring-rose-400/30"
                    >
                      CONFIRMAR PALPITE FINAL
                    </button>
                  </div>
                ) : (
                  <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-rose-400 mx-auto" />
                    <p className="text-xs text-slate-300 font-bold">
                      Aguardando o impostor tentar adivinhar o cenário na última chance...
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* FASE 11: ENCERRAMENTO E RESULTADO FINAL */}
            {gameState.phase === 'finished' && (
              <div className="py-6 text-center space-y-5">
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-black uppercase ${
                  gameState.winner === 'impostor'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                }`}>
                  <span>{gameState.winner === 'impostor' ? '😈 VITÓRIA DO IMPOSTOR!' : '🕵️ O GRUPO VENCEU!'}</span>
                </div>

                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 text-left">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                    <span className="text-slate-400 font-bold">📍 Cenário Real:</span>
                    <span className="text-white font-black">{gameState.scenario?.icon} {gameState.scenario?.name}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                    <span className="text-slate-400 font-bold">🎭 Impostor Secreto:</span>
                    <span className="text-rose-400 font-black">
                      {gameState.players.find((p) => p.isImpostor)?.gameNick}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold">👥 Total de Jogadores:</span>
                    <span className="text-slate-200 font-mono font-bold">{gameState.players.length}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {isHost && (
                    <button
                      type="button"
                      onClick={handleRestartGame}
                      className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
                    >
                      JOGAR NOVAMENTE
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                  >
                    VOLTAR AO MODO JOGO
                  </button>
                </div>
              </div>
            )}

            {/* Botão de Encerrar para o Host durante o jogo */}
            {gameState.phase !== 'lobby' && gameState.phase !== 'finished' && isHost && (
              <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                <button
                  type="button"
                  onClick={handleEndGame}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Encerrar partida
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import {
  GameLevel,
  GamePhase,
  GamePlayer,
  TruthOrDareGameState,
} from '../../types/truthOrDare';
import { AnonymousUser } from '../../types';
import {
  Sparkles,
  Users,
  Copy,
  Check,
  Flame,
  Heart,
  X,
  Play,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import QRCode from 'qrcode';

interface TruthOrDareGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AnonymousUser;
  roomId?: string;
}

export const TruthOrDareGameModal: React.FC<TruthOrDareGameModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  roomId,
}) => {
  const [gameState, setGameState] = useState<TruthOrDareGameState | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [rouletteText, setRoletteText] = useState<string>('Sorteando...');
  const [socketError, setSocketError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Garantir um ID de partida estável e persistente para a sessão da modal
  const [fallbackRoomId] = useState(() => 'tod_' + Math.random().toString(36).substring(2, 8));
  const gameRoomId = roomId || fallbackRoomId;
  const shareUrl = `${window.location.origin}/?tod_room=${gameRoomId}`;

  // Gerar QR Code para a partida
  useEffect(() => {
    if (gameRoomId) {
      QRCode.toDataURL(shareUrl, { width: 220, margin: 1 })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => {});
    }
  }, [gameRoomId, shareUrl]);

  // Conectar via WebSocket à rota /ws (idêntica às salas de chat do AnônQr)
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
        // Utilizar estritamente o endpoint /ws que o servidor do AnônQr escuta
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!isSubscribed) return;
          setWsConnected(true);
          setSocketError(null);

          // Enviar imediatamente a ação join_game
          ws.send(
            JSON.stringify({
              type: 'truth_or_dare_action',
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
            if (msg.type === 'truth_or_dare_state' && msg.gameState) {
              setGameState(msg.gameState);
              setWsConnected(true);
              setSocketError(null);
            } else if (msg.type === 'truth_or_dare_error') {
              setSocketError(msg.message || 'Erro do servidor.');
            }
          } catch (err) {
            console.error('Erro ao decodificar mensagem do jogo:', err);
          }
        };

        ws.onerror = () => {
          if (!isSubscribed) return;
          // Não travar a UI, reconexão automática lidará com a reconexão
        };

        ws.onclose = () => {
          if (!isSubscribed) return;
          setWsConnected(false);
          // Reconectar após 2s
          reconnectTimer = setTimeout(() => {
            if (isSubscribed && isOpen) {
              connectWebSocket();
            }
          }, 2000);
        };
      } catch (err) {
        console.error('Erro ao conectar WebSocket do jogo:', err);
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

  // Animação de sorteio de nomes na fase choosing_player
  useEffect(() => {
    if (gameState?.phase === 'choosing_player' && gameState.players.length > 0) {
      const interval = setInterval(() => {
        const randomPlayer =
          gameState.players[Math.floor(Math.random() * gameState.players.length)];
        setRoletteText(randomPlayer.gameNick);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [gameState?.phase, gameState?.players]);

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
          type: 'truth_or_dare_action',
          action,
          roomId: gameRoomId,
          userId: currentUser.id,
          ...payload,
        })
      );
    } else {
      console.warn('[TruthOrDare] Socket fechado ou indisponível ao enviar:', action);
    }
  };

  const handleToggleReady = () => sendAction('toggle_ready');
  const handleSelectLevel = (level: GameLevel) => sendAction('select_level', { level });
  const handleStartGame = () => sendAction('start_game');
  const handleChooseType = (selectedType: 'truth' | 'dare') => sendAction('choose_type', { selectedType });
  const handleConfirmRound = () => sendAction('confirm_round');
  const handleSkipRound = () => sendAction('skip_round');
  const handleEndGame = () => sendAction('end_game');
  const handleRestartGame = () => sendAction('restart_game');

  const handleManualReconnect = () => {
    setSocketError(null);
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 text-slate-100 shadow-2xl p-4 sm:p-6 max-h-[94dvh] overflow-y-auto">
        {/* Background Glows */}
        <div className="absolute -top-20 -right-20 h-56 w-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-56 w-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-base">
              🎭
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                VERDADE OU DESAFIO
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
                O AnônQr conduz. Vocês fazem a brincadeira.
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

        {/* Alerta discreto de desconexão apenas se demorar mais de 3s sem estado */}
        {!wsConnected && !gameState && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
              <span>Conectando ao servidor do jogo...</span>
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

        {/* CONTEÚDO DA PARTIDA */}
        {!gameState ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto" />
            <p className="text-xs text-slate-300 font-bold">Criando/Entrando na partida...</p>
          </div>
        ) : (
          <div className="relative z-10 pt-4 space-y-4">
            {/* FASE 1: LOBBY */}
            {gameState.phase === 'lobby' && (
              <div className="space-y-4">
                {/* Nível da Partida */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Selecione o Nível da Partida:
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
                      {gameState.level === 'light' && '🟢 LEVE'}
                      {gameState.level === 'intense' && '🟡 INTENSO'}
                      {gameState.level === 'heavy' && '🔴 PESADO'}
                      {gameState.level === 'surprise' && '🎲 SURPRESA'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSelectLevel('light')}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        gameState.level === 'light'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      🟢 LEVE
                    </button>
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSelectLevel('intense')}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        gameState.level === 'intense'
                          ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      🟡 INTENSO
                    </button>
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSelectLevel('heavy')}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        gameState.level === 'heavy'
                          ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-950/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      🔴 PESADO
                    </button>
                    <button
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSelectLevel('surprise')}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        gameState.level === 'surprise'
                          ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-950/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      🎲 SURPRESA
                    </button>
                  </div>
                </div>

                {/* Lista de Jogadores no Lobby */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-bold border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-emerald-400" />
                      <span>Jogadores Conectados</span>
                    </span>
                    <span className="text-emerald-400 font-mono">
                      👥 {gameState.players.length} participante{gameState.players.length !== 1 ? 's' : ''}
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
                            style={{ backgroundColor: p.avatarColor || '#10b981' }}
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

                {/* Código & QR Code para Entrada de Amigos */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-200">
                        Convide os amigos para jogar presencialmente:
                      </p>
                      <p className="text-[11px] font-mono text-emerald-400">
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
                          <Copy className="h-3.5 w-3.5 text-emerald-400" />
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
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                    }`}
                  >
                    {myPlayer?.isReady ? '✓ Você está pronto' : 'Estou pronto!'}
                  </button>

                  {isHost && (
                    <button
                      type="button"
                      disabled={gameState.players.length < 2}
                      onClick={handleStartGame}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-black shadow-xl shadow-emerald-950/60 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Play className="h-4 w-4 fill-white" />
                      <span>Iniciar Partida ({gameState.players.length}/2 mín.)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* FASE 2: ANIMAÇÃO DE SORTEIO DO JOGADOR */}
            {gameState.phase === 'choosing_player' && (
              <div className="py-12 text-center space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-3xl animate-bounce">
                  🎲
                </div>
                <h4 className="text-xl font-black text-white uppercase tracking-wider">
                  SORTEANDO O JOGADOR...
                </h4>
                <div className="text-2xl font-black text-emerald-400 font-mono py-2 bg-slate-900/80 rounded-2xl border border-slate-800 max-w-xs mx-auto">
                  {rouletteText}
                </div>
              </div>
            )}

            {/* FASE 3: SELEÇÃO DE VERDADE OU DESAFIO */}
            {gameState.phase === 'selecting_type' && gameState.currentRound && (
              <div className="py-6 text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-extrabold uppercase">
                  <span>🎯 RODADA #{gameState.currentRound.roundNumber}</span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                    Sorteado para esta rodada:
                  </p>
                  <h4 className="text-2xl font-black text-white">
                    {gameState.currentRound.targetNick}
                  </h4>
                </div>

                {/* Se for o próprio sorteado */}
                {gameState.currentRound.targetPlayerId === currentUser.id ? (
                  <div className="space-y-4 max-w-md mx-auto pt-2">
                    <p className="text-sm font-bold text-emerald-300">
                      🎯 É SUA VEZ! Escolha como quer jogar:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleChooseType('truth')}
                        className="py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-950/60 transition-all cursor-pointer flex items-center justify-center gap-2 ring-2 ring-emerald-400/30 active:scale-95"
                      >
                        <Heart className="h-5 w-5 fill-white" />
                        <span>❤️ VERDADE</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleChooseType('dare')}
                        className="py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-sm shadow-xl shadow-amber-950/60 transition-all cursor-pointer flex items-center justify-center gap-2 ring-2 ring-amber-400/30 active:scale-95"
                      >
                        <Flame className="h-5 w-5 fill-white" />
                        <span>🔥 DESAFIO</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 max-w-sm mx-auto">
                    <div className="inline-block animate-pulse text-xl">⏳</div>
                    <p className="text-sm font-bold text-slate-200">
                      <strong>{gameState.currentRound.targetNick}</strong> está escolhendo entre Verdade ou Desafio...
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* FASE 4: ATIVIDADE PRESENCIAL DA RODADA */}
            {gameState.phase === 'round_active' && gameState.currentRound && (
              <div className="space-y-5 py-2">
                {/* Banner e Card de Destaque da Rodada Presencial */}
                <div className="p-5 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 text-center space-y-4 shadow-xl">
                  {/* Badge Tipo de Escolha */}
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-black tracking-wider uppercase">
                    {gameState.currentRound.selectedType === 'truth' ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <Heart className="h-4 w-4 fill-emerald-400" /> ❤️ VERDADE
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <Flame className="h-4 w-4 fill-amber-400" /> 🔥 DESAFIO
                      </span>
                    )}
                  </div>

                  {/* Sorteio do Perguntador / Condutor */}
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                      {gameState.currentRound.selectedType === 'truth' ? '🎤 QUEM FARÁ A PERGUNTA' : '🎤 QUEM IRÁ CONDUZIR'}
                    </p>
                    <p className="text-2xl font-black text-emerald-400">
                      {gameState.currentRound.conductorNick}
                    </p>

                    <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-300 font-semibold space-y-1">
                      <p className="text-sm font-bold text-white">
                        {gameState.currentRound.selectedType === 'truth' ? (
                          <>🗣️ <strong>{gameState.currentRound.conductorNick}</strong>, faça uma pergunta de verdade para <strong className="text-emerald-400">{gameState.currentRound.targetNick}</strong>.</>
                        ) : (
                          <>🗣️ <strong>{gameState.currentRound.conductorNick}</strong>, proponha um desafio para <strong className="text-amber-400">{gameState.currentRound.targetNick}</strong>.</>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 font-normal">
                        {gameState.currentRound.selectedType === 'truth'
                          ? 'A pergunta é criada e feita diretamente entre vocês no mundo real.'
                          : 'O desafio é definido e apresentado diretamente entre vocês no mundo real.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO DOS DISPOSITIVOS */}
                {gameState.currentRound.conductorPlayerId === currentUser.id ? (
                  /* SE FOR O CONDUTOR (QUEM PERGUNTA OU PROPÕE O DESAFIO) */
                  <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-3">
                    <p className="text-xs font-bold text-emerald-300">
                      Você conduz esta rodada no mundo real!
                    </p>

                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleConfirmRound}
                        className="flex-1 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 ring-2 ring-emerald-400/30"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{gameState.currentRound.selectedType === 'truth' ? '✅ Pergunta feita' : '✅ Desafio realizado'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSkipRound}
                        className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Pular
                      </button>
                    </div>
                  </div>
                ) : gameState.currentRound.targetPlayerId === currentUser.id ? (
                  /* SE FOR O RESPONDENTE / REALIZADOR */
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-3">
                    <p className="text-xs font-bold text-amber-300">
                      🎯 Sua vez no mundo real!
                    </p>
                    <p className="text-xs text-slate-300">
                      Aguarde <strong>{gameState.currentRound.conductorNick}</strong> {gameState.currentRound.selectedType === 'truth' ? 'fazer a pergunta' : 'apresentar o desafio'} para você presencialmente.
                    </p>

                    <button
                      type="button"
                      onClick={handleSkipRound}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Pular
                    </button>
                  </div>
                ) : (
                  /* PARA DEMAIS OBSERVADORES */
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center text-xs text-slate-300 space-y-1">
                    <p className="font-medium">
                      Acompanhando a interação entre <strong className="text-emerald-400">{gameState.currentRound.conductorNick}</strong> e <strong className="text-white">{gameState.currentRound.targetNick}</strong> no mundo real...
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* FASE 5: RODADA CONCLUÍDA */}
            {gameState.phase === 'round_completed' && (
              <div className="py-10 text-center space-y-3">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-2xl">
                  ✅
                </div>
                <h4 className="text-xl font-black text-white">
                  RODADA CONCLUÍDA!
                </h4>
                <p className="text-xs text-slate-400 font-medium animate-pulse">
                  🎲 Preparando próxima rodada...
                </p>
              </div>
            )}

            {/* FASE 6: PARTIDA FINALIZADA */}
            {gameState.phase === 'finished' && (
              <div className="py-6 text-center space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  <span>🏆</span>
                  <span>PARTIDA ENCERRADA</span>
                </div>

                <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Rodadas</p>
                    <p className="text-xl font-black text-white">{gameState.roundsCompleted}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Verdades</p>
                    <p className="text-xl font-black text-emerald-400">{gameState.truthsCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Desafios</p>
                    <p className="text-xl font-black text-amber-400">{gameState.daresCount}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isHost && (
                    <button
                      type="button"
                      onClick={handleRestartGame}
                      className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95"
                    >
                      Jogar novamente
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Sair
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

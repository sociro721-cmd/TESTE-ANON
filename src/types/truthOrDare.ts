export type GameLevel = 'light' | 'intense' | 'heavy' | 'surprise';

export type GamePhase =
  | 'lobby'
  | 'choosing_player'
  | 'selecting_type'
  | 'round_active'
  | 'round_completed'
  | 'finished';

export interface GamePlayer {
  id: string;
  originalName: string;
  gameNick: string; // Ex: 🦊 Raposa4821
  avatarColor: string;
  isReady: boolean;
  isHost: boolean;
  isOnline: boolean;
  lastSeenAt: number;
  truthsAnswered: number;
  daresCompleted: number;
  questionsAsked: number;
}

export interface TruthOrDareItem {
  id: string;
  type: 'truth' | 'dare';
  level: 'light' | 'intense' | 'heavy';
  content: string;
}

export interface TruthOrDareRound {
  roundNumber: number;
  targetPlayerId: string; // Quem responde / cumpre desafio
  targetNick: string;
  selectedType?: 'truth' | 'dare';
  contentItem?: TruthOrDareItem;
  conductorPlayerId?: string; // Quem faz a pergunta ou propõe desafio
  conductorNick?: string;
  status: 'selecting_type' | 'active' | 'skipped' | 'completed';
}

export interface TruthOrDareGameState {
  roomId: string;
  hostId: string;
  level: GameLevel;
  effectiveLevel: 'light' | 'intense' | 'heavy'; // resolvido no caso de surprise
  phase: GamePhase;
  players: GamePlayer[];
  roundsCompleted: number;
  truthsCount: number;
  daresCount: number;
  currentRound?: TruthOrDareRound;
  usedContentIds: string[];
  recentTargetIds: string[]; // para evitar repetição do mesmo sorteado
  recentConductorIds: string[]; // para evitar repetição do mesmo condutor
}

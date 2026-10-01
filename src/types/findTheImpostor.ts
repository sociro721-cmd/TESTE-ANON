export type ImpostorGamePhase =
  | 'lobby'
  | 'role_distribution'
  | 'round_speaking'
  | 'free_investigation'
  | 'identity_reveal'
  | 'suspicions_declaration'
  | 'voting'
  | 'tie_break_discussion'
  | 'vote_reveal'
  | 'impostor_last_chance'
  | 'finished';

export interface ImpostorPlayer {
  id: string;
  originalName: string;
  gameNick: string; // Ex: 🐸 Sapo6241
  avatarColor: string;
  isReady: boolean;
  isHost: boolean;
  isOnline: boolean;
  isImpostor?: boolean; // Apenas visível para o próprio jogador
  hasVoted: boolean;
  votedForId?: string;
  suspectedId?: string;
}

export interface ImpostorScenario {
  id: string;
  name: string;
  icon: string;
}

export interface ImpostorGameState {
  roomId: string;
  hostId: string;
  phase: ImpostorGamePhase;
  players: ImpostorPlayer[];
  scenario?: ImpostorScenario; // Omitido do impostor durante o jogo!
  scenarioOptions?: ImpostorScenario[]; // 4 opções de múltipla escolha para a última chance do impostor
  currentRound: number; // 1, 2 ou 3
  speakingOrder: string[]; // IDs dos jogadores na ordem de fala
  currentSpeakerIndex: number;
  currentPromptSuggestion?: string; // Sugestão de fala para o jogador da vez
  voteCounts?: Record<string, number>;
  mostVotedPlayerId?: string;
  isMostVotedImpostor?: boolean;
  impostorGuess?: string;
  winner?: 'group' | 'impostor';
  tiePlayerIds?: string[];
  historyLog?: string[];
}

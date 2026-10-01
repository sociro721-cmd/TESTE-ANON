export interface UserPresentation {
  profileLookingFor: string[];
  profileInterests: string[];
  profileAvailability: string | null;
  profileDesires: string[];
}

export const DEFAULT_USER_PRESENTATION: UserPresentation = {
  profileLookingFor: [],
  profileInterests: [],
  profileAvailability: null,
  profileDesires: [],
};

export const SUGGESTIONS_LOOKING_FOR = [
  '💬 Conversa casual',
  '🧠 Debate',
  '🎮 Jogos',
  '💻 Tecnologia',
  '❤️ Relacionamentos',
  '🎬 Filmes',
  '🤝 Networking',
];

export const SUGGESTIONS_INTERESTS = [
  '🎬 Filmes',
  '💻 Tecnologia',
  '🚀 Startups',
  '🎮 Jogos',
  '🧠 Filosofia',
];

export const SUGGESTIONS_AVAILABILITY = [
  '🟢 Conversar agora',
  '🟡 Conversar mais tarde',
  '🔴 Não estou disponível',
];

export const SUGGESTIONS_DESIRES = [
  '✈️ Viajar para determinado lugar',
  '🌎 Conhecer outros países',
  '❤️ Encontrar alguém especial',
  '👫 Fazer novas amizades',
  '🎭 Viver experiências diferentes',
  '🧠 Conhecer novas perspectivas',
  '🔥 Explorar algo novo',
  '🏕️ Fazer uma aventura',
  '📸 Conhecer pessoas para viajar',
  '🔞 Desejos adultos',
];

// Limites razoáveis para manter organização visual
export const MAX_TAG_LENGTH = 40;
export const MAX_TAGS_PER_CATEGORY = 12;

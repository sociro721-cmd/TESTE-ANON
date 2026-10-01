export type ConfessionCategory =
  | 'Amor'
  | 'Segredos'
  | 'Nunca contei'
  | 'Desejos'
  | 'Pensamentos'
  | 'Engraçadas'
  | 'Desabafos'
  | 'Adulto';

export interface ConfessionReply {
  id: string;
  confessionId: string;
  authorId: string;
  authorNick: string;
  content: string;
  createdAt: number;
}

export interface Confession {
  id: string;
  content: string;
  category?: ConfessionCategory | null;
  authorId: string;
  authorNick: string;
  createdAt: number;
  reactions: Record<string, number>;
  userReactions?: Record<string, string[]>;
  repliesCount: number;
  replies: ConfessionReply[];
}

export type ConfessionSortFilter = 'trending' | 'recent' | 'discussed' | 'random';

export const CONFESSION_REACTION_TYPES = [
  '🫂 Eu também',
  '👀 Me identifiquei',
  '🥹 Senti isso',
  '🤫 Nunca contei',
  '😂 Eu ri',
  '😳 Não esperava',
  '🧠 Fiquei pensando',
];

export const CONFESSION_CATEGORIES: { name: ConfessionCategory; emoji: string }[] = [
  { name: 'Amor', emoji: '❤️' },
  { name: 'Segredos', emoji: '🤫' },
  { name: 'Nunca contei', emoji: '😳' },
  { name: 'Desejos', emoji: '✨' },
  { name: 'Pensamentos', emoji: '🧠' },
  { name: 'Engraçadas', emoji: '😂' },
  { name: 'Desabafos', emoji: '🥀' },
  { name: 'Adulto', emoji: '🔞' },
];

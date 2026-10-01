export type RoomType =
  | 'open'
  | 'group_temp'
  | 'group_perm'
  | 'duo_temp'
  | 'duo_perm'
  | 'duo_multi_temp'
  | 'duo_multi_perm';

export interface AnonymousUser {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface ChatAttachment {
  type: 'image' | 'video';
  url: string;
  name: string;
  size?: number;
}

export interface ThemedRoom {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  accessKey: string;
  createdAt: number;
  onlineCount: number;
  maxParticipants: number;
  durationMinutes: number;
  expiresAt: number;
  hasPasscode: boolean;
  isOpenRoom?: boolean;
  isPermanent?: boolean;
  roomType?: RoomType;
  hasMultiChat?: boolean;
  isCustom?: boolean;
  isExpired?: boolean;
  voucherToken?: string;
  compraId?: string;
  activatedAt?: number;
  creatorPasscode?: string; // only returned to creator or in ticket
  channelPasscodes?: Record<string, string>;
  allowedChannels?: string[];
  assignedChannelId?: string;
  isMaster?: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  channelId?: string;
  sender: AnonymousUser;
  content: string;
  attachment?: ChatAttachment;
  timestamp: number;
  type: 'text' | 'system' | 'image' | 'video' | 'audio';
  reactions?: Record<string, number>;
  audioUrl?: string;
  audioDuration?: number;
}

export interface QRDataPayload {
  protocol: 'anonqr';
  version: 1;
  roomId: string;
  accessKey: string;
  roomName: string;
  timestamp: number;
  passcodeRequired?: boolean;
}

export interface OwnerVoucher {
  token: string;
  roomType: RoomType;
  durationMinutes: number;
  isPermanent: boolean;
  maxParticipants: number;
  hasMultiChat?: boolean;
  label?: string; // Developer / Owner identifier for this client (e.g. "Cliente WhatsApp - Marcos")
  createdAt: number;
  expiresAt?: number;
  usedAt?: number;
  usedByRoomId?: string;
  roomName?: string; // Name created by the client who used the link
  creatorPasscode?: string; // Passcode created by the client who used the link
  roomExpiresAt?: number;
  roomOnlineCount?: number;
  roomHasTimeLeft?: boolean;
  status: 'available' | 'active' | 'expired';
}

export interface OwnerRoomInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  createdAt: number;
  durationMinutes: number;
  expiresAt: number;
  timeLeftSeconds: number;
  isExpired: boolean;
  isPermanent?: boolean;
  isOpenRoom?: boolean;
  roomType?: RoomType;
  hasMultiChat?: boolean;
  maxParticipants: number;
  onlineCount: number;
  creatorPasscode?: string;
  channelPasscodes?: Record<string, string>;
  isCustom?: boolean;
  voucherToken?: string;
  shareUrl: string;
  accessKey?: string;
}

export const PIX_KEY = '1e74e7ae-06e1-44d5-ba1c-21e5348dfbc3';

export interface RoomPricingOption {
  id: string;
  roomType: RoomType;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  durationLabel: string;
  durationMinutes: number;
  isPermanent: boolean;
  hasMultiChat: boolean;
  priceValue: number;
  priceFormatted: string;
}

export interface PurchaseOrder {
  id: string; // e.g. "PED-9481"
  catalogId: string;
  roomType: RoomType;
  roomTitle: string;
  durationLabel: string;
  durationMinutes: number;
  isPermanent: boolean;
  hasMultiChat: boolean;
  priceValue: number;
  priceFormatted: string;
  pixKey: string;
  customerName: string;
  desiredRoomName?: string;
  desiredPasscode?: string;
  status: 'pending' | 'approved' | 'cancelled';
  userId?: string;
  userEmail?: string;
  createdAt: number;
  approvedAt?: number;
  approvedRoomId?: string;
  approvedRoomLink?: string;
  approvedPasscode?: string;
  approvedChannelPasscodes?: Record<string, string>;
}

export const ROOM_CATALOGUE: RoomPricingOption[] = [
  // 1. Sala de Grupo Temporária
  {
    id: 'group_temp_30m',
    roomType: 'group_temp',
    title: 'Sala de Grupo (Temporária)',
    badge: '10 Pessoas • 30m',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    description: 'Sala de bate-papo em grupo com limite de 10 pessoas e contagem regressiva.',
    durationLabel: '30 Minutos',
    durationMinutes: 30,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 0.90,
    priceFormatted: 'R$ 0,90',
  },
  {
    id: 'group_temp_1h',
    roomType: 'group_temp',
    title: 'Sala de Grupo (Temporária)',
    badge: '10 Pessoas • 1h',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    description: 'Sala de bate-papo em grupo com limite de 10 pessoas e contagem regressiva.',
    durationLabel: '1 Hora (60m)',
    durationMinutes: 60,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 1.50,
    priceFormatted: 'R$ 1,50',
  },
  {
    id: 'group_temp_2h',
    roomType: 'group_temp',
    title: 'Sala de Grupo (Temporária)',
    badge: '10 Pessoas • 2h',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    description: 'Sala de bate-papo em grupo com limite de 10 pessoas e contagem regressiva.',
    durationLabel: '2 Horas (120m)',
    durationMinutes: 120,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 2.50,
    priceFormatted: 'R$ 2,50',
  },
  {
    id: 'group_temp_4h',
    roomType: 'group_temp',
    title: 'Sala de Grupo (Temporária)',
    badge: '10 Pessoas • 4h',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    description: 'Sala de bate-papo em grupo com limite de 10 pessoas e contagem regressiva.',
    durationLabel: '4 Horas (240m)',
    durationMinutes: 240,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 4.00,
    priceFormatted: 'R$ 4,00',
  },
  {
    id: 'group_temp_12h',
    roomType: 'group_temp',
    title: 'Sala de Grupo (Temporária)',
    badge: '10 Pessoas • 12h',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    description: 'Sala de bate-papo em grupo com limite de 10 pessoas e contagem regressiva.',
    durationLabel: '12 Horas (720m)',
    durationMinutes: 720,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 6.00,
    priceFormatted: 'R$ 6,00',
  },
  {
    id: 'group_temp_24h',
    roomType: 'group_temp',
    title: 'Sala de Grupo (Temporária)',
    badge: '10 Pessoas • 24h',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    description: 'Sala de bate-papo em grupo com limite de 10 pessoas e contagem regressiva.',
    durationLabel: '24 Horas (1440m)',
    durationMinutes: 1440,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 10.00,
    priceFormatted: 'R$ 10,00',
  },

  // 2. Sala de Grupo Permanente
  {
    id: 'group_perm',
    roomType: 'group_perm',
    title: 'Sala de Grupo (Permanente)',
    badge: '10 Pessoas • Permanente',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    description: 'Sala de bate-papo em grupo com limite de 10 pessoas, sem limite de tempo (não expira).',
    durationLabel: 'Permanente (Sem Expiração)',
    durationMinutes: 0,
    isPermanent: true,
    hasMultiChat: false,
    priceValue: 15.90,
    priceFormatted: 'R$ 15,90',
  },

  // 3. Sala Dupla (Temporária) - Chat Único
  {
    id: 'duo_temp_30m',
    roomType: 'duo_temp',
    title: 'Sala Dupla (Temporária)',
    badge: '2 Pessoas • 30m',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    description: 'Sala privativa exclusiva para 2 pessoas com contagem regressiva.',
    durationLabel: '30 Minutos',
    durationMinutes: 30,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 0.90,
    priceFormatted: 'R$ 0,90',
  },
  {
    id: 'duo_temp_1h',
    roomType: 'duo_temp',
    title: 'Sala Dupla (Temporária)',
    badge: '2 Pessoas • 1h',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    description: 'Sala privativa exclusiva para 2 pessoas com contagem regressiva.',
    durationLabel: '1 Hora (60m)',
    durationMinutes: 60,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 1.50,
    priceFormatted: 'R$ 1,50',
  },
  {
    id: 'duo_temp_2h',
    roomType: 'duo_temp',
    title: 'Sala Dupla (Temporária)',
    badge: '2 Pessoas • 2h',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    description: 'Sala privativa exclusiva para 2 pessoas com contagem regressiva.',
    durationLabel: '2 Horas (120m)',
    durationMinutes: 120,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 2.50,
    priceFormatted: 'R$ 2,50',
  },
  {
    id: 'duo_temp_4h',
    roomType: 'duo_temp',
    title: 'Sala Dupla (Temporária)',
    badge: '2 Pessoas • 4h',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    description: 'Sala privativa exclusiva para 2 pessoas com contagem regressiva.',
    durationLabel: '4 Horas (240m)',
    durationMinutes: 240,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 4.00,
    priceFormatted: 'R$ 4,00',
  },
  {
    id: 'duo_temp_12h',
    roomType: 'duo_temp',
    title: 'Sala Dupla (Temporária)',
    badge: '2 Pessoas • 12h',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    description: 'Sala privativa exclusiva para 2 pessoas com contagem regressiva.',
    durationLabel: '12 Horas (720m)',
    durationMinutes: 720,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 6.00,
    priceFormatted: 'R$ 6,00',
  },
  {
    id: 'duo_temp_24h',
    roomType: 'duo_temp',
    title: 'Sala Dupla (Temporária)',
    badge: '2 Pessoas • 24h',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    description: 'Sala privativa exclusiva para 2 pessoas com contagem regressiva.',
    durationLabel: '24 Horas (1440m)',
    durationMinutes: 1440,
    isPermanent: false,
    hasMultiChat: false,
    priceValue: 10.00,
    priceFormatted: 'R$ 10,00',
  },

  // 4. Sala Dupla (Permanente) - Chat Único
  {
    id: 'duo_perm',
    roomType: 'duo_perm',
    title: 'Sala Dupla (Permanente)',
    badge: '2 Pessoas • Permanente',
    badgeColor: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
    description: 'Sala privativa exclusiva para 2 pessoas. Permanente (sem expiração).',
    durationLabel: 'Permanente (Sem Expiração)',
    durationMinutes: 0,
    isPermanent: true,
    hasMultiChat: false,
    priceValue: 19.90,
    priceFormatted: 'R$ 19,90',
  },
];

// --- SISTEMA DE VENDA INDIVIDUAL DE SALAS (SUPABASE) ---
export type SalaStatus = 'available' | 'pending' | 'sold';
export type CompraStatus = 'pending' | 'paid' | 'cancelled' | 'rejected' | 'expired';

export interface SalaProduto {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  status: SalaStatus;
  comprador_id?: string | null;
  categoria?: string;
  icone?: string;
  cor?: string;
  max_participantes?: number;
  duracao_label?: string;
  duracao_minutos?: number;
  is_permanente?: boolean;
  room_type?: RoomType;
  badge?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CompraOrdem {
  id: string;
  user_id: string;
  sala_id: string;
  valor: number;
  status: CompraStatus;
  payment_id?: string | null;
  metodo_pagamento?: string | null;
  duration_minutes?: number | null;
  is_permanent?: boolean | null;
  activated_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  sala?: SalaProduto;
}

export const WHATSAPP_SUPPORT_URL = 'https://wa.me/qr/FVT7IK7T3SAGC1';

// --- MENSAGENS PRIVADAS 1x1 ENTRE USUÁRIOS ---
export interface PrivateChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderNick?: string;
  senderAvatarUrl?: string | null;
  senderAvatarColor?: string;
  senderAvatarIcon?: string;
  content: string;
  timestamp: number;
  type: 'text' | 'audio' | 'image';
  audioUrl?: string;
  audioDuration?: number;
  imageUrl?: string;
  imageName?: string;
}

export interface PrivateConversationParticipant {
  id: string;
  nick?: string;
  name?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarIcon?: string;
  isOnline?: boolean;
}

/**
 * Gera um ID de conversa privada determinístico e simétrico entre 2 usuários.
 * buildPrivateConversationId(A, B) === buildPrivateConversationId(B, A)
 */
export function buildPrivateConversationId(userIdA: string, userIdB: string): string {
  const sorted = [String(userIdA || '').trim(), String(userIdB || '').trim()].sort();
  return `dm_${sorted[0]}__${sorted[1]}`;
}

export interface PrivateConversationSummary {
  conversationId: string;
  otherParticipant: {
    id: string;
    nick: string;
    name?: string;
    avatar_url?: string | null;
    avatarColor?: string;
    avatarIcon?: string;
    isOnline?: boolean;
  };
  lastMessage: string | null;
  lastMessageAt: number;
  lastMessageType: 'text' | 'audio' | 'image' | null;
  unreadCount: number;
  createdAt: number;
}





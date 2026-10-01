import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

export type RoomType =
  | 'open'
  | 'group_temp'
  | 'group_perm'
  | 'duo_temp'
  | 'duo_perm'
  | 'duo_multi_temp'
  | 'duo_multi_perm';

interface AnonymousUser {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string;
}

export interface ChatAttachment {
  type: 'image' | 'video';
  url: string;
  name: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  channelId?: string;
  sender: AnonymousUser;
  content: string;
  timestamp: number;
  type: 'text' | 'system' | 'image' | 'video' | 'audio';
  attachment?: ChatAttachment;
  reactions?: Record<string, number>;
  audioUrl?: string;
  audioDuration?: number;
}

interface OwnerVoucher {
  token: string;
  roomType: RoomType;
  durationMinutes: number; // 0 if permanent
  isPermanent: boolean;
  maxParticipants: number; // 10 for group, 2 for duo
  hasMultiChat: boolean;   // false
  label?: string;          // Developer / Owner identifier for this client (e.g. "Cliente WhatsApp - Dr. Ricardo")
  createdAt: number;
  expiresAt?: number;
  usedAt?: number;
  usedByRoomId?: string;
  roomName?: string;       // Name chosen by the client
  creatorPasscode?: string; // Passcode chosen by the client
  status: 'available' | 'active' | 'expired';
}

interface RoomData {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  accessKey: string;
  creatorPasscode: string; // Passcode set by creator/client
  channelPasscodes?: Record<string, string>; // e.g. { chat_1: 'C1-8492', chat_2: 'C2-8492', ... }
  channelAccessKeys?: Record<string, string>; // e.g. { chat_1: 'key_1...', chat_2: 'key_2...', ... }
  createdAt: number;
  durationMinutes: number;
  expiresAt: number;
  maxParticipants: number; // 10 for group, 2 for duo, 100 for open
  isOpenRoom?: boolean;    // true only for the 3 main open rooms
  isPermanent?: boolean;   // true if no expiration
  roomType?: RoomType;
  hasMultiChat?: boolean;
  isCustom?: boolean;
  isExpired?: boolean;
  voucherToken?: string;
  compraId?: string;
  activatedAt?: number;
  messages: ChatMessage[];
  knownParticipants?: Record<string, KnownParticipant>;
}

export interface KnownParticipant {
  id: string;
  name: string;
  avatarColor?: string;
  avatarIcon?: string;
  firstJoinedAt: number;
  lastSeenAt?: number;
}

export const PIX_KEY = '1e74e7ae-06e1-44d5-ba1c-21e5348dfbc3';

export interface PurchaseCycle {
  compraId: string;
  userId?: string;
  salaId: string;
  durationMinutes: number;
  isPermanent: boolean;
  activatedAt?: number; // timestamp em ms do 1º acesso
  expiresAt?: number;   // timestamp em ms (0 se permanente)
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'rejected';
  createdAt?: number;
  updatedAt?: number;
}

interface PurchaseOrder {
  id: string; // e.g. "PED-8492"
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
  createdAt: number;
  approvedAt?: number;
  approvedRoomId?: string;
  approvedRoomLink?: string;
  approvedPasscode?: string;
  approvedChannelPasscodes?: Record<string, string>;
}

// Stores
const rooms = new Map<string, RoomData>();
const vouchers = new Map<string, OwnerVoucher>();
const purchaseOrders = new Map<string, PurchaseOrder>();
const purchaseCycles = new Map<string, PurchaseCycle>();

// Persistent file storage on disk
const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// Supabase backend client configuration
const SUPABASE_BACKEND_URL = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://srclzysflycxyedgmwaz.supabase.co/rest/v1/'
).trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

// Chave privada service_role (USO EXCLUSIVO DO BACKEND - NUNCA expor no frontend ou respostas HTTP)
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Chave pública anon para clientes públicos e scoped
const SUPABASE_ANON_KEY = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_3Mbqn0oAgUajihKqht4YpA_WwKeqBCX'
).trim();

// supabaseAdmin: Cliente privilegiado (service_role) EXCLUSIVO do backend para jobs de background, expiração e tarefas administrativas
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_BACKEND_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// supabaseServer: Cliente unauthenticated/anon usado apenas para leituras públicas sem privilégios
const supabaseServer = createClient(SUPABASE_BACKEND_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Verificação de inicialização e alerta explícito se a service_role key não estiver configurada
if (!supabaseAdmin) {
  console.error(
    '\n================================================================================\n' +
    '[AVISO CRÍTICO DE BACKEND] SUPABASE_SERVICE_ROLE_KEY NÃO CONFIGURADA!\n' +
    'O job periódico de expiração (markPurchaseExpired) e a RPC expirar_ciclo_compra\n' +
    'exigem SUPABASE_SERVICE_ROLE_KEY no ambiente do backend para alterar o status no Supabase.\n' +
    'Enquanto essa variável não for definida no servidor, a persistência de expiração falhará com erro explícito.\n' +
    '================================================================================\n'
  );
} else {
  console.log('[Supabase Lifecycle] Cliente backend supabaseAdmin inicializado com SUPABASE_SERVICE_ROLE_KEY.');
  // Sincronização idempotente dos 14 produtos do ROOM_CATALOGUE com public.salas
  ensureCatalogueInSupabase().catch((err) => {
    console.warn('[Supabase Sync] Falha ao verificar catálogo no Supabase:', err);
  });
}

/**
 * Garante a sincronização idempotente dos 14 produtos oficiais do ROOM_CATALOGUE
 * na tabela public.salas do Supabase, preservando rigorosamente os 6 produtos antigos.
 */
async function ensureCatalogueInSupabase() {
  if (!supabaseAdmin) return;
  try {
    const products = [
      { id: 'group_temp_30m', nome: 'Sala de Grupo - 30 Minutos', descricao: '30 Minutos', categoria: 'grupo', valor: 0.90, status: 'available', icone: '👥', cor: '#10b981', max_participantes: 10 },
      { id: 'group_temp_1h', nome: 'Sala de Grupo - 1 Hora', descricao: '1 Hora', categoria: 'grupo', valor: 1.50, status: 'available', icone: '👥', cor: '#10b981', max_participantes: 10 },
      { id: 'group_temp_2h', nome: 'Sala de Grupo - 2 Horas', descricao: '2 Horas', categoria: 'grupo', valor: 2.50, status: 'available', icone: '👥', cor: '#10b981', max_participantes: 10 },
      { id: 'group_temp_4h', nome: 'Sala de Grupo - 4 Horas', descricao: '4 Horas', categoria: 'grupo', valor: 4.00, status: 'available', icone: '👥', cor: '#10b981', max_participantes: 10 },
      { id: 'group_temp_12h', nome: 'Sala de Grupo - 12 Horas', descricao: '12 Horas', categoria: 'grupo', valor: 6.00, status: 'available', icone: '👥', cor: '#10b981', max_participantes: 10 },
      { id: 'group_temp_24h', nome: 'Sala de Grupo - 24 Horas', descricao: '24 Horas', categoria: 'grupo', valor: 10.00, status: 'available', icone: '👥', cor: '#10b981', max_participantes: 10 },
      { id: 'group_perm', nome: 'Sala de Grupo - Permanente', descricao: 'Permanente', categoria: 'grupo', valor: 15.90, status: 'available', icone: '👥', cor: '#10b981', max_participantes: 10 },
      { id: 'duo_temp_30m', nome: 'Sala Dupla 1x1 - 30 Minutos', descricao: '30 Minutos', categoria: 'dupla', valor: 0.90, status: 'available', icone: '🔒', cor: '#06b6d4', max_participantes: 2 },
      { id: 'duo_temp_1h', nome: 'Sala Dupla 1x1 - 1 Hora', descricao: '1 Hora', categoria: 'dupla', valor: 1.50, status: 'available', icone: '🔒', cor: '#06b6d4', max_participantes: 2 },
      { id: 'duo_temp_2h', nome: 'Sala Dupla 1x1 - 2 Horas', descricao: '2 Horas', categoria: 'dupla', valor: 2.50, status: 'available', icone: '🔒', cor: '#06b6d4', max_participantes: 2 },
      { id: 'duo_temp_4h', nome: 'Sala Dupla 1x1 - 4 Horas', descricao: '4 Horas', categoria: 'dupla', valor: 4.00, status: 'available', icone: '🔒', cor: '#06b6d4', max_participantes: 2 },
      { id: 'duo_temp_12h', nome: 'Sala Dupla 1x1 - 12 Horas', descricao: '12 Horas', categoria: 'dupla', valor: 6.00, status: 'available', icone: '🔒', cor: '#06b6d4', max_participantes: 2 },
      { id: 'duo_temp_24h', nome: 'Sala Dupla 1x1 - 24 Horas', descricao: '24 Horas', categoria: 'dupla', valor: 10.00, status: 'available', icone: '🔒', cor: '#06b6d4', max_participantes: 2 },
      { id: 'duo_perm', nome: 'Sala Dupla 1x1 - Permanente', descricao: 'Permanente', categoria: 'dupla', valor: 19.90, status: 'available', icone: '🔒', cor: '#ec4899', max_participantes: 2 },
    ];
    for (const p of products) {
      await supabaseAdmin.from('salas').upsert(p, { onConflict: 'id' });
    }
    console.log('[Supabase Sync] 14 produtos oficiais do catálogo verificados e sincronizados com sucesso.');
  } catch (err) {
    console.warn('[Supabase Sync] Aviso ao sincronizar catálogo:', err);
  }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveStore() {
  try {
    ensureDataDir();
    const data = {
      vouchers: Array.from(vouchers.entries()),
      purchaseOrders: Array.from(purchaseOrders.entries()),
      purchaseCycles: Array.from(purchaseCycles.entries()),
      rooms: Array.from(rooms.entries()).map(([k, r]) => [
        k,
        {
          ...r,
          messages: r.messages.slice(-50), // keep latest 50
        },
      ]),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store to disk:', err);
  }
}

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.vouchers)) {
        for (const [k, v] of data.vouchers) {
          vouchers.set(k, v);
        }
      }
      if (Array.isArray(data.purchaseOrders)) {
        for (const [k, po] of data.purchaseOrders) {
          purchaseOrders.set(k, po);
        }
      }
      if (Array.isArray(data.purchaseCycles)) {
        for (const [k, pc] of data.purchaseCycles) {
          // Atualiza status se o ciclo temporário já expirou
          if (!pc.isPermanent && pc.expiresAt && Date.now() > pc.expiresAt) {
            pc.status = 'expired';
          }
          purchaseCycles.set(k, pc);
        }
      }
      if (Array.isArray(data.rooms)) {
        for (const [k, r] of data.rooms) {
          const isPerm = !!r.isPermanent || r.roomType === 'group_perm' || r.roomType === 'duo_perm' || r.durationMinutes === 0 || !!r.isOpenRoom;
          if (isPerm) {
            r.isPermanent = true;
            r.isExpired = false;
            r.expiresAt = 0;
          } else if (r.expiresAt && Date.now() > r.expiresAt) {
            r.isExpired = true;
          }
          // Se a sala estiver associada a um ciclo de compra conhecido, sincroniza o prazo definitivo
          if (r.compraId && purchaseCycles.has(r.compraId)) {
            const pc = purchaseCycles.get(r.compraId)!;
            if (pc.isPermanent) {
              r.isPermanent = true;
              r.expiresAt = 0;
              r.isExpired = false;
            } else if (pc.expiresAt && pc.expiresAt > 0) {
              r.expiresAt = pc.expiresAt;
              if (Date.now() > pc.expiresAt || pc.status === 'expired') {
                r.isExpired = true;
              }
            }
          }
          rooms.set(k, r);
        }
      }
      console.log(`[Store] Loaded ${vouchers.size} vouchers, ${purchaseOrders.size} purchase orders, ${purchaseCycles.size} cycles, and ${rooms.size} rooms from disk.`);
    }
  } catch (err) {
    console.error('Error loading store from disk:', err);
  }
}

// Load any previously persisted data immediately
loadStore();

// Helper universal para interpretar textos e extrair duração em minutos e permanência
function parseDurationFromText(text: string): { durationMinutes: number; isPermanent: boolean } | null {
  if (!text) return null;
  const s = text.toLowerCase().trim();

  if (s.includes('permanente') || s.includes('vitalícia') || s.includes('vitalicia') || s.includes('vitalício') || s.includes('vitalicio')) {
    return { durationMinutes: 0, isPermanent: true };
  }

  // Horas (ex: 24 horas, 4 horas, 2 horas, 1 hora, 12h, 4h, 24h)
  const hoursMatch = s.match(/(\d+)\s*(?:horas|hora|h\b)/i);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    return { durationMinutes: hours * 60, isPermanent: false };
  }

  // Minutos (ex: 30 minutos, 30min, 30m, 60m)
  const minutesMatch = s.match(/(\d+)\s*(?:minutos|minuto|min|m\b)/i);
  if (minutesMatch) {
    const mins = parseInt(minutesMatch[1], 10);
    return { durationMinutes: mins, isPermanent: false };
  }

  // Dias (ex: 1 dia, 7 dias)
  const daysMatch = s.match(/(\d+)\s*(?:dias|dia|d\b)/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return { durationMinutes: days * 24 * 60, isPermanent: false };
  }

  return null;
}

// Helper universal para extrair informações de duração a partir de qualquer objeto de sala ou texto
function parseDurationFromTextOrEntity(entityOrText: any): { durationMinutes: number; isPermanent: boolean } | null {
  if (!entityOrText) return null;

  if (typeof entityOrText === 'object') {
    if (entityOrText.is_permanente === true || entityOrText.is_permanent === true || entityOrText.isPermanent === true) {
      return { durationMinutes: 0, isPermanent: true };
    }
    if (typeof entityOrText.duracao_minutos === 'number' && entityOrText.duracao_minutos > 0) {
      return { durationMinutes: entityOrText.duracao_minutos, isPermanent: false };
    }
    if (typeof entityOrText.duration_minutes === 'number' && entityOrText.duration_minutes > 0) {
      return { durationMinutes: entityOrText.duration_minutes, isPermanent: false };
    }

    const combined = [
      entityOrText.descricao,
      entityOrText.duracao_label,
      entityOrText.nome,
      entityOrText.categoria,
      entityOrText.id,
    ].filter(Boolean).join(' ');

    return parseDurationFromText(combined);
  }

  return parseDurationFromText(String(entityOrText));
}

// Catálogo estático oficial de referência para salas predefinidas
const STATIC_ROOM_CATALOGUE = [
  { id: 'sala-vip-master-01', durationMinutes: 0, isPermanent: true, maxParticipants: 10, roomType: 'group_perm' as RoomType, title: 'VIP Master Permanente' },
  { id: 'sala-grupo-gold-03', durationMinutes: 1440, isPermanent: false, maxParticipants: 10, roomType: 'group_temp' as RoomType, title: 'Grupo Gold 24h' },
  { id: 'sala-grupo-express-04', durationMinutes: 240, isPermanent: false, maxParticipants: 10, roomType: 'group_temp' as RoomType, title: 'Grupo Express 4h' },
  { id: 'sala-duo-confidencial-05', durationMinutes: 120, isPermanent: false, maxParticipants: 2, roomType: 'duo_temp' as RoomType, title: 'Duo Confidencial 2h' },
  { id: 'sala-iniciante-flash-06', durationMinutes: 60, isPermanent: false, maxParticipants: 10, roomType: 'group_temp' as RoomType, title: 'Iniciante Flash 1h' },
];

// Helper para derivar informacoes de produto a partir de salaEntity, compraRecord ou catalogo/identificador
function getProductDurationAndType(
  salaId: string,
  salaEntity?: any,
  compraRecord?: any
): {
  durationMinutes: number;
  isPermanent: boolean;
  maxParticipants: number;
  roomType: RoomType;
  title: string;
  description: string;
} {
  const s = (salaId || '').toLowerCase();

  // 1. Tenta extrair da compra se já persistido explicitamente
  let durationInfo: { durationMinutes: number; isPermanent: boolean } | null = null;
  if (compraRecord) {
    if (compraRecord.is_permanent === true) {
      durationInfo = { durationMinutes: 0, isPermanent: true };
    } else if (typeof compraRecord.duration_minutes === 'number' && compraRecord.duration_minutes > 0) {
      durationInfo = { durationMinutes: compraRecord.duration_minutes, isPermanent: false };
    }
  }

  // 2. Tenta extrair da entidade de sala cadastrada no banco de dados (public.salas)
  if (!durationInfo && salaEntity) {
    durationInfo = parseDurationFromTextOrEntity(salaEntity);
  }

  // 3. Tenta encontrar no catálogo estático por ID
  if (!durationInfo) {
    const cat = STATIC_ROOM_CATALOGUE.find((p) => p.id === salaId);
    if (cat) {
      durationInfo = { durationMinutes: cat.durationMinutes, isPermanent: cat.isPermanent };
    }
  }

  // 4. Tenta extrair a partir de padrões textuais no próprio ID da sala (ex: 4h, 24h, 2h, perm)
  if (!durationInfo) {
    durationInfo = parseDurationFromText(salaId);
  }

  const isPerm = durationInfo?.isPermanent ?? (s.includes('perm') || s.includes('permanente'));
  const durationMinutes = isPerm ? 0 : (durationInfo?.durationMinutes ?? 60);

  const isDuo = (salaEntity?.categoria === 'dupla') || (salaEntity?.max_participantes === 2) || s.includes('duo') || s.includes('dupla');
  const maxParticipants = salaEntity?.max_participantes || (isDuo ? 2 : 10);

  const roomType: RoomType = isDuo
    ? (isPerm ? 'duo_perm' : 'duo_temp')
    : (isPerm ? 'group_perm' : 'group_temp');

  const title = salaEntity?.nome || (STATIC_ROOM_CATALOGUE.find((p) => p.id === salaId)?.title) || salaId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const description = salaEntity?.descricao || (isDuo
    ? 'Sala privativa exclusiva para 2 pessoas.'
    : 'Sala privada temporária de alta segurança.');

  return {
    durationMinutes,
    isPermanent: isPerm,
    maxParticipants,
    roomType,
    title,
    description,
  };
}

// Marca uma compra como expirada de forma consistente no Supabase e no store local
async function markPurchaseExpired(compraId: string, scopedClient?: any): Promise<{ success: boolean; error?: string }> {
  try {
    const cycle = purchaseCycles.get(compraId);
    if (cycle) {
      cycle.status = 'expired';
      cycle.updatedAt = Date.now();
      purchaseCycles.set(compraId, cycle);
    }

    // Sincroniza todas as salas em memória vinculadas a este compraId
    for (const [, r] of rooms.entries()) {
      if (r.compraId === compraId) {
        r.isExpired = true;
      }
    }
    saveStore();

    // Prioridade de cliente para expiração no banco:
    // 1. supabaseAdmin (backend autorizado com SUPABASE_SERVICE_ROLE_KEY) - autoridade máxima de background
    // 2. scopedClient (se houver e for autenticado com token do proprietário da compra)
    const clientToUse = supabaseAdmin || scopedClient;

    if (!clientToUse) {
      const errMsg = `[Lifecycle V3] Falha ao expirar compra #${compraId} no Supabase: SUPABASE_SERVICE_ROLE_KEY não está configurada no backend e nenhum cliente autenticado foi fornecido.`;
      console.error(errMsg);
      return { success: false, error: errMsg };
    }

    // Invoca estritamente a RPC V3 SECURITY DEFINER expirar_ciclo_compra
    const { data: rpcRes, error: rpcErr } = await clientToUse.rpc('expirar_ciclo_compra', {
      p_compra_id: compraId,
    });

    if (rpcErr) {
      const errMsg = `[Lifecycle V3] Erro na RPC expirar_ciclo_compra para compra #${compraId}: [${rpcErr.code || 'UNKNOWN'}] ${rpcErr.message}`;
      console.error(errMsg, rpcErr);
      return { success: false, error: errMsg };
    }

    if (!rpcRes?.success) {
      const reason = rpcRes?.reason || 'REJEITADO_PELA_RPC';
      const warnMsg = `[Lifecycle V3] RPC expirar_ciclo_compra não expirou compra #${compraId}. Motivo: ${reason}`;
      console.warn(warnMsg, rpcRes);
      return { success: false, error: warnMsg };
    }

    console.log(`[Lifecycle V3] Compra #${compraId} marcada com sucesso como 'expired' via RPC expirar_ciclo_compra.`);
    return { success: true };
  } catch (err: any) {
    const errMsg = `[Lifecycle V3] Exceção inesperada ao marcar compra #${compraId} como expirada: ${err?.message || err}`;
    console.error(errMsg, err);
    return { success: false, error: errMsg };
  }
}

interface PersistActivationResult {
  success: boolean;
  activatedAt?: number;
  expiresAt?: number;
  durationMinutes?: number;
  isPermanent?: boolean;
  isExpired?: boolean;
  error?: string;
  statusCode?: number;
}

// Persiste a ativacao do ciclo (activated_at, expires_at, duration_minutes) no Supabase e store
// REGRA V3: Supabase PostgreSQL é a fonte definitiva da verdade. Falhas na RPC NÃO devem ser mascaradas por fallback em memória.
async function persistPurchaseActivation(cycle: PurchaseCycle, scopedClient?: any): Promise<PersistActivationResult> {
  const clientToUse = scopedClient || supabaseServer;

  // Invoca a RPC V3 SECURITY DEFINER (atômica, idempotente e imutável após ativação)
  try {
    const { data: rpcRes, error: rpcErr } = await clientToUse.rpc('ativar_ciclo_compra', {
      p_compra_id: cycle.compraId,
      p_sala_id: cycle.salaId,
      p_duration_minutes: cycle.durationMinutes,
      p_is_permanent: cycle.isPermanent,
    });

    if (rpcErr) {
      const errMsg = rpcErr.message || '';
      console.error(`[Lifecycle V3] Erro na RPC ativar_ciclo_compra para compra #${cycle.compraId}:`, rpcErr);

      if (errMsg.includes('COMPRA_EXPIRADA')) {
        cycle.status = 'expired';
        purchaseCycles.set(cycle.compraId, cycle);
        saveStore();
        return {
          success: false,
          isExpired: true,
          error: 'O tempo contratado para esta sala expirou.',
          statusCode: 410,
        };
      }

      if (errMsg.includes('ACESSO_NEGADO')) {
        return {
          success: false,
          error: 'Acesso negado: esta compra pertence a outro usuário.',
          statusCode: 403,
        };
      }

      if (errMsg.includes('COMPRA_NAO_ENCONTRADA')) {
        return {
          success: false,
          error: 'Compra não encontrada no banco de dados.',
          statusCode: 404,
        };
      }

      if (errMsg.includes('STATUS_INVALIDO')) {
        return {
          success: false,
          error: 'O pagamento desta compra ainda não foi confirmado.',
          statusCode: 403,
        };
      }

      if (errMsg.includes('DURACAO_INDETERMINADA')) {
        return {
          success: false,
          error: 'A duração da sala não pôde ser determinada para ativação.',
          statusCode: 400,
        };
      }

      return {
        success: false,
        error: `Não foi possível persistir a ativação no PostgreSQL: ${errMsg}`,
        statusCode: 500,
      };
    }

    if (!rpcRes || !rpcRes.success) {
      const errDetail = rpcRes?.error || 'A ativação da sala não foi confirmada pelo banco de dados.';
      console.error(`[Lifecycle V3] RPC ativar_ciclo_compra não confirmou sucesso para compra #${cycle.compraId}:`, rpcRes);
      return {
        success: false,
        error: errDetail,
        statusCode: 500,
      };
    }

    // RPC confirmou ativação com sucesso: utiliza o resultado persistido pelo PostgreSQL como fonte de verdade
    if (rpcRes.is_permanent) {
      cycle.isPermanent = true;
      cycle.expiresAt = 0;
      if (rpcRes.activated_at) {
        cycle.activatedAt = new Date(rpcRes.activated_at).getTime();
      }
    } else {
      cycle.isPermanent = false;
      if (rpcRes.activated_at) {
        cycle.activatedAt = new Date(rpcRes.activated_at).getTime();
      }
      if (rpcRes.expires_at) {
        cycle.expiresAt = new Date(rpcRes.expires_at).getTime();
      }
      if (rpcRes.duration_minutes) {
        cycle.durationMinutes = rpcRes.duration_minutes;
      }
    }

    cycle.status = rpcRes.status || cycle.status;
    cycle.updatedAt = Date.now();
    purchaseCycles.set(cycle.compraId, cycle);
    saveStore();

    console.log(`[Lifecycle V3] Compra #${cycle.compraId} ciclo ativado/sincronizado com sucesso via RPC ativar_ciclo_compra.`);
    return {
      success: true,
      activatedAt: cycle.activatedAt,
      expiresAt: cycle.expiresAt,
      durationMinutes: cycle.durationMinutes,
      isPermanent: cycle.isPermanent,
    };
  } catch (rpcEx: any) {
    const exMsg = rpcEx?.message || String(rpcEx);
    console.error(`[Lifecycle V3] Exceção na RPC ativar_ciclo_compra para compra #${cycle.compraId}:`, rpcEx);

    if (exMsg.includes('COMPRA_EXPIRADA')) {
      cycle.status = 'expired';
      purchaseCycles.set(cycle.compraId, cycle);
      saveStore();
      return {
        success: false,
        isExpired: true,
        error: 'O tempo contratado para esta sala expirou.',
        statusCode: 410,
      };
    }

    return {
      success: false,
      error: `Erro ao comunicar com o banco de dados para ativação: ${exMsg}`,
      statusCode: 500,
    };
  }
}

// Owner/Admin password (can be customized or passed via env, default: 8090)
const OWNER_SECRET_KEY = process.env.OWNER_SECRET_KEY || '8090';
// Security PIN required exclusively for deleting links or room sessions
const OWNER_DELETE_PIN = '8090';

// Seed demo vouchers for immediate testing if store empty
if (vouchers.size === 0) {
  const seedVoucherToken = 'vch_demo_1h_' + crypto.randomBytes(3).toString('hex');
  vouchers.set(seedVoucherToken, {
    token: seedVoucherToken,
    durationMinutes: 60,
    label: 'Voucher Demonstrativo (1 Hora)',
    createdAt: Date.now(),
    status: 'available',
    roomType: 'group_temp',
    isPermanent: false,
    maxParticipants: 10,
    hasMultiChat: false,
  });
  saveStore();
}

// Seed default 3 Open Rooms strictly for the main lobby view
const openLobbyRooms = [
  {
    id: 'sala-aberta-1',
    name: 'Lounge Principal (Bate-Papo Aberto)',
    description: 'Espaço comunitário aberto para todos conversarem livremente sobre qualquer assunto de forma anônima.',
    category: 'Bate-Papo Livre',
    icon: 'Sparkles',
    color: '#06b6d4',
  },
  {
    id: 'sala-aberta-2',
    name: 'Desabafos & Histórias Anônimas',
    description: 'Espaço acolhedor para compartilhar relatos, pedir conselhos e desabafar sem julgamentos.',
    category: 'Apoio & Emoção',
    icon: 'Lock',
    color: '#ec4899',
  },
  {
    id: 'sala-aberta-3',
    name: 'Mundo Tech, IA & Curiosidades',
    description: 'Conversas e novidades sobre tecnologia, inteligência artificial, internet, jogos e futuro.',
    category: 'Tecnologia',
    icon: 'Terminal',
    color: '#10b981',
  },
];

openLobbyRooms.forEach((r, index) => {
  const existing = rooms.get(r.id);
  const now = Date.now();
  const roomData: RoomData = {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    icon: r.icon,
    color: r.color,
    accessKey: existing?.accessKey || `open_key_${index + 1}`,
    creatorPasscode: '', // Open room - no password required
    createdAt: existing?.createdAt || now,
    durationMinutes: 0,
    expiresAt: 0,
    isPermanent: true,
    isOpenRoom: true,
    maxParticipants: 100,
    isCustom: false,
    messages: existing?.messages || [
      {
        id: 'sys_' + Math.random().toString(36).substring(2, 9),
        roomId: r.id,
        sender: {
          id: 'system',
          name: 'Sistema AnonQR',
          avatarColor: r.color,
          avatarIcon: 'Shield',
        },
        content: `Bem-vindo ao ${r.name}! Esta sala é aberta ao público para conversas anônimas e respeitosas.`,
        timestamp: now,
        type: 'system',
      },
    ],
  };
  rooms.set(r.id, roomData);
});
saveStore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure body limits for image/video upload support (up to 50MB)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Create and serve uploads directory for chat attachments
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // --- HTTP & WEBSOCKET SETUP ---
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 50 * 1024 * 1024 });

  interface ClientMeta {
    ws: WebSocket;
    roomId?: string;
    user?: AnonymousUser;
    assignedChannelId?: string;
    allowedChannels?: string[];
    isMaster?: boolean;
  }

  const clientConnections = new Map<WebSocket, ClientMeta>();

  // =========================================================================
  // SISTEMA ISOLADO DE MENSAGENS PRIVADAS 1x1 (EXCLUSIVAMENTE EM MEMÓRIA)
  // =========================================================================
  interface PrivateChatMessageServer {
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

  interface PrivateConversationData {
    id: string;
    participants: [string, string];
    messages: PrivateChatMessageServer[];
    updatedAt: number;
    createdAt: number;
    participantProfiles: Record<string, {
      id: string;
      name?: string;
      nick?: string;
      avatar_url?: string | null;
      avatarColor?: string;
      avatarIcon?: string;
    }>;
    unreadCounts: Record<string, number>;
  }

  interface PrivateSocketMeta {
    ws: WebSocket;
    conversationId: string;
    user: {
      id: string;
      name: string;
      nick?: string;
      avatarUrl?: string | null;
      avatarColor?: string;
      avatarIcon?: string;
    };
  }

  interface ActiveUserSocketMeta {
    ws: WebSocket;
    user: {
      id: string;
      name?: string;
      nick?: string;
      avatarUrl?: string | null;
      avatarColor?: string;
      avatarIcon?: string;
    };
  }

  const privateConversations = new Map<string, PrivateConversationData>();
  const privateConversationSockets = new Map<WebSocket, PrivateSocketMeta>();
  const activeUserSockets = new Map<WebSocket, ActiveUserSocketMeta>();

  function isUserOnlineGlobally(userId: string): boolean {
    for (const [ws, meta] of activeUserSockets.entries()) {
      if (meta.user.id === userId && ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    for (const [ws, meta] of privateConversationSockets.entries()) {
      if (meta.user.id === userId && ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }

  function getUserPrivateConversations(userId: string) {
    const result: any[] = [];
    if (!userId) return result;

    for (const conv of privateConversations.values()) {
      if (!conv.participants.includes(userId)) continue;

      const otherId = conv.participants.find((p) => p !== userId) || '';
      const otherProfile = conv.participantProfiles?.[otherId] || { id: otherId, nick: 'Anônimo' };
      const isOtherOnline = isUserOnlineGlobally(otherId);

      const lastMsg = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
      const lastMessageAt = lastMsg ? lastMsg.timestamp : (conv.createdAt || conv.updatedAt || Date.now());

      result.push({
        conversationId: conv.id,
        otherParticipant: {
          id: otherId,
          nick: otherProfile.nick || 'Anônimo',
          name: otherProfile.name || otherProfile.nick || 'Anônimo',
          avatar_url: otherProfile.avatar_url || null,
          avatarColor: otherProfile.avatarColor || '#06b6d4',
          avatarIcon: otherProfile.avatarIcon || 'User',
          isOnline: isOtherOnline,
        },
        lastMessage: lastMsg ? (lastMsg.type === 'audio' ? 'Mensagem de áudio' : lastMsg.type === 'image' ? '📷 Foto' : lastMsg.content) : null,
        lastMessageAt,
        lastMessageType: lastMsg ? lastMsg.type : null,
        unreadCount: (conv.unreadCounts && typeof conv.unreadCounts[userId] === 'number') ? conv.unreadCounts[userId] : 0,
        createdAt: conv.createdAt || conv.updatedAt || Date.now(),
      });
    }

    // Ordenar por atividade mais recente (lastMessageAt decrescente)
    result.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return result;
  }

  function notifyUserConversationsList(userId: string) {
    if (!userId) return;
    const list = getUserPrivateConversations(userId);
    const payload = JSON.stringify({
      type: 'private_conversations_list',
      conversations: list,
    });

    for (const [ws, meta] of activeUserSockets.entries()) {
      if (meta.user.id === userId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  function broadcastToPrivateConversation(conversationId: string, data: any, excludeWs?: WebSocket) {
    const payload = JSON.stringify(data);
    for (const [ws, meta] of privateConversationSockets.entries()) {
      if (meta.conversationId === conversationId && ws.readyState === WebSocket.OPEN && ws !== excludeWs) {
        ws.send(payload);
      }
    }
  }

  function isPeerOnlineInPrivateConversation(conversationId: string, currentUserId: string): boolean {
    for (const meta of privateConversationSockets.values()) {
      if (meta.conversationId === conversationId && meta.user.id !== currentUserId && meta.ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }



  function broadcastToRoom(roomId: string, data: any, excludeWs?: WebSocket, channelId?: string) {
    const payload = JSON.stringify(data);
    for (const [ws, meta] of clientConnections.entries()) {
      if (meta.roomId === roomId && ws.readyState === WebSocket.OPEN && ws !== excludeWs) {
        // If a specific channel is targeted, only clients who are allowed in this channel receive it
        if (channelId && meta.allowedChannels && !meta.allowedChannels.includes(channelId)) {
          continue;
        }
        ws.send(payload);
      }
    }
  }

  function getOnlineUsersInRoom(roomId: string): AnonymousUser[] {
    const users: AnonymousUser[] = [];
    const seen = new Set<string>();
    for (const meta of clientConnections.values()) {
      if (meta.roomId === roomId && meta.user && !seen.has(meta.user.id)) {
        seen.add(meta.user.id);
        users.push(meta.user);
      }
    }
    return users;
  }

  // Forcefully terminates and removes a room, notifying all participants immediately
  function terminateAndRemoveRoom(roomId: string, reason = 'Esta sala/sessão foi encerrada e excluída pelo administrador.') {
    const room = rooms.get(roomId);
    if (!room) return false;

    // Broadcast termination event to room participants
    broadcastToRoom(roomId, {
      type: 'room_deleted',
      roomId,
      reason,
    });

    // Close and clean up all WebSocket connections in this room
    for (const [ws, meta] of clientConnections.entries()) {
      if (meta.roomId === roomId) {
        try {
          ws.send(
            JSON.stringify({
              type: 'room_deleted',
              roomId,
              reason,
            })
          );
          ws.close(1000, reason);
        } catch (e) {}
        clientConnections.delete(ws);
      }
    }

    room.messages = [];
    room.knownParticipants = {};
    rooms.delete(roomId);

    // Update associated vouchers if any
    for (const [, v] of vouchers.entries()) {
      if (v.usedByRoomId === roomId) {
        v.status = 'expired';
      }
    }

    saveStore();
    return true;
  }

  function getBaseUrl(req: express.Request): string {
    // 1. If Origin header is present (standard browser fetch/navigation), use it!
    const origin = req.headers.origin as string;
    if (origin && typeof origin === 'string' && origin.startsWith('http')) {
      return origin.replace(/\/+$/, '');
    }
    // 2. If Referer header is present, extract origin from it
    const referer = req.headers.referer as string;
    if (referer && typeof referer === 'string' && referer.startsWith('http')) {
      try {
        const parsed = new URL(referer);
        return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
      } catch {}
    }
    // 3. Fallback to configured URL if valid
    if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' && process.env.APP_URL.startsWith('http')) {
      return process.env.APP_URL.replace(/\/+$/, '');
    }
    // 4. Fallback to forwarded headers or host
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : (req.secure ? 'https' : 'http');
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  function buildRoomInviteUrl(req: express.Request, room: RoomData, channelId?: string, includeMasterKey = false): string {
    const baseUrl = getBaseUrl(req);
    const keyPart = includeMasterKey && room.accessKey ? `&key=${encodeURIComponent(room.accessKey)}` : '';
    const chatPart = channelId ? `&chat=${encodeURIComponent(channelId)}` : '';
    return `${baseUrl}/?room=${encodeURIComponent(room.id)}${keyPart}${chatPart}`;
  }

  function buildVoucherActivationUrl(req: express.Request, voucher: OwnerVoucher): string {
    const baseUrl = getBaseUrl(req);
    return `${baseUrl}/?voucher=${encodeURIComponent(voucher.token)}`;
  }

  // --- REST API ROUTES ---

  // Direct friendly routes for Android and iOS mobile link clicks
  app.get('/voucher/:token', (req, res) => {
    const token = String(req.params.token).trim();
    const v = vouchers.get(token);
    // If the room was already created, the origin link converts directly to access the room!
    if (v && v.status === 'active' && v.usedByRoomId) {
      const room = rooms.get(v.usedByRoomId);
      if (room && (room.isPermanent || Date.now() <= room.expiresAt)) {
        return res.redirect(`/?room=${encodeURIComponent(room.id)}`);
      }
    }
    const query = new URLSearchParams(req.query as any).toString();
    res.redirect(`/?voucher=${encodeURIComponent(req.params.token)}${query ? `&${query}` : ''}`);
  });

  app.get('/room/:id', (req, res) => {
    const query = new URLSearchParams(req.query as any).toString();
    res.redirect(`/?room=${encodeURIComponent(req.params.id)}${query ? `&${query}` : ''}`);
  });

  // Public config for client-side URL generation
  app.get('/api/config/public-url', (req, res) => {
    res.json({
      publicUrl: getBaseUrl(req),
      isMobileReady: true,
    });
  });

  // =========================================================================
  // MURAL DAS CONFISSÕES (ISOLADO E EM MEMÓRIA)
  // =========================================================================
  interface ServerConfessionReply {
    id: string;
    confessionId: string;
    authorId: string;
    authorNick: string;
    content: string;
    createdAt: number;
  }

  interface ServerConfession {
    id: string;
    content: string;
    category?: string | null;
    authorId: string;
    authorNick: string;
    createdAt: number;
    reactions: Record<string, number>;
    userReactions: Record<string, string[]>;
    repliesCount: number;
    replies: ServerConfessionReply[];
  }

  const confessionsMap = new Map<string, ServerConfession>();

  const initialConfessions: ServerConfession[] = [
    {
      id: 'conf_1',
      content: 'Eu sempre digo para todos que estou bem no trabalho e na vida, mas sinceramente por dentro estou esgotado e com medo do futuro.',
      category: 'Desabafos',
      authorId: 'anon_sys_1',
      authorNick: 'Anônimo #4821',
      createdAt: Date.now() - 3600000 * 2,
      reactions: { '🫂 Eu também': 847, '👀 Me identifiquei': 126, '🥹 Senti isso': 312 },
      userReactions: {},
      repliesCount: 1,
      replies: [
        { id: 'rep_1', confessionId: 'conf_1', authorId: 'anon_sys_2', authorNick: 'Anônimo #7319', content: 'Eu passo exatamente pela mesma coisa todos os dias. Força!', createdAt: Date.now() - 3600000 }
      ]
    },
    {
      id: 'conf_2',
      content: 'Guardo um segredo de família há 10 anos que mudaria a dinâmica de todos se soubessem, mas prefiro carregar esse peso sozinha para proteger quem amo.',
      category: 'Segredos',
      authorId: 'anon_sys_3',
      authorNick: 'Anônimo #9124',
      createdAt: Date.now() - 3600000 * 5,
      reactions: { '🤫 Nunca contei': 532, '👀 Me identifiquei': 210 },
      userReactions: {},
      repliesCount: 0,
      replies: []
    },
    {
      id: 'conf_3',
      content: 'Às vezes choro no carro escutando música antes de entrar em casa, só para fingir que está tudo perfeito quando chego.',
      category: 'Pensamentos',
      authorId: 'anon_sys_4',
      authorNick: 'Anônimo #1835',
      createdAt: Date.now() - 3600000 * 8,
      reactions: { '🥹 Senti isso': 1240, '🫂 Eu também': 980 },
      userReactions: {},
      repliesCount: 0,
      replies: []
    }
  ];

  for (const c of initialConfessions) {
    confessionsMap.set(c.id, c);
  }

  // GET /api/confessions
  app.get('/api/confessions', (req, res) => {
    try {
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';
      const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

      let list = Array.from(confessionsMap.values());

      if (category && category !== 'Todas') {
        list = list.filter((c) => c.category === category);
      }

      if (sort === 'recent') {
        list.sort((a, b) => b.createdAt - a.createdAt);
      } else if (sort === 'trending') {
        list.sort((a, b) => {
          const totalReactionsA = Object.values(a.reactions).reduce((acc, v) => acc + v, 0);
          const totalReactionsB = Object.values(b.reactions).reduce((acc, v) => acc + v, 0);
          return totalReactionsB - totalReactionsA;
        });
      } else if (sort === 'discussed') {
        list.sort((a, b) => b.repliesCount - a.repliesCount);
      } else if (sort === 'random') {
        list.sort(() => Math.random() - 0.5);
      } else {
        list.sort((a, b) => b.createdAt - a.createdAt);
      }

      res.json({ success: true, confessions: list });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Erro ao listar confissões' });
    }
  });

  // POST /api/confessions
  app.post('/api/confessions', (req, res) => {
    try {
      const { content, category, authorId, authorNick } = req.body;
      const cleanContent = String(content || '').trim();
      if (!cleanContent) {
        return res.status(400).json({ success: false, error: 'O conteúdo da confissão não pode estar vazio.' });
      }
      if (cleanContent.length > 1000) {
        return res.status(400).json({ success: false, error: 'A confissão excede o limite máximo de 1000 caracteres.' });
      }

      const id = 'conf_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const newConfession: ServerConfession = {
        id,
        content: cleanContent,
        category: category ? String(category).trim() : null,
        authorId: String(authorId || 'anon_guest').trim(),
        authorNick: String(authorNick || 'Anônimo #' + Math.floor(1000 + Math.random() * 9000)).trim(),
        createdAt: Date.now(),
        reactions: { '🫂 Eu também': 1 },
        userReactions: { [String(authorId || 'anon_guest')]: ['🫂 Eu também'] },
        repliesCount: 0,
        replies: [],
      };

      confessionsMap.set(id, newConfession);
      res.json({ success: true, confession: newConfession });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Erro ao criar confissão' });
    }
  });

  // GET /api/confessions/:id
  app.get('/api/confessions/:id', (req, res) => {
    try {
      const confession = confessionsMap.get(req.params.id);
      if (!confession) {
        return res.status(404).json({ success: false, error: 'Confissão não encontrada.' });
      }
      res.json({ success: true, confession });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Erro ao obter confissão' });
    }
  });

  // POST /api/confessions/:id/reactions
  app.post('/api/confessions/:id/reactions', (req, res) => {
    try {
      const { reactionType, userId } = req.body;
      const confession = confessionsMap.get(req.params.id);
      if (!confession) {
        return res.status(404).json({ success: false, error: 'Confissão não encontrada.' });
      }
      const rType = String(reactionType || '').trim();
      const uId = String(userId || 'anon_guest').trim();

      if (!rType) {
        return res.status(400).json({ success: false, error: 'Tipo de reação inválido.' });
      }

      if (!confession.userReactions) {
        confession.userReactions = {};
      }
      if (!confession.userReactions[uId]) {
        confession.userReactions[uId] = [];
      }

      const userReactionsList = confession.userReactions[uId];
      const hasReacted = userReactionsList.includes(rType);

      if (hasReacted) {
        confession.userReactions[uId] = userReactionsList.filter((r) => r !== rType);
        confession.reactions[rType] = Math.max(0, (confession.reactions[rType] || 1) - 1);
        if (confession.reactions[rType] === 0) {
          delete confession.reactions[rType];
        }
      } else {
        userReactionsList.push(rType);
        confession.reactions[rType] = (confession.reactions[rType] || 0) + 1;
      }

      res.json({ success: true, reactions: confession.reactions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Erro ao registrar reação' });
    }
  });

  // POST /api/confessions/:id/replies
  app.post('/api/confessions/:id/replies', (req, res) => {
    try {
      const { content, authorId, authorNick } = req.body;
      const cleanContent = String(content || '').trim();
      if (!cleanContent) {
        return res.status(400).json({ success: false, error: 'O conteúdo da resposta não pode estar vazio.' });
      }
      if (cleanContent.length > 500) {
        return res.status(400).json({ success: false, error: 'A resposta excede o limite de 500 caracteres.' });
      }

      const confession = confessionsMap.get(req.params.id);
      if (!confession) {
        return res.status(404).json({ success: false, error: 'Confissão não encontrada.' });
      }

      const replyId = 'frep_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const newReply: ServerConfessionReply = {
        id: replyId,
        confessionId: confession.id,
        authorId: String(authorId || 'anon_guest').trim(),
        authorNick: String(authorNick || 'Anônimo #' + Math.floor(1000 + Math.random() * 9000)).trim(),
        content: cleanContent,
        createdAt: Date.now(),
      };

      confession.replies.push(newReply);
      confession.repliesCount = confession.replies.length;

      res.json({ success: true, reply: newReply, repliesCount: confession.repliesCount });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Erro ao enviar resposta' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), roomsCount: rooms.size, vouchersCount: vouchers.size });
  });

  // =========================================================================
  // USUÁRIOS: EXCLUSÃO DEFINITIVA DA PRÓPRIA CONTA
  // =========================================================================
  app.post('/api/user/delete-account', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
      if (!bearerToken) {
        res.status(401).json({ error: 'Autenticação necessária para excluir a conta.' });
        return;
      }

      if (!supabaseAdmin) {
        res.status(500).json({ error: 'Serviço administrativo do Supabase não configurado no servidor.' });
        return;
      }

      // Validar a sessão do usuário com o token fornecido (auth.uid())
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearerToken);
      if (userError || !userData?.user) {
        res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
        return;
      }

      const userId = userData.user.id;

      // Executa a exclusão definitiva do usuário em auth.users através da API Admin do Supabase
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error('[API /api/user/delete-account] Erro ao excluir usuário:', deleteError.message);
        res.status(500).json({ error: 'Erro ao excluir a conta no Supabase. Tente novamente mais tarde.' });
        return;
      }

      res.json({
        success: true,
        message: 'Conta excluída definitivamente com sucesso.',
      });
    } catch (err: any) {
      console.error('[API /api/user/delete-account] Erro inesperado:', err);
      res.status(500).json({ error: 'Erro interno ao processar a exclusão da conta.' });
    }
  });

  // =========================================================================
  // USUÁRIOS: DEFINIR OU ALTERAR NICK ÚNICO
  // =========================================================================
  app.post('/api/user/nick', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
      if (!bearerToken) {
        res.status(401).json({ error: 'Autenticação necessária para definir o Nick.' });
        return;
      }

      const client = supabaseAdmin || supabaseServer;
      if (!client) {
        res.status(500).json({ error: 'Serviço de autenticação temporariamente indisponível.' });
        return;
      }

      // Validar usuário autenticado via Supabase Auth
      const { data: userData, error: userError } = await client.auth.getUser(bearerToken);
      if (userError || !userData?.user) {
        res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
        return;
      }

      const userId = userData.user.id;
      let rawNick = typeof req.body.nick === 'string' ? req.body.nick.trim() : '';

      // Remover @ inicial se o usuário digitou com @
      if (rawNick.startsWith('@')) {
        rawNick = rawNick.replace(/^@+/, '').trim();
      }

      // 1. Validação de tamanho (3 a 20 caracteres)
      if (rawNick.length < 3 || rawNick.length > 20) {
        res.status(400).json({ error: 'O Nick deve possuir entre 3 e 20 caracteres.' });
        return;
      }

      // 2. Validação de caracteres permitidos (apenas letras, números e underscore, sem espaços)
      const validFormat = /^[a-zA-Z0-9_]{3,20}$/.test(rawNick);
      if (!validFormat) {
        res.status(400).json({ error: 'Nick inválido. Permite apenas letras, números e underscore (_).' });
        return;
      }

      const normalizedNick = rawNick;
      const lowerNick = normalizedNick.toLowerCase();

      // 3. Validação de unicidade case-insensitive no banco de dados (public.profiles)
      if (supabaseAdmin) {
        // Checa em public.profiles
        const { data: existingProfiles, error: profileQueryErr } = await supabaseAdmin
          .from('profiles')
          .select('id, nick')
          .neq('id', userId);

        if (!profileQueryErr && Array.isArray(existingProfiles)) {
          const duplicate = existingProfiles.find(
            (p) => p.nick && p.nick.trim().toLowerCase() === lowerNick
          );
          if (duplicate) {
            res.status(409).json({ error: 'Este Nick já está em uso por outro usuário.' });
            return;
          }
        }

        // Checa também em auth.users metadata para evitar colisão
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        if (usersData && Array.isArray((usersData as any).users)) {
          const duplicateUser = ((usersData as any).users as any[]).find((u: any) => {
            if (u.id === userId) return false;
            const metaNick = u.user_metadata?.nick || u.user_metadata?.username;
            return typeof metaNick === 'string' && metaNick.trim().toLowerCase() === lowerNick;
          });
          if (duplicateUser) {
            res.status(409).json({ error: 'Este Nick já está em uso por outro usuário.' });
            return;
          }
        }
      }

      // 4. Persistência no banco: Tenta chamar a RPC definir_nick_usuario com o token do usuário
      const scopedSupabase = createClient(SUPABASE_BACKEND_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      });

      try {
        const { data: rpcData, error: rpcErr } = await scopedSupabase.rpc('definir_nick_usuario', {
          novo_nick: normalizedNick,
        });

        if (rpcErr && supabaseAdmin) {
          // Se RPC retornar erro de nick em uso, repassa imediatamente
          if (rpcErr.code === '23505' || rpcErr.message?.includes('já está em uso')) {
            res.status(409).json({ error: 'Este Nick já está em uso por outro usuário.' });
            return;
          }

          // Se a RPC não estiver criada ainda, salva diretamente na tabela public.profiles via supabaseAdmin
          await supabaseAdmin
            .from('profiles')
            .upsert(
              {
                id: userId,
                nick: normalizedNick,
                name: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || normalizedNick,
                email: userData.user.email,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );
        }
      } catch (e: any) {
        console.warn('[Nick] Tentativa de RPC profiles:', e.message);
      }

      // 5. Atualiza o user_metadata no Supabase Auth via admin (garante sincronização no AuthContext)
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: {
              ...(userData.user.user_metadata || {}),
              nick: normalizedNick,
              username: normalizedNick,
            },
          });
        } catch (adminErr: any) {
          console.warn('[Nick] Erro ao sincronizar metadata:', adminErr.message);
        }
      }

      res.json({
        success: true,
        nick: normalizedNick,
        message: 'Nick salvo com sucesso!',
      });
    } catch (err: any) {
      console.error('[API /api/user/nick] Erro inesperado:', err);
      res.status(500).json({ error: 'Erro interno ao salvar Nick.' });
    }
  });

  // =========================================================================
  // USUÁRIOS: FOTO DE PERFIL (UPLOAD NO BUCKET "avatars" E ATUALIZAÇÃO DO PERFIL)
  // =========================================================================
  app.post('/api/user/avatar', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
      if (!bearerToken) {
        res.status(401).json({ error: 'Token de autenticação não fornecido.' });
        return;
      }

      if (!supabaseAdmin) {
        res.status(500).json({ error: 'Serviço de administração do Supabase indisponível no servidor.' });
        return;
      }

      // Validar autenticação do usuário exclusivamente via Supabase Auth
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearerToken);
      if (userError || !userData?.user?.id) {
        res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
        return;
      }

      const userId = userData.user.id;

      let rawImage = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
      if (!rawImage) {
        res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
        return;
      }

      let mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim().toLowerCase() : '';

      // Extrai cabeçalho data URI se presente (ex: data:image/png;base64,...)
      if (rawImage.startsWith('data:')) {
        const commaIndex = rawImage.indexOf(',');
        if (commaIndex !== -1) {
          const headerPart = rawImage.substring(0, commaIndex);
          const mimeMatch = headerPart.match(/data:([^;]+)/);
          if (mimeMatch && mimeMatch[1]) {
            mimeType = mimeMatch[1].trim().toLowerCase();
          }
          rawImage = rawImage.substring(commaIndex + 1);
        }
      }

      // Normaliza formatos
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(mimeType)) {
        res.status(400).json({
          error: 'Formato inválido. Aceita somente image/jpeg, image/png ou image/webp.',
        });
        return;
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(rawImage, 'base64');
      } catch {
        res.status(400).json({ error: 'Dados da imagem corrompidos ou inválidos.' });
        return;
      }

      if (buffer.length === 0) {
        res.status(400).json({ error: 'Arquivo de imagem vazio.' });
        return;
      }

      // Validação estrita do tamanho máximo: 2 MB (2 * 1024 * 1024 bytes)
      const MAX_SIZE = 2 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        res.status(400).json({
          error: `O tamanho do arquivo excede o limite máximo permitido de 2 MB (tamanho: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
        });
        return;
      }

      let ext = 'jpg';
      if (mimeType === 'image/png') ext = 'png';
      else if (mimeType === 'image/webp') ext = 'webp';

      const timestamp = Date.now();
      const filePath = `${userId}/${timestamp}.${ext}`;

      // Remover arquivos anteriores do usuário no bucket "avatars" para manter o storage limpo
      try {
        const { data: existingFiles } = await supabaseAdmin.storage
          .from('avatars')
          .list(userId);

        if (existingFiles && existingFiles.length > 0) {
          const pathsToRemove = existingFiles.map((f) => `${userId}/${f.name}`);
          await supabaseAdmin.storage.from('avatars').remove(pathsToRemove);
        }
      } catch (cleanupErr) {
        console.warn('[Avatar Upload] Aviso ao limpar avatar anterior:', cleanupErr);
      }

      // Upload do novo arquivo no bucket "avatars"
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('avatars')
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadErr) {
        console.error('[Avatar Upload] Erro no upload:', uploadErr);
        res.status(500).json({ error: 'Falha ao salvar a imagem no armazenamento: ' + uploadErr.message });
        return;
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = publicUrlData.publicUrl;

      // Atualiza public.profiles.avatar_url com a nova URL pública
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileErr) {
        console.error('[Avatar Upload] Erro ao atualizar public.profiles.avatar_url:', profileErr);
        res.status(500).json({ error: 'Foto salva, mas falhou ao atualizar o perfil: ' + profileErr.message });
        return;
      }

      res.json({
        success: true,
        avatar_url: avatarUrl,
      });
    } catch (err: any) {
      console.error('[API POST /api/user/avatar] Erro inesperado:', err);
      res.status(500).json({ error: 'Erro interno ao processar o upload da foto de perfil.' });
    }
  });

  // =========================================================================
  // USUÁRIOS: REMOVER FOTO DE PERFIL
  // =========================================================================
  app.delete('/api/user/avatar', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
      if (!bearerToken) {
        res.status(401).json({ error: 'Token de autenticação não fornecido.' });
        return;
      }

      if (!supabaseAdmin) {
        res.status(500).json({ error: 'Serviço de administração do Supabase indisponível no servidor.' });
        return;
      }

      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearerToken);
      if (userError || !userData?.user?.id) {
        res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
        return;
      }

      const userId = userData.user.id;

      // 1. Remover arquivos da pasta do usuário no bucket "avatars"
      try {
        const { data: existingFiles } = await supabaseAdmin.storage
          .from('avatars')
          .list(userId);

        if (existingFiles && existingFiles.length > 0) {
          const pathsToRemove = existingFiles.map((f) => `${userId}/${f.name}`);
          await supabaseAdmin.storage.from('avatars').remove(pathsToRemove);
        }
      } catch (removeFileErr) {
        console.warn('[Avatar Delete] Aviso ao remover arquivos do bucket:', removeFileErr);
      }

      // 2. Atualizar public.profiles.avatar_url para NULL
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileErr) {
        console.error('[Avatar Delete] Erro ao atualizar public.profiles:', profileErr);
        res.status(500).json({ error: 'Falha ao atualizar o perfil: ' + profileErr.message });
        return;
      }

      res.json({ success: true, message: 'Foto de perfil removida com sucesso.' });
    } catch (err: any) {
      console.error('[API DELETE /api/user/avatar] Erro inesperado:', err);
      res.status(500).json({ error: 'Erro interno ao remover foto de perfil.' });
    }
  });

  // Cache em memória para apresentações de perfil ("Sobre mim / O que procuro")
  const userPresentationsCache = new Map<string, {
    profileLookingFor: string[];
    profileInterests: string[];
    profileAvailability: string | null;
    profileDesires: string[];
  }>();

  // =========================================================================
  // USUÁRIOS: SALVAR APRESENTAÇÃO DO PERFIL ("Sobre mim / O que procuro")
  // =========================================================================
  app.post('/api/user/presentation', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
      if (!bearerToken) {
        res.status(401).json({ error: 'Token de autenticação não fornecido.' });
        return;
      }

      const client = supabaseAdmin || supabaseServer;
      if (!client) {
        res.status(500).json({ error: 'Serviço de autenticação temporariamente indisponível.' });
        return;
      }

      const { data: userData, error: userError } = await client.auth.getUser(bearerToken);
      if (userError || !userData?.user) {
        res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
        return;
      }

      const userId = userData.user.id;
      const body = req.body || {};

      // Higienização com limites estritos de segurança
      const sanitizeList = (raw: any): string[] => {
        if (!Array.isArray(raw)) return [];
        const seen = new Set<string>();
        const clean: string[] = [];
        for (const item of raw) {
          if (typeof item === 'string') {
            const trimmed = item.trim().substring(0, 40);
            if (trimmed.length > 0 && !seen.has(trimmed.toLowerCase())) {
              seen.add(trimmed.toLowerCase());
              clean.push(trimmed);
              if (clean.length >= 12) break; // Limite máximo de 12 tags
            }
          }
        }
        return clean;
      };

      const cleanLookingFor = sanitizeList(body.profileLookingFor);
      const cleanInterests = sanitizeList(body.profileInterests);
      const cleanAvailability = typeof body.profileAvailability === 'string' && body.profileAvailability.trim().length > 0
        ? body.profileAvailability.trim().substring(0, 40)
        : null;
      const cleanDesires = sanitizeList(body.profileDesires);

      const presentationData = {
        profileLookingFor: cleanLookingFor,
        profileInterests: cleanInterests,
        profileAvailability: cleanAvailability,
        profileDesires: cleanDesires,
      };

      // 1. Atualizar cache em memória para entrega instantânea
      userPresentationsCache.set(userId, presentationData);

      // 2. Persistir no Supabase user_metadata via admin
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: {
              ...(userData.user.user_metadata || {}),
              profileLookingFor: cleanLookingFor,
              profileInterests: cleanInterests,
              profileAvailability: cleanAvailability,
              profileDesires: cleanDesires,
            },
          });
        } catch (adminErr: any) {
          console.warn('[Presentation] Erro ao sincronizar metadata:', adminErr.message);
        }
      }

      // 3. Tentar também atualizar na tabela public.profiles caso as colunas existam
      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('profiles')
            .update({
              looking_for: cleanLookingFor,
              interests: cleanInterests,
              availability: cleanAvailability,
              desires: cleanDesires,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        } catch {}
      }

      res.json({
        success: true,
        presentation: presentationData,
        message: 'Apresentação de perfil salva com sucesso!',
      });
    } catch (err: any) {
      console.error('[API POST /api/user/presentation] Erro inesperado:', err);
      res.status(500).json({ error: 'Erro interno ao salvar apresentação de perfil.' });
    }
  });

  // =========================================================================
  // USUÁRIOS: CONSULTAR APRESENTAÇÃO DO PERFIL POR USER ID
  // =========================================================================
  app.get('/api/user/presentation/:userId', async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      if (!targetUserId) {
        res.status(400).json({ error: 'ID do usuário não fornecido.' });
        return;
      }

      // 1. Se estiver no cache em memória, retorna imediatamente
      const cached = userPresentationsCache.get(targetUserId);
      if (cached) {
        res.json({ success: true, presentation: cached });
        return;
      }

      // 2. Consultar em user_metadata via supabaseAdmin
      if (supabaseAdmin) {
        try {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
          const meta = userData?.user?.user_metadata;
          if (meta) {
            const pres = {
              profileLookingFor: Array.isArray(meta.profileLookingFor) ? meta.profileLookingFor : [],
              profileInterests: Array.isArray(meta.profileInterests) ? meta.profileInterests : [],
              profileAvailability: typeof meta.profileAvailability === 'string' ? meta.profileAvailability : null,
              profileDesires: Array.isArray(meta.profileDesires) ? meta.profileDesires : [],
            };
            userPresentationsCache.set(targetUserId, pres);
            res.json({ success: true, presentation: pres });
            return;
          }
        } catch {}
      }

      res.json({
        success: true,
        presentation: {
          profileLookingFor: [],
          profileInterests: [],
          profileAvailability: null,
          profileDesires: [],
        },
      });
    } catch (err: any) {
      console.error('[API GET /api/user/presentation/:userId] Erro:', err);
      res.status(500).json({ error: 'Erro ao consultar apresentação do usuário.' });
    }
  });

  // =========================================================================
  // USUÁRIOS: PESQUISA PÚBLICA POR NICK (NÃO EXPÕE E-MAILS OU DADOS PRIVADOS)
  // =========================================================================
  app.get('/api/users/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (!q) {
        res.json({ users: [] });
        return;
      }

      // Remove @ inicial caso o usuário tenha digitado @Felipe123
      const cleanTerm = q.replace(/^@+/, '').trim().toLowerCase();
      if (cleanTerm.length < 1) {
        res.json({ users: [] });
        return;
      }

      const resultsMap = new Map<string, {
        id: string;
        nick: string;
        name: string;
        avatar_url?: string | null;
        profileLookingFor?: string[];
        profileInterests?: string[];
        profileAvailability?: string | null;
        profileDesires?: string[];
      }>();

      // 1. Tentar buscar via RPC buscar_usuarios_por_nick
      const client = supabaseAdmin || supabaseServer;
      if (client) {
        try {
          const { data: rpcResults, error: rpcErr } = await client.rpc('buscar_usuarios_por_nick', {
            termo_busca: cleanTerm,
          });

          if (!rpcErr && Array.isArray(rpcResults)) {
            for (const r of rpcResults) {
              if (r.id && r.nick) {
                resultsMap.set(r.id, {
                  id: r.id,
                  nick: r.nick,
                  name: r.name || r.nick,
                  avatar_url: r.avatar_url || null,
                });
              }
            }
          }
        } catch {}

        // 2. Consulta direta em public.profiles caso o RPC não esteja criado ainda
        if (resultsMap.size === 0) {
          try {
            const { data: profileRows, error: profErr } = await client
              .from('profiles')
              .select('id, nick, name, avatar_url')
              .not('nick', 'is', null);

            if (!profErr && Array.isArray(profileRows)) {
              for (const p of profileRows) {
                const pNick = (p.nick || '').trim();
                const pName = (p.name || '').trim();
                if (
                  pNick.toLowerCase().startsWith(cleanTerm) ||
                  pNick.toLowerCase().includes(cleanTerm) ||
                  (pName && pName.toLowerCase().includes(cleanTerm))
                ) {
                  resultsMap.set(p.id, {
                    id: p.id,
                    nick: pNick,
                    name: pName || pNick,
                    avatar_url: p.avatar_url || null,
                  });
                }
              }
            }
          } catch {}
        }
      }

      // 3. Fallback adicional via auth.users metadata se supabaseAdmin estiver ativo
      if (supabaseAdmin && resultsMap.size === 0) {
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
          if (authData && Array.isArray((authData as any).users)) {
            for (const u of (authData as any).users as any[]) {
              const metaNick = u.user_metadata?.nick || u.user_metadata?.username;
              const metaName = u.user_metadata?.full_name || u.user_metadata?.name || '';
              if (typeof metaNick === 'string' && metaNick.trim().length > 0) {
                const pNick = metaNick.trim();
                if (
                  pNick.toLowerCase().startsWith(cleanTerm) ||
                  pNick.toLowerCase().includes(cleanTerm) ||
                  (metaName && metaName.toLowerCase().includes(cleanTerm))
                ) {
                  resultsMap.set(u.id, {
                    id: u.id,
                    nick: pNick,
                    name: metaName || pNick,
                    avatar_url: null,
                  });
                }
              }
            }
          }
        } catch {}
      }

      // Enriquecer com avatar_url de public.profiles para resultados que ainda não possuem
      if (resultsMap.size > 0 && client) {
        const idsWithoutAvatar = Array.from(resultsMap.values())
          .filter((u) => !u.avatar_url)
          .map((u) => u.id);
        if (idsWithoutAvatar.length > 0) {
          try {
            const { data: profs } = await client
              .from('profiles')
              .select('id, avatar_url')
              .in('id', idsWithoutAvatar);
            if (profs && Array.isArray(profs)) {
              for (const p of profs) {
                const existing = resultsMap.get(p.id);
                if (existing) {
                  existing.avatar_url = p.avatar_url || null;
                }
              }
            }
          } catch {}
        }
      }

      // Enriquecer resultados com dados de apresentação ("Sobre mim / O que procuro")
      for (const item of resultsMap.values()) {
        const cached = userPresentationsCache.get(item.id);
        if (cached) {
          item.profileLookingFor = cached.profileLookingFor;
          item.profileInterests = cached.profileInterests;
          item.profileAvailability = cached.profileAvailability;
          item.profileDesires = cached.profileDesires;
        } else if (supabaseAdmin) {
          try {
            const { data: uData } = await supabaseAdmin.auth.admin.getUserById(item.id);
            const meta = uData?.user?.user_metadata;
            if (meta) {
              const pres = {
                profileLookingFor: Array.isArray(meta.profileLookingFor) ? meta.profileLookingFor : [],
                profileInterests: Array.isArray(meta.profileInterests) ? meta.profileInterests : [],
                profileAvailability: typeof meta.profileAvailability === 'string' ? meta.profileAvailability : null,
                profileDesires: Array.isArray(meta.profileDesires) ? meta.profileDesires : [],
              };
              userPresentationsCache.set(item.id, pres);
              item.profileLookingFor = pres.profileLookingFor;
              item.profileInterests = pres.profileInterests;
              item.profileAvailability = pres.profileAvailability;
              item.profileDesires = pres.profileDesires;
            }
          } catch {}
        }
      }

      // Converte resultados para array (máximo 10)
      const list = Array.from(resultsMap.values()).slice(0, 10);
      res.json({ users: list });
    } catch (err: any) {
      console.error('[API /api/users/search] Erro ao buscar usuários:', err);
      res.status(500).json({ users: [], error: 'Erro ao pesquisar usuários.' });
    }
  });

  // Sincronização segura para novos usuários em public.profiles
  app.post('/api/user/sync-profile', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
      if (!bearerToken || !supabaseAdmin) {
        res.status(400).json({ success: false });
        return;
      }
      const { data: userData } = await supabaseAdmin.auth.getUser(bearerToken);
      if (userData?.user) {
        const u = userData.user;
        const displayName = u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'Usuário');
        await supabaseAdmin.from('profiles').upsert({
          id: u.id,
          name: displayName,
          email: u.email,
          plan: 'free',
          premium: false,
          credits: 0,
        }, { onConflict: 'id' });
        res.json({ success: true });
        return;
      }
      res.status(401).json({ success: false });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // OWNER/ADMIN: Verify owner master password
  app.post('/api/owner/verify', (req, res) => {
    const { password } = req.body;
    if (password === '8090' || password === OWNER_SECRET_KEY) {
      res.json({ authenticated: true });
    } else {
      res.status(401).json({ authenticated: false, error: 'Senha incorreta. Acesso negado.' });
    }
  });

  // OWNER/ADMIN: List generated vouchers and their statuses with attached room details
  app.get('/api/owner/vouchers', (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const list = Array.from(vouchers.values()).map((v) => {
      // Check if attached room is still active
      const r = v.usedByRoomId ? rooms.get(v.usedByRoomId) : null;
      if (v.status === 'active' && r && !r.isPermanent && Date.now() > r.expiresAt) {
        v.status = 'expired';
      }

      const isRoomActive = v.status === 'active' && r && (r.isPermanent || Date.now() <= r.expiresAt);

      return {
        ...v,
        roomName: v.roomName || (r ? r.name : undefined),
        creatorPasscode: v.creatorPasscode || (r ? r.creatorPasscode : undefined),
        roomExpiresAt: r ? r.expiresAt : undefined,
        roomOnlineCount: r ? Array.from(clientConnections.values()).filter((c) => c.roomId === r.id).length : 0,
        roomHasTimeLeft: r ? (r.isPermanent || Date.now() < r.expiresAt) : false,
        activationUrl: buildVoucherActivationUrl(req, v),
        roomDirectUrl: isRoomActive && r ? buildRoomInviteUrl(req, r) : undefined,
      };
    });

    res.json(list.reverse());
  });

  // OWNER/ADMIN: List all active and existing rooms with administrative data
  app.get('/api/owner/rooms', (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado.' });
      return;
    }

    // Deduplicate by room ID to avoid multiple entries when a room is mapped under both room.id and compra.id
    const seenRoomIds = new Set<string>();
    const uniqueRooms: typeof rooms extends Map<any, infer V> ? V[] : any[] = [];
    for (const r of rooms.values()) {
      if (!seenRoomIds.has(r.id)) {
        seenRoomIds.add(r.id);
        uniqueRooms.push(r);
      }
    }

    const list = uniqueRooms
      .filter((r) =>
        r.isPermanent ||
        (!r.isExpired && Date.now() < r.expiresAt)
      )
      .map((r) => {
        const online = Array.from(clientConnections.values()).filter((c) => c.roomId === r.id).length;
        const timeLeftSeconds = r.isPermanent
          ? 999999
          : Math.max(0, Math.floor((r.expiresAt - Date.now()) / 1000));
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          category: r.category,
          icon: r.icon,
          color: r.color,
          createdAt: r.createdAt,
          durationMinutes: r.durationMinutes,
          expiresAt: r.expiresAt,
          timeLeftSeconds,
          isExpired: !r.isPermanent && (r.isExpired || Date.now() > r.expiresAt),
          isPermanent: !!r.isPermanent,
          isOpenRoom: !!r.isOpenRoom,
          roomType: r.roomType,
          hasMultiChat: !!r.hasMultiChat,
          maxParticipants: r.maxParticipants || 10,
          onlineCount: online,
          creatorPasscode: r.creatorPasscode,
          channelPasscodes: r.channelPasscodes,
          isCustom: !!r.isCustom,
          voucherToken: r.voucherToken,
          shareUrl: buildRoomInviteUrl(req, r),
          accessKey: r.accessKey,
        };
      });

    res.json(list.reverse());
  });

  // OWNER/ADMIN: Directly create an active room with countdown timer or permanent
  app.post('/api/owner/rooms/create', (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const {
      name,
      description,
      category,
      color,
      icon,
      durationMinutes,
      creatorPasscode,
      roomType,
      isPermanent: reqIsPermanent,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'O nome da sala é obrigatório (mínimo 2 caracteres).' });
      return;
    }

    const selectedType: RoomType = (['group_temp', 'group_perm', 'duo_temp', 'duo_perm'].includes(roomType)
      ? roomType
      : (reqIsPermanent ? 'group_perm' : 'group_temp')) as RoomType;

    const isPermanent = selectedType === 'group_perm' || selectedType === 'duo_perm' || !!reqIsPermanent;
    const isDuo = selectedType === 'duo_temp' || selectedType === 'duo_perm';
    const hasMultiChat = false;
    const maxParticipants = isDuo ? 2 : 10;

    let duration = 60;
    if (!isPermanent) {
      duration = parseInt(durationMinutes, 10);
      if (isNaN(duration) || duration < 1 || duration > 43200) {
        duration = 60;
      }
    } else {
      duration = 0;
    }

    const passcode = (creatorPasscode || '').trim();

    const cleanSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'sala';

    const uniqueId = `${cleanSlug}-${crypto.randomBytes(4).toString('hex')}`;
    const accessKey = 'key_' + crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const expiresAt = isPermanent ? 0 : now + duration * 60 * 1000;

    const passcodeNotice = passcode ? ` Código de acesso mestre: "${passcode}".` : ' Acesso livre com o link direto.';
    const timeNotice = isPermanent ? 'Sala Permanente (sem expiração).' : `Duração: ${duration} minutos. O cronômetro começou a correr.`;

    const newRoom: RoomData = {
      id: uniqueId,
      name: name.trim().substring(0, 50),
      description: (description || (isDuo ? 'Sala dupla privativa para 2 pessoas.' : `Sala privada para até ${maxParticipants} pessoas.`)).trim().substring(0, 150),
      category: (category || (isDuo ? 'Sala Dupla' : 'Privado')).trim().substring(0, 30),
      icon: icon || (isDuo ? 'Users' : 'MessageSquare'),
      color: color || (isDuo ? '#06b6d4' : '#10b981'),
      accessKey,
      creatorPasscode: passcode,
      createdAt: now,
      durationMinutes: duration,
      expiresAt,
      isPermanent,
      maxParticipants,
      roomType: selectedType,
      hasMultiChat: false,
      isCustom: true,
      messages: [
        {
          id: 'sys_' + Math.random().toString(36).substring(2, 9),
          roomId: uniqueId,
          channelId: 'chat_1',
          sender: {
            id: 'system',
            name: 'Sistema AnonQR',
            avatarColor: '#10b981',
            avatarIcon: 'Shield',
          },
          content: `Sala liberada pelo dono! Capacidade: ${maxParticipants} pessoas. ${timeNotice}${passcodeNotice}`,
          timestamp: now,
          type: 'system',
        },
      ],
    };

    rooms.set(uniqueId, newRoom);
    saveStore();

    const shareUrl = buildRoomInviteUrl(req, newRoom);

    res.json({
      success: true,
      room: {
        id: newRoom.id,
        name: newRoom.name,
        description: newRoom.description,
        category: newRoom.category,
        icon: newRoom.icon,
        color: newRoom.color,
        createdAt: newRoom.createdAt,
        durationMinutes: newRoom.durationMinutes,
        expiresAt: newRoom.expiresAt,
        isPermanent,
        maxParticipants,
        hasMultiChat,
        roomType: selectedType,
        hasPasscode: !!passcode,
        creatorPasscode: passcode,
        channelPasscodes: newRoom.channelPasscodes,
        isCustom: true,
        onlineCount: 0,
      },
      accessKey,
      shareUrl,
      directUrl: shareUrl,
      creatorPasscode: passcode,
      channelPasscodes: newRoom.channelPasscodes,
    });
  });

  // OWNER/ADMIN: Delete a link/voucher and immediately terminate any running room session (even with remaining time)
  // Strictly requires security PIN
  app.post('/api/owner/vouchers/:token/delete', (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const { deletePin } = req.body;
    const providedPin = String(deletePin || req.headers['x-delete-pin'] || '').trim();

    if (providedPin !== OWNER_DELETE_PIN) {
      res.status(403).json({ error: 'Senha de autorização incorreta.' });
      return;
    }

    const token = String(req.params.token).trim();
    const voucher = vouchers.get(token);
    if (!voucher) {
      res.status(404).json({ error: 'Link ou voucher não encontrado.' });
      return;
    }

    // Terminate associated room session immediately, even if time is still remaining!
    if (voucher.usedByRoomId) {
      terminateAndRemoveRoom(
        voucher.usedByRoomId,
        'O link e a sessão desta sala foram excluídos pelo administrador.'
      );
    }

    vouchers.delete(token);
    saveStore();

    res.json({
      success: true,
      message: 'Link e sessão excluídos com sucesso.',
      token,
    });
  });

  // OWNER/ADMIN: Delete and terminate an active room session immediately (even with remaining time)
  // Strictly requires security PIN
  app.post('/api/owner/rooms/:id/delete', (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const { deletePin } = req.body;
    const providedPin = String(deletePin || req.headers['x-delete-pin'] || '').trim();

    if (providedPin !== OWNER_DELETE_PIN) {
      res.status(403).json({ error: 'Senha de autorização incorreta.' });
      return;
    }

    const roomId = String(req.params.id).trim();
    const room = rooms.get(roomId);
    if (!room) {
      res.status(404).json({ error: 'Sala/sessão não encontrada ou já encerrada.' });
      return;
    }

    terminateAndRemoveRoom(
      roomId,
      'Esta sessão de sala foi excluída e encerrada pelo administrador.'
    );

    res.json({
      success: true,
      message: 'Sessão da sala encerrada e excluída com sucesso.',
      roomId,
    });
  });

  // DELETE ROOM VIA SECURITY CODE (Available from 'Ver Convite' and 'Digitar Código')
  app.post('/api/rooms/:id/delete-by-code', (req, res) => {
    const { deleteCode, code } = req.body;
    const providedCode = String(deleteCode || code || req.headers['x-delete-code'] || '').trim();

    if (providedCode !== OWNER_DELETE_PIN) {
      res.status(403).json({
        error: 'Código de autorização incorreto.',
      });
      return;
    }

    const roomId = String(req.params.id).trim();
    const room = rooms.get(roomId);
    if (!room) {
      res.status(404).json({ error: 'Sala não encontrada ou já encerrada.' });
      return;
    }

    terminateAndRemoveRoom(
      roomId,
      'Esta sala foi excluída e encerrada pelo administrador.'
    );

    res.json({
      success: true,
      message: 'Sala excluída e encerrada com sucesso.',
      roomId,
    });
  });

  // OWNER/ADMIN: Generate new voucher activation link with requested room type
  app.post('/api/owner/vouchers/generate', (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado.' });
      return;
    }

    const { durationMinutes, label, roomType, isPermanent: reqIsPermanent } = req.body;

    const selectedType: RoomType = (['group_temp', 'group_perm', 'duo_temp', 'duo_perm'].includes(roomType)
      ? roomType
      : (reqIsPermanent ? 'group_perm' : 'group_temp')) as RoomType;

    const isPermanent = selectedType === 'group_perm' || selectedType === 'duo_perm' || !!reqIsPermanent;
    const isDuo = selectedType === 'duo_temp' || selectedType === 'duo_perm';
    const hasMultiChat = false;
    const maxParticipants = isDuo ? 2 : 10;

    let duration = 60;
    if (!isPermanent) {
      duration = parseInt(durationMinutes, 10);
      if (isNaN(duration) || duration < 1 || duration > 43200) {
        duration = 60;
      }
    } else {
      duration = 0;
    }

    const token = 'vch_' + crypto.randomBytes(8).toString('hex');
    const newVoucher: OwnerVoucher = {
      token,
      roomType: selectedType,
      durationMinutes: duration,
      isPermanent,
      maxParticipants,
      hasMultiChat: false,
      label: label ? String(label).trim().substring(0, 100) : undefined,
      createdAt: Date.now(),
      status: 'available',
    };

    vouchers.set(token, newVoucher);
    saveStore();

    const activationUrl = buildVoucherActivationUrl(req, newVoucher);
    res.json({
      voucher: newVoucher,
      activationUrl,
    });
  });

  // PUBLIC: Validate a voucher token before room creation
  app.get('/api/vouchers/:token', (req, res) => {
    const token = String(req.params.token).trim();
    const v = vouchers.get(token);
    if (!v) {
      res.status(404).json({ error: 'Link de ativação não encontrado ou inexistente.' });
      return;
    }

    // Check if room was created and if it has expired
    let existingRoom = null;
    if (v.status === 'active' && v.usedByRoomId) {
      const room = rooms.get(v.usedByRoomId);
      if (room && !room.isPermanent && Date.now() > room.expiresAt) {
        v.status = 'expired';
        saveStore();
      } else if (room) {
        existingRoom = {
          id: room.id,
          name: room.name,
          expiresAt: room.expiresAt,
          isPermanent: !!room.isPermanent,
          hasPasscode: Boolean(room.creatorPasscode),
          hasMultiChat: false,
          maxParticipants: room.maxParticipants || 10,
        };
      }
    }

    if (v.status === 'expired') {
      res.status(410).json({ error: 'Este link de ativação expirou e não pode mais ser utilizado.' });
      return;
    }

    res.json({
      token: v.token,
      roomType: v.roomType || 'group_temp',
      durationMinutes: v.durationMinutes,
      isPermanent: !!v.isPermanent,
      maxParticipants: v.maxParticipants || 10,
      hasMultiChat: false,
      label: v.label,
      status: v.status,
      usedByRoomId: v.usedByRoomId,
      roomName: v.roomName,
      creatorPasscode: v.creatorPasscode,
      existingRoom,
    });
  });

  // ==========================================
  // SISTEMA DE VENDA DE SALAS PRIVADAS (PIX)
  // ==========================================

  const SERVER_CATALOGUE: Record<string, {
    roomType: RoomType;
    roomTitle: string;
    durationLabel: string;
    durationMinutes: number;
    isPermanent: boolean;
    hasMultiChat: boolean;
    priceValue: number;
    priceFormatted: string;
  }> = {
    // Sala de Grupo temporária
    'group_temp_30m': {
      roomType: 'group_temp',
      roomTitle: 'Sala de Grupo (Temporária)',
      durationLabel: '30 Minutos',
      durationMinutes: 30,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 0.90,
      priceFormatted: 'R$ 0,90',
    },
    'group_temp_1h': {
      roomType: 'group_temp',
      roomTitle: 'Sala de Grupo (Temporária)',
      durationLabel: '1 Hora (60m)',
      durationMinutes: 60,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 1.50,
      priceFormatted: 'R$ 1,50',
    },
    'group_temp_2h': {
      roomType: 'group_temp',
      roomTitle: 'Sala de Grupo (Temporária)',
      durationLabel: '2 Horas (120m)',
      durationMinutes: 120,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 2.50,
      priceFormatted: 'R$ 2,50',
    },
    'group_temp_4h': {
      roomType: 'group_temp',
      roomTitle: 'Sala de Grupo (Temporária)',
      durationLabel: '4 Horas (240m)',
      durationMinutes: 240,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 4.00,
      priceFormatted: 'R$ 4,00',
    },
    'group_temp_12h': {
      roomType: 'group_temp',
      roomTitle: 'Sala de Grupo (Temporária)',
      durationLabel: '12 Horas (720m)',
      durationMinutes: 720,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 6.00,
      priceFormatted: 'R$ 6,00',
    },
    'group_temp_24h': {
      roomType: 'group_temp',
      roomTitle: 'Sala de Grupo (Temporária)',
      durationLabel: '24 Horas (1440m)',
      durationMinutes: 1440,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 10.00,
      priceFormatted: 'R$ 10,00',
    },
    // Sala de Grupo Permanente
    'group_perm': {
      roomType: 'group_perm',
      roomTitle: 'Sala de Grupo (Permanente)',
      durationLabel: 'Permanente (Sem Expiração)',
      durationMinutes: 0,
      isPermanent: true,
      hasMultiChat: false,
      priceValue: 15.90,
      priceFormatted: 'R$ 15,90',
    },
    // Sala Dupla (2 pessoas • Chat Único) Temporária
    'duo_temp_30m': {
      roomType: 'duo_temp',
      roomTitle: 'Sala Dupla (Temporária)',
      durationLabel: '30 Minutos',
      durationMinutes: 30,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 0.90,
      priceFormatted: 'R$ 0,90',
    },
    'duo_temp_1h': {
      roomType: 'duo_temp',
      roomTitle: 'Sala Dupla (Temporária)',
      durationLabel: '1 Hora (60m)',
      durationMinutes: 60,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 1.50,
      priceFormatted: 'R$ 1,50',
    },
    'duo_temp_2h': {
      roomType: 'duo_temp',
      roomTitle: 'Sala Dupla (Temporária)',
      durationLabel: '2 Horas (120m)',
      durationMinutes: 120,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 2.50,
      priceFormatted: 'R$ 2,50',
    },
    'duo_temp_4h': {
      roomType: 'duo_temp',
      roomTitle: 'Sala Dupla (Temporária)',
      durationLabel: '4 Horas (240m)',
      durationMinutes: 240,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 4.00,
      priceFormatted: 'R$ 4,00',
    },
    'duo_temp_12h': {
      roomType: 'duo_temp',
      roomTitle: 'Sala Dupla (Temporária)',
      durationLabel: '12 Horas (720m)',
      durationMinutes: 720,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 6.00,
      priceFormatted: 'R$ 6,00',
    },
    'duo_temp_24h': {
      roomType: 'duo_temp',
      roomTitle: 'Sala Dupla (Temporária)',
      durationLabel: '24 Horas (1440m)',
      durationMinutes: 1440,
      isPermanent: false,
      hasMultiChat: false,
      priceValue: 10.00,
      priceFormatted: 'R$ 10,00',
    },
    // Sala Dupla Permanente
    'duo_perm': {
      roomType: 'duo_perm',
      roomTitle: 'Sala Dupla (Permanente)',
      durationLabel: 'Permanente (Sem Expiração)',
      durationMinutes: 0,
      isPermanent: true,
      hasMultiChat: false,
      priceValue: 19.90,
      priceFormatted: 'R$ 19,90',
    },
  };

  // PUBLIC: Obter catálogo de preços e chave Pix
  app.get('/api/purchase-orders/catalogue', (req, res) => {
    res.json({
      pixKey: PIX_KEY,
      items: Object.entries(SERVER_CATALOGUE).map(([id, item]) => ({
        id,
        ...item,
      })),
    });
  });

  // PUBLIC: Criar solicitação de compra / pedido via Pix
  app.post('/api/purchase-orders', (req, res) => {
    const rawCatalogId = String(req.body.catalogId || req.body.catalogItemId || '');
    // Normalize legacy 5-in-1 keys to single chat
    const normalizedCatalogId = rawCatalogId.replace('duo_multi_', 'duo_');
    const item = SERVER_CATALOGUE[rawCatalogId] || SERVER_CATALOGUE[normalizedCatalogId];
    const { customerName, desiredRoomName, desiredPasscode } = req.body;

    if (!item) {
      res.status(400).json({ error: 'Opção de sala inválida selecionada.' });
      return;
    }

    const orderId = `PED-${Math.floor(1000 + Math.random() * 9000)}`;
    const sanitizedCustomerName = String(customerName || 'Cliente Anônimo').trim().substring(0, 50);
    const sanitizedRoomName = desiredRoomName ? String(desiredRoomName).trim().substring(0, 50) : undefined;
    const sanitizedPasscode = desiredPasscode ? String(desiredPasscode).trim().substring(0, 30) : undefined;

    const order: PurchaseOrder = {
      id: orderId,
      catalogId: normalizedCatalogId,
      roomType: item.roomType,
      roomTitle: item.roomTitle,
      durationLabel: item.durationLabel,
      durationMinutes: item.durationMinutes,
      isPermanent: item.isPermanent,
      hasMultiChat: false,
      priceValue: item.priceValue,
      priceFormatted: item.priceFormatted,
      pixKey: PIX_KEY,
      customerName: sanitizedCustomerName,
      desiredRoomName: sanitizedRoomName,
      desiredPasscode: sanitizedPasscode,
      status: 'pending',
      createdAt: Date.now(),
    };

    purchaseOrders.set(orderId, order);
    saveStore();

    // Mensagem de comprovante pronta para WhatsApp
    const whatsappProofMessage = `Olá! Acabei de realizar o pagamento via Pix de ${item.priceFormatted} referente ao pedido *#${orderId}* (${item.roomTitle} - ${item.durationLabel}).\n\nEstou enviando o comprovante do Pix em anexo. Aguardo a aprovação e liberação do link de acesso da minha sala! Obrigado.`;

    res.json({
      success: true,
      order,
      pixKey: PIX_KEY,
      whatsappProofMessage,
    });
  });

  // PUBLIC: Consultar status de um pedido
  app.get('/api/purchase-orders/:id', (req, res) => {
    const orderId = String(req.params.id).trim().toUpperCase();
    const order = purchaseOrders.get(orderId);
    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }
    res.json(order);
  });

  // OWNER/ADMIN: Listar todas as solicitações / pedidos de compra
  app.get('/api/owner/purchase-orders', (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const list = Array.from(purchaseOrders.values()).sort((a, b) => b.createdAt - a.createdAt);
    res.json(list);
  });

  // OWNER/ADMIN: Aprovar pagamento e criar sala conforme os requisitos solicitados pelo cliente
  app.post('/api/owner/purchase-orders/:id/approve-and-create', (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const orderId = String(req.params.id).trim().toUpperCase();
    const order = purchaseOrders.get(orderId);
    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    // Se já foi aprovada anteriormente e a sala ainda existe, retorna os dados da sala
    if (order.status === 'approved' && order.approvedRoomId && rooms.has(order.approvedRoomId)) {
      const existingRoom = rooms.get(order.approvedRoomId)!;
      const shareUrl = buildRoomInviteUrl(req, existingRoom);
      res.json({
        success: true,
        alreadyApproved: true,
        order,
        room: existingRoom,
        shareUrl,
        whatsappDeliveryMessage: `Olá ${order.customerName || 'Cliente'}! Segue o link de acesso da sua sala (${order.roomTitle}):\n🔗 Link: ${shareUrl}\n🔑 Senha: ${order.approvedPasscode || 'Acesso Livre'}`,
      });
      return;
    }

    // 1. Configurações da sala baseadas nos requisitos exatos do pedido
    const isPermanent = order.isPermanent;
    const isDuo = order.roomType === 'duo_temp' || order.roomType === 'duo_perm' || (order.roomType as string) === 'duo_multi_temp' || (order.roomType as string) === 'duo_multi_perm';
    const hasMultiChat = false;
    const duration = isPermanent ? 0 : order.durationMinutes;
    const maxParticipants = isDuo ? 2 : 10;
    const now = Date.now();
    const expiresAt = isPermanent ? 0 : now + duration * 60 * 1000;

    // Nome da sala
    const roomName = (order.desiredRoomName || `${order.roomTitle} - ${order.customerName || order.id}`).trim().substring(0, 50);

    // Senha Mestre: usa a informada pelo cliente ou gera uma exclusiva
    const masterPasscode = order.desiredPasscode || String(Math.floor(1000 + Math.random() * 9000));

    const cleanSlug = roomName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'sala';

    const uniqueId = `${cleanSlug}-${crypto.randomBytes(4).toString('hex')}`;
    const accessKey = 'key_' + crypto.randomBytes(16).toString('hex');

    const timeNotice = isPermanent ? 'Sala Permanente (sem expiração).' : `Duração contratada: ${duration} minutos.`;
    const passcodeNotice = ` Senha de acesso mestre: "${masterPasscode}".`;

    const newRoom: RoomData = {
      id: uniqueId,
      name: roomName,
      description: isDuo ? 'Sala Dupla exclusiva para 2 participantes com bate-papo seguro.' : `Sala privada para até ${maxParticipants} pessoas. Pedido ${order.id}.`,
      category: isDuo ? 'Sala Dupla' : 'Privada VIP',
      icon: isDuo ? 'Users' : (isPermanent ? 'ShieldCheck' : 'Clock'),
      color: isDuo ? '#06b6d4' : (isPermanent ? '#10b981' : '#f59e0b'),
      accessKey,
      creatorPasscode: masterPasscode,
      createdAt: now,
      durationMinutes: duration,
      expiresAt,
      isPermanent,
      maxParticipants,
      roomType: (isDuo ? (isPermanent ? 'duo_perm' : 'duo_temp') : (isPermanent ? 'group_perm' : 'group_temp')) as RoomType,
      hasMultiChat: false,
      isCustom: true,
      messages: [
        {
          id: 'sys_' + Math.random().toString(36).substring(2, 9),
          roomId: uniqueId,
          channelId: 'chat_1',
          sender: {
            id: 'system',
            name: 'Sistema AnonQR',
            avatarColor: '#10b981',
            avatarIcon: 'Shield',
          },
          content: `Sala criada e liberada após confirmação do pagamento Pix do pedido #${order.id}! ${timeNotice}${passcodeNotice}`,
          timestamp: now,
          type: 'system',
        },
      ],
    };

    rooms.set(uniqueId, newRoom);

    // 2. Atualiza o pedido como Aprovado
    const shareUrl = buildRoomInviteUrl(req, newRoom);
    order.status = 'approved';
    order.approvedAt = now;
    order.approvedRoomId = uniqueId;
    order.approvedRoomLink = shareUrl;
    order.approvedPasscode = masterPasscode;
    order.hasMultiChat = false;

    saveStore();

    // 3. Monta mensagem pronta e completa para envio no WhatsApp do cliente
    const whatsappDeliveryMessage =
      `🎉 *PAGAMENTO APROVADO! SUA SALA ESTÁ LIBERADA* 🎉\n\n` +
      `Olá *${order.customerName || 'Cliente'}*! Confirmamos o recebimento do seu Pix de *${order.priceFormatted}* referente ao pedido *#${order.id}*.\n\n` +
      `📋 *Detalhes da sua Sala:*` +
      `\n• *Tipo:* ${order.roomTitle}` +
      `\n• *Duração:* ${order.durationLabel}` +
      `\n• *Nome:* ${newRoom.name}` +
      `\n• *Capacidade:* ${maxParticipants} pessoas` +
      `\n\n🔗 *Link Exclusivo de Acesso:*` +
      `\n${shareUrl}` +
      `\n\n🔑 *Senha de Acesso:* ${masterPasscode}` +
      `\n🛡️ _Sala 100% criptografada e anônima. Bom uso!_`;

    res.json({
      success: true,
      order,
      room: {
        id: newRoom.id,
        name: newRoom.name,
        description: newRoom.description,
        durationMinutes: newRoom.durationMinutes,
        expiresAt: newRoom.expiresAt,
        isPermanent: newRoom.isPermanent,
        creatorPasscode: masterPasscode,
        shareUrl,
      },
      shareUrl,
      whatsappDeliveryMessage,
    });
  });

  // OWNER/ADMIN: Cancelar solicitação de compra
  app.post('/api/owner/purchase-orders/:id/cancel', (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const rawParam = String(req.params.id || '').trim();
    const cleanId = rawParam.replace(/^#/, '').trim();
    let order: PurchaseOrder | undefined = purchaseOrders.get(cleanId) || purchaseOrders.get(cleanId.toUpperCase());

    if (!order) {
      for (const [key, po] of purchaseOrders.entries()) {
        if (
          key.toLowerCase() === cleanId.toLowerCase() ||
          po.id.toLowerCase() === cleanId.toLowerCase()
        ) {
          order = po;
          break;
        }
      }
    }

    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    order.status = 'cancelled';
    saveStore();

    res.json({ success: true, order });
  });

  // OWNER/ADMIN: Excluir solicitação de compra e a sala vinculada (se houver)
  const handleDeletePurchaseOrder = (req: express.Request, res: express.Response) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const rawParam = String(req.params.id || '').trim();
    const cleanId = rawParam.replace(/^#/, '').trim();
    let targetKey: string | null = null;
    let order: PurchaseOrder | undefined = purchaseOrders.get(cleanId) || purchaseOrders.get(cleanId.toUpperCase());

    if (order) {
      targetKey = purchaseOrders.has(cleanId) ? cleanId : cleanId.toUpperCase();
    } else {
      for (const [key, po] of purchaseOrders.entries()) {
        if (
          key.toLowerCase() === cleanId.toLowerCase() ||
          po.id.toLowerCase() === cleanId.toLowerCase() ||
          key.toLowerCase() === rawParam.toLowerCase() ||
          po.id.toLowerCase() === rawParam.toLowerCase()
        ) {
          order = po;
          targetKey = key;
          break;
        }
      }
    }

    if (!order) {
      // Se a ordem já não está no mapa, retorna sucesso para desobstruir a UI imediatamente
      res.json({
        success: true,
        message: `Solicitação #${cleanId} já havia sido removida.`,
        deletedOrderId: cleanId,
      });
      return;
    }

    // Se uma sala foi gerada através deste pedido, exclui a sala e desconecta os participantes
    if (order.approvedRoomId) {
      terminateAndRemoveRoom(
        order.approvedRoomId,
        'A solicitação vinculada a esta sala foi excluída pelo administrador.'
      );
    }

    if (targetKey) {
      purchaseOrders.delete(targetKey);
    }
    purchaseOrders.delete(cleanId);
    purchaseOrders.delete(cleanId.toUpperCase());
    purchaseOrders.delete(rawParam);
    saveStore();

    res.json({ success: true, message: `Pedido #${order.id} excluído com sucesso!`, deletedOrderId: order.id });
  };

  app.post('/api/owner/purchase-orders/:id/delete', handleDeletePurchaseOrder);
  app.delete('/api/owner/purchase-orders/:id', handleDeletePurchaseOrder);

  // OWNER/ADMIN: List all purchases from Supabase public.compras
  app.get('/api/owner/supabase-compras', async (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    try {
      const client = supabaseAdmin || supabaseServer;
      const { data, error } = await client
        .from('compras')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Server Owner] Erro ao consultar public.compras:', error.message);
        res.json([]);
        return;
      }

      res.json(data || []);
    } catch (err: any) {
      console.error('[Server Owner] Exceção ao consultar supabase-compras:', err);
      res.json([]);
    }
  });

  // OWNER/ADMIN: Approve manual PIX purchase, updating status to 'paid' in Supabase
  app.post('/api/owner/supabase-compras/:id/approve', async (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const compraId = String(req.params.id || '').trim();
    if (!compraId) {
      res.status(400).json({ error: 'ID da compra é obrigatório.' });
      return;
    }

    try {
      const client = supabaseAdmin || supabaseServer;
      // 1. Busca os dados da compra no Supabase
      const { data: compraData, error: fetchErr } = await client
        .from('compras')
        .select('*')
        .eq('id', compraId)
        .maybeSingle();

      if (fetchErr) {
        console.warn('[Server Owner] Aviso ao buscar compra:', fetchErr.message);
      }

      // 2. Atualiza status para 'paid' em public.compras usando a RPC SECURITY DEFINER
      let approvedRecord: any = null;
      try {
        const { data: rpcData, error: rpcErr } = await client.rpc('aprovar_compra_admin', {
          p_compra_id: compraId,
          p_admin_secret: String(authHeader || '8090'),
        });

        if (!rpcErr && rpcData?.success) {
          approvedRecord = rpcData;
          console.log(`[Server Owner] Compra #${compraId} aprovada com sucesso via RPC aprovar_compra_admin.`);
        } else if (rpcErr) {
          console.warn('[Server Owner] RPC aprovar_compra_admin retornou aviso:', rpcErr.message);
        }
      } catch (rpcEx) {
        console.warn('[Server Owner] Exceção na RPC aprovar_compra_admin, tentando fallback:', rpcEx);
      }

      const nowIso = new Date().toISOString();

      // Fallback de UPDATE direto caso a RPC ainda não esteja instalada
      if (!approvedRecord) {
        const { data: updateData, error: updateErr } = await client
          .from('compras')
          .update({
            status: 'paid',
            updated_at: nowIso,
          })
          .eq('id', compraId)
          .select();

        if (updateErr && !approvedRecord) {
          console.error('[Server Owner] Erro ao atualizar status da compra:', updateErr.message);
          res.status(500).json({
            error: `Não foi possível atualizar compra no Supabase: ${updateErr.message}. Certifique-se de aplicar a migration SQL 'supabase_migration_lifecycle_and_approval.sql'.`,
          });
          return;
        }

        if (updateData?.[0]) {
          approvedRecord = updateData[0];
        }
      }

      // 3. Atualiza a sala em public.salas se vinculada
      const salaId = compraData?.sala_id || approvedRecord?.sala_id;
      const userId = compraData?.user_id || approvedRecord?.user_id;

      if (salaId) {
        try {
          await client
            .from('salas')
            .update({
              status: 'sold',
              comprador_id: userId,
              updated_at: nowIso,
            })
            .eq('id', salaId);
        } catch (e) {
          console.warn('[Server Owner] Aviso ao atualizar sala para sold:', e);
        }

        // O início da contagem do prazo NÃO começa com a aprovação do pagamento.
        // O prazo iniciará exclusivamente no 1º acesso do comprador (POST /api/rooms/join-verify).
        const productInfo = getProductDurationAndType(salaId);
        const cycle: PurchaseCycle = {
          compraId,
          userId,
          salaId,
          durationMinutes: compraData?.duration_minutes ?? productInfo.durationMinutes,
          isPermanent: compraData?.is_permanent ?? productInfo.isPermanent,
          status: 'paid',
          updatedAt: Date.now(),
        };
        purchaseCycles.set(compraId, cycle);
        saveStore();
      }

      console.log(`[Server Owner] Compra PIX #${compraId} APROVADA com sucesso para status 'paid'. O prazo iniciará no 1º acesso.`);
      res.json({
        success: true,
        message: 'Compra aprovada com sucesso! Status alterado para paid.',
        compra: approvedRecord || compraData,
      });
    } catch (err: any) {
      console.error('[Server Owner] Exceção ao aprovar compra:', err);
      res.status(500).json({ error: err?.message || 'Falha ao aprovar compra.' });
    }
  });

  // OWNER/ADMIN: Cancel manual PIX purchase
  app.post('/api/owner/supabase-compras/:id/cancel', async (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const compraId = String(req.params.id || '').trim();
    try {
      const client = supabaseAdmin || supabaseServer;
      const { data, error } = await client
        .from('compras')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', compraId)
        .select();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ success: true, compra: data?.[0] });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Falha ao cancelar compra.' });
    }
  });

  // OWNER/ADMIN: Delete purchase record
  app.post('/api/owner/supabase-compras/:id/delete', async (req, res) => {
    const authHeader = req.headers['x-owner-key'];
    if (authHeader !== '8090' && authHeader !== OWNER_SECRET_KEY) {
      res.status(401).json({ error: 'Acesso não autorizado ao painel do dono.' });
      return;
    }

    const compraId = String(req.params.id || '').trim();
    if (!compraId) {
      res.status(400).json({ error: 'ID da compra não fornecido.' });
      return;
    }

    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Serviço administrativo do Supabase não configurado no servidor.' });
      return;
    }

    try {
      const { error } = await supabaseAdmin
        .from('compras')
        .delete()
        .eq('id', compraId);

      if (error) {
        console.error('[Owner Admin] Erro ao deletar compra em public.compras:', error);
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ success: true, message: 'Compra removida definitivamente com sucesso.' });
    } catch (err: any) {
      console.error('[Owner Admin] Exceção ao deletar compra:', err);
      res.status(500).json({ error: err?.message || 'Falha ao remover compra.' });
    }
  });

  // PUBLIC: Get active rooms list - STRICTLY ONLY the 3 Open Rooms requested
  // Do not expose chat messages, only participant count
  app.get('/api/rooms', (req, res) => {
    const list = Array.from(rooms.values())
      .filter((r) => r.isOpenRoom === true)
      .map((r) => {
        const online = Array.from(clientConnections.values()).filter((c) => c.roomId === r.id).length;
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          category: r.category,
          icon: r.icon,
          color: r.color,
          accessKey: r.accessKey,
          createdAt: r.createdAt,
          durationMinutes: 0,
          expiresAt: 0,
          isPermanent: true,
          isOpenRoom: true,
          maxParticipants: r.maxParticipants || 100,
          hasPasscode: false,
          isCustom: false,
          onlineCount: online, // Apenas a quantidade de pessoas que estão lá! Sem conteúdo de conversas!
        };
      });
    res.json(list);
  });

  // PUBLIC: Get public info of a specific room for guest access verification
  app.get('/api/rooms/:id/info', (req, res) => {
    const room = rooms.get(req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Sala não encontrada ou já expirada.' });
      return;
    }

    const isPermanent = !!room.isPermanent || room.roomType === 'group_perm' || room.roomType === 'duo_perm' || room.durationMinutes === 0 || !!room.isOpenRoom;
    const isExpired = !isPermanent && (Date.now() > room.expiresAt || !!room.isExpired);
    const online = Array.from(clientConnections.values()).filter((c) => c.roomId === room.id).length;

    res.json({
      id: room.id,
      name: room.name,
      description: room.description,
      category: room.category,
      icon: room.icon,
      color: room.color,
      createdAt: room.createdAt,
      durationMinutes: room.durationMinutes,
      expiresAt: isPermanent ? 0 : room.expiresAt,
      isPermanent,
      maxParticipants: room.maxParticipants || 10,
      hasPasscode: !!room.creatorPasscode,
      hasMultiChat: !!room.hasMultiChat,
      isExpired,
      onlineCount: online,
      shareUrl: buildRoomInviteUrl(req, room),
    });
  });

  // Get room ticket & QR Code data (accessible by creator or validated guest)
  app.get('/api/rooms/:id/ticket', (req, res) => {
    const room = rooms.get(req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Sala não encontrada' });
      return;
    }

    const isPermanent = !!room.isPermanent || room.roomType === 'group_perm' || room.roomType === 'duo_perm' || room.durationMinutes === 0 || !!room.isOpenRoom;
    const isExpired = !isPermanent && (Date.now() > room.expiresAt || !!room.isExpired);
    const shareUrl = buildRoomInviteUrl(req, room);

    res.json({
      roomId: room.id,
      roomName: room.name,
      accessKey: room.accessKey,
      creatorPasscode: room.creatorPasscode,
      channelPasscodes: room.channelPasscodes,
      hasMultiChat: !!room.hasMultiChat,
      roomType: room.roomType,
      isPermanent,
      qrUrl: shareUrl,
      qrData: shareUrl,
      shareUrl,
      durationMinutes: room.durationMinutes,
      expiresAt: isPermanent ? 0 : room.expiresAt,
      maxParticipants: room.maxParticipants || 10,
      isExpired,
    });
  });

  // CREATE ROOM: Creator creates the room with passcode & activated voucher
  app.post('/api/rooms/create', (req, res) => {
    const {
      name,
      description,
      category,
      color,
      icon,
      creatorPasscode,
      voucherToken,
      customDurationMinutes,
      channelPasscodes: customChannelPasscodes,
    } = req.body;

    const authHeader = req.headers['x-owner-key'];
    const isOwner = authHeader === '8090' || authHeader === OWNER_SECRET_KEY;
    if (!isOwner && !voucherToken) {
      res.status(403).json({
        error: 'Apenas links autorizados pelo desenvolvedor/administrador podem criar salas.',
      });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'O nome da sala é obrigatório (mínimo 2 caracteres).' });
      return;
    }

    const passcode = (creatorPasscode || '').trim();
    if (!passcode || passcode.length < 3) {
      res.status(400).json({ error: 'Defina uma Senha/Código de Acesso de no mínimo 3 caracteres para sua sala.' });
      return;
    }

    let durationMinutes = 60; // Default 1 hour
    let isPermanent = false;
    let maxParticipants = 10;
    let roomType: RoomType = 'group_temp';
    let voucherRef: OwnerVoucher | null = null;

    // If a voucher is provided, validate and claim it
    if (voucherToken) {
      const cleanToken = String(voucherToken).trim();
      const v = vouchers.get(cleanToken);
      if (!v) {
        res.status(400).json({ error: 'Link de ativação não encontrado ou inexistente.' });
        return;
      }
      voucherRef = v;

      // If user reconnects or reloads after already creating the room, recover existing room!
      if (v.status === 'active' && v.usedByRoomId && rooms.has(v.usedByRoomId)) {
        const existingRoom = rooms.get(v.usedByRoomId)!;
        const isStillValid = existingRoom.isPermanent || Date.now() <= existingRoom.expiresAt;
        if (isStillValid) {
          const shareUrl = buildRoomInviteUrl(req, existingRoom);
          res.json({
            room: {
              id: existingRoom.id,
              name: existingRoom.name,
              description: existingRoom.description,
              category: existingRoom.category,
              icon: existingRoom.icon,
              color: existingRoom.color,
              createdAt: existingRoom.createdAt,
              durationMinutes: existingRoom.durationMinutes,
              expiresAt: existingRoom.expiresAt,
              isPermanent: !!existingRoom.isPermanent,
              maxParticipants: existingRoom.maxParticipants,
              hasMultiChat: false,
              roomType: existingRoom.roomType,
              hasPasscode: true,
              creatorPasscode: existingRoom.creatorPasscode,
              isCustom: true,
              onlineCount: 0,
            },
            shareUrl,
            qrUrl: shareUrl,
            qrData: shareUrl,
            accessKey: existingRoom.accessKey,
            creatorPasscode: existingRoom.creatorPasscode,
          });
          return;
        }
      }

      if (v.status === 'expired') {
        res.status(400).json({ error: 'Este link de ativação já expirou.' });
        return;
      }

      durationMinutes = v.durationMinutes;
      isPermanent = !!v.isPermanent;
      const vRoomTypeStr = String(v.roomType || '');
      const isDuo = vRoomTypeStr.startsWith('duo_');
      maxParticipants = isDuo ? 2 : 10;
      roomType = isDuo ? (isPermanent ? 'duo_perm' : 'duo_temp') : (isPermanent ? 'group_perm' : 'group_temp');
    } else if (customDurationMinutes && !isNaN(parseInt(customDurationMinutes, 10))) {
      durationMinutes = Math.max(5, Math.min(43200, parseInt(customDurationMinutes, 10)));
    }

    const cleanSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'sala';

    const uniqueId = `${cleanSlug}-${crypto.randomBytes(4).toString('hex')}`;
    const accessKey = 'key_' + crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const expiresAt = isPermanent ? 0 : now + durationMinutes * 60 * 1000;

    const timeNotice = isPermanent
      ? 'Sala Permanente (sem expiração).'
      : `Duração: ${durationMinutes} minutos. O cronômetro começou a correr.`;

    const isDuo = roomType === 'duo_temp' || roomType === 'duo_perm';

    const newRoom: RoomData = {
      id: uniqueId,
      name: name.trim().substring(0, 50),
      description: (description || (isDuo ? 'Sala dupla privativa para 2 pessoas.' : `Sala privada para até ${maxParticipants} pessoas.`)).trim().substring(0, 150),
      category: (category || (isDuo ? 'Sala Dupla' : 'Privado')).trim().substring(0, 30),
      icon: icon || (isDuo ? 'Users' : 'MessageSquare'),
      color: color || (isDuo ? '#06b6d4' : '#10b981'),
      accessKey,
      creatorPasscode: passcode,
      createdAt: now,
      durationMinutes,
      expiresAt,
      isPermanent,
      maxParticipants,
      hasMultiChat: false,
      roomType,
      isCustom: true,
      voucherToken: voucherToken ? String(voucherToken).trim() : undefined,
      messages: [
        {
          id: 'sys_' + Math.random().toString(36).substring(2, 9),
          roomId: uniqueId,
          channelId: 'chat_1',
          sender: {
            id: 'system',
            name: 'Sistema AnonQR',
            avatarColor: '#10b981',
            avatarIcon: 'Shield',
          },
          content: `Sala criada com sucesso! Capacidade: ${maxParticipants} pessoas. ${timeNotice} Senha da sala: "${passcode}".`,
          timestamp: now,
          type: 'system',
        },
      ],
    };

    rooms.set(uniqueId, newRoom);

    // If attached to a voucher, mark as active and save client's room name and passcode for the owner!
    if (voucherRef) {
      voucherRef.status = 'active';
      voucherRef.usedAt = now;
      voucherRef.usedByRoomId = uniqueId;
      voucherRef.roomName = newRoom.name;
      voucherRef.creatorPasscode = passcode;
    }

    saveStore();

    const shareUrl = buildRoomInviteUrl(req, newRoom);

    res.json({
      room: {
        id: newRoom.id,
        name: newRoom.name,
        description: newRoom.description,
        category: newRoom.category,
        icon: newRoom.icon,
        color: newRoom.color,
        createdAt: newRoom.createdAt,
        durationMinutes: newRoom.durationMinutes,
        expiresAt: newRoom.expiresAt,
        isPermanent: newRoom.isPermanent,
        maxParticipants: newRoom.maxParticipants,
        hasMultiChat: false,
        roomType: newRoom.roomType,
        hasPasscode: true,
        creatorPasscode: passcode,
        isCustom: true,
        onlineCount: 0,
      },
      shareUrl,
      qrUrl: shareUrl,
      qrData: shareUrl,
      accessKey,
      creatorPasscode: passcode,
    });
  });

  // Retorna os ciclos de compras registrados para refletir status real em Minhas Compras
  app.get('/api/compras/cycles', (req, res) => {
    const userIdQuery = typeof req.query.userId === 'string' ? req.query.userId.trim().toLowerCase() : '';
    const now = Date.now();
    let hasChanged = false;

    const cyclesMap: Record<string, {
      compraId: string;
      salaId: string;
      userId?: string;
      activatedAt?: number;
      expiresAt?: number;
      durationMinutes: number;
      isPermanent: boolean;
      status: string;
    }> = {};

    for (const [compraId, pc] of purchaseCycles.entries()) {
      if (userIdQuery && pc.userId && pc.userId.toLowerCase() !== userIdQuery) {
        continue;
      }
      let status = pc.status;
      if (!pc.isPermanent && pc.expiresAt && pc.expiresAt > 0 && now >= pc.expiresAt) {
        status = 'expired';
        if (pc.status !== 'expired') {
          pc.status = 'expired';
          hasChanged = true;
        }
      }

      cyclesMap[compraId] = {
        compraId: pc.compraId,
        salaId: pc.salaId,
        userId: pc.userId,
        activatedAt: pc.activatedAt,
        expiresAt: pc.expiresAt,
        durationMinutes: pc.durationMinutes,
        isPermanent: pc.isPermanent,
        status,
      };
    }

    // Sincroniza salas ativas em memória que possuam compraId vinculado caso ainda não constem em cyclesMap
    for (const [, room] of rooms.entries()) {
      if (room.compraId && (!cyclesMap[room.compraId] || !cyclesMap[room.compraId].activatedAt)) {
        const isExp = !room.isPermanent && room.expiresAt > 0 && now >= room.expiresAt;
        const pc = purchaseCycles.get(room.compraId);
        if (userIdQuery && pc?.userId && pc.userId.toLowerCase() !== userIdQuery) {
          continue;
        }
        cyclesMap[room.compraId] = {
          compraId: room.compraId,
          salaId: room.id,
          userId: pc?.userId,
          activatedAt: pc?.activatedAt || room.activatedAt,
          expiresAt: pc?.expiresAt || room.expiresAt,
          durationMinutes: pc?.durationMinutes || room.durationMinutes,
          isPermanent: pc?.isPermanent || !!room.isPermanent,
          status: isExp ? 'expired' : (pc?.status || (room.isExpired ? 'expired' : 'paid')),
        };
      }
    }

    if (hasChanged) {
      saveStore();
    }

    res.json({ cycles: cyclesMap });
  });

  // Marca uma compra específica como expirada sob demanda do frontend
  app.post('/api/compras/:id/expire', async (req, res) => {
    const compraId = String(req.params.id || '').trim();
    if (!compraId) {
      res.status(400).json({ error: 'ID da compra é obrigatório.' });
      return;
    }

    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const scopedSupabase = bearerToken
      ? createClient(SUPABASE_BACKEND_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${bearerToken}` } },
        })
      : (supabaseAdmin || supabaseServer);

    const result = await markPurchaseExpired(compraId, scopedSupabase);
    if (!result.success) {
      res.status(500).json({ error: result.error || 'Erro ao expirar compra no Supabase.' });
      return;
    }
    res.json({ success: true, compraId, status: 'expired' });
  });

  // VERIFY GUEST ENTRY / OWNER ENTRY: Verify room status, purchase cycle, passcode and capacity
  app.post('/api/rooms/join-verify', async (req, res) => {
    const { roomId, passcode, accessKey, compraId, userId } = req.body;
    if (!roomId && !compraId) {
      res.status(400).json({ error: 'Identificador da sala ou compra ausente.' });
      return;
    }

    // Extração do Access Token JWT do usuário autenticado para respeitar RLS em public.compras
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const userToken = bearerToken || (typeof req.body.accessToken === 'string' ? req.body.accessToken.trim() : '');

    // Cria cliente Supabase autenticado com a sessão do usuário
    const scopedSupabase = userToken
      ? createClient(SUPABASE_BACKEND_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false },
          global: {
            headers: {
              Authorization: `Bearer ${userToken}`,
            },
          },
        })
      : (supabaseAdmin || supabaseServer);

    let authenticatedUserId = userId || null;
    if (userToken) {
      try {
        const { data: authUser } = await scopedSupabase.auth.getUser(userToken);
        if (authUser?.user?.id) {
          authenticatedUserId = authUser.user.id;
        }
      } catch (e) {
        console.warn('[Lifecycle] Aviso ao verificar token JWT do usuário:', e);
      }
    }

    try {
      let targetCompra: any = null;

      // 1. Localiza a compra se compraId foi fornecido
      if (compraId) {
        const cleanCompraId = String(compraId).trim();
        try {
          // Consulta autenticada respeitando a política RLS (auth.uid() = user_id)
          const { data, error } = await scopedSupabase
            .from('compras')
            .select('*')
            .eq('id', cleanCompraId)
            .maybeSingle();

          if (data && !error) {
            targetCompra = data;
          } else if (scopedSupabase !== supabaseServer) {
            // Fallback usando supabaseServer caso o client autenticado não encontre
            const { data: fallbackData } = await supabaseServer
              .from('compras')
              .select('*')
              .eq('id', cleanCompraId)
              .maybeSingle();
            if (fallbackData) {
              targetCompra = fallbackData;
            }
          }
        } catch (e) {
          console.warn('[Lifecycle] Aviso ao buscar compra no Supabase:', e);
        }

        // Se não achou no Supabase, verifica no store local de ciclos
        if (!targetCompra && purchaseCycles.has(cleanCompraId)) {
          const pc = purchaseCycles.get(cleanCompraId)!;
          targetCompra = {
            id: pc.compraId,
            user_id: pc.userId,
            sala_id: pc.salaId,
            status: pc.status,
            duration_minutes: pc.durationMinutes,
            is_permanent: pc.isPermanent,
            activated_at: pc.activatedAt ? new Date(pc.activatedAt).toISOString() : null,
            expires_at: pc.expiresAt ? new Date(pc.expiresAt).toISOString() : null,
          };
        }
      }

      // Se não passou compraId, mas o roomId tem formato UUID, tenta buscar como id da compra
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId || '');
      if (!targetCompra && isUuid) {
        try {
          const { data } = await scopedSupabase
            .from('compras')
            .select('*')
            .eq('id', roomId)
            .maybeSingle();
          if (data) {
            targetCompra = data;
          } else if (scopedSupabase !== supabaseServer) {
            const { data: fallbackData } = await supabaseServer
              .from('compras')
              .select('*')
              .eq('id', roomId)
              .maybeSingle();
            if (fallbackData) targetCompra = fallbackData;
          }
        } catch (_) {}
      }

      // Se a sala já está em memória e possui compraId vinculado, busca os dados atualizados dessa compra
      if (!targetCompra && roomId && rooms.has(roomId) && rooms.get(roomId)!.compraId) {
        const linkedCompraId = rooms.get(roomId)!.compraId!;
        try {
          const { data } = await scopedSupabase
            .from('compras')
            .select('*')
            .eq('id', linkedCompraId)
            .maybeSingle();
          if (data) targetCompra = data;
        } catch (_) {}
        if (!targetCompra && purchaseCycles.has(linkedCompraId)) {
          const pc = purchaseCycles.get(linkedCompraId)!;
          targetCompra = {
            id: pc.compraId,
            user_id: pc.userId,
            sala_id: pc.salaId,
            status: pc.status,
            duration_minutes: pc.durationMinutes,
            is_permanent: pc.isPermanent,
            activated_at: pc.activatedAt ? new Date(pc.activatedAt).toISOString() : null,
            expires_at: pc.expiresAt ? new Date(pc.expiresAt).toISOString() : null,
          };
        }
      }

      // Se ainda não temos compra específica, verifica se há um ciclo de compra local ativo com esta salaId
      if (!targetCompra && roomId && !roomId.startsWith('open-')) {
        for (const [, pc] of purchaseCycles.entries()) {
          if (pc.salaId === roomId && pc.status === 'paid') {
            targetCompra = {
              id: pc.compraId,
              user_id: pc.userId,
              sala_id: pc.salaId,
              status: pc.status,
              duration_minutes: pc.durationMinutes,
              is_permanent: pc.isPermanent,
              activated_at: pc.activatedAt ? new Date(pc.activatedAt).toISOString() : null,
              expires_at: pc.expiresAt ? new Date(pc.expiresAt).toISOString() : null,
            };
            break;
          }
        }
      }

      // Se ainda não temos compra específica, consulta public.compras por sala_id (ordena por mais recente)
      if (!targetCompra && roomId && !roomId.startsWith('open-')) {
        try {
          const query = scopedSupabase
            .from('compras')
            .select('*')
            .eq('sala_id', roomId)
            .eq('status', 'paid')
            .order('created_at', { ascending: false });

          if (authenticatedUserId) {
            query.eq('user_id', authenticatedUserId);
          } else if (userId) {
            query.eq('user_id', userId);
          }

          const { data } = await query.limit(1).maybeSingle();
          if (data) {
            targetCompra = data;
          } else if (scopedSupabase !== supabaseServer) {
            const serverQuery = supabaseServer
              .from('compras')
              .select('*')
              .eq('sala_id', roomId)
              .eq('status', 'paid')
              .order('created_at', { ascending: false });
            if (authenticatedUserId) {
              serverQuery.eq('user_id', authenticatedUserId);
            }
            const { data: serverData } = await serverQuery.limit(1).maybeSingle();
            if (serverData) targetCompra = serverData;
          }
        } catch (_) {}
      }

      // Validação de segurança: se a compra foi solicitada explicitamente por compraId, valida permissão
      if (compraId && targetCompra && authenticatedUserId && targetCompra.user_id) {
        if (targetCompra.user_id !== authenticatedUserId) {
          res.status(403).json({ error: 'Acesso negado: esta compra pertence a outro usuário.' });
          return;
        }
      }

      // 2. Processa ciclo temporal caso uma compra tenha sido identificada
      const targetRoomId = targetCompra?.sala_id || roomId;
      let room = (targetCompra?.id ? rooms.get(targetCompra.id) : null) || rooms.get(targetRoomId);

      // Busca dados reais da sala na tabela public.salas para recuperar duração, nome, capacidade
      let salaEntity: any = null;
      try {
        const { data: sData } = await supabaseServer
          .from('salas')
          .select('*')
          .eq('id', targetRoomId)
          .maybeSingle();
        if (sData) {
          salaEntity = sData;
        }
      } catch (_) {}

      if (targetCompra) {
        // Valida se a compra já está marcada como expirada
        if (targetCompra.status === 'expired') {
          res.status(410).json({ error: 'O tempo contratado para esta sala expirou.' });
          return;
        }

        if (targetCompra.status !== 'paid') {
          res.status(403).json({ error: 'O pagamento desta compra ainda não foi confirmado.' });
          return;
        }

        const productInfo = getProductDurationAndType(targetCompra.sala_id || targetRoomId, salaEntity, targetCompra);
        let isPermanent = Boolean(targetCompra.is_permanent ?? productInfo.isPermanent);
        let durationMinutes = isPermanent ? 0 : (targetCompra.duration_minutes ?? productInfo.durationMinutes);
        let expiresAt = 0;
        let activatedAtMs: number | null = null;

        if (isPermanent) {
          expiresAt = 0;
          activatedAtMs = targetCompra.activated_at ? new Date(targetCompra.activated_at).getTime() : null;

          // Se a compra permanente ainda não foi ativada no banco, registra via RPC
          if (!activatedAtMs) {
            const preCycle: PurchaseCycle = {
              compraId: targetCompra.id,
              userId: targetCompra.user_id || authenticatedUserId || userId,
              salaId: targetCompra.sala_id || targetRoomId,
              durationMinutes: 0,
              isPermanent: true,
              activatedAt: 0,
              expiresAt: 0,
              status: 'paid',
              createdAt: targetCompra.created_at ? new Date(targetCompra.created_at).getTime() : Date.now(),
              updatedAt: Date.now(),
            };
            const activationResult = await persistPurchaseActivation(preCycle, scopedSupabase);
            if (!activationResult.success) {
              const status = activationResult.statusCode || 500;
              res.status(status).json({
                error: activationResult.error || 'Não foi possível registrar a ativação da sala permanente no banco de dados.',
              });
              return;
            }
            activatedAtMs = activationResult.activatedAt || Date.now();
          }
        } else {
          // SALA TEMPORÁRIA:
          // A fonte primária da verdade é public.compras associada ao compra.id específico.
          const dbActivatedAt = targetCompra.activated_at ? new Date(targetCompra.activated_at).getTime() : null;
          const dbExpiresAt = targetCompra.expires_at ? new Date(targetCompra.expires_at).getTime() : null;

          // BLOQUEIO ANTECIPADO: Se o banco já registrou expires_at vencido, recusa imediatamente
          if (dbExpiresAt && dbExpiresAt > 0 && Date.now() >= dbExpiresAt) {
            console.log(`[Lifecycle V3] Compra #${targetCompra.id} com expires_at vencido no Supabase (${new Date(dbExpiresAt).toISOString()}). Bloqueando.`);
            await markPurchaseExpired(targetCompra.id, scopedSupabase);
            res.status(410).json({ error: 'O tempo contratado para esta sala expirou.' });
            return;
          }

          // 1. Prioridade 1: Supabase já possui expires_at persistido (reutiliza estritamente)
          if (dbExpiresAt && !isNaN(dbExpiresAt) && dbExpiresAt > 0) {
            expiresAt = dbExpiresAt;
            activatedAtMs = (dbActivatedAt && !isNaN(dbActivatedAt) && dbActivatedAt > 0)
              ? dbActivatedAt
              : (dbExpiresAt - durationMinutes * 60 * 1000);
            console.log(`[Lifecycle V3] Compra #${targetCompra.id}: Reutilizando expires_at persistido no Supabase: ${new Date(expiresAt).toISOString()}`);
          }
          // 2. Prioridade 2: Supabase já possui activated_at gravado (calcula expires_at = activated_at + duration)
          // REGRA FUNDAMENTAL: NUNCA usar Date.now() + duration se a compra já possui activated_at!
          else if (dbActivatedAt && !isNaN(dbActivatedAt) && dbActivatedAt > 0) {
            activatedAtMs = dbActivatedAt;
            expiresAt = dbActivatedAt + durationMinutes * 60 * 1000;
            console.log(`[Lifecycle V3] Compra #${targetCompra.id}: Reutilizando activated_at persistido (${new Date(activatedAtMs).toISOString()}). expires_at definitivo = activated_at + ${durationMinutes}m: ${new Date(expiresAt).toISOString()}`);
          }
          // 3. Caso não possua activated_at nem expires_at no Supabase: PRIMEIRO ACESSO GENUÍNO via RPC V3 no Supabase
          // ATIVAÇÃO OBRIGATÓRIA NO POSTGRESQL: Se a RPC falhar, NÃO autoriza entrada nem mascara com memória.
          else {
            console.log(`[Lifecycle V3] 1º ACESSO GENUÍNO da compra #${targetCompra.id} (${durationMinutes}m). Invocando ativação atômica no banco.`);

            const preCycle: PurchaseCycle = {
              compraId: targetCompra.id,
              userId: targetCompra.user_id || authenticatedUserId || userId,
              salaId: targetCompra.sala_id || targetRoomId,
              durationMinutes,
              isPermanent: false,
              activatedAt: 0,
              expiresAt: 0,
              status: 'paid',
              createdAt: targetCompra.created_at ? new Date(targetCompra.created_at).getTime() : Date.now(),
              updatedAt: Date.now(),
            };

            const activationResult = await persistPurchaseActivation(preCycle, scopedSupabase);

            if (activationResult.isExpired) {
              res.status(410).json({ error: 'O tempo contratado para esta sala expirou.' });
              return;
            }

            if (!activationResult.success) {
              const status = activationResult.statusCode || 500;
              res.status(status).json({
                error: activationResult.error || 'Não foi possível ativar o ciclo da sala no banco de dados. Tente novamente.',
              });
              return;
            }

            // Sucesso da RPC: utiliza o resultado persistido pelo PostgreSQL como fonte de verdade
            if (activationResult.isPermanent) {
              isPermanent = true;
              expiresAt = 0;
            } else {
              if (!activationResult.expiresAt || activationResult.expiresAt <= 0) {
                res.status(500).json({ error: 'Falha ao registrar prazo de expiração no banco de dados.' });
                return;
              }
              expiresAt = activationResult.expiresAt;
            }

            if (activationResult.activatedAt && activationResult.activatedAt > 0) {
              activatedAtMs = activationResult.activatedAt;
            }
            if (activationResult.durationMinutes) {
              durationMinutes = activationResult.durationMinutes;
            }
          }

          // VERIFICA SE O PRAZO DEFINITIVO JÁ EXPIROU
          if (expiresAt > 0 && Date.now() >= expiresAt) {
            console.log(`[Lifecycle V3] Compra #${targetCompra.id} com prazo expirado (${new Date(expiresAt).toISOString()}). Bloqueando entrada.`);
            await markPurchaseExpired(targetCompra.id, scopedSupabase);
            if (room && room.compraId === targetCompra.id) {
              room.isExpired = true;
              room.expiresAt = expiresAt;
            }
            res.status(410).json({ error: 'O tempo contratado para esta sala expirou.' });
            return;
          }

          // Atualiza cache em disco com o ciclo definitivo
          if (activatedAtMs && expiresAt) {
            purchaseCycles.set(targetCompra.id, {
              compraId: targetCompra.id,
              userId: targetCompra.user_id || authenticatedUserId || userId,
              salaId: targetCompra.sala_id || targetRoomId,
              durationMinutes,
              isPermanent: false,
              activatedAt: activatedAtMs,
              expiresAt,
              status: 'paid',
              updatedAt: Date.now(),
            });
            saveStore();
          }
        }

        // Cria ou sincroniza a sala em memória com o ciclo desta compra específica
        if (!room || room.compraId !== targetCompra.id) {
          const maxParticipants = productInfo.maxParticipants;
          const isDuo = maxParticipants === 2;
          const newAccessKey = 'key_' + crypto.randomBytes(16).toString('hex');
          room = {
            id: targetRoomId,
            name: productInfo.title,
            description: productInfo.description,
            category: isDuo ? 'Sala Dupla' : 'Sala de Grupo',
            icon: isDuo ? 'Users' : 'ShieldCheck',
            color: isDuo ? '#ec4899' : '#10b981',
            accessKey: newAccessKey,
            creatorPasscode: '',
            createdAt: activatedAtMs || (targetCompra.activated_at ? new Date(targetCompra.activated_at).getTime() : Date.now()),
            durationMinutes,
            expiresAt: isPermanent ? 0 : expiresAt,
            isPermanent,
            maxParticipants,
            hasMultiChat: false,
            roomType: productInfo.roomType,
            isCustom: true,
            compraId: targetCompra.id,
            activatedAt: activatedAtMs || (targetCompra.activated_at ? new Date(targetCompra.activated_at).getTime() : Date.now()),
            messages: [
              {
                id: 'sys_' + Math.random().toString(36).substring(2, 9),
                roomId: targetRoomId,
                sender: {
                  id: 'system',
                  name: 'Sistema AnonQR',
                  avatarColor: isDuo ? '#ec4899' : '#10b981',
                  avatarIcon: 'Shield',
                },
                content: isPermanent
                  ? 'Acesso vitalício liberado! Esta sala permanente não possui expiração.'
                  : `Acesso liberado! Duração contratada: ${durationMinutes >= 60 ? `${Math.floor(durationMinutes / 60)}h` : `${durationMinutes}m`}.`,
                timestamp: Date.now(),
                type: 'system',
              },
            ],
          };
          rooms.set(targetRoomId, room);
          if (targetCompra?.id) {
            rooms.set(targetCompra.id, room);
          }
          saveStore();
        } else {
          // SALA JÁ EM MEMÓRIA PARA ESTA MESMA COMPRA:
          // NUNCA sobreescreve com novo prazo se já possui ciclo ativo.
          // Aplica estritamente o expiresAt oficial verificado da compra.
          if (isPermanent) {
            room.expiresAt = 0;
            room.isPermanent = true;
          } else {
            room.expiresAt = expiresAt;
            room.isPermanent = false;
            if (activatedAtMs) {
              room.activatedAt = activatedAtMs;
            }
          }
          room.durationMinutes = durationMinutes;
          if (targetCompra?.id && !rooms.has(targetCompra.id)) {
            rooms.set(targetCompra.id, room);
          }
          saveStore();
        }
      }

      // 3. Se ainda não temos a sala em memória (e não foi associada a compra)
      if (!room) {
        if (targetRoomId.startsWith('open-')) {
          const openInfo = getProductDurationAndType(targetRoomId);
          room = {
            id: targetRoomId,
            name: openInfo.title,
            description: 'Sala aberta pública sem senha.',
            category: 'Sala Aberta',
            icon: 'Users',
            color: '#3b82f6',
            accessKey: 'open_access_key',
            creatorPasscode: '',
            createdAt: Date.now(),
            durationMinutes: 0,
            expiresAt: 0,
            isPermanent: true,
            isOpenRoom: true,
            maxParticipants: 100,
            hasMultiChat: false,
            roomType: 'open',
            messages: [],
          };
          rooms.set(targetRoomId, room);
          saveStore();
        } else {
          res.status(404).json({ error: 'A sala solicitada não existe ou foi excluída.' });
          return;
        }
      }

      // Check expiration if not permanent
      if (!room.isPermanent && (Date.now() > room.expiresAt || room.isExpired)) {
        room.isExpired = true;
        if (room.compraId) {
          await markPurchaseExpired(room.compraId, scopedSupabase);
        }
        res.status(410).json({ error: 'O tempo contratado para esta sala expirou.' });
        return;
      }

      // Check total room capacity
      const online = Array.from(clientConnections.values()).filter((c) => c.roomId === room!.id).length;
      const maxCapacity = room.hasMultiChat ? 10 : (room.maxParticipants || 10);
      if (online >= maxCapacity) {
        res.status(403).json({ error: `Sala lotada! A capacidade máxima de ${maxCapacity} pessoas foi atingida.` });
        return;
      }

      const inputPasscode = (passcode || '').trim();
      const hasPasscode = Boolean(room.creatorPasscode && room.creatorPasscode.trim().length > 0);
      const isMasterPasscode = hasPasscode && inputPasscode.toLowerCase() === room.creatorPasscode!.toLowerCase();
      const isMasterKey = Boolean(accessKey && room.accessKey === accessKey);

      // Check if inputPasscode matches one of the individual channel passcodes
      let matchedChannel: string | undefined = undefined;
      let matchedChannelKey: string | undefined = undefined;
      if (room.hasMultiChat && room.channelPasscodes) {
        for (const [ch, chPass] of Object.entries(room.channelPasscodes)) {
          if (inputPasscode && inputPasscode.toLowerCase() === chPass.trim().toLowerCase()) {
            matchedChannel = ch;
            matchedChannelKey = room.channelAccessKeys?.[ch];
            break;
          }
        }
      }

      // Also check if accessKey is a channel access key
      if (!matchedChannel && room.hasMultiChat && room.channelAccessKeys && accessKey) {
        for (const [ch, chKey] of Object.entries(room.channelAccessKeys)) {
          if (accessKey === chKey) {
            matchedChannel = ch;
            matchedChannelKey = chKey;
            break;
          }
        }
      }

      const canEnterDirectly = !hasPasscode;

      if (!canEnterDirectly && !isMasterPasscode && !isMasterKey && !matchedChannel) {
        res.status(401).json({
          error: room.hasMultiChat
            ? 'Código de acesso incorreto. Digite a Senha Mestre ou a Senha Exclusiva de um dos 5 chats.'
            : 'Código de acesso incorreto. Solicite a senha correta ao criador da sala.',
          requiresPasscode: true,
        });
        return;
      }

      // If joining a specific channel as a guest, check if that channel is already occupied by another guest
      if (matchedChannel && !isMasterPasscode && !isMasterKey) {
        const guestsInChannel = Array.from(clientConnections.values()).filter(
          (c) => c.roomId === room!.id && c.assignedChannelId === matchedChannel
        ).length;
        if (guestsInChannel >= 1) {
          res.status(403).json({
            error: `O chat "${matchedChannel.replace('chat_', 'Chat ')}" já possui um participante conectado no momento.`,
          });
          return;
        }
      }

      const isMaster = isMasterPasscode || isMasterKey || !room.hasMultiChat;
      const grantedAccessKey = isMaster
        ? room.accessKey
        : (matchedChannelKey || `${room.accessKey}_${matchedChannel}`);
      const assignedChannelId = isMaster ? undefined : matchedChannel;
      const allowedChannels = isMaster
        ? ['chat_1', 'chat_2', 'chat_3', 'chat_4', 'chat_5']
        : (matchedChannel ? [matchedChannel] : undefined);

      res.json({
        valid: true,
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          category: room.category,
          icon: room.icon,
          color: room.color,
          createdAt: room.createdAt,
          durationMinutes: room.durationMinutes,
          expiresAt: room.expiresAt,
          isPermanent: !!room.isPermanent,
          maxParticipants: room.maxParticipants || 10,
          hasMultiChat: !!room.hasMultiChat,
          roomType: room.roomType,
          hasPasscode: !!room.creatorPasscode,
          creatorPasscode: isMaster ? room.creatorPasscode : undefined,
          channelPasscodes: isMaster ? room.channelPasscodes : undefined,
          isCustom: !!room.isCustom,
          onlineCount: online,
          assignedChannelId,
          allowedChannels,
          isMaster,
          compraId: room.compraId,
          activatedAt: room.activatedAt,
        },
        accessKey: grantedAccessKey,
        assignedChannelId,
        isMaster,
      });
    } catch (err: any) {
      console.error('[Lifecycle] Erro no join-verify:', err);
      res.status(500).json({ error: 'Erro interno ao validar entrada na sala.' });
    }
  });

  // Backward-compatible QR scanner verification
  app.post('/api/verify-qr', (req, res) => {
    let roomId = req.body.roomId;
    let accessKey = req.body.accessKey;
    const { qrData } = req.body;

    if (!roomId && qrData && typeof qrData === 'string') {
      const trimmed = qrData.trim();
      if (trimmed.includes('room=')) {
        try {
          const urlToParse = trimmed.startsWith('http')
            ? trimmed
            : `https://dummy.local${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
          const url = new URL(urlToParse);
          roomId = url.searchParams.get('room') || url.searchParams.get('roomId') || roomId;
          accessKey = url.searchParams.get('key') || url.searchParams.get('accessKey') || accessKey;
        } catch {}
      } else if (rooms.has(trimmed)) {
        roomId = trimmed;
      }
    }

    if (!roomId) {
      res.status(400).json({ error: 'QR Code ou link não reconhecido.' });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      res.status(404).json({ error: 'A sala vinculada não existe ou expirou.' });
      return;
    }

    if (!room.isPermanent && (Date.now() > room.expiresAt || room.isExpired)) {
      res.status(410).json({ error: 'O tempo contratado para esta sala expirou.' });
      return;
    }

    const online = Array.from(clientConnections.values()).filter((c) => c.roomId === room.id).length;
    const maxCapacity = room.hasMultiChat ? 10 : (room.maxParticipants || 10);
    if (online >= maxCapacity) {
      res.status(403).json({ error: `Sala lotada! A capacidade máxima de ${maxCapacity} pessoas foi atingida.` });
      return;
    }

    // Check master key or channel key
    const hasMasterKey = Boolean(accessKey && accessKey === room.accessKey);
    let channelKeyMatch: string | undefined = undefined;
    if (room.hasMultiChat && room.channelAccessKeys && accessKey) {
      for (const [ch, chKey] of Object.entries(room.channelAccessKeys)) {
        if (accessKey === chKey) {
          channelKeyMatch = ch;
          break;
        }
      }
    }

    const hasValidKey = hasMasterKey || Boolean(channelKeyMatch);
    const hasPasscode = Boolean(room.creatorPasscode && room.creatorPasscode.trim().length > 0);
    if (hasPasscode && !hasValidKey) {
      res.json({
        valid: false,
        requiresPasscode: true,
        roomId: room.id,
        roomName: room.name,
        hasMultiChat: !!room.hasMultiChat,
      });
      return;
    }

    const isMaster = hasMasterKey || !room.hasMultiChat;
    const assignedChannelId = isMaster ? undefined : channelKeyMatch;
    const allowedChannels = isMaster
      ? ['chat_1', 'chat_2', 'chat_3', 'chat_4', 'chat_5']
      : (assignedChannelId ? [assignedChannelId] : undefined);

    res.json({
      valid: true,
      requiresPasscode: false,
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        category: room.category,
        icon: room.icon,
        color: room.color,
        createdAt: room.createdAt,
        durationMinutes: room.durationMinutes,
        expiresAt: room.expiresAt,
        isPermanent: !!room.isPermanent,
        maxParticipants: room.maxParticipants || 10,
        hasMultiChat: !!room.hasMultiChat,
        roomType: room.roomType,
        hasPasscode: !!room.creatorPasscode,
        creatorPasscode: isMaster ? room.creatorPasscode : undefined,
        channelPasscodes: isMaster ? room.channelPasscodes : undefined,
        isCustom: !!room.isCustom,
        onlineCount: online,
        assignedChannelId,
        allowedChannels,
        isMaster,
      },
      accessKey: accessKey || room.accessKey,
      assignedChannelId,
      allowedChannels,
      isMaster,
    });
  });

  // FILE UPLOAD: Upload photos and videos for private chat rooms (Forbidden in Open Room)
  app.post('/api/rooms/:id/upload', (req, res) => {
    const roomId = String(req.params.id);
    const room = rooms.get(roomId);
    if (!room) {
      res.status(404).json({ error: 'Sala não encontrada.' });
      return;
    }

    if (room.isOpenRoom) {
      res.status(403).json({ error: 'O envio de fotos e vídeos não é permitido no grupo aberto.' });
      return;
    }

    if (!room.isPermanent && (Date.now() > room.expiresAt || room.isExpired)) {
      res.status(410).json({ error: 'Esta sala já expirou.' });
      return;
    }

    const rawDataBase64 = req.body.dataBase64 || req.body.fileData || req.body.base64 || req.body.data;
    const rawFileName = req.body.fileName || req.body.name;
    const rawMimeType = req.body.mimeType || req.body.fileType || req.body.type;

    if (!rawDataBase64 || typeof rawDataBase64 !== 'string') {
      res.status(400).json({ error: 'Nenhum dado de mídia recebido.' });
      return;
    }

    const isVideo = rawMimeType?.startsWith('video/') || rawFileName?.match(/\.(mp4|webm|mov|mkv)$/i);
    const isImage = rawMimeType?.startsWith('image/') || rawFileName?.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i);

    if (!isVideo && !isImage) {
      res.status(400).json({ error: 'Formato não suportado. Envie apenas fotos ou vídeos.' });
      return;
    }

    try {
      const base64Data = rawDataBase64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length > 30 * 1024 * 1024) {
        res.status(400).json({ error: 'O arquivo excede o limite máximo permitido de 30MB.' });
        return;
      }

      const ext = path.extname(rawFileName || (isVideo ? '.mp4' : '.jpg')) || (isVideo ? '.mp4' : '.jpg');
      const safeName = `media_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
      const filePath = path.join(uploadsDir, safeName);
      fs.writeFileSync(filePath, buffer);

      const fileUrl = `/uploads/${safeName}`;

      res.json({
        success: true,
        attachment: {
          type: isVideo ? 'video' : 'image',
          url: fileUrl,
          name: rawFileName || (isVideo ? 'video.mp4' : 'foto.jpg'),
          size: buffer.length,
        },
      });
    } catch (err: any) {
      console.error('Erro ao processar upload:', err);
      res.status(500).json({ error: 'Erro ao salvar arquivo no servidor.' });
    }
  });

  // ==========================================
  // MODO JOGO: VERDADE OU DESAFIO (SERVER)
  // ==========================================

  const SERVER_ANIMAL_AVATARS = [
    { name: 'Raposa', emoji: '🦊', color: '#f97316' },
    { name: 'Lobo', emoji: '🐺', color: '#64748b' },
    { name: 'Panda', emoji: '🐼', color: '#06b6d4' },
    { name: 'Coruja', emoji: '🦉', color: '#8b5cf6' },
    { name: 'Tigre', emoji: '🐯', color: '#eab308' },
    { name: 'Leão', emoji: '🦁', color: '#f59e0b' },
    { name: 'Coelho', emoji: '🐰', color: '#ec4899' },
    { name: 'Urso', emoji: '🐻', color: '#a16207' },
    { name: 'Unicórnio', emoji: '🦄', color: '#d946ef' },
    { name: 'Dragão', emoji: '🐲', color: '#10b981' },
  ];

  const SERVER_TRUTHS = [
    { id: 't_light_1', type: 'truth', level: 'light', content: 'Qual foi a coisa mais engraçada que já aconteceu com você em público?' },
    { id: 't_light_2', type: 'truth', level: 'light', content: 'Qual hábito estranho ou engraçado você tem quando ninguém está olhando?' },
    { id: 't_light_3', type: 'truth', level: 'light', content: 'Qual foi a última coisa que te fez rir até chorar?' },
    { id: 't_light_4', type: 'truth', level: 'light', content: 'Qual é o seu maior medo bobo ou incomum?' },
    { id: 't_light_5', type: 'truth', level: 'light', content: 'Se você pudesse comer apenas uma comida pelo resto da vida, qual seria?' },
    { id: 't_light_6', type: 'truth', level: 'light', content: 'Qual foi a mentira mais inofensiva que você contou na infância?' },
    { id: 't_light_7', type: 'truth', level: 'light', content: 'Qual é o seu talento secreto que poucas pessoas conhecem?' },
    { id: 't_intense_1', type: 'truth', level: 'intense', content: 'Qual foi uma decisão impulsiva que você tomou e se arrependeu logo em seguida?' },
    { id: 't_intense_2', type: 'truth', level: 'intense', content: 'Qual segredo inofensivo você nunca contou para a maioria dos seus amigos?' },
    { id: 't_intense_3', type: 'truth', level: 'intense', content: 'Qual foi a situação mais constrangedora que você já viveu?' },
    { id: 't_intense_4', type: 'truth', level: 'intense', content: 'Qual primeira impressão equivocada alguém já teve sobre você?' },
    { id: 't_intense_5', type: 'truth', level: 'intense', content: 'Se você pudesse mudar um acontecimento do seu passado, qual escolheria?' },
    { id: 't_heavy_1', type: 'truth', level: 'heavy', content: 'Qual é o maior aprendizado que você tirou de um momento difícil na sua vida?' },
    { id: 't_heavy_2', type: 'truth', level: 'heavy', content: 'Se você pudesse pedir desculpas sinceras para alguém do seu passado, para quem seria e por quê?' },
    { id: 't_heavy_3', type: 'truth', level: 'heavy', content: 'Qual é o maior objetivo pessoal que você está buscando alcançar este ano?' },
  ];

  const SERVER_DARES = [
    { id: 'd_light_1', type: 'dare', level: 'light', content: 'Imite o som de um animal escolhido pela sala durante 15 segundos.' },
    { id: 'd_light_2', type: 'dare', level: 'light', content: 'Conte uma piada engraçada ou tente fazer três pessoas rir no recinto.' },
    { id: 'd_light_3', type: 'dare', level: 'light', content: 'Faça uma caminhada engraçada pela sala imitando um robô.' },
    { id: 'd_light_4', type: 'dare', level: 'light', content: 'Fale com um sotaque diferente durante os próximos 2 minutos.' },
    { id: 'd_light_5', type: 'dare', level: 'light', content: 'Cante o refrão de uma música popular como se estivesse num show de ópera.' },
    { id: 'd_intense_1', type: 'dare', level: 'intense', content: 'Faça uma imitação respeitosa e engraçada de alguém presente na roda durante 30 segundos.' },
    { id: 'd_intense_2', type: 'dare', level: 'intense', content: 'Invente e conte uma história curta em 30 segundos usando três palavras escolhidas pela sala.' },
    { id: 'd_intense_3', type: 'dare', level: 'intense', content: 'Elogie sinceramente três pessoas presentes destacando qualidades únicas de cada uma.' },
    { id: 'd_intense_4', type: 'dare', level: 'intense', content: 'Crie uma mini rima improvisada de 4 versos sobre o AnônQr e apresente para a roda.' },
    { id: 'd_heavy_1', type: 'dare', level: 'heavy', content: 'Faça um discurso dramático de 1 minuto em tom de agradecimento ao grupo por estarem reunidos.' },
    { id: 'd_heavy_2', type: 'dare', level: 'heavy', content: 'Faça uma demonstração mímica de um filme famoso sem usar palavras até que alguém adivinhe.' },
    { id: 'd_heavy_3', type: 'dare', level: 'heavy', content: 'Compartilhe uma dica valiosa de vida que você aprendeu com sua própria experiência.' },
  ];

  interface ServerTruthOrDareGame {
    roomId: string;
    hostId: string;
    level: 'light' | 'intense' | 'heavy' | 'surprise';
    effectiveLevel: 'light' | 'intense' | 'heavy';
    phase: 'lobby' | 'choosing_player' | 'selecting_type' | 'round_active' | 'round_completed' | 'finished';
    players: Map<string, {
      id: string;
      originalName: string;
      gameNick: string;
      avatarColor: string;
      isReady: boolean;
      isHost: boolean;
      isOnline: boolean;
      lastSeenAt: number;
      truthsAnswered: number;
      daresCompleted: number;
      questionsAsked: number;
    }>;
    roundsCompleted: number;
    truthsCount: number;
    daresCount: number;
    currentRound?: {
      roundNumber: number;
      targetPlayerId: string;
      targetNick: string;
      selectedType?: 'truth' | 'dare';
      contentItem?: { id: string; type: 'truth' | 'dare'; level: string; content: string };
      conductorPlayerId?: string;
      conductorNick?: string;
      status: 'selecting_type' | 'active' | 'skipped' | 'completed';
    };
    usedContentIds: Set<string>;
    recentTargetIds: string[];
    recentConductorIds: string[];
  }

  const truthOrDareGames = new Map<string, ServerTruthOrDareGame>();

  function broadcastTruthOrDareState(roomId: string) {
    const game = truthOrDareGames.get(roomId);
    if (!game) return;

    const serializedState = {
      roomId: game.roomId,
      hostId: game.hostId,
      level: game.level,
      effectiveLevel: game.effectiveLevel,
      phase: game.phase,
      players: Array.from(game.players.values()),
      roundsCompleted: game.roundsCompleted,
      truthsCount: game.truthsCount,
      daresCount: game.daresCount,
      currentRound: game.currentRound,
      usedContentIds: Array.from(game.usedContentIds),
      recentTargetIds: game.recentTargetIds,
      recentConductorIds: game.recentConductorIds,
    };

    const payload = JSON.stringify({
      type: 'truth_or_dare_state',
      gameState: serializedState,
    });

    clientConnections.forEach((meta, wsClient) => {
      if (wsClient.readyState === WebSocket.OPEN && meta.roomId === roomId) {
        try {
          wsClient.send(payload);
        } catch {}
      }
    });
  }

  function startNextRound(game: ServerTruthOrDareGame) {
    const currentActive = Array.from(game.players.values()).filter((p) => p.isOnline);
    if (currentActive.length < 2) {
      game.phase = 'lobby';
      broadcastTruthOrDareState(game.roomId);
      return;
    }

    game.phase = 'choosing_player';
    broadcastTruthOrDareState(game.roomId);

    setTimeout(() => {
      if (!game || game.phase !== 'choosing_player') return;

      const currentActivePlayers = Array.from(game.players.values()).filter((p) => p.isOnline);
      const candidates = currentActivePlayers.filter((p) => !game.recentTargetIds.includes(p.id));
      const pool = candidates.length > 0 ? candidates : currentActivePlayers;
      const targetPlayer = pool[Math.floor(Math.random() * pool.length)];

      game.recentTargetIds.push(targetPlayer.id);
      if (game.recentTargetIds.length > 3) game.recentTargetIds.shift();

      game.currentRound = {
        roundNumber: game.roundsCompleted + 1,
        targetPlayerId: targetPlayer.id,
        targetNick: targetPlayer.gameNick,
        status: 'selecting_type',
      };

      game.phase = 'selecting_type';
      broadcastTruthOrDareState(game.roomId);
    }, 1500);
  }

  function handleTruthOrDareAction(ws: WebSocket, msg: any) {
    const { action, roomId, user, userId, level, selectedType } = msg;
    const targetRoomId = String(roomId || 'tod_default').trim();

    let game = truthOrDareGames.get(targetRoomId);

    if (action === 'join_game') {
      if (!game) {
        game = {
          roomId: targetRoomId,
          hostId: user?.id || 'host_anon',
          level: 'light',
          effectiveLevel: 'light',
          phase: 'lobby',
          players: new Map(),
          roundsCompleted: 0,
          truthsCount: 0,
          daresCount: 0,
          usedContentIds: new Set(),
          recentTargetIds: [],
          recentConductorIds: [],
        };
        truthOrDareGames.set(targetRoomId, game);
      }

      const uId = user?.id || 'user_' + Math.random().toString(36).substring(2, 7);
      const existingPlayer = game.players.get(uId);

      if (!existingPlayer) {
        const existingNicks = Array.from(game.players.values()).map((p) => p.gameNick);
        const animal = SERVER_ANIMAL_AVATARS[Math.floor(Math.random() * SERVER_ANIMAL_AVATARS.length)];
        const num = Math.floor(1000 + Math.random() * 9000);
        const gameNick = `${animal.emoji} ${animal.name}${num}`;

        game.players.set(uId, {
          id: uId,
          originalName: user?.name || 'Jogador',
          gameNick,
          avatarColor: animal.color,
          isReady: false,
          isHost: game.players.size === 0 || game.hostId === uId,
          isOnline: true,
          lastSeenAt: Date.now(),
          truthsAnswered: 0,
          daresCompleted: 0,
          questionsAsked: 0,
        });
      } else {
        existingPlayer.isOnline = true;
        existingPlayer.lastSeenAt = Date.now();
      }

      let meta = clientConnections.get(ws);
      if (!meta) {
        meta = { ws };
        clientConnections.set(ws, meta);
      }
      meta.roomId = targetRoomId;
      meta.user = user || { id: uId, name: 'Jogador', avatarColor: '#10b981', avatarIcon: 'User' };

      // Resposta direta e imediata ao socket do remetente
      const serializedState = {
        roomId: game.roomId,
        hostId: game.hostId,
        level: game.level,
        effectiveLevel: game.effectiveLevel,
        phase: game.phase,
        players: Array.from(game.players.values()),
        roundsCompleted: game.roundsCompleted,
        truthsCount: game.truthsCount,
        daresCount: game.daresCount,
        currentRound: game.currentRound,
        usedContentIds: Array.from(game.usedContentIds),
        recentTargetIds: game.recentTargetIds,
        recentConductorIds: game.recentConductorIds,
      };

      try {
        ws.send(
          JSON.stringify({
            type: 'truth_or_dare_state',
            gameState: serializedState,
          })
        );
      } catch (err) {
        console.error('Erro ao responder join_game no socket:', err);
      }

      broadcastTruthOrDareState(targetRoomId);
      return;
    }

    if (!game) return;

    if (action === 'toggle_ready') {
      const p = game.players.get(userId);
      if (p) {
        p.isReady = !p.isReady;
        broadcastTruthOrDareState(targetRoomId);
      }
      return;
    }

    if (action === 'select_level') {
      if (game.hostId === userId && ['light', 'intense', 'heavy', 'surprise'].includes(level)) {
        game.level = level;
        broadcastTruthOrDareState(targetRoomId);
      }
      return;
    }

    if (action === 'start_game') {
      if (game.hostId !== userId) return;
      const activePlayers = Array.from(game.players.values()).filter((p) => p.isOnline);
      if (activePlayers.length < 2) return;

      game.phase = 'choosing_player';
      broadcastTruthOrDareState(targetRoomId);

      setTimeout(() => {
        if (!game || game.phase !== 'choosing_player') return;

        const currentActive = Array.from(game.players.values()).filter((p) => p.isOnline);
        const candidates = currentActive.filter((p) => !game.recentTargetIds.includes(p.id));
        const pool = candidates.length > 0 ? candidates : currentActive;
        const targetPlayer = pool[Math.floor(Math.random() * pool.length)];

        game.recentTargetIds.push(targetPlayer.id);
        if (game.recentTargetIds.length > 3) game.recentTargetIds.shift();

        game.currentRound = {
          roundNumber: game.roundsCompleted + 1,
          targetPlayerId: targetPlayer.id,
          targetNick: targetPlayer.gameNick,
          status: 'selecting_type',
        };

        game.phase = 'selecting_type';
        broadcastTruthOrDareState(targetRoomId);
      }, 1500);
      return;
    }

    if (action === 'choose_type') {
      if (!game.currentRound || game.currentRound.targetPlayerId !== userId) return;
      if (game.currentRound.status !== 'selecting_type') return;

      const chosenType: 'truth' | 'dare' = selectedType === 'dare' ? 'dare' : 'truth';
      game.currentRound.selectedType = chosenType;

      let effLevel = game.level;
      if (game.level === 'surprise') {
        const levels: Array<'light' | 'intense' | 'heavy'> = ['light', 'intense', 'heavy'];
        effLevel = levels[Math.floor(Math.random() * levels.length)];
      }
      game.effectiveLevel = effLevel as 'light' | 'intense' | 'heavy';

      // Sorteio autoritativo do condutor/perguntador no mundo real
      const currentActive = Array.from(game.players.values()).filter((p) => p.isOnline);
      let conductorCandidates = currentActive.filter((p) => p.id !== userId);

      if (conductorCandidates.length > 1) {
        const freshCandidates = conductorCandidates.filter((p) => !game.recentConductorIds.includes(p.id));
        if (freshCandidates.length > 0) conductorCandidates = freshCandidates;
      }

      const conductorPlayer = conductorCandidates.length > 0
        ? conductorCandidates[Math.floor(Math.random() * conductorCandidates.length)]
        : currentActive[0];

      if (conductorPlayer) {
        game.recentConductorIds.push(conductorPlayer.id);
        if (game.recentConductorIds.length > 3) game.recentConductorIds.shift();

        game.currentRound.conductorPlayerId = conductorPlayer.id;
        game.currentRound.conductorNick = conductorPlayer.gameNick;
      }

      game.currentRound.status = 'active';
      game.phase = 'round_active';

      broadcastTruthOrDareState(targetRoomId);
      return;
    }

    if (action === 'confirm_round') {
      if (!game.currentRound || game.phase !== 'round_active') return;
      if (game.currentRound.conductorPlayerId !== userId && game.currentRound.targetPlayerId !== userId) return;

      game.currentRound.status = 'completed';
      game.roundsCompleted++;

      if (game.currentRound.selectedType === 'truth') {
        game.truthsCount++;
        const p = game.players.get(game.currentRound.targetPlayerId);
        if (p) p.truthsAnswered++;
      } else {
        game.daresCount++;
        const p = game.players.get(game.currentRound.targetPlayerId);
        if (p) p.daresCompleted++;
      }

      if (game.currentRound.conductorPlayerId) {
        const cond = game.players.get(game.currentRound.conductorPlayerId);
        if (cond) cond.questionsAsked++;
      }

      game.phase = 'round_completed';
      broadcastTruthOrDareState(targetRoomId);

      setTimeout(() => {
        if (!game || game.phase !== 'round_completed') return;
        startNextRound(game);
      }, 2500);
      return;
    }

    if (action === 'skip_round') {
      if (!game.currentRound || game.phase !== 'round_active') return;
      if (game.currentRound.conductorPlayerId !== userId && game.currentRound.targetPlayerId !== userId) return;

      game.currentRound.status = 'skipped';
      game.phase = 'round_completed';
      broadcastTruthOrDareState(targetRoomId);

      setTimeout(() => {
        if (!game || game.phase !== 'round_completed') return;
        startNextRound(game);
      }, 2500);
      return;
    }

    if (action === 'end_game') {
      if (game.hostId === userId) {
        game.phase = 'finished';
        broadcastTruthOrDareState(targetRoomId);
      }
      return;
    }

    if (action === 'restart_game') {
      if (game.hostId === userId) {
        game.phase = 'lobby';
        game.roundsCompleted = 0;
        game.truthsCount = 0;
        game.daresCount = 0;
        game.currentRound = undefined;
        game.usedContentIds.clear();
        broadcastTruthOrDareState(targetRoomId);
      }
      return;
    }
  }

  // ==========================================
  // MODO JOGO: ACHE O IMPOSTOR (SERVER)
  // ==========================================

  const SERVER_IMPOSTOR_SCENARIOS = [
    { id: 'aeroporto', name: 'Aeroporto', icon: '✈️' },
    { id: 'praia', name: 'Praia', icon: '🏖️' },
    { id: 'hospital', name: 'Hospital', icon: '🏥' },
    { id: 'cinema', name: 'Cinema', icon: '🎬' },
    { id: 'escola', name: 'Escola', icon: '🏫' },
    { id: 'restaurante', name: 'Restaurante', icon: '🍽️' },
    { id: 'estadio', name: 'Estádio de Futebol', icon: '🏟️' },
    { id: 'hotel', name: 'Hotel', icon: '🏨' },
    { id: 'parque', name: 'Parque de Diversões', icon: '🎢' },
    { id: 'supermercado', name: 'Supermercado', icon: '🛒' },
    { id: 'academia', name: 'Academia', icon: '🏋️' },
    { id: 'show', name: 'Show de Música', icon: '🎤' },
    { id: 'estacao_trem', name: 'Estação de Trem', icon: 'estation_trem' },
    { id: 'rodoviaria', name: 'Rodoviária', icon: '🚌' },
    { id: 'escritorio', name: 'Escritório', icon: '🏢' },
    { id: 'universidade', name: 'Universidade', icon: '🎓' },
    { id: 'acampamento', name: 'Acampamento', icon: '🏕️' },
    { id: 'casamento', name: 'Festa de Casamento', icon: '💒' },
  ];

  const SERVER_IMPOSTOR_PROMPTS = [
    'Comente alguma coisa sobre a temperatura ou o clima que você sente nesse lugar.',
    'Diga um objeto comum que você veria espalhado nesse ambiente.',
    'Fale sobre algo que você costuma fazer quando está nesse lugar.',
    'Comente sobre o barulho ou tipo de som característico desse local.',
    'Diga se você precisaria pagar algum valor para permanecer nesse ambiente.',
    'Fale sobre o tipo de roupa que a maioria das pessoas usa aqui.',
    'Comente algo que você costuma comer ou beber nesse ambiente.',
    'Diga um imprevisto ou inconveniente chato que pode acontecer nesse lugar.',
    'Fale se você viria aqui acompanhado ou sozinho.',
    'Comente se esse é um lugar onde as pessoas costumam passar rápido ou ficar muito tempo.',
    'Diga um objeto indispensável para levar quando você vai a esse ambiente.',
    'Comente qual costuma ser a melhor hora do dia para visitar esse lugar.',
    'Fale se esse ambiente te transmite tranquilidade ou agitação.',
  ];

  interface ServerImpostorPlayer {
    id: string;
    originalName: string;
    gameNick: string;
    avatarColor: string;
    isReady: boolean;
    isHost: boolean;
    isOnline: boolean;
    isImpostor: boolean;
    hasVoted: boolean;
    votedForId?: string;
  }

  interface ServerImpostorGame {
    roomId: string;
    hostId: string;
    phase:
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
    players: Map<string, ServerImpostorPlayer>;
    scenario?: { id: string; name: string; icon: string };
    scenarioOptions?: Array<{ id: string; name: string; icon: string }>;
    currentRound: number;
    speakingOrder: string[];
    currentSpeakerIndex: number;
    currentPromptSuggestion?: string;
    voteCounts?: Record<string, number>;
    mostVotedPlayerId?: string;
    isMostVotedImpostor?: boolean;
    impostorGuess?: string;
    winner?: 'group' | 'impostor';
    tiePlayerIds?: string[];
  }

  const findTheImpostorGames = new Map<string, ServerImpostorGame>();

  function broadcastImpostorState(roomId: string) {
    const game = findTheImpostorGames.get(roomId);
    if (!game) return;

    clientConnections.forEach((meta, wsClient) => {
      if (wsClient.readyState === WebSocket.OPEN && meta.roomId === roomId) {
        const clientUserId = meta.user?.id;
        const clientPlayer = clientUserId ? game.players.get(clientUserId) : null;
        const isClientImpostor = clientPlayer?.isImpostor || false;

        // Omitir cenário do Impostor durante o jogo
        const hideScenario = isClientImpostor && game.phase !== 'finished';

        const serializedPlayers = Array.from(game.players.values()).map((p) => {
          const showImpostorRole = p.id === clientUserId || game.phase === 'finished';
          return {
            id: p.id,
            originalName: p.originalName,
            gameNick: p.gameNick,
            avatarColor: p.avatarColor,
            isReady: p.isReady,
            isHost: p.isHost,
            isOnline: p.isOnline,
            isImpostor: showImpostorRole ? p.isImpostor : undefined,
            hasVoted: p.hasVoted,
          };
        });

        const serializedState = {
          roomId: game.roomId,
          hostId: game.hostId,
          phase: game.phase,
          players: serializedPlayers,
          scenario: hideScenario ? undefined : game.scenario,
          scenarioOptions: isClientImpostor || game.phase === 'finished' ? game.scenarioOptions : undefined,
          currentRound: game.currentRound,
          speakingOrder: game.speakingOrder,
          currentSpeakerIndex: game.currentSpeakerIndex,
          currentPromptSuggestion: game.currentPromptSuggestion,
          voteCounts: game.phase === 'finished' || game.phase === 'vote_reveal' ? game.voteCounts : undefined,
          mostVotedPlayerId: game.mostVotedPlayerId,
          isMostVotedImpostor: game.isMostVotedImpostor,
          winner: game.winner,
          tiePlayerIds: game.tiePlayerIds,
        };

        try {
          wsClient.send(
            JSON.stringify({
              type: 'impostor_state',
              gameState: serializedState,
            })
          );
        } catch {}
      }
    });
  }

  function handleImpostorAction(ws: WebSocket, msg: any) {
    const { action, roomId, user, userId, votedForId, guessScenarioId } = msg;
    const targetRoomId = String(roomId || 'imp_default').trim();

    let game = findTheImpostorGames.get(targetRoomId);

    if (action === 'join_game') {
      if (!game) {
        game = {
          roomId: targetRoomId,
          hostId: user?.id || 'host_anon',
          phase: 'lobby',
          players: new Map(),
          currentRound: 1,
          speakingOrder: [],
          currentSpeakerIndex: 0,
        };
        findTheImpostorGames.set(targetRoomId, game);
      }

      const uId = user?.id || 'user_' + Math.random().toString(36).substring(2, 7);
      const existingPlayer = game.players.get(uId);

      if (!existingPlayer) {
        const animal = SERVER_ANIMAL_AVATARS[Math.floor(Math.random() * SERVER_ANIMAL_AVATARS.length)];
        const num = Math.floor(1000 + Math.random() * 9000);
        const gameNick = `${animal.emoji} ${animal.name}${num}`;

        game.players.set(uId, {
          id: uId,
          originalName: user?.name || 'Jogador',
          gameNick,
          avatarColor: animal.color,
          isReady: false,
          isHost: game.players.size === 0 || game.hostId === uId,
          isOnline: true,
          isImpostor: false,
          hasVoted: false,
        });
      } else {
        existingPlayer.isOnline = true;
      }

      let meta = clientConnections.get(ws);
      if (!meta) {
        meta = { ws };
        clientConnections.set(ws, meta);
      }
      meta.roomId = targetRoomId;
      meta.user = user || { id: uId, name: 'Jogador', avatarColor: '#8b5cf6', avatarIcon: 'User' };

      broadcastImpostorState(targetRoomId);
      return;
    }

    if (!game) return;

    if (action === 'toggle_ready') {
      const p = game.players.get(userId);
      if (p) {
        p.isReady = !p.isReady;
        broadcastImpostorState(targetRoomId);
      }
      return;
    }

    if (action === 'start_game') {
      if (game.hostId !== userId) return;
      const activePlayers = Array.from(game.players.values()).filter((p) => p.isOnline);
      if (activePlayers.length < 3) return;

      const chosenScenario = SERVER_IMPOSTOR_SCENARIOS[Math.floor(Math.random() * SERVER_IMPOSTOR_SCENARIOS.length)];
      game.scenario = chosenScenario;

      const impostorIndex = Math.floor(Math.random() * activePlayers.length);
      activePlayers.forEach((p, idx) => {
        p.isImpostor = (idx === impostorIndex);
        p.hasVoted = false;
        p.votedForId = undefined;
      });

      const optionsSet = new Set<string>();
      optionsSet.add(chosenScenario.id);
      while (optionsSet.size < Math.min(4, SERVER_IMPOSTOR_SCENARIOS.length)) {
        const randSc = SERVER_IMPOSTOR_SCENARIOS[Math.floor(Math.random() * SERVER_IMPOSTOR_SCENARIOS.length)];
        optionsSet.add(randSc.id);
      }
      game.scenarioOptions = SERVER_IMPOSTOR_SCENARIOS.filter((sc) => optionsSet.has(sc.id));

      game.phase = 'role_distribution';
      broadcastImpostorState(targetRoomId);
      return;
    }

    if (action === 'next_speaker') {
      if (game.phase === 'role_distribution') {
        game.phase = 'round_speaking';
        game.currentRound = 1;

        const activePlayerIds = Array.from(game.players.values()).filter((p) => p.isOnline).map((p) => p.id);
        game.speakingOrder = activePlayerIds.sort(() => Math.random() - 0.5);
        game.currentSpeakerIndex = 0;
        game.currentPromptSuggestion = SERVER_IMPOSTOR_PROMPTS[Math.floor(Math.random() * SERVER_IMPOSTOR_PROMPTS.length)];

        broadcastImpostorState(targetRoomId);
        return;
      }

      if (game.phase === 'round_speaking') {
        if (game.currentSpeakerIndex < game.speakingOrder.length - 1) {
          game.currentSpeakerIndex++;
          game.currentPromptSuggestion = SERVER_IMPOSTOR_PROMPTS[Math.floor(Math.random() * SERVER_IMPOSTOR_PROMPTS.length)];
        } else {
          if (game.currentRound < 3) {
            game.currentRound++;
            const activePlayerIds = Array.from(game.players.values()).filter((p) => p.isOnline).map((p) => p.id);
            game.speakingOrder = activePlayerIds.sort(() => Math.random() - 0.5);
            game.currentSpeakerIndex = 0;
            game.currentPromptSuggestion = SERVER_IMPOSTOR_PROMPTS[Math.floor(Math.random() * SERVER_IMPOSTOR_PROMPTS.length)];
          } else {
            game.phase = 'free_investigation';
          }
        }
        broadcastImpostorState(targetRoomId);
        return;
      }
    }

    if (action === 'start_identity_reveal') {
      game.phase = 'identity_reveal';
      broadcastImpostorState(targetRoomId);
      return;
    }

    if (action === 'start_suspicions') {
      game.phase = 'suspicions_declaration';
      broadcastImpostorState(targetRoomId);
      return;
    }

    if (action === 'start_voting') {
      game.phase = 'voting';
      game.players.forEach((p) => {
        p.hasVoted = false;
        p.votedForId = undefined;
      });
      broadcastImpostorState(targetRoomId);
      return;
    }

    if (action === 'submit_vote') {
      const p = game.players.get(userId);
      if (p && !p.hasVoted && votedForId && votedForId !== userId) {
        p.hasVoted = true;
        p.votedForId = votedForId;

        const activePlayers = Array.from(game.players.values()).filter((player) => player.isOnline);
        const allVoted = activePlayers.every((player) => player.hasVoted);

        if (allVoted) {
          const counts: Record<string, number> = {};
          activePlayers.forEach((player) => {
            if (player.votedForId) {
              counts[player.votedForId] = (counts[player.votedForId] || 0) + 1;
            }
          });
          game.voteCounts = counts;

          let maxVotes = 0;
          Object.values(counts).forEach((val) => {
            if (val > maxVotes) maxVotes = val;
          });

          const topScorers = Object.keys(counts).filter((pId) => counts[pId] === maxVotes);

          if (topScorers.length > 1) {
            game.phase = 'tie_break_discussion';
            game.tiePlayerIds = topScorers;
          } else if (topScorers.length === 1) {
            game.mostVotedPlayerId = topScorers[0];
            const targetP = game.players.get(topScorers[0]);
            game.isMostVotedImpostor = Boolean(targetP?.isImpostor);
            game.phase = 'vote_reveal';
          }
        }
        broadcastImpostorState(targetRoomId);
      }
      return;
    }

    if (action === 'reveal_most_voted') {
      if (game.isMostVotedImpostor) {
        game.phase = 'impostor_last_chance';
      } else {
        game.winner = 'impostor';
        game.phase = 'finished';
      }
      broadcastImpostorState(targetRoomId);
      return;
    }

    if (action === 'submit_impostor_guess') {
      const p = game.players.get(userId);
      if (p && p.isImpostor && guessScenarioId) {
        game.impostorGuess = guessScenarioId;
        if (guessScenarioId === game.scenario?.id) {
          game.winner = 'impostor';
        } else {
          game.winner = 'group';
        }
        game.phase = 'finished';
        broadcastImpostorState(targetRoomId);
      }
      return;
    }

    if (action === 'restart_game') {
      if (game.hostId === userId) {
        game.phase = 'lobby';
        game.scenario = undefined;
        game.winner = undefined;
        game.mostVotedPlayerId = undefined;
        game.isMostVotedImpostor = undefined;
        game.voteCounts = undefined;
        game.players.forEach((player) => {
          player.isImpostor = false;
          player.hasVoted = false;
          player.votedForId = undefined;
        });
        broadcastImpostorState(targetRoomId);
      }
      return;
    }

    if (action === 'end_game') {
      if (game.hostId === userId) {
        game.phase = 'finished';
        broadcastImpostorState(targetRoomId);
      }
      return;
    }
  }

  // Periodic room expiration check (every 5 seconds)
  setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms.entries()) {
      if (!room.isPermanent && !room.isExpired && now > room.expiresAt) {
        room.isExpired = true;
        room.messages = [];
        room.knownParticipants = {};
        if (room.compraId) {
          markPurchaseExpired(room.compraId).catch((err) => {
            console.error(`[Lifecycle Timer] Erro ao expirar compra #${room.compraId}:`, err);
          });
        }
        // Broadcast expiration to connected clients
        broadcastToRoom(id, {
          type: 'room_expired',
          roomId: id,
          message: 'O tempo contratado para esta sala expirou. A sessão foi encerrada.',
        });
      }
    }

    // Expiration check for active purchased cycles (persists even if room isn't held in memory)
    for (const [compraId, cycle] of purchaseCycles.entries()) {
      if (!cycle.isPermanent && cycle.status === 'paid' && cycle.expiresAt && now > cycle.expiresAt) {
        markPurchaseExpired(compraId).catch((err) => {
          console.error(`[Lifecycle Timer] Erro ao expirar ciclo #${compraId}:`, err);
        });
      }
    }
  }, 5000);

  wss.on('connection', (ws) => {
    clientConnections.set(ws, { ws });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const meta = clientConnections.get(ws);
        if (!meta) return;

        switch (msg.type) {
          case 'truth_or_dare_action': {
            handleTruthOrDareAction(ws, msg);
            break;
          }

          case 'impostor_action': {
            handleImpostorAction(ws, msg);
            break;
          }

          case 'join': {
            const { roomId, accessKey, user } = msg;
            const room = rooms.get(roomId);
            if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: 'Sala não encontrada.' }));
              return;
            }

            let isMaster = false;
            let assignedChannelId: string | undefined = undefined;

            if (room.isOpenRoom) {
              isMaster = true;
            } else if (room.accessKey === accessKey) {
              isMaster = true;
            } else if (room.hasMultiChat && room.channelAccessKeys) {
              for (const [ch, chKey] of Object.entries(room.channelAccessKeys)) {
                if (chKey === accessKey || `${room.accessKey}_${ch}` === accessKey) {
                  assignedChannelId = ch;
                  break;
                }
              }
            }

            if (!isMaster && !assignedChannelId && !room.isOpenRoom) {
              ws.send(JSON.stringify({ type: 'error', message: 'Acesso negado: chave de sala inválida.' }));
              return;
            }

            // Check expiration if not permanent
            if (!room.isPermanent && (Date.now() > room.expiresAt || room.isExpired)) {
              room.isExpired = true;
              room.messages = [];
              room.knownParticipants = {};
              ws.send(JSON.stringify({ type: 'error', message: 'Esta sala expirou e não recebe mais conexões.' }));
              return;
            }

            // Check capacity limit
            const currentUsers = getOnlineUsersInRoom(roomId);
            const isAlreadyInRoom = currentUsers.some((u) => u.id === user.id);
            const maxCapacity = room.hasMultiChat ? 10 : (room.maxParticipants || 10);
            if (!isAlreadyInRoom && currentUsers.length >= maxCapacity) {
              const capMsg = `Sala lotada: Limite de ${maxCapacity} pessoas atingido.`;
              ws.send(JSON.stringify({ type: 'error', message: capMsg }));
              return;
            }

            meta.roomId = roomId;
            meta.user = user;

            if (user && user.id) {
              activeUserSockets.set(ws, {
                ws,
                user: {
                  id: user.id,
                  name: user.name,
                  nick: user.nick,
                  avatarUrl: user.avatarUrl,
                  avatarColor: user.avatarColor,
                  avatarIcon: user.avatarIcon,
                },
              });
            }
            meta.isMaster = isMaster;
            meta.assignedChannelId = assignedChannelId;
            meta.allowedChannels = isMaster
              ? ['chat_1', 'chat_2', 'chat_3', 'chat_4', 'chat_5']
              : (assignedChannelId ? [assignedChannelId] : undefined);

            // Garantir que as coleções em memória existam na sala
            if (!room.messages) room.messages = [];
            if (!room.knownParticipants) room.knownParticipants = {};

            // Verificar se é primeira entrada ou retorno/reconexão
            const isReturningParticipant = !!room.knownParticipants[user.id];

            if (!isReturningParticipant) {
              // Primeira entrada: registrar nos participantes conhecidos durante a vida da sala
              room.knownParticipants[user.id] = {
                id: user.id,
                name: user.name,
                avatarColor: user.avatarColor,
                avatarIcon: user.avatarIcon,
                firstJoinedAt: Date.now(),
                lastSeenAt: Date.now(),
              };
            } else {
              // Retorno do mesmo participante: atualizar apenas dados mutáveis (nome/avatar e lastSeen)
              const existingParticipant = room.knownParticipants[user.id];
              existingParticipant.name = user.name;
              if (user.avatarColor) existingParticipant.avatarColor = user.avatarColor;
              if (user.avatarIcon) existingParticipant.avatarIcon = user.avatarIcon;
              existingParticipant.lastSeenAt = Date.now();
            }

            // Filter history for guests restricted to a single channel
            const onlineUsers = getOnlineUsersInRoom(roomId);
            const rawVisibleMessages = (room.hasMultiChat && assignedChannelId)
              ? room.messages.filter((m) => !m.channelId || m.channelId === assignedChannelId || m.type === 'system')
              : room.messages;

            // Enviar no máximo as últimas 100 mensagens para histórico leve e seguro
            const visibleMessages = rawVisibleMessages.slice(-100);

            ws.send(
              JSON.stringify({
                type: 'room_state',
                room: {
                  id: room.id,
                  name: room.name,
                  description: room.description,
                  category: room.category,
                  icon: room.icon,
                  color: room.color,
                  isCustom: !!room.isCustom,
                  durationMinutes: room.durationMinutes,
                  expiresAt: room.expiresAt,
                  isPermanent: !!room.isPermanent,
                  maxParticipants: room.maxParticipants || 10,
                  hasMultiChat: !!room.hasMultiChat,
                  roomType: room.roomType,
                  creatorPasscode: isMaster ? room.creatorPasscode : undefined,
                  channelPasscodes: isMaster ? room.channelPasscodes : undefined,
                  assignedChannelId,
                  allowedChannels: meta.allowedChannels,
                  isMaster,
                },
                messages: visibleMessages,
                onlineUsers,
              })
            );

            // Anúncio de entrada para os outros participantes:
            const notifyChannel = assignedChannelId || 'chat_1';

            if (!isReturningParticipant) {
              // Primeira entrada: anuncia normalmente para a sala
              const sysMsg = {
                id: 'sys_' + Math.random().toString(36).substring(2, 9),
                roomId,
                channelId: notifyChannel,
                sender: {
                  id: 'system',
                  name: 'Sistema AnonQR',
                  avatarColor: '#06b6d4',
                  avatarIcon: 'Shield',
                },
                content: `${user.name} conectou-se (${onlineUsers.length}/${maxCapacity} online).`,
                timestamp: Date.now(),
                type: 'system' as const,
              };

              room.messages.push(sysMsg);
              if (room.messages.length > 200) room.messages.shift();

              broadcastToRoom(
                roomId,
                {
                  type: 'user_joined',
                  user,
                  systemMessage: sysMsg,
                  onlineUsers: getOnlineUsersInRoom(roomId),
                },
                ws,
                room.hasMultiChat ? notifyChannel : undefined
              );
            } else {
              // Retorno/reconexão: NÃO gera nova mensagem de sistema "Fulano conectou-se"
              // Apenas atualiza a lista de onlineUsers para todos os clientes conectados
              broadcastToRoom(
                roomId,
                {
                  type: 'user_joined',
                  user,
                  isReconnect: true,
                  onlineUsers: getOnlineUsersInRoom(roomId),
                },
                ws,
                room.hasMultiChat ? notifyChannel : undefined
              );
            }
            break;
          }

          case 'message': {
            if (!meta.roomId || !meta.user) return;
            const room = rooms.get(meta.roomId);
            if (!room) return;

            if (!room.isPermanent && (Date.now() > room.expiresAt || room.isExpired)) {
              ws.send(JSON.stringify({ type: 'error', message: 'Sala expirada. Novas mensagens estão bloqueadas.' }));
              return;
            }

            const content = (msg.content || '').trim();
            const rawAttachment = msg.attachment;
            const isAudio = msg.messageType === 'audio' || msg.type === 'audio' || (typeof msg.audioUrl === 'string' && msg.audioUrl.startsWith('data:audio/'));

            // Validação de áudio
            if (isAudio) {
              const audioUrl = String(msg.audioUrl || '').trim();
              if (!audioUrl || !audioUrl.startsWith('data:audio/')) {
                ws.send(JSON.stringify({ type: 'error', message: 'Áudio inválido ou corrompido.' }));
                return;
              }
              // Limite de segurança: ~700.000 caracteres base64 (~500 KB decodificado)
              if (audioUrl.length > 700000) {
                ws.send(JSON.stringify({ type: 'error', message: 'Áudio excede o limite máximo de 500 KB.' }));
                return;
              }
              const duration = Number(msg.audioDuration || 0);
              // Limite de segurança de duração: máximo 65 segundos (tolerância sobre 60s)
              if (duration > 65) {
                ws.send(JSON.stringify({ type: 'error', message: 'Áudio excede a duração máxima permitida de 60 segundos.' }));
                return;
              }
            }

            // If room is an Open Room (group aberto), file attachments (photos/videos) are strictly forbidden!
            if (room.isOpenRoom && rawAttachment) {
              ws.send(JSON.stringify({ type: 'error', message: 'Envio de fotos e vídeos não é permitido no grupo aberto.' }));
              return;
            }

            if (!content && !rawAttachment && !isAudio) return;

            const attachment = (!room.isOpenRoom && rawAttachment && !isAudio) ? {
              type: rawAttachment.type === 'video' ? 'video' : 'image',
              url: String(rawAttachment.url),
              name: String(rawAttachment.name || 'arquivo'),
              size: Number(rawAttachment.size || 0),
            } : undefined;

            const chatMsg: ChatMessage = {
              id: 'msg_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
              roomId: meta.roomId,
              channelId: 'chat_1',
              sender: meta.user,
              content: isAudio ? (content || 'Mensagem de áudio') : content.substring(0, 1000),
              timestamp: Date.now(),
              type: isAudio ? 'audio' : (attachment ? (attachment.type === 'video' ? 'video' : 'image') : 'text'),
              attachment: attachment as any,
              audioUrl: isAudio ? String(msg.audioUrl) : undefined,
              audioDuration: isAudio ? Math.min(60, Math.max(0, Number(msg.audioDuration || 0))) : undefined,
              reactions: {},
            };

            room.messages.push(chatMsg);
            if (room.messages.length > 200) room.messages.shift();

            broadcastToRoom(
              meta.roomId,
              {
                type: 'new_message',
                message: chatMsg,
              }
            );
            break;
          }

          case 'reaction': {
            if (!meta.roomId) return;
            const room = rooms.get(meta.roomId);
            if (!room) return;
            const { messageId, emoji } = msg;
            const target = room.messages.find((m) => m.id === messageId);
            if (target) {
              if (meta.assignedChannelId && target.channelId && target.channelId !== meta.assignedChannelId) {
                return;
              }
              if (!target.reactions) target.reactions = {};
              target.reactions[emoji] = (target.reactions[emoji] || 0) + 1;
              broadcastToRoom(
                meta.roomId,
                {
                  type: 'reaction_update',
                  messageId,
                  reactions: target.reactions,
                },
                undefined,
                room.hasMultiChat ? target.channelId : undefined
              );
            }
            break;
          }

          case 'typing': {
            if (!meta.roomId || !meta.user) return;
            const r = rooms.get(meta.roomId);
            const targetChannel = meta.assignedChannelId || msg.channelId || 'chat_1';
            broadcastToRoom(
              meta.roomId,
              {
                type: 'typing_update',
                userId: meta.user.id,
                userName: meta.user.name,
                isTyping: !!msg.isTyping,
                channelId: targetChannel,
              },
              ws,
              r?.hasMultiChat ? targetChannel : undefined
            );
            break;
          }

          case 'ping': {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
            break;
          }

          case 'leave': {
            if (meta.roomId && meta.user) {
              const prevRoomId = meta.roomId;
              const prevUser = meta.user;
              meta.roomId = undefined;

              const remaining = getOnlineUsersInRoom(prevRoomId).filter((u) => u.id !== prevUser.id);
              const sysLeave = {
                id: 'sys_' + Math.random().toString(36).substring(2, 9),
                roomId: prevRoomId,
                sender: {
                  id: 'system',
                  name: 'Sistema AnonQR',
                  avatarColor: '#ef4444',
                  avatarIcon: 'Shield',
                },
                content: `${prevUser.name} saiu da sala (${remaining.length}/10 participantes).`,
                timestamp: Date.now(),
                type: 'system' as const,
              };

              const room = rooms.get(prevRoomId);
              if (room) {
                room.messages.push(sysLeave);
                if (room.messages.length > 200) room.messages.shift();
              }

              broadcastToRoom(prevRoomId, {
                type: 'user_left',
                userId: prevUser.id,
                systemMessage: sysLeave,
                onlineUsers: remaining,
              });
            }
            break;
          }

          // =======================================================
          // HANDLERS PARA MENSAGENS PRIVADAS 1x1 (EXCLUSIVOS)
          // =======================================================
          case 'private_join': {
            const { conversationId, user } = msg;
            if (!conversationId || typeof conversationId !== 'string' || !user || !user.id) {
              ws.send(JSON.stringify({ type: 'private_error', message: 'Dados de conexão privada inválidos.' }));
              return;
            }

            // Validação estrita de autorização: o usuário DEVE ser um dos dois participantes da conversa
            const cleanConvId = conversationId.trim();
            const idWithoutPrefix = cleanConvId.replace(/^dm_/, '');
            const participants = idWithoutPrefix.split('__');

            if (participants.length !== 2 || (!participants.includes(user.id))) {
              ws.send(JSON.stringify({ type: 'private_error', message: 'Acesso negado: você não pertence a esta conversa privada.' }));
              return;
            }

            // Normalização determinística do ID da conversa
            const canonicalConvId = `dm_${[participants[0], participants[1]].sort().join('__')}`;
            if (cleanConvId !== canonicalConvId) {
              ws.send(JSON.stringify({ type: 'private_error', message: 'Identificador de conversa inválido.' }));
              return;
            }

            // Obter ou instanciar a conversa em memória
            let conv = privateConversations.get(canonicalConvId);
            if (!conv) {
              conv = {
                id: canonicalConvId,
                participants: [participants[0], participants[1]].sort() as [string, string],
                messages: [],
                updatedAt: Date.now(),
                createdAt: Date.now(),
                participantProfiles: {},
                unreadCounts: {},
              };
              privateConversations.set(canonicalConvId, conv);
            }

            // Armazenar perfis dos participantes para a lista "Minhas conversas"
            if (!conv.participantProfiles) conv.participantProfiles = {};
            conv.participantProfiles[user.id] = {
              id: user.id,
              name: user.name || 'Usuário Anônimo',
              nick: user.nick || 'Anônimo',
              avatar_url: user.avatarUrl || null,
              avatarColor: user.avatarColor || '#06b6d4',
              avatarIcon: user.avatarIcon || 'User',
            };

            const peerUser = msg.peerUser;
            const peerId = participants.find((p) => p !== user.id) || '';
            if (peerUser && peerUser.id && peerUser.id === peerId) {
              conv.participantProfiles[peerId] = {
                id: peerId,
                name: peerUser.name || peerUser.nick || 'Anônimo',
                nick: peerUser.nick || 'Anônimo',
                avatar_url: peerUser.avatarUrl || peerUser.avatar_url || null,
              };
            }

            // Ao entrar na conversa, mensagens não lidas deste participante são zeradas
            if (!conv.unreadCounts) conv.unreadCounts = {};
            conv.unreadCounts[user.id] = 0;

            // Registrar conexão do participante na conversa privada
            privateConversationSockets.set(ws, {
              ws,
              conversationId: canonicalConvId,
              user: {
                id: user.id,
                name: user.name || 'Usuário Anônimo',
                nick: user.nick,
                avatarUrl: user.avatarUrl,
                avatarColor: user.avatarColor || '#06b6d4',
                avatarIcon: user.avatarIcon || 'User',
              },
            });

            // Registrar socket ativo para notificações gerais de conversas do usuário
            activeUserSockets.set(ws, {
              ws,
              user: {
                id: user.id,
                name: user.name,
                nick: user.nick,
                avatarUrl: user.avatarUrl,
                avatarColor: user.avatarColor,
                avatarIcon: user.avatarIcon,
              },
            });

            // Enviar estado inicial da conversa (últimas 100 mensagens)
            const peerOnline = isPeerOnlineInPrivateConversation(canonicalConvId, user.id);

            ws.send(
              JSON.stringify({
                type: 'private_state',
                conversationId: canonicalConvId,
                messages: conv.messages.slice(-100),
                peerId,
                peerOnline,
              })
            );

            // Notificar o outro participante de que este usuário está online
            broadcastToPrivateConversation(
              canonicalConvId,
              {
                type: 'private_peer_status',
                conversationId: canonicalConvId,
                peerId: user.id,
                isOnline: true,
              },
              ws
            );

            // Atualizar lista de conversas para os participantes
            notifyUserConversationsList(user.id);
            if (peerId) {
              notifyUserConversationsList(peerId);
            }
            break;
          }

          case 'private_message': {
            const pMeta = privateConversationSockets.get(ws);
            if (!pMeta) {
              ws.send(JSON.stringify({ type: 'private_error', message: 'Você não está conectado a nenhuma conversa privada.' }));
              return;
            }

            const { conversationId, content, messageType, audioUrl, audioDuration, imageUrl, imageName } = msg;
            if (pMeta.conversationId !== conversationId) {
              ws.send(JSON.stringify({ type: 'private_error', message: 'Conversa divergente da conexão ativa.' }));
              return;
            }

            const conv = privateConversations.get(conversationId);
            if (!conv || !conv.participants.includes(pMeta.user.id)) {
              ws.send(JSON.stringify({ type: 'private_error', message: 'Acesso negado à conversa.' }));
              return;
            }

            const cleanContent = (content || '').trim();
            const isAudio = messageType === 'audio' || (typeof audioUrl === 'string' && audioUrl.startsWith('data:audio/'));
            const isImage = messageType === 'image' || (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/'));

            if (!cleanContent && !isAudio && !isImage) return;

            // Validação de áudio
            if (isAudio) {
              const safeAudioUrl = String(audioUrl || '').trim();
              if (!safeAudioUrl || !safeAudioUrl.startsWith('data:audio/')) {
                ws.send(JSON.stringify({ type: 'private_error', message: 'Áudio inválido ou corrompido.' }));
                return;
              }
              if (safeAudioUrl.length > 700000) {
                ws.send(JSON.stringify({ type: 'private_error', message: 'Áudio excede o limite máximo permitido de 500 KB.' }));
                return;
              }
              const dur = Number(audioDuration || 0);
              if (dur > 65) {
                ws.send(JSON.stringify({ type: 'private_error', message: 'Áudio excede a duração máxima permitida de 60 segundos.' }));
                return;
              }
            }

            // Validação de imagem (fotos temporárias em memória RAM)
            if (isImage) {
              const safeImageUrl = String(imageUrl || '').trim();
              if (!safeImageUrl || !safeImageUrl.startsWith('data:image/')) {
                ws.send(JSON.stringify({ type: 'private_error', message: 'Foto inválida ou formato não suportado.' }));
                return;
              }
              // Limite de 4.2 MB em base64 (~3MB arquivo original)
              if (safeImageUrl.length > 4200000) {
                ws.send(JSON.stringify({ type: 'private_error', message: 'A foto excede o limite máximo de 3MB.' }));
                return;
              }
            }

            const msgType: 'text' | 'audio' | 'image' = isAudio ? 'audio' : isImage ? 'image' : 'text';

            const newMsg: PrivateChatMessageServer = {
              id: (msg.id && typeof msg.id === 'string') ? msg.id : ('pmsg_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)),
              conversationId,
              senderId: pMeta.user.id,
              senderName: pMeta.user.name,
              senderNick: pMeta.user.nick,
              senderAvatarUrl: pMeta.user.avatarUrl,
              senderAvatarColor: pMeta.user.avatarColor,
              senderAvatarIcon: pMeta.user.avatarIcon,
              content: isAudio ? (cleanContent || 'Mensagem de áudio') : isImage ? (cleanContent || 'Foto') : cleanContent.substring(0, 1000),
              timestamp: Date.now(),
              type: msgType,
              audioUrl: isAudio ? String(audioUrl) : undefined,
              audioDuration: isAudio ? Math.min(60, Math.max(0, Number(audioDuration || 0))) : undefined,
              imageUrl: isImage ? String(imageUrl) : undefined,
              imageName: isImage ? String(imageName || 'foto.jpg').substring(0, 100) : undefined,
            };

            // Deduplicação em memória
            const alreadyExists = conv.messages.some((m) => m.id === newMsg.id);
            if (!alreadyExists) {
              conv.messages.push(newMsg);
              if (conv.messages.length > 100) {
                conv.messages.shift();
              }
              conv.updatedAt = Date.now();
            }

            // Atualizar contadores de mensagens não lidas
            const otherParticipantId = conv.participants.find((p) => p !== pMeta.user.id) || '';
            const isOtherInChat = Array.from(privateConversationSockets.values()).some(
              (s) => s.conversationId === conversationId && s.user.id === otherParticipantId && s.ws.readyState === WebSocket.OPEN
            );

            if (!conv.unreadCounts) conv.unreadCounts = {};
            if (!isOtherInChat && otherParticipantId) {
              conv.unreadCounts[otherParticipantId] = (conv.unreadCounts[otherParticipantId] || 0) + 1;
            } else if (otherParticipantId) {
              conv.unreadCounts[otherParticipantId] = 0;
            }
            conv.unreadCounts[pMeta.user.id] = 0;

            // Entrega segura e em tempo real da mensagem aos participantes autorizados
            const payloadNewMsg = JSON.stringify({
              type: 'private_new_message',
              conversationId,
              message: newMsg,
            });

            const sentSockets = new Set<WebSocket>();

            // 1. Entregar para todos os sockets registrados nesta conversa privada (quem está dentro do PrivateChatView)
            for (const [sWs, meta] of privateConversationSockets.entries()) {
              if (meta.conversationId === conversationId && sWs.readyState === WebSocket.OPEN) {
                sWs.send(payloadNewMsg);
                sentSockets.add(sWs);
              }
            }

            // 2. Entregar para o destinatário conectado ao sistema via activeUserSockets caso ainda não tenha recebido no passo 1 (ex: está no Lobby ou fora do chat)
            if (otherParticipantId) {
              for (const [uWs, meta] of activeUserSockets.entries()) {
                if (meta.user.id === otherParticipantId && uWs.readyState === WebSocket.OPEN && !sentSockets.has(uWs)) {
                  uWs.send(payloadNewMsg);
                  sentSockets.add(uWs);
                }
              }
            }

            // 3. Atualização em tempo real de "Minhas conversas" para ambos os participantes
            notifyUserConversationsList(pMeta.user.id);
            if (otherParticipantId) {
              notifyUserConversationsList(otherParticipantId);
            }
            break;
          }

          case 'private_list_conversations': {
            const { user } = msg;
            if (!user || !user.id) {
              ws.send(JSON.stringify({ type: 'private_error', message: 'Identidade de usuário necessária para listar conversas.' }));
              return;
            }

            // Registra socket para o usuário receber atualizações em tempo real
            activeUserSockets.set(ws, {
              ws,
              user: {
                id: user.id,
                name: user.name,
                nick: user.nick,
                avatarUrl: user.avatarUrl,
                avatarColor: user.avatarColor,
                avatarIcon: user.avatarIcon,
              },
            });

            // Retorna as conversas exclusivamente deste usuário autenticado
            const userConversations = getUserPrivateConversations(user.id);
            ws.send(
              JSON.stringify({
                type: 'private_conversations_list',
                conversations: userConversations,
              })
            );
            break;
          }

          case 'private_mark_read': {
            const { conversationId, user } = msg;
            if (!conversationId || !user || !user.id) return;

            const conv = privateConversations.get(conversationId);
            if (conv && conv.participants.includes(user.id)) {
              if (!conv.unreadCounts) conv.unreadCounts = {};
              conv.unreadCounts[user.id] = 0;
              notifyUserConversationsList(user.id);
            }
            break;
          }

          case 'private_typing': {
            const pMeta = privateConversationSockets.get(ws);
            if (!pMeta || pMeta.conversationId !== msg.conversationId) return;

            broadcastToPrivateConversation(
              msg.conversationId,
              {
                type: 'private_typing',
                conversationId: msg.conversationId,
                userId: pMeta.user.id,
                isTyping: !!msg.isTyping,
              },
              ws
            );
            break;
          }

          case 'private_leave': {
            const pMeta = privateConversationSockets.get(ws);
            if (pMeta) {
              const convId = pMeta.conversationId;
              const userId = pMeta.user.id;
              privateConversationSockets.delete(ws);

              broadcastToPrivateConversation(convId, {
                type: 'private_peer_status',
                conversationId: convId,
                peerId: userId,
                isOnline: isPeerOnlineInPrivateConversation(convId, userId),
              });
            }
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    });

    ws.on('close', () => {
      // Limpeza de registro ativo do usuário
      activeUserSockets.delete(ws);

      // Limpeza de conexão privada se aplicável
      const pMeta = privateConversationSockets.get(ws);
      if (pMeta) {
        const convId = pMeta.conversationId;
        const userId = pMeta.user.id;
        privateConversationSockets.delete(ws);

        broadcastToPrivateConversation(convId, {
          type: 'private_peer_status',
          conversationId: convId,
          peerId: userId,
          isOnline: isPeerOnlineInPrivateConversation(convId, userId),
        });
      }

      const meta = clientConnections.get(ws);
      if (meta && meta.roomId && meta.user) {
        const prevRoomId = meta.roomId;
        const prevUser = meta.user;

        const remaining = getOnlineUsersInRoom(prevRoomId).filter((u) => u.id !== prevUser.id);
        const sysLeave = {
          id: 'sys_' + Math.random().toString(36).substring(2, 9),
          roomId: prevRoomId,
          sender: {
            id: 'system',
            name: 'Sistema AnonQR',
            avatarColor: '#ef4444',
            avatarIcon: 'Shield',
          },
          content: `${prevUser.name} desconectou (${remaining.length}/10 participantes).`,
          timestamp: Date.now(),
          type: 'system' as const,
        };

        const room = rooms.get(prevRoomId);
        if (room) {
          room.messages.push(sysLeave);
          if (room.messages.length > 200) room.messages.shift();
        }

        clientConnections.delete(ws);

        broadcastToRoom(prevRoomId, {
          type: 'user_left',
          userId: prevUser.id,
          systemMessage: sysLeave,
          onlineUsers: remaining,
        });
      } else {
        clientConnections.delete(ws);
      }
    });
  });

  // --- PREVENT API ROUTES FROM FALLING THROUGH TO VITE SPA HTML FALLBACK ---
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint da API não encontrado.' });
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AnonQR Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

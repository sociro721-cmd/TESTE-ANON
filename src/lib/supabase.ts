/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Clean and normalize Supabase project URL so SDK routes both Auth and PostgREST correctly
const env = (import.meta as any).env || {};
const rawUrl =
  env.VITE_SUPABASE_URL ||
  'https://srclzysflycxyedgmwaz.supabase.co/rest/v1/';

export const SUPABASE_URL = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

export const SUPABASE_PUBLISHABLE_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_3Mbqn0oAgUajihKqht4YpA_WwKeqBCX';

// Supabase client instance using ONLY the public/anon key (never service_role)
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

import { UserPresentation } from '../constants/presentation';

/**
 * Profile schema from public.profiles table
 */
export interface Profile {
  id: string;
  nick?: string | null;
  name?: string | null;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  plan?: string | null;
  premium?: boolean | null;
  credits?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  profileLookingFor?: string[] | null;
  profileInterests?: string[] | null;
  profileAvailability?: string | null;
  profileDesires?: string[] | null;
}

/**
 * Resultado público da busca por Nick
 */
export interface UserSearchResult {
  id: string;
  nick: string;
  name: string;
  avatar_url?: string | null;
  profileLookingFor?: string[] | null;
  profileInterests?: string[] | null;
  profileAvailability?: string | null;
  profileDesires?: string[] | null;
}

/**
 * Allowed fields that frontend is permitted to update.
 * Strictly forbids modifying 'premium', 'plan', or 'credits' directly from the client.
 */
export type AllowedProfileUpdate = {
  nick?: string | null;
  name?: string | null;
  full_name?: string | null;
  username?: string | null;
};

/**
 * Safely fetches the profile for a user ID from public.profiles
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] Could not fetch profile from public.profiles:', error.message);
      return null;
    }

    return data as Profile | null;
  } catch (err) {
    console.error('[Supabase] Error reading public.profiles:', err);
    return null;
  }
}

/**
 * Operação segura para o próprio usuário definir ou alterar seu Nick.
 * - Usa a sessão ativa (auth.uid());
 * - Impede alteração de nick de outro usuário;
 * - Valida formato (3 a 20 caracteres, a-z, 0-9, _);
 * - Valida unicidade case-insensitive no banco;
 * - Retorna mensagens claras para a interface.
 */
export async function definirNickUsuario(
  novoNick: string,
  token?: string
): Promise<{ success: boolean; nick?: string; message?: string; error?: string }> {
  const cleanNick = novoNick.trim().replace(/^@+/, '');

  if (cleanNick.length < 3 || cleanNick.length > 20) {
    return {
      success: false,
      error: 'Nick deve possuir entre 3 e 20 caracteres.',
    };
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanNick)) {
    return {
      success: false,
      error: 'Nick inválido. Caracteres permitidos: letras, números e _ (sem espaços).',
    };
  }

  try {
    let sessionToken = token;
    if (!sessionToken) {
      const { data: sessionData } = await supabase.auth.getSession();
      sessionToken = sessionData.session?.access_token;
    }

    if (!sessionToken) {
      return {
        success: false,
        error: 'Você precisa estar autenticado para definir um Nick.',
      };
    }

    const response = await fetch('/api/user/nick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ nick: cleanNick }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Erro ao salvar Nick.',
      };
    }

    return {
      success: true,
      nick: result.nick || cleanNick,
      message: result.message || 'Nick salvo com sucesso!',
    };
  } catch (err: any) {
    console.error('[definirNickUsuario] Erro na requisição:', err);
    return {
      success: false,
      error: 'Falha na conexão ao salvar Nick. Tente novamente.',
    };
  }
}

/**
 * Pesquisa pública segura de usuários pelo Nick.
 * - Não expõe e-mails, senhas, tokens ou dados financeiros;
 * - Busca case-insensitive;
 * - Retorna Nick, nome público e avatar_url.
 */
export async function buscarUsuariosPorNick(
  termo: string
): Promise<UserSearchResult[]> {
  const cleanTerm = termo.trim().replace(/^@+/, '');
  if (!cleanTerm) return [];

  try {
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(cleanTerm)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.users) ? data.users : [];
  } catch (err) {
    console.warn('[buscarUsuariosPorNick] Erro na busca:', err);
    return [];
  }
}

/**
 * Upload seguro de foto de perfil via backend autenticado.
 * - Valida tipo (JPG, PNG, WebP) e tamanho máximo (2 MB);
 * - Envia token da sessão no header Authorization;
 * - Salva no bucket público "avatars" e atualiza public.profiles.avatar_url.
 */
export async function uploadAvatar(
  file: File
): Promise<{ success: boolean; avatar_url?: string; error?: string }> {
  if (!file) {
    return { success: false, error: 'Nenhum arquivo de imagem selecionado.' };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: 'Formato inválido. Aceita somente fotos nos formatos JPG, PNG ou WebP.',
    };
  }

  const MAX_SIZE = 2 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return {
      success: false,
      error: 'A imagem excede o tamanho máximo permitido de 2 MB.',
    };
  }

  try {
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    if (!token) {
      return {
        success: false,
        error: 'Você precisa estar autenticado para enviar uma foto de perfil.',
      };
    }

    // Leitura do arquivo como Base64 Data URL
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao processar o arquivo de imagem.'));
      reader.readAsDataURL(file);
    });

    const res = await fetch('/api/user/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        image: base64Data,
        mimeType: file.type,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success && data?.avatar_url) {
      return { success: true, avatar_url: data.avatar_url };
    }

    return {
      success: false,
      error: data?.error || `Erro ao salvar foto de perfil (${res.status}).`,
    };
  } catch (err: any) {
    console.error('[uploadAvatar] Erro inesperado:', err);
    return {
      success: false,
      error: err?.message || 'Falha de comunicação com o servidor ao enviar a foto.',
    };
  }
}

/**
 * Remoção segura de foto de perfil via backend autenticado.
 * - Envia token da sessão no header Authorization;
 * - Remove arquivos do bucket "avatars" e define public.profiles.avatar_url como NULL.
 */
export async function removerAvatar(): Promise<{ success: boolean; error?: string }> {
  try {
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    if (!token) {
      return {
        success: false,
        error: 'Você precisa estar autenticado para remover sua foto de perfil.',
      };
    }

    const res = await fetch('/api/user/avatar', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      return { success: true };
    }

    return {
      success: false,
      error: data?.error || `Erro ao remover foto de perfil (${res.status}).`,
    };
  } catch (err: any) {
    console.error('[removerAvatar] Erro inesperado:', err);
    return {
      success: false,
      error: err?.message || 'Falha de comunicação com o servidor ao remover a foto.',
    };
  }
}

/**
 * Salva a seção "Sobre mim / O que procuro" (4 categorias) no perfil do usuário autenticado.
 */
export async function salvarApresentacaoUsuario(
  presentation: UserPresentation,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let sessionToken = token;
    if (!sessionToken) {
      const session = (await supabase.auth.getSession()).data.session;
      sessionToken = session?.access_token;
    }

    if (!sessionToken) {
      return {
        success: false,
        error: 'Você precisa estar autenticado para salvar sua apresentação de perfil.',
      };
    }

    const res = await fetch('/api/user/presentation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(presentation),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      // Sincroniza também localmente no Supabase Auth client para reatividade imediata
      try {
        await supabase.auth.updateUser({
          data: {
            profileLookingFor: presentation.profileLookingFor,
            profileInterests: presentation.profileInterests,
            profileAvailability: presentation.profileAvailability,
            profileDesires: presentation.profileDesires,
          },
        });
      } catch {}

      return { success: true };
    }

    return {
      success: false,
      error: data?.error || 'Erro ao salvar informações do perfil.',
    };
  } catch (err: any) {
    console.error('[salvarApresentacaoUsuario] Erro inesperado:', err);
    return {
      success: false,
      error: err?.message || 'Falha na conexão ao salvar apresentação.',
    };
  }
}

/**
 * Obtém a apresentação de perfil de um usuário pelo seu ID.
 */
export async function obterApresentacaoUsuario(
  userId: string
): Promise<UserPresentation | null> {
  if (!userId) return null;
  try {
    const res = await fetch(`/api/user/presentation/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data?.presentation) {
      return data.presentation as UserPresentation;
    }
    return null;
  } catch (err) {
    console.warn('[obterApresentacaoUsuario] Erro ao buscar apresentação:', err);
    return null;
  }
}

/**
 * Operação segura para o próprio usuário excluir definitivamente sua conta.
 * - Usa o Bearer token da sessão ativa do usuário.
 * - O backend extrai auth.uid() e executa a exclusão em auth.users através da Service Role.
 */
export async function excluirMinhaConta(
  token?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    let sessionToken = token;
    if (!sessionToken) {
      const { data: sessionData } = await supabase.auth.getSession();
      sessionToken = sessionData.session?.access_token;
    }

    if (!sessionToken) {
      return {
        success: false,
        error: 'Você precisa estar autenticado para excluir a conta.',
      };
    }

    const response = await fetch('/api/user/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Erro ao excluir a conta.',
      };
    }

    return {
      success: true,
      message: result.message || 'Conta excluída definitivamente com sucesso.',
    };
  } catch (err: any) {
    console.error('[excluirMinhaConta] Erro na requisição:', err);
    return {
      success: false,
      error: 'Falha de comunicação com o servidor ao excluir a conta. Tente novamente.',
    };
  }
}

import { SalaProduto, CompraOrdem, SalaStatus, ROOM_CATALOGUE } from '../types';

/**
 * Produtos Oficiais de Salas disponíveis para compra.
 * Vinculados exatamente ao catálogo oficial de produtos do sistema (ROOM_CATALOGUE).
 */
export const DEFAULT_SALAS_PRODUTOS: SalaProduto[] = ROOM_CATALOGUE.map((item) => ({
  id: item.id,
  nome: `${item.title} - ${item.durationLabel}`,
  descricao: item.description,
  valor: item.priceValue,
  status: 'available' as SalaStatus,
  categoria: item.isPermanent ? 'Permanente' : 'Temporária',
  icone: item.isPermanent ? 'ShieldCheck' : 'Clock',
  cor: item.roomType === 'group_perm'
    ? '#10b981'
    : item.roomType === 'duo_perm'
    ? '#ec4899'
    : item.roomType === 'duo_temp'
    ? '#06b6d4'
    : '#f59e0b',
  max_participantes: item.roomType.startsWith('duo') ? 2 : 10,
  duracao_label: item.durationLabel,
  duracao_minutos: item.durationMinutes,
  is_permanente: item.isPermanent,
  room_type: item.roomType,
  badge: item.badge,
}));

/**
 * Helper universal para interpretar textos e extrair duração em minutos e permanência.
 * Reconhece: "24 Horas", "4 Horas", "2 Horas", "1 Hora", "30 Minutos", "Permanente", etc.
 */
export function parseDurationFromText(text: string): { durationMinutes: number; isPermanent: boolean } | null {
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

/**
 * Helper universal para extrair informações de duração a partir de qualquer objeto de sala ou texto.
 */
export function parseDurationFromTextOrEntity(entityOrText: any): { durationMinutes: number; isPermanent: boolean } | null {
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

/**
 * Fetches all rooms for sale from Supabase public.salas
 */
export async function getSalas(): Promise<SalaProduto[]> {
  try {
    const { data, error } = await supabase
      .from('salas')
      .select('*')
      .order('valor', { ascending: true });

    if (error) {
      console.warn('[Supabase] Could not fetch public.salas (using default catalogue):', error.message);
      return DEFAULT_SALAS_PRODUTOS;
    }

    if (data && data.length > 0) {
      // Exclui produtos legados/descontinuados (como 'sala-dupla-ultra-02' ou qualquer menção a 5-em-1)
      const filtered = (data as SalaProduto[]).filter((s) => {
        const id = s.id?.toLowerCase() || '';
        const nome = s.nome?.toLowerCase() || '';
        const desc = s.descricao?.toLowerCase() || '';
        const cat = s.categoria?.toLowerCase() || '';
        return (
          id !== 'sala-dupla-ultra-02' &&
          !nome.includes('5-em-1') &&
          !nome.includes('5 em 1') &&
          !desc.includes('5-em-1') &&
          !desc.includes('5 em 1') &&
          !cat.includes('5-em-1') &&
          !cat.includes('5 em 1')
        );
      });

      // Enriquecimento com duracao_minutos, is_permanente e duracao_label extraídos dinamicamente dos dados da sala
      const enriched = filtered.map((s) => {
        const durInfo = parseDurationFromTextOrEntity(s);
        const isPerm = s.is_permanente ?? durInfo?.isPermanent ?? false;
        const durMins = isPerm ? 0 : (s.duracao_minutos ?? durInfo?.durationMinutes ?? 60);
        let label = s.duracao_label;
        if (!label) {
          if (isPerm) label = 'Permanente';
          else if (durMins >= 60) label = `${Math.floor(durMins / 60)} ${durMins === 60 ? 'Hora' : 'Horas'}`;
          else label = `${durMins} min`;
        }

        return {
          ...s,
          duracao_minutos: durMins,
          is_permanente: isPerm,
          duracao_label: label,
        };
      });

      // Deduplicate by ID to guarantee uniqueness
      const seenIds = new Set<string>();
      const deduplicated = enriched.filter((s) => {
        if (!s || !s.id || seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });

      return deduplicated.length > 0 ? deduplicated : DEFAULT_SALAS_PRODUTOS;
    }

    return DEFAULT_SALAS_PRODUTOS;
  } catch (err) {
    console.warn('[Supabase] Error connecting to public.salas, fallback to default:', err);
    return DEFAULT_SALAS_PRODUTOS;
  }
}

/**
 * Helper para extrair duracao e flag de permanente de um produto de sala.
 * Prioriza dados reais persistidos da sala ou da compra antes de recorrer a qualquer catálogo.
 */
export function extractProductDurationInfo(
  salaId: string,
  explicitMinutes?: number | null,
  explicitIsPerm?: boolean | null,
  salaEntity?: any
): { durationMinutes: number; isPermanent: boolean } {
  // 1. Dados explícitos passados diretamente
  if (explicitIsPerm === true) {
    return { durationMinutes: 0, isPermanent: true };
  }
  if (typeof explicitMinutes === 'number' && explicitMinutes > 0) {
    return { durationMinutes: explicitMinutes, isPermanent: false };
  }

  // 2. Entidade de sala vinda do banco de dados
  if (salaEntity) {
    const fromEntity = parseDurationFromTextOrEntity(salaEntity);
    if (fromEntity) return fromEntity;
  }

  // 3. Catálogo oficial do sistema (ROOM_CATALOGUE)
  const product = ROOM_CATALOGUE.find((p) => p.id === salaId);
  if (product) {
    return {
      durationMinutes: product.durationMinutes,
      isPermanent: product.isPermanent,
    };
  }

  // 4. Extração a partir de termos no próprio ID da sala (ex: 4h, 24h, 2h, perm)
  const fromText = parseDurationFromText(salaId);
  if (fromText) return fromText;

  // 5. Fallback somente se nenhuma informação for identificada
  return { durationMinutes: 60, isPermanent: false };
}

/**
 * Registers an official purchase order in Supabase table 'compras'.
 * Starts strictly with status 'pending' (the room is NOT sold upon creating order).
 */
export async function createOrdemCompra(params: {
  userId: string;
  salaId: string;
  valor: number;
  metodoPagamento?: 'mercadopago' | 'pix_manual';
  durationMinutes?: number;
  isPermanent?: boolean;
  salaEntity?: any;
}): Promise<{ data: CompraOrdem | null; error: string | null }> {
  try {
    const isPix = params.metodoPagamento === 'pix_manual';
    const info = extractProductDurationInfo(
      params.salaId,
      params.durationMinutes,
      params.isPermanent,
      params.salaEntity
    );
    const isPermanent = params.isPermanent ?? info.isPermanent;
    const durationMinutes = isPermanent ? 0 : (params.durationMinutes ?? info.durationMinutes);

    const payload: any = {
      user_id: params.userId,
      sala_id: params.salaId,
      valor: params.valor,
      status: 'pending',
      payment_id: isPix ? 'pix_manual' : null,
      metodo_pagamento: params.metodoPagamento || 'mercadopago',
      duration_minutes: durationMinutes,
      is_permanent: isPermanent,
    };

    let { data, error } = await supabase
      .from('compras')
      .insert(payload)
      .select()
      .single();

    // Se o banco remoto ainda não tiver colunas extras (duration_minutes, is_permanent, metodo_pagamento), remove gradualmente
    if (error && (error.code === 'PGRST204' || error.message?.includes('duration_minutes') || error.message?.includes('is_permanent') || error.message?.includes('metodo_pagamento'))) {
      delete payload.duration_minutes;
      delete payload.is_permanent;
      delete payload.metodo_pagamento;
      const retry = await supabase
        .from('compras')
        .insert(payload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('[Supabase] Error inserting in public.compras:', error.message);
      // Fallback local memory representation if table is not created yet
      const fallbackOrder: CompraOrdem = {
        id: 'ordem-' + Math.random().toString(36).substring(2, 9),
        user_id: params.userId,
        sala_id: params.salaId,
        valor: params.valor,
        status: 'pending',
        payment_id: isPix ? 'pix_manual' : null,
        metodo_pagamento: params.metodoPagamento || 'mercadopago',
        duration_minutes: durationMinutes,
        is_permanent: isPermanent,
        created_at: new Date().toISOString(),
      };
      return { data: fallbackOrder, error: null };
    }

    return {
      data: {
        ...(data as CompraOrdem),
        duration_minutes: durationMinutes,
        is_permanent: isPermanent,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Falha ao registrar ordem de compra' };
  }
}

/**
 * Fetches purchase orders belonging to the authenticated user.
 * Preserves each purchase as an independent cycle with its exact status and duration.
 */
export async function getMinhasCompras(userId: string): Promise<CompraOrdem[]> {
  try {
    const { data, error } = await supabase
      .from('compras')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Error reading compras:', error.message);
      return [];
    }

    const rawCompras = (data || []) as CompraOrdem[];

    // Busca ciclos ativos e persistidos no backend para refletir o status real de cada compra
    let backendCycles: Record<string, {
      compraId: string;
      salaId: string;
      activatedAt?: number;
      expiresAt?: number;
      durationMinutes: number;
      isPermanent: boolean;
      status: string;
    }> = {};

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      const cycleRes = await fetch(`/api/compras/cycles?userId=${encodeURIComponent(userId)}`, { headers });
      if (cycleRes.ok) {
        const json = await cycleRes.json();
        if (json?.cycles) {
          backendCycles = json.cycles;
        }
      }
    } catch (_) {}

    // Busca o catálogo de salas para vincular os dados reais da sala a cada compra
    let salasMap = new Map<string, SalaProduto>();
    try {
      const { data: salasList } = await supabase.from('salas').select('*');
      if (salasList && salasList.length > 0) {
        for (const s of salasList) {
          salasMap.set(s.id, s as SalaProduto);
        }
      }
    } catch (_) {}

    // Processa cada compra garantindo que cada compra seja um ciclo independente no historico
    const resultado: CompraOrdem[] = [];
    const pendingPorSala = new Set<string>();

    for (const compra of rawCompras) {
      const salaEntity = salasMap.get(compra.sala_id);
      const cycle = backendCycles[compra.id];

      // Sincroniza activated_at e expires_at (prioriza Supabase; se nulo, recupera do ciclo persistido do backend)
      let activatedAt = compra.activated_at || (cycle?.activatedAt ? new Date(cycle.activatedAt).toISOString() : null);
      let expiresAt = compra.expires_at || (cycle?.expiresAt && cycle.expiresAt > 0 ? new Date(cycle.expiresAt).toISOString() : null);

      const info = extractProductDurationInfo(
        compra.sala_id,
        compra.duration_minutes ?? cycle?.durationMinutes,
        compra.is_permanent ?? cycle?.isPermanent,
        salaEntity
      );
      const isPermanent = Boolean(compra.is_permanent ?? cycle?.isPermanent ?? info.isPermanent);
      const durationMinutes = isPermanent ? 0 : (compra.duration_minutes ?? cycle?.durationMinutes ?? info.durationMinutes);

      // Se for temporária e possui activated_at, mas expires_at estiver ausente, deriva estritamente de activated_at + durationMinutes
      // (NUNCA recalculando a partir de Date.now())
      if (!isPermanent && activatedAt && (!expiresAt || expiresAt === '0')) {
        const actMs = new Date(activatedAt).getTime();
        if (!isNaN(actMs) && actMs > 0 && durationMinutes > 0) {
          expiresAt = new Date(actMs + durationMinutes * 60 * 1000).toISOString();
        }
      }

      let status = compra.status;
      if (cycle?.status === 'expired') {
        status = 'expired';
      }

      // Se for temporária e tiver expires_at vencido no horário atual, marca como 'expired'
      if (!isPermanent && expiresAt) {
        const expMs = new Date(expiresAt).getTime();
        if (!isNaN(expMs) && expMs > 0 && expMs <= Date.now()) {
          status = 'expired';
        }
      }

      // Se for ordem pending e o usuario já gerou outro pending mais recente para a mesma sala, ignora o antigo
      if (status === 'pending') {
        if (pendingPorSala.has(compra.sala_id)) {
          continue;
        }
        pendingPorSala.add(compra.sala_id);
      }

      resultado.push({
        ...compra,
        is_permanent: isPermanent,
        duration_minutes: durationMinutes,
        activated_at: activatedAt,
        expires_at: expiresAt,
        status,
        sala: salaEntity ? {
          ...salaEntity,
          duracao_minutos: durationMinutes,
          is_permanente: isPermanent,
        } : undefined,
      });
    }

    return resultado;
  } catch (err) {
    console.error('[Supabase] Exception querying compras:', err);
    return [];
  }
}

/**
 * Ativa o ciclo de uma compra temporária no Supabase via RPC V3 SECURITY DEFINER (atômica e idempotente).
 */
export async function ativarCicloCompra(compraId: string, salaId: string) {
  try {
    const { data, error } = await supabase.rpc('ativar_ciclo_compra', {
      p_compra_id: compraId,
      p_sala_id: salaId,
    });
    if (error) {
      console.warn('[Supabase] Erro ao ativar ciclo de compra:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    console.warn('[Supabase] Exceção ao ativar ciclo de compra:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao ativar sala.' };
  }
}

/**
 * Expira o ciclo de uma compra temporária no Supabase via RPC V3 SECURITY DEFINER.
 */
export async function expirarCicloCompra(compraId: string) {
  try {
    const { data, error } = await supabase.rpc('expirar_ciclo_compra', {
      p_compra_id: compraId,
    });
    if (error) {
      console.warn('[Supabase] Erro ao expirar compra:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    console.warn('[Supabase] Exceção ao expirar compra:', err);
    return { success: false, error: err?.message || 'Erro ao expirar sala.' };
  }
}

/**
 * Invokes the 'hyper-action' Edge Function to create a Mercado Pago checkout preference for a given purchase order.
 */
export async function criarCheckoutMercadoPago(params: {
  compraId: string;
  salaId: string;
  valor: number;
}) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {
        data: null,
        error: 'Usuário não autenticado.',
      };
    }

    const { data, error } = await supabase.functions.invoke('hyper-action', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'create_order',
        compra_id: params.compraId,
        compraId: params.compraId,
        salaId: params.salaId,
        valor: params.valor,
      },
    });

    if (error) {
      console.error(
        '[Mercado Pago] Erro ao criar checkout:',
        error
      );

      // Attempt to inspect response body if error is FunctionsHttpError
      let detailedMsg = error.message || 'Não foi possível criar o checkout.';
      try {
        if ('context' in (error as any) && typeof (error as any).context?.json === 'function') {
          const body = await (error as any).context.json();
          if (body?.error) {
            detailedMsg = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
          } else if (body?.message) {
            detailedMsg = body.message;
          }
        }
      } catch {
        // ignore parse error and keep detailedMsg
      }

      return {
        data: null,
        error: detailedMsg,
      };
    }

    if (!data?.success || !data?.checkout_url) {
      return {
        data: null,
        error:
          data?.error ||
          'O Mercado Pago não retornou um link de pagamento.',
      };
    }

    return {
      data,
      error: null,
    };
  } catch (err: any) {
    console.error(
      '[Mercado Pago] Erro inesperado:',
      err
    );

    return {
      data: null,
      error:
        err?.message ||
        'Falha ao iniciar o pagamento.',
    };
  }
}

/**
 * ADMIN: Busca todas as compras da tabela compras do Supabase para o painel de administração.
 */
export async function getComprasAdmin(adminKey: string = '8090'): Promise<CompraOrdem[]> {
  try {
    const res = await fetch('/api/owner/supabase-compras', {
      headers: {
        'x-owner-key': adminKey,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data as CompraOrdem[];
      }
    }
  } catch (err) {
    console.warn('[Supabase Admin] Falha na API backend, tentando consulta direta:', err);
  }

  // Fallback: consulta direta via cliente Supabase
  try {
    const { data, error } = await supabase
      .from('compras')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase Admin] Erro na consulta direta:', error.message);
      return [];
    }

    return (data || []) as CompraOrdem[];
  } catch (err) {
    console.error('[Supabase Admin] Exceção ao buscar compras:', err);
    return [];
  }
}

/**
 * ADMIN: Aprova manualmente uma compra via PIX, alterando status para 'paid' no Supabase.
 */
export async function aprovarCompraPixAdmin(
  compraId: string,
  adminKey: string = '8090'
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`/api/owner/supabase-compras/${encodeURIComponent(compraId)}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-owner-key': adminKey,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'Compra PIX aprovada com sucesso! Status alterado para paid.',
      };
    }

    if (data.error) {
      // Se a rota falhar por permissão ou erro interno, tenta fallback direto
      console.warn('[Admin] Resposta da API retornou erro:', data.error);
    }
  } catch (err) {
    console.warn('[Admin] Erro na requisição para a API de aprovação, tentando fallback direto:', err);
  }

  // Fallback direto via Supabase client caso a API esteja indisponível
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('compras')
      .update({
        status: 'paid',
        updated_at: nowIso,
      })
      .eq('id', compraId)
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    // Se tiver sala vinculada, atualiza sala para sold
    const salaId = data?.[0]?.sala_id;
    const userId = data?.[0]?.user_id;
    if (salaId) {
      try {
        await supabase
          .from('salas')
          .update({
            status: 'sold',
            comprador_id: userId,
            updated_at: nowIso,
          })
          .eq('id', salaId);
      } catch (e) {
        console.warn('[Admin Fallback] Erro ao atualizar sala:', e);
      }
    }

    return {
      success: true,
      message: 'Compra aprovada com sucesso no Supabase! Status alterado para paid.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Falha ao aprovar compra no banco.',
    };
  }
}

/**
 * ADMIN: Cancela uma compra no Supabase.
 */
export async function cancelarCompraAdmin(
  compraId: string,
  adminKey: string = '8090'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/owner/supabase-compras/${encodeURIComponent(compraId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-owner-key': adminKey,
      },
    });

    if (res.ok) {
      return { success: true };
    }
  } catch (err) {
    console.warn('[Admin] Fallback para cancelamento direto:', err);
  }

  try {
    const { error } = await supabase
      .from('compras')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', compraId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * ADMIN: Exclui uma compra no Supabase via backend administrativo.
 */
export async function deletarCompraAdmin(
  compraId: string,
  adminKey: string = '8090'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/owner/supabase-compras/${encodeURIComponent(compraId)}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-owner-key': adminKey,
      },
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      return { success: true };
    }

    return {
      success: false,
      error: data?.error || `Erro ao excluir compra no servidor (HTTP ${res.status}).`,
    };
  } catch (err: any) {
    console.error('[deletarCompraAdmin] Erro na requisição:', err);
    return {
      success: false,
      error: err?.message || 'Falha de comunicação com o servidor ao excluir compra.',
    };
  }
}

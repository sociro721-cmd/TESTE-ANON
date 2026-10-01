import { AnonymousUser } from '../types';

const ADJECTIVES = [
  'Silencioso', 'Noturno', 'Cifrado', 'Oculto', 'Invisível',
  'Espectral', 'Sombrio', 'Anônimo', 'Astral', 'Misterioso',
  'Blindado', 'Fantasma', 'Discreto', 'Críptico', 'Efêmero'
];

const NOUNS = [
  'Viajante', 'Guardião', 'Espectro', 'Lince', 'Coruja',
  'Sombra', 'Sentinela', 'Nômade', 'Falcão', 'Observador',
  'Andarilho', 'Oráculo', 'Eco', 'Vórtice', 'Agente'
];

const COLORS = [
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#3b82f6', // blue-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
];

const ICONS = ['User', 'EyeOff', 'Shield', 'Ghost', 'Lock', 'Compass', 'Zap', 'Feather'];

const STORAGE_KEY = 'anonqr_user';
const LEGACY_STORAGE_KEY = 'anonqr_user_profile';

export function getOrCreateAnonymousUser(): AnonymousUser {
  try {
    // 1. Verificar se já existe perfil persistente no localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.id && parsed.name) {
        return parsed;
      }
    }

    // 2. Migração segura: verificar se existe perfil legado no sessionStorage
    const legacySaved = sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacySaved) {
      const parsedLegacy = JSON.parse(legacySaved);
      if (parsedLegacy.id && parsedLegacy.name) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedLegacy));
        return parsedLegacy;
      }
    }
  } catch {}

  return createFreshAnonymousUser();
}

export function createFreshAnonymousUser(): AnonymousUser {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const icon = ICONS[Math.floor(Math.random() * ICONS.length)];
  
  const user: AnonymousUser = {
    id: 'user_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    name: `${noun} ${adj} #${num}`,
    avatarColor: color,
    avatarIcon: icon,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {}

  return user;
}

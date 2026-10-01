import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import {
  supabase,
  Profile,
  getProfile,
  definirNickUsuario,
  excluirMinhaConta,
  uploadAvatar,
  removerAvatar,
  salvarApresentacaoUsuario,
} from '../lib/supabase';
import { UserPresentation, DEFAULT_USER_PRESENTATION } from '../constants/presentation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  displayName: string;
  userNick: string | null;
  avatarUrl: string | null;
  presentation: UserPresentation;
  planName: string;
  isPremium: boolean;
  credits: number;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: AuthError | null; needsEmailConfirmation?: boolean }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  refreshProfile: () => Promise<void>;
  updateNick: (nick: string) => Promise<{ success: boolean; nick?: string; message?: string; error?: string }>;
  uploadAvatar: (file: File) => Promise<{ success: boolean; avatar_url?: string; error?: string }>;
  removeAvatar: () => Promise<{ success: boolean; error?: string }>;
  updatePresentation: (presentation: UserPresentation) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; message?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to load profile for a specific user ID
  const fetchAndSetProfile = async (userId: string) => {
    try {
      const data = await getProfile(userId);
      setProfile(data);
    } catch (err) {
      console.error('[AuthContext] Error loading user profile:', err);
    }
  };

  // Initialize and observe auth state automatically
  useEffect(() => {
    let isMounted = true;

    // 1. Check existing session on mount
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchAndSetProfile(initialSession.user.id).finally(() => {
          if (isMounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // 2. Subscribe to auth changes (login, logout, token refresh, user updated)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchAndSetProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchAndSetProfile(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: name?.trim() ? { name: name.trim(), full_name: name.trim() } : undefined,
        emailRedirectTo: `${window.location.origin}/confirmar-email`,
      },
    });

    // If auto-confirmed or user immediately returned, fetch profile and ensure sync
    if (data?.user?.id) {
      if (data.session?.access_token) {
        fetch('/api/user/sync-profile', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        }).catch(() => {});
      }
      await fetchAndSetProfile(data.user.id);
    }

    const needsEmailConfirmation = !data.session && !!data.user;
    return { error, needsEmailConfirmation };
  };

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/confirmar-email`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    return { error };
  };

  const deleteAccount = async () => {
    setIsLoading(true);
    try {
      const res = await excluirMinhaConta(session?.access_token);
      if (res.success) {
        // Desconectar o usuário imediatamente e limpar sessão local
        await supabase.auth.signOut().catch(() => {});
        setUser(null);
        setSession(null);
        setProfile(null);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.clear();
          } catch {}
        }
      }
      return res;
    } catch (err: any) {
      console.error('[AuthContext] Erro ao excluir conta:', err);
      return {
        success: false,
        error: err.message || 'Erro inesperado ao excluir conta.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Resolved user Nick from profile or user_metadata
  const userNick = useMemo(() => {
    if (profile?.nick && profile.nick.trim()) {
      return profile.nick.trim().replace(/^@+/, '');
    }
    if (user?.user_metadata?.nick && typeof user.user_metadata.nick === 'string' && user.user_metadata.nick.trim()) {
      return user.user_metadata.nick.trim().replace(/^@+/, '');
    }
    if (user?.user_metadata?.username && typeof user.user_metadata.username === 'string' && user.user_metadata.username.trim()) {
      return user.user_metadata.username.trim().replace(/^@+/, '');
    }
    return null;
  }, [profile, user]);

  // Update or define user nick
  const updateNick = async (newNick: string) => {
    const res = await definirNickUsuario(newNick, session?.access_token);
    if (res.success && res.nick) {
      // Atualiza o estado local imediatamente
      setProfile((prev) => (prev ? { ...prev, nick: res.nick } : { id: user?.id || '', nick: res.nick }));
      if (user) {
        setUser({
          ...user,
          user_metadata: {
            ...user.user_metadata,
            nick: res.nick,
          },
        });
      }
      // Revalida perfil em segundo plano
      if (user?.id) {
        fetchAndSetProfile(user.id).catch(() => {});
      }
    }
    return res;
  };

  // Resolved user Avatar URL strictly from profile
  const avatarUrl = useMemo(() => {
    if (profile?.avatar_url && profile.avatar_url.trim()) {
      return profile.avatar_url.trim();
    }
    return null;
  }, [profile]);

  // Upload or update user avatar photo
  const handleUploadAvatar = async (file: File) => {
    const res = await uploadAvatar(file);
    if (res.success && res.avatar_url) {
      setProfile((prev) =>
        prev
          ? { ...prev, avatar_url: res.avatar_url }
          : { id: user?.id || '', avatar_url: res.avatar_url }
      );
      if (user?.id) {
        fetchAndSetProfile(user.id).catch(() => {});
      }
    }
    return res;
  };

  // Remove user avatar photo
  const handleRemoveAvatar = async () => {
    const res = await removerAvatar();
    if (res.success) {
      setProfile((prev) => (prev ? { ...prev, avatar_url: null } : null));
      if (user?.id) {
        fetchAndSetProfile(user.id).catch(() => {});
      }
    }
    return res;
  };

  // Resolved display name from profile or metadata or email
  const displayName = useMemo(() => {
    if (profile?.name) return profile.name;
    if (profile?.full_name) return profile.full_name;
    if (profile?.username) return profile.username;
    if (user?.user_metadata?.name) return user.user_metadata.name;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return 'Usuário';
  }, [profile, user]);

  // Resolved plan name from profile
  const planName = useMemo(() => {
    if (profile?.plan && profile.plan.trim()) {
      return profile.plan;
    }
    if (profile?.premium) {
      return 'Premium';
    }
    return 'Gratuito';
  }, [profile]);

  const isPremium = useMemo(() => {
    if (profile?.premium) return true;
    if (profile?.plan && profile.plan.toLowerCase() !== 'gratuito' && profile.plan.toLowerCase() !== 'free') {
      return true;
    }
    return false;
  }, [profile]);

  const credits = profile?.credits ?? 0;

  // Resolved user presentation ("Sobre mim / O que procuro")
  const presentation = useMemo<UserPresentation>(() => {
    const meta = user?.user_metadata || {};
    return {
      profileLookingFor: Array.isArray(profile?.profileLookingFor)
        ? profile.profileLookingFor
        : Array.isArray(meta.profileLookingFor)
        ? meta.profileLookingFor
        : [],
      profileInterests: Array.isArray(profile?.profileInterests)
        ? profile.profileInterests
        : Array.isArray(meta.profileInterests)
        ? meta.profileInterests
        : [],
      profileAvailability:
        typeof profile?.profileAvailability === 'string' && profile.profileAvailability.trim()
          ? profile.profileAvailability
          : typeof meta.profileAvailability === 'string' && meta.profileAvailability.trim()
          ? meta.profileAvailability
          : null,
      profileDesires: Array.isArray(profile?.profileDesires)
        ? profile.profileDesires
        : Array.isArray(meta.profileDesires)
        ? meta.profileDesires
        : [],
    };
  }, [profile, user]);

  const updatePresentation = async (newPres: UserPresentation) => {
    const res = await salvarApresentacaoUsuario(newPres, session?.access_token);
    if (res.success) {
      setProfile((prev) => (prev ? {
        ...prev,
        profileLookingFor: newPres.profileLookingFor,
        profileInterests: newPres.profileInterests,
        profileAvailability: newPres.profileAvailability,
        profileDesires: newPres.profileDesires,
      } : {
        id: user?.id || '',
        profileLookingFor: newPres.profileLookingFor,
        profileInterests: newPres.profileInterests,
        profileAvailability: newPres.profileAvailability,
        profileDesires: newPres.profileDesires,
      }));
      if (user) {
        setUser({
          ...user,
          user_metadata: {
            ...user.user_metadata,
            profileLookingFor: newPres.profileLookingFor,
            profileInterests: newPres.profileInterests,
            profileAvailability: newPres.profileAvailability,
            profileDesires: newPres.profileDesires,
          },
        });
      }
      if (user?.id) {
        fetchAndSetProfile(user.id).catch(() => {});
      }
    }
    return res;
  };

  const value = {
    user,
    session,
    profile,
    isLoading,
    displayName,
    userNick,
    avatarUrl,
    presentation,
    planName,
    isPremium,
    credits,
    signIn,
    signUp,
    resendConfirmationEmail,
    signOut,
    refreshProfile,
    updateNick,
    uploadAvatar: handleUploadAvatar,
    removeAvatar: handleRemoveAvatar,
    updatePresentation,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

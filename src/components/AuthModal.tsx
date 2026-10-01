import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
  LogOut,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trash2,
  AlertTriangle,
  Camera,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserPresentationEditor } from './UserPresentationEditor';
import { UserPresentation } from '../constants/presentation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
  onAccountDeleted?: (msg: string) => void;
}

export const AuthModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onAccountDeleted,
}) => {
  const {
    user,
    profile,
    displayName,
    userNick,
    avatarUrl,
    presentation,
    updatePresentation,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    updateNick,
    uploadAvatar,
    removeAvatar,
    deleteAccount,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  console.log('[AuthModal DIAGNOSTIC] isOpen:', isOpen, 'initialMode:', initialMode, 'currentMode:', mode);

  React.useEffect(() => {
    console.log('[AuthModal DIAGNOSTIC] useEffect initialMode/isOpen changed:', initialMode, isOpen);
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode, isOpen]);

  const handleSwitchMode = (newMode: 'login' | 'signup') => {
    console.log('[AuthModal DIAGNOSTIC] handleSwitchMode triggered to:', newMode);
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const [nickInput, setNickInput] = useState(userNick || '');
  const [nickError, setNickError] = useState<string | null>(null);
  const [nickSuccess, setNickSuccess] = useState<string | null>(null);
  const [isSavingNick, setIsSavingNick] = useState(false);

  // Estados para apresentação de perfil ("Sobre mim / O que procuro")
  const [presentationState, setPresentationState] = useState<UserPresentation>(presentation);
  const [isSavingPresentation, setIsSavingPresentation] = useState(false);
  const [presentationSuccess, setPresentationSuccess] = useState<string | null>(null);
  const [presentationError, setPresentationError] = useState<string | null>(null);

  React.useEffect(() => {
    if (presentation) {
      setPresentationState(presentation);
    }
  }, [presentation]);

  // Estados para foto de perfil
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Estados para exclusão definitiva de conta com confirmação em 2 etapas
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2 | 3>(0);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sincroniza o input com o nick atual do usuário quando disponível
  React.useEffect(() => {
    if (userNick) {
      setNickInput(userNick);
    }
  }, [userNick]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setNickError(null);
    setNickSuccess(null);
    setDeleteStep(0);
    setDeleteError(null);
    setAvatarError(null);
    setAvatarSuccess(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setAvatarError(null);
    setAvatarSuccess(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError('Formato inválido. Aceita somente fotos nos formatos JPG, PNG ou WebP.');
      return;
    }

    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setAvatarError('O tamanho da imagem excede o limite máximo permitido de 2 MB.');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const res = await uploadAvatar(file);
      if (res.success) {
        setAvatarSuccess('Foto de perfil atualizada com sucesso!');
        setTimeout(() => setAvatarSuccess(null), 4000);
      } else {
        setAvatarError(res.error || 'Erro ao enviar foto de perfil.');
      }
    } catch (err: any) {
      setAvatarError(err?.message || 'Falha ao atualizar foto de perfil.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Tem certeza que deseja remover sua foto de perfil?')) {
      return;
    }

    setAvatarError(null);
    setAvatarSuccess(null);
    setIsUploadingAvatar(true);
    try {
      const res = await removeAvatar();
      if (res.success) {
        setAvatarSuccess('Foto de perfil removida com sucesso!');
        setTimeout(() => setAvatarSuccess(null), 4000);
      } else {
        setAvatarError(res.error || 'Erro ao remover foto de perfil.');
      }
    } catch (err: any) {
      setAvatarError(err?.message || 'Falha ao remover foto de perfil.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await deleteAccount();
      if (res.success) {
        setDeleteStep(3);
        if (onAccountDeleted) {
          onAccountDeleted('Sua conta foi excluída definitivamente com sucesso.');
        }
      } else {
        setDeleteError(res.error || 'Erro ao excluir conta.');
        setDeleteStep(2);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Erro inesperado ao excluir conta.');
      setDeleteStep(2);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleSaveNick = async (e: React.FormEvent) => {
    e.preventDefault();
    setNickError(null);
    setNickSuccess(null);

    const clean = nickInput.trim().replace(/^@+/, '');
    if (!clean) {
      setNickError('Por favor, digite um Nick.');
      return;
    }

    if (clean.length < 3 || clean.length > 20) {
      setNickError('Nick deve possuir entre 3 e 20 caracteres.');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
      setNickError('Nick inválido. Permite apenas letras, números e underscore (_).');
      return;
    }

    setIsSavingNick(true);
    try {
      const res = await updateNick(clean);
      if (res.success) {
        setNickSuccess(res.message || 'Nick salvo com sucesso!');
        setNickInput(res.nick || clean);
      } else {
        setNickError(res.error || 'Erro ao salvar Nick.');
      }
    } catch (err: any) {
      setNickError(err.message || 'Erro inesperado ao salvar Nick.');
    } finally {
      setIsSavingNick(false);
    }
  };

  const handleSavePresentation = async () => {
    setIsSavingPresentation(true);
    setPresentationError(null);
    setPresentationSuccess(null);
    try {
      const res = await updatePresentation(presentationState);
      if (res.success) {
        setPresentationSuccess('Apresentação de perfil salva com sucesso!');
        setTimeout(() => setPresentationSuccess(null), 3500);
      } else {
        setPresentationError(res.error || 'Erro ao salvar apresentação.');
      }
    } catch (err: any) {
      setPresentationError(err.message || 'Erro inesperado ao salvar apresentação.');
    } finally {
      setIsSavingPresentation(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Por favor, preencha o e-mail e a senha.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('E-mail ou senha incorretos.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMsg('E-mail ainda não confirmado. Verifique sua caixa de entrada.');
        } else {
          setErrorMsg(error.message || 'Falha ao autenticar.');
        }
      } else {
        setSuccessMsg('Login realizado com sucesso!');
        setTimeout(() => {
          onClose();
          resetForm();
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro inesperado ao fazer login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Preencha seu e-mail e senha para continuar.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const { error, needsEmailConfirmation } = await signUp(
        email.trim(),
        password,
        fullName.trim()
      );

      if (error) {
        if (error.message.includes('already registered')) {
          setErrorMsg('Este e-mail já está cadastrado. Faça login.');
        } else {
          setErrorMsg(error.message || 'Erro ao criar conta.');
        }
      } else {
        if (needsEmailConfirmation) {
          setSuccessMsg(
            'Conta criada com sucesso! Enviamos um link de confirmação para o seu e-mail.'
          );
        } else {
          setSuccessMsg('Cadastro concluído com sucesso!');
          setTimeout(() => {
            onClose();
            resetForm();
          }, 900);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao criar a conta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      onClose();
      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao desconectar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="supabase-auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="supabase-auth-modal-content"
        className="relative w-full max-w-md flex flex-col max-h-[90vh] sm:max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl my-auto shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 sm:px-6 py-3.5 sm:py-4 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {user ? 'Minha Conta' : mode === 'login' ? 'Acessar Conta' : 'Criar Nova Conta'}
              </h3>
              <p className="text-xs text-slate-400">
                {user
                  ? 'Gerencie sua conta e visualize seu plano'
                  : 'Autenticação segura integrada via Supabase'}
              </p>
            </div>
          </div>
          <button
            id="close-auth-modal-btn"
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 overscroll-contain">
          {deleteStep === 3 ? (
            <div className="text-center space-y-4 py-4 animate-in fade-in">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Conta Excluída com Sucesso</h4>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto mt-1.5">
                  Sua conta foi excluída definitivamente. Seus dados foram removidos do Supabase e você precisará criar uma nova conta para voltar ao AnônQr.
                </p>
              </div>
              <button
                id="btn-close-account-deleted"
                onClick={() => {
                  setDeleteStep(0);
                  onClose();
                  resetForm();
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                Entendido / Fechar
              </button>
            </div>
          ) : user ? (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="relative group shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-16 w-16 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md shadow-emerald-950/50"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-2xl shadow-md shadow-emerald-950/50">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-slate-950/80 rounded-2xl flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left w-full">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <p className="font-bold text-sm text-white truncate">{displayName}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      Autenticado
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>

                  {/* Ações da Foto de Perfil */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                    />
                    {!avatarUrl ? (
                      <button
                        type="button"
                        id="btn-add-avatar"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {isUploadingAvatar ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}
                        <span>Adicionar foto</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          id="btn-change-avatar"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                          {isUploadingAvatar ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Camera className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                          <span>Trocar foto</span>
                        </button>
                        <button
                          type="button"
                          id="btn-remove-avatar"
                          onClick={handleRemoveAvatar}
                          disabled={isUploadingAvatar}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remover foto</span>
                        </button>
                      </>
                    )}
                  </div>

                  {avatarSuccess && (
                    <div className="mt-2 text-[11px] text-emerald-400 flex items-center justify-center sm:justify-start gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{avatarSuccess}</span>
                    </div>
                  )}

                  {avatarError && (
                    <div className="mt-2 text-[11px] text-rose-400 flex items-center justify-center sm:justify-start gap-1.5 animate-in fade-in">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{avatarError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Informações da Conta */}
              <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Status da Sessão:
                  </span>
                  <span className="text-emerald-400 font-semibold">Conectado com Sucesso</span>
                </div>
              </div>

              {/* Seção de Definição / Alteração do Nick */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="input-user-nick" className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                      Nick
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {userNick ? (
                        <span>
                          Nick atual: <strong className="text-emerald-400 font-mono font-bold">@{userNick}</strong>
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">Defina seu Nick</span>
                      )}
                    </p>
                  </div>
                  {userNick ? (
                    <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
                      @{userNick}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                      Sem Nick
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveNick} className="space-y-2.5">
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-500 font-bold text-xs select-none">@</span>
                    <input
                      type="text"
                      id="input-user-nick"
                      value={nickInput}
                      onChange={(e) => {
                        setNickInput(e.target.value.replace(/^@+/, ''));
                        setNickError(null);
                        setNickSuccess(null);
                      }}
                      placeholder="Defina seu Nick (ex: Felipe123)"
                      maxLength={20}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700/80 pl-7 pr-3 py-2 text-base sm:text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none font-medium"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <p className="text-[10.5px] text-slate-400">
                      Entre 3 e 20 caracteres • letras, números e _
                    </p>
                    <button
                      type="submit"
                      id="btn-save-user-nick"
                      disabled={isSavingNick || !nickInput.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-sm shadow-emerald-950/40"
                    >
                      {isSavingNick ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Salvar Nick</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Mensagens de Feedback */}
                  {nickSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{nickSuccess}</span>
                    </div>
                  )}

                  {nickError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>{nickError}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* Seção: Sobre mim / O que procuro */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3.5">
                <UserPresentationEditor
                  value={presentationState}
                  onChange={(updated) => {
                    setPresentationState(updated);
                    setPresentationSuccess(null);
                    setPresentationError(null);
                  }}
                  disabled={isSavingPresentation}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <p className="text-[10.5px] text-slate-400">
                    Suas escolhas são visíveis para outros usuários ao consultarem seu perfil.
                  </p>
                  <button
                    type="button"
                    id="btn-save-user-presentation"
                    onClick={handleSavePresentation}
                    disabled={isSavingPresentation}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-sm shadow-emerald-950/40 active:scale-95"
                  >
                    {isSavingPresentation ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Salvar Apresentação</span>
                      </>
                    )}
                  </button>
                </div>

                {presentationSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{presentationSuccess}</span>
                  </div>
                )}

                {presentationError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{presentationError}</span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                <p>
                  Sua conta está conectada e pronta para comprar e gerenciar salas individuais com segurança no Supabase.
                </p>
              </div>

              {/* Seção: Excluir Minha Conta (Confirmação em 2 Etapas) */}
              <div className="pt-2 border-t border-slate-800/80">
                {deleteStep === 0 && (
                  <button
                    type="button"
                    id="btn-open-delete-account"
                    onClick={() => {
                      setDeleteStep(1);
                      setDeleteError(null);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-rose-900/40 bg-rose-950/20 hover:bg-rose-950/40 text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Excluir minha conta</span>
                  </button>
                )}

                {deleteStep === 1 && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-800/50 space-y-2.5 animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold text-rose-200">
                          Tem certeza que deseja excluir sua conta?
                        </h5>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Essa ação é permanente. Seus dados de conta serão removidos e você precisará criar uma nova conta para voltar ao AnônQr.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        id="btn-delete-step1-continue"
                        onClick={() => setDeleteStep(2)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer text-center"
                      >
                        Sim, desejo continuar
                      </button>
                      <button
                        type="button"
                        id="btn-delete-step1-cancel"
                        onClick={() => {
                          setDeleteStep(0);
                          setDeleteError(null);
                        }}
                        className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {deleteStep === 2 && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-600/60 space-y-2.5 animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold text-white">
                          Confirmação Definitiva
                        </h5>
                        <p className="text-[11px] text-rose-200/90 leading-relaxed">
                          Ao confirmar, seu login será excluído imediatamente do Supabase e sua sessão encerrada. Esta ação NÃO pode ser desfeita.
                        </p>
                      </div>
                    </div>

                    {deleteError && (
                      <div className="p-2 rounded-lg bg-rose-900/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                        <span>{deleteError}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        id="btn-confirm-final-delete-account"
                        onClick={handleConfirmDeleteAccount}
                        disabled={isDeletingAccount}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950 disabled:text-rose-400 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-rose-950/50"
                      >
                        {isDeletingAccount ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Excluindo conta...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Confirmar e Excluir Definitivamente</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        id="btn-delete-step2-cancel"
                        disabled={isDeletingAccount}
                        onClick={() => {
                          setDeleteStep(0);
                          setDeleteError(null);
                        }}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  id="auth-logout-btn"
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 py-2.5 text-xs font-bold text-rose-300 transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="h-4 w-4" />
                      <span>Sair da Conta</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            /* Login & Signup Forms */
            <div>
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 mb-5">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === 'login'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signup')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === 'signup'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cadastrar
                </button>
              </div>

              {/* Status feedback */}
              {errorMsg && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              {mode === 'login' ? (
                /* Login Form */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-emerald-400" />
                      E-mail
                    </label>
                    <input
                      id="auth-login-email"
                      type="email"
                      required
                      placeholder="seu.email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-emerald-400" />
                      Senha
                    </label>
                    <input
                      id="auth-login-password"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    id="auth-login-submit-btn"
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-bold text-white shadow-md shadow-emerald-950/60 transition-all disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span>Entrar no Sistema</span>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-400 pt-2">
                    Não tem uma conta ainda?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('signup')}
                      className="text-emerald-400 font-bold hover:underline"
                    >
                      Cadastre-se gratuitamente
                    </button>
                  </p>
                </form>
              ) : (
                /* Sign Up Form */
                <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-emerald-400" />
                      Nome de Exibição (Opcional)
                    </label>
                    <input
                      id="auth-signup-name"
                      type="text"
                      placeholder="Ex: João Silva"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-emerald-400" />
                      E-mail
                    </label>
                    <input
                      id="auth-signup-email"
                      type="email"
                      required
                      placeholder="seu.email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-emerald-400" />
                      Senha (mínimo 6 caracteres)
                    </label>
                    <input
                      id="auth-signup-password"
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-emerald-400" />
                      Confirmar Senha
                    </label>
                    <input
                      id="auth-signup-confirm-password"
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    id="auth-signup-submit-btn"
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-950/60 transition-all disabled:opacity-50 cursor-pointer mt-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span>Criar Conta no Supabase</span>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-400 pt-1">
                    Já possui uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('login')}
                      className="text-emerald-400 font-bold hover:underline"
                    >
                      Fazer login
                    </button>
                  </p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

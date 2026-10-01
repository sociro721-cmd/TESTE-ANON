import React from 'react';
import { ShieldCheck, QrCode, RefreshCw, User, Receipt, MessageCircle } from 'lucide-react';
import { AnonymousUser } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { AnonQrMascot } from './AnonQrMascot';

interface Props {
  currentUser?: AnonymousUser | null;
  onOpenScanner: () => void;
  onOpenCreateRoom?: () => void;
  onRegenerateIdentity: () => void;
  onOpenOwnerPanel?: () => void;
  onOpenBuyRoom?: () => void;
  onOpenAuth?: () => void;
  onOpenMinhasCompras?: () => void;
  onOpenMinhasConversas?: () => void;
  unreadConversationsCount?: number;
  onNavigateHome?: () => void;
}

export const Header: React.FC<Props> = ({
  currentUser,
  onOpenScanner,
  onOpenCreateRoom,
  onRegenerateIdentity,
  onOpenOwnerPanel,
  onOpenBuyRoom,
  onOpenAuth,
  onOpenMinhasCompras,
  onOpenMinhasConversas,
  unreadConversationsCount,
  onNavigateHome,
}) => {
  const { user, displayName, userNick, avatarUrl } = useAuth();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-2 sm:px-6 py-2 sm:py-3.5 gap-1.5 sm:gap-2.5 min-w-0">
        {/* Logo & Brand */}
        <div
          onClick={onNavigateHome}
          className={`flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0 ${onNavigateHome ? 'cursor-pointer' : ''}`}
          role={onNavigateHome ? 'button' : undefined}
          tabIndex={onNavigateHome ? 0 : undefined}
          title={onNavigateHome ? 'Voltar para a página inicial' : undefined}
          aria-label={onNavigateHome ? 'Voltar para a página inicial do AnônQr' : undefined}
        >
          <div className="relative flex items-center justify-center shrink-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-950/50 shrink-0">
              <QrCode className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="absolute -top-2 -right-2 hidden sm:block">
              <AnonQrMascot variant="compact" size="sm" className="w-6 h-6" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-extrabold tracking-tight text-white">
                Anon<span className="text-emerald-400">QR</span>
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Criptografia Anônima
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">
              Salas temáticas privadas com acesso exclusivo por QR Code
            </p>
          </div>
        </div>

        {/* Right Section: Identity, User Profile & Scanner */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Anonymous User Badge */}
          <div className="flex items-center gap-1 sm:gap-2 rounded-xl border border-slate-800 bg-slate-900/90 py-1 px-1 sm:px-3 sm:py-1.5 min-h-[36px] sm:min-h-[38px]">
            <div
              className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-white text-[11px] font-bold shrink-0"
              style={{ backgroundColor: currentUser.avatarColor || '#06b6d4' }}
              title={`Identidade anônima: ${currentUser.name}`}
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Identidade</p>
              <p className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                {currentUser.name}
              </p>
            </div>
            <button
              id="header-reroll-identity-btn"
              onClick={onRegenerateIdentity}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Trocar pseudônimo anônimo"
              aria-label="Trocar pseudônimo anônimo"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Supabase User Account */}
          {user ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                id="header-supabase-user-btn"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/40 py-1 px-1.5 sm:px-3 sm:py-1.5 min-h-[36px] sm:min-h-[38px] transition-all text-left cursor-pointer"
                title="Conta Supabase: Ver perfil"
                aria-label="Meu perfil no AnônQr"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-6 w-6 rounded-full object-cover border border-emerald-400/60 shrink-0"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 text-[11px] font-black shrink-0">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold text-white truncate max-w-[120px]">
                    {userNick ? `@${userNick}` : displayName}
                  </p>
                  <p className="text-[10px] text-emerald-400 font-medium">
                    {userNick ? displayName : 'Conta Ativa'}
                  </p>
                </div>
              </button>

              {onOpenMinhasCompras && (
                <button
                  id="header-minhas-compras-btn"
                  onClick={onOpenMinhasCompras}
                  className="hidden md:flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors cursor-pointer min-h-[38px]"
                  title="Consultar histórico de compras"
                  aria-label="Minhas compras de salas"
                >
                  <Receipt className="h-3.5 w-3.5 text-amber-400" />
                  <span>Minhas Compras</span>
                </button>
              )}
            </div>
          ) : (
            onOpenAuth && (
              <button
                id="header-login-btn"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-200 transition-colors cursor-pointer min-h-[36px] sm:min-h-[38px]"
                title="Entrar ou cadastrar no Supabase"
                aria-label="Entrar na conta"
              >
                <User className="h-3.5 w-3.5 text-emerald-400" />
                <span>Entrar</span>
              </button>
            )
          )}

          {/* Minhas Conversas 1x1 Button (exclusivo para usuário realmente autenticado) */}
          {Boolean(user?.id && onOpenMinhasConversas) && (
            <button
              id="header-minhas-conversas-btn"
              onClick={onOpenMinhasConversas}
              className="relative flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/40 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-emerald-300 transition-colors cursor-pointer min-h-[36px] sm:min-h-[38px] shrink-0"
              title="Minhas conversas privadas 1×1"
              aria-label="Minhas conversas privadas"
            >
              <MessageCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Minhas conversas</span>
              <span className="sm:hidden">Conversas</span>
              {typeof unreadConversationsCount === 'number' && unreadConversationsCount > 0 && (
                <span className="flex items-center justify-center h-4.5 min-w-[18px] px-1 rounded-full bg-emerald-400 text-slate-950 font-black text-[10px] animate-pulse">
                  {unreadConversationsCount}
                </span>
              )}
            </button>
          )}

          {/* Scanner Button */}
          <button
            id="header-open-scanner-btn"
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white shadow-md shadow-emerald-950/60 transition-all active:scale-95 min-h-[36px] sm:min-h-[38px] cursor-pointer shrink-0"
            title="Escanear QR Code"
            aria-label="Escanear QR Code"
          >
            <QrCode className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Escanear QR Code</span>
            <span className="sm:hidden">Escanear</span>
          </button>
        </div>
      </div>
    </header>
  );
};

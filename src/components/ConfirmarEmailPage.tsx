import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  CheckCircle2,
  Mail,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Send,
  Home,
  Check,
} from 'lucide-react';

interface ConfirmarEmailPageProps {
  onNavigateHome: () => void;
  onOpenAuthModal?: () => void;
}

export const ConfirmarEmailPage: React.FC<ConfirmarEmailPageProps> = ({
  onNavigateHome,
  onOpenAuthModal,
}) => {
  const { user, isLoading, resendConfirmationEmail } = useAuth();
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [urlErrorDescription, setUrlErrorDescription] = useState<string | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);

  // Analisa erros passados pelo Supabase na URL (ex: token expirado)
  useEffect(() => {
    try {
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#\/?/, '')
      );
      const searchParams = new URLSearchParams(window.location.search);

      const errorDesc =
        hashParams.get('error_description') ||
        searchParams.get('error_description') ||
        hashParams.get('error') ||
        searchParams.get('error');

      if (errorDesc) {
        if (errorDesc.includes('expired') || errorDesc.includes('invalid')) {
          setUrlErrorDescription(
            'O link de confirmação expirou ou já foi utilizado. Solicite um novo link abaixo.'
          );
        } else {
          setUrlErrorDescription(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
        }
      }
    } catch (e) {
      console.warn('Erro ao processar parâmetros da URL de confirmação:', e);
    }
  }, []);

  // Dá um pequeno tempo para o Supabase processar hash tokens na montagem da página
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVerifyingSession(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);
    setResendSuccess(false);

    const emailToUse = resendEmail.trim() || user?.email;
    if (!emailToUse) {
      setResendError('Por favor, informe seu endereço de e-mail.');
      return;
    }

    setResendLoading(true);
    try {
      const { error } = await resendConfirmationEmail(emailToUse);
      if (error) {
        setResendError(error.message || 'Erro ao reenviar e-mail de confirmação.');
      } else {
        setResendSuccess(true);
      }
    } catch (err: any) {
      setResendError(err?.message || 'Falha ao conectar com o serviço de autenticação.');
    } finally {
      setResendLoading(false);
    }
  };

  const isChecking = isLoading || isVerifyingSession;
  const isConfirmed = !!user;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Simple Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para o Início</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-300 tracking-wide">
              AnonQR • Autenticação
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-emerald-950/20 p-6 sm:p-8 relative overflow-hidden backdrop-blur-sm">
          {/* Subtle Glow background */}
          <div className="absolute -top-24 -right-24 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {isChecking ? (
            /* Loading State */
            <div className="text-center py-10 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-inner">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Validando confirmação de e-mail...
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Aguarde um momento enquanto confirmamos a sua conta com o servidor.
              </p>
            </div>
          ) : isConfirmed ? (
            /* Confirmed State */
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-950/40">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Conta Verificada
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  E-mail Confirmado com Sucesso!
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  Sua conta foi ativada com sucesso. Você já está conectado e pode criar, comprar e gerenciar salas anônimas protegidas.
                </p>
              </div>

              {/* User Data Preview */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>E-mail autenticado:</span>
                  <span className="font-semibold text-white truncate max-w-[220px]">
                    {user?.email}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Status do acesso:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="h-3 w-3" /> Liberado
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  id="btn-confirm-email-home"
                  onClick={onNavigateHome}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-950/60 transition-all cursor-pointer active:scale-98"
                >
                  <Home className="h-4 w-4" />
                  <span>Ir para a Página Inicial</span>
                </button>
              </div>
            </div>
          ) : (
            /* Pending Confirmation / Action Needed State */
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-950/30">
                  <Mail className="h-10 w-10 text-amber-400" />
                </div>

                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Ação Necessária
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-white">
                    Verifique seu E-mail
                  </h1>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                  Enviamos um link de confirmação para o seu e-mail. Por favor, acesse sua caixa de entrada (ou pasta de spam) e clique no link para ativar sua conta.
                </p>
              </div>

              {/* URL Error Message (if token expired) */}
              {urlErrorDescription && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{urlErrorDescription}</span>
                </div>
              )}

              {/* Feedback messages for resending */}
              {resendSuccess && (
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>
                    Novo link de confirmação enviado com sucesso! Verifique seu e-mail.
                  </span>
                </div>
              )}

              {resendError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{resendError}</span>
                </div>
              )}

              {/* Resend Form */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-emerald-400" />
                  Não recebeu o e-mail ou o link expirou?
                </p>

                <form onSubmit={handleResend} className="space-y-3">
                  <input
                    type="email"
                    required
                    placeholder="Digite seu e-mail cadastrado"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                  <button
                    type="submit"
                    disabled={resendLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {resendLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Reenviar E-mail de Confirmação</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Navigation Actions */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Home className="h-4 w-4" />
                  <span>Voltar para o Início</span>
                </button>

                {onOpenAuthModal && (
                  <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-md shadow-emerald-950/40"
                  >
                    <span>Já confirmou? Fazer Login</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-[11px] text-slate-500">
        AnonQR • Plataforma de Salas Anônimas & Efêmeras
      </footer>
    </div>
  );
};

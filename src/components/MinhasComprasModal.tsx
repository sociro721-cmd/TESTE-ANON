import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  ShieldCheck,
  LogIn,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  Hourglass,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { CompraOrdem, PIX_KEY, ROOM_CATALOGUE } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getMinhasCompras } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onEnterRoom?: (salaId: string, compraId?: string) => void | Promise<void>;
}

export const MinhasComprasModal: React.FC<Props> = ({ isOpen, onClose, onEnterRoom }) => {
  const { user } = useAuth();
  const [compras, setCompras] = useState<CompraOrdem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [enteringSalaId, setEnteringSalaId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Atualiza ticker temporal a cada segundo para contagem regressiva em tempo real
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const carregarCompras = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getMinhasCompras(user.id);
      setCompras(data);
    } catch (err) {
      console.error('Erro ao buscar compras:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      carregarCompras();
    }
  }, [isOpen, user]);

  // Sincroniza em segundo plano compras cujo prazo expirou enquanto o modal está aberto
  useEffect(() => {
    if (!isOpen) return;
    for (const c of compras) {
      if (!c.is_permanent && c.status !== 'expired' && c.expires_at) {
        const expMs = new Date(c.expires_at).getTime();
        if (!isNaN(expMs) && expMs > 0 && expMs <= now) {
          fetch(`/api/compras/${encodeURIComponent(c.id)}/expire`, { method: 'POST' }).catch(() => {});
        }
      }
    }
  }, [isOpen, now, compras]);

  if (!isOpen) return null;

  // Identifica se a compra foi gerada pela modalidade PIX manual
  const isPixManual = (compra: CompraOrdem): boolean => {
    if (compra.metodo_pagamento === 'pix_manual') return true;
    if (compra.payment_id === 'pix_manual' || compra.payment_id?.startsWith('pix_manual')) return true;
    return false;
  };

  const getWhatsappUrl = (compra: CompraOrdem) => {
    const mensagem = `Olá! Fiz um pagamento via PIX referente à sala ${compra.sala_id}.\nID da compra: ${compra.id}\nValor: R$ ${compra.valor.toFixed(2).replace('.', ',')}\nEstou enviando o comprovante.`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
  };

  const handleCopyPixKey = (compraId: string) => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopiedKeyId(compraId);
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  // Helper para verificar expiração da compra
  const checkIsExpired = (compra: CompraOrdem): boolean => {
    if (compra.is_permanent) return false;
    if (compra.status === 'expired') return true;
    if (compra.expires_at) {
      const expMs = new Date(compra.expires_at).getTime();
      if (!isNaN(expMs) && expMs > 0 && expMs <= now) {
        return true;
      }
    }
    return false;
  };

  // Helper para formatar a duração contratada
  const formatDurationLabel = (compra: CompraOrdem): string => {
    if (compra.is_permanent) return 'Permanente';
    if (compra.sala?.duracao_label) return compra.sala.duracao_label;
    if (compra.sala?.descricao && (compra.sala.descricao.toLowerCase().includes('hora') || compra.sala.descricao.toLowerCase().includes('perm'))) {
      return compra.sala.descricao;
    }
    const cat = ROOM_CATALOGUE.find((c) => c.id === compra.sala_id);
    if (cat?.durationLabel) return cat.durationLabel;
    const mins = compra.duration_minutes ?? compra.sala?.duracao_minutos;
    if (mins) {
      if (mins < 60) return `${mins} min`;
      if (mins % 60 === 0) {
        const h = Math.floor(mins / 60);
        return `${h} ${h === 1 ? 'hora' : 'horas'}`;
      }
      return `${mins} min`;
    }
    return '1 hora';
  };

  // Helper para formatar o tempo restante
  const formatTimeLeft = (expiresAtIso: string): string => {
    const diffMs = Math.max(0, new Date(expiresAtIso).getTime() - now);
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const renderStatusBadge = (compra: CompraOrdem) => {
    const isPix = isPixManual(compra);
    const isExpired = checkIsExpired(compra);

    // 4. TEMPO EXPIRADO (prioridade máxima se o prazo já atingiu o término ou status já é expired)
    if (isExpired || compra.status === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-800 text-slate-400 border border-slate-700">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          Tempo Expirado
        </span>
      );
    }

    switch (compra.status) {
      case 'paid': {
        // 5. SALA PERMANENTE
        if (compra.is_permanent) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <InfinityIcon className="h-3 w-3" />
              Permanente • Sem Expiração
            </span>
          );
        }

        // 2. PRONTA - NÃO INICIADA (Pagamento aprovado, mas nunca acessado)
        if (!compra.activated_at) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Hourglass className="h-3 w-3" />
              Pronta — Não iniciada
            </span>
          );
        }

        // 3. ATIVA (Pagamento aprovado + activated_at preenchido + expires_at no futuro)
        const remainingText = compra.expires_at ? formatTimeLeft(compra.expires_at) : '';
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <Clock className="h-3 w-3 animate-pulse" />
            Ativa{remainingText ? ` • Restam ${remainingText}` : ''}
          </span>
        );
      }
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <XCircle className="h-3 w-3" /> Cancelada
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <XCircle className="h-3 w-3" /> Recusada
          </span>
        );
      case 'pending':
      default:
        // 1. PAGAMENTO PENDENTE
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="h-3 w-3" />
            {isPix ? 'PIX — Pendente' : 'Pendente'}
          </span>
        );
    }
  };

  return (
    <div
      id="minhas-compras-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="minhas-compras-modal-content"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Minhas Compras de Salas</h2>
              <p className="text-[11px] sm:text-xs text-slate-400">Ciclos de acesso registrados no Supabase</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={carregarCompras}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Atualizar compras"
              aria-label="Atualizar compras"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {compras.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Nenhuma compra encontrada</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Você ainda não iniciou nenhuma compra de sala. Escolha uma das salas disponíveis no
                catálogo para iniciar seu pedido.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {compras.map((compra) => {
                const isPix = isPixManual(compra);
                const isExpired = checkIsExpired(compra);
                const durLabel = formatDurationLabel(compra);
                const catItem = ROOM_CATALOGUE.find((c) => c.id === compra.sala_id);
                const salaNome = catItem?.title || compra.sala_id;

                return (
                  <div
                    key={compra.id}
                    className={`p-4 rounded-2xl border ${
                      isExpired
                        ? 'border-slate-800/60 bg-slate-950/40 opacity-75'
                        : 'border-slate-800 bg-slate-950/60'
                    } flex flex-col gap-2.5 transition-all`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-500 uppercase">
                            ID: {compra.id.slice(0, 8)}...
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {durLabel}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-0.5">{salaNome}</h4>
                      </div>
                      {renderStatusBadge(compra)}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Método: <strong className={isPix ? 'text-teal-400' : 'text-cyan-400'}>{isPix ? 'PIX' : 'Mercado Pago'}</strong>
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500 text-[11px]">
                          {compra.created_at ? new Date(compra.created_at).toLocaleString('pt-BR') : '-'}
                        </span>
                      </div>
                      <span className="text-sm font-black text-emerald-400">
                        R$ {compra.valor.toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    {/* DETALHE DO CICLO DE ATIVAÇÃO PARA SALAS TEMPORÁRIAS PAGAS */}
                    {compra.status === 'paid' && !compra.is_permanent && !isExpired && (
                      <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/70 flex items-center justify-between">
                        {!compra.activated_at ? (
                          <span className="text-teal-300/90 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-teal-400" />
                            O prazo de {durLabel} começará a contar no seu 1º acesso
                          </span>
                        ) : (
                          <span className="text-cyan-300/90 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-cyan-400" />
                            Iniciado em: {new Date(compra.activated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Expira em: {compra.expires_at ? new Date(compra.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* ALERTA E AÇÕES ESPECÍFICAS PARA PIX MANUAL PENDENTE */}
                    {isPix && compra.status === 'pending' && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2 animate-fade-in mt-1">
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-amber-200">
                              Pagamento aguardando confirmação
                            </p>
                            <p className="text-[11px] text-amber-300/80 leading-relaxed">
                              Realize o PIX e envie o comprovante no WhatsApp para que o administrador aprove e libere seu acesso.
                            </p>
                          </div>
                        </div>

                        {/* Chave PIX Rápida */}
                        <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] gap-2">
                          <span className="font-mono text-slate-300 truncate pr-1">
                            PIX: {PIX_KEY}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPixKey(compra.id)}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                            aria-label="Copiar chave PIX"
                          >
                            {copiedKeyId === compra.id ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>Copiada!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copiar Chave</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Botão Enviar Comprovante */}
                        <a
                          id={`btn-enviar-comprovante-${compra.id}`}
                          href={getWhatsappUrl(compra)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-3 px-3 min-h-[44px] rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span>Enviar comprovante</span>
                          <ExternalLink className="h-3 w-3 opacity-80" />
                        </a>
                      </div>
                    )}

                    {/* BOTÕES DE ENTRADA OU STATUS EXPIRADO */}
                    {isExpired || compra.status === 'expired' ? (
                      <div className="pt-1">
                        <div
                          id={`sala-expirada-${compra.id}`}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 min-h-[44px] rounded-xl font-bold text-xs bg-slate-800/60 text-slate-400 border border-slate-700/50 cursor-not-allowed select-none"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          <span>Tempo Expirado — Acesso Encerrado</span>
                        </div>
                      </div>
                    ) : compra.status === 'paid' ? (
                      <div className="pt-1">
                        <button
                          id={`entrar-sala-btn-${compra.id}`}
                          type="button"
                          disabled={enteringSalaId === compra.sala_id}
                          onClick={async () => {
                            if (!onEnterRoom) return;
                            setEnteringSalaId(compra.sala_id);
                            try {
                              await onEnterRoom(compra.sala_id, compra.id);
                              onClose();
                            } finally {
                              setEnteringSalaId(null);
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 min-h-[44px] rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {enteringSalaId === compra.sala_id ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>Entrando na sala...</span>
                            </>
                          ) : (
                            <>
                              <LogIn className="h-4 w-4" />
                              <span>
                                {!compra.activated_at && !compra.is_permanent
                                  ? `Entrar na sala (Iniciar ${durLabel})`
                                  : 'Entrar na sala'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Regra de Autoridade: O tempo de salas temporárias inicia no 1º acesso e é validado
              continuamente pelo servidor. Novas compras geram novos ciclos de tempo independentes.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

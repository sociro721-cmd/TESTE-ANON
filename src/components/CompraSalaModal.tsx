import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  User,
  Users,
  QrCode,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { SalaProduto, CompraOrdem, PIX_KEY, WHATSAPP_SUPPORT_URL } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { createOrdemCompra, criarCheckoutMercadoPago, getMinhasCompras, parseDurationFromTextOrEntity } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sala: SalaProduto | null;
  onRequireAuth: () => void;
  onOrderCreated?: (order: CompraOrdem) => void;
  onOpenMinhasCompras?: () => void;
}

export const CompraSalaModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sala,
  onRequireAuth,
  onOrderCreated,
  onOpenMinhasCompras,
}) => {
  const { user, displayName } = useAuth();
  const [isSubmittingMP, setIsSubmittingMP] = useState(false);
  const [isSubmittingPix, setIsSubmittingPix] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CompraOrdem | null>(null);
  const [pixSuccessOrder, setPixSuccessOrder] = useState<CompraOrdem | null>(null);
  const [alreadyPaidWarning, setAlreadyPaidWarning] = useState(false);
  const [copiedPixKey, setCopiedPixKey] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !sala) return null;

  // Fluxo 1: Compra Manual Via PIX
  const handleComprarSalaViaPix = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }

    setIsSubmittingPix(true);
    setErrorMsg(null);
    setAlreadyPaidWarning(false);

    try {
      // 1. Verificar se o usuário já possui compras para essa sala (prevenção de duplicidade)
      const comprasExistentes = await getMinhasCompras(user.id);
      const comprasDessaSala = comprasExistentes.filter((c) => c.sala_id === sala.id);

      // 1.1 Se já existir compra paga, não cria nova e avisa o usuário
      const compraPaga = comprasDessaSala.find((c) => c.status === 'paid');
      if (compraPaga) {
        setAlreadyPaidWarning(true);
        setIsSubmittingPix(false);
        return;
      }

      // 1.2 Se já existir uma solicitação pendente para essa sala, reutiliza-a evitando duplicidade
      const compraPendenteExistente = comprasDessaSala.find((c) => c.status === 'pending');
      if (compraPendenteExistente) {
        setPixSuccessOrder(compraPendenteExistente);
        if (onOrderCreated) {
          onOrderCreated(compraPendenteExistente);
        }
        setIsSubmittingPix(false);
        return;
      }

      // 1.3 Se não existir, cria a nova solicitação de compra manual via PIX com status 'pending'
      const durInfoPix = parseDurationFromTextOrEntity(sala);
      const isPermanentPix = sala.is_permanente ?? durInfoPix?.isPermanent ?? false;
      const durationMinutesPix = isPermanentPix ? 0 : (sala.duracao_minutos ?? durInfoPix?.durationMinutes ?? 60);

      const { data, error } = await createOrdemCompra({
        userId: user.id,
        salaId: sala.id,
        valor: sala.valor,
        metodoPagamento: 'pix_manual',
        durationMinutes: durationMinutesPix,
        isPermanent: isPermanentPix,
        salaEntity: sala,
      });

      if (error || !data) {
        throw new Error(error || 'Não foi possível registrar a solicitação PIX.');
      }

      setPixSuccessOrder(data);
      if (onOrderCreated) {
        onOrderCreated(data);
      }
    } catch (err: any) {
      console.error('[CompraSalaModal] Erro ao registrar compra PIX manual:', err);
      setErrorMsg(err?.message || 'Falha ao processar solicitação de compra PIX.');
    } finally {
      setIsSubmittingPix(false);
    }
  };

  // Fluxo 2: Mercado Pago (fluxo original inalterado)
  const handleConfirmPurchaseMP = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }

    setIsSubmittingMP(true);
    setErrorMsg(null);

    try {
      // Criar a ordem de compra vinculada ao usuário, sala, valor oficial e status pendente
      const durInfoMP = parseDurationFromTextOrEntity(sala);
      const isPermanentMP = sala.is_permanente ?? durInfoMP?.isPermanent ?? false;
      const durationMinutesMP = isPermanentMP ? 0 : (sala.duracao_minutos ?? durInfoMP?.durationMinutes ?? 60);

      const { data, error } = await createOrdemCompra({
        userId: user.id,
        salaId: sala.id,
        valor: sala.valor,
        metodoPagamento: 'mercadopago',
        durationMinutes: durationMinutesMP,
        isPermanent: isPermanentMP,
        salaEntity: sala,
      });

      if (error || !data) {
        throw new Error(error || 'Não foi possível gerar a ordem de compra.');
      }

      setCreatedOrder(data);
      if (onOrderCreated) {
        onOrderCreated(data);
      }

      // Criar checkout no Mercado Pago via Edge Function
      const { data: checkoutData, error: checkoutError } = await criarCheckoutMercadoPago({
        compraId: data.id,
        salaId: sala.id,
        valor: sala.valor,
      });

      if (checkoutError || !checkoutData?.checkout_url) {
        throw new Error(checkoutError || 'O Mercado Pago não retornou um link de pagamento.');
      }

      // Redirecionar para o checkout do Mercado Pago
      window.location.href = checkoutData.checkout_url;
    } catch (err: any) {
      console.error('[CompraSalaModal] Erro ao processar Mercado Pago:', err);
      setErrorMsg(err?.message || 'Falha ao processar solicitação de compra via Mercado Pago.');
    } finally {
      setIsSubmittingMP(false);
    }
  };

  const handleCopyPixKey = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopiedPixKey(true);
    setTimeout(() => setCopiedPixKey(false), 2500);
  };

  const getWhatsappMessage = (ordemId: string) => {
    return `Olá! Fiz um pagamento via PIX referente à sala ${sala.id}.\nID da compra: ${ordemId}\nValor: R$ ${sala.valor.toFixed(2).replace('.', ',')}\nEstou enviando o comprovante.`;
  };

  const handleCopyWhatsappMsg = (ordemId: string) => {
    navigator.clipboard.writeText(getWhatsappMessage(ordemId));
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  const handleClose = () => {
    setCreatedOrder(null);
    setPixSuccessOrder(null);
    setAlreadyPaidWarning(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      id="compra-sala-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={handleClose}
    >
      <div
        id="compra-sala-modal-content"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-slate-900 text-slate-100 shadow-2xl shadow-emerald-950/40 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
      >
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800/80 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Comprar Sala Individual</h2>
              <p className="text-xs text-slate-400">Produto exclusivo • Pagamento via PIX ou Mercado Pago</p>
            </div>
          </div>
          <button
            id="close-compra-sala-btn"
            onClick={handleClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Aviso se a sala já estiver paga pelo usuário */}
          {alreadyPaidWarning && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 space-y-3 animate-fade-in text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Você já possui acesso liberado a esta sala!</h4>
              <p className="text-xs text-slate-300">
                Uma compra paga para esta sala já foi confirmada na sua conta. Você pode acessá-la diretamente em Minhas Compras.
              </p>
              <div className="flex gap-2 pt-1">
                {onOpenMinhasCompras && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenMinhasCompras();
                    }}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
                  >
                    Abrir Minhas Compras
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* ESTADO 1: INSTRUÇÕES PIX MANUAL (Solicitação Criada) */}
          {pixSuccessOrder ? (
            <div className="space-y-4 animate-fade-in">
              {/* Alerta de Confirmação Oficial */}
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-white">Solicitação criada com sucesso.</h3>
                <p className="text-xs text-emerald-200/90 leading-relaxed max-w-sm mx-auto">
                  Faça o pagamento via PIX e envie o comprovante pelo WhatsApp. Seu acesso será liberado após a confirmação manual do pagamento.
                </p>
              </div>

              {/* Detalhes da Solicitação */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">ID da Compra:</span>
                  <span className="font-mono text-emerald-300 text-[11px] font-bold">{pixSuccessOrder.id}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Sala:</span>
                  <span className="font-bold text-white">{sala.nome}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Valor Oficial:</span>
                  <span className="font-extrabold text-emerald-400 text-sm">
                    R$ {pixSuccessOrder.valor.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status da Solicitação:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Clock className="h-3 w-3" />
                    Pendente (Aguardando Confirmação)
                  </span>
                </div>
              </div>

              {/* Caixa da Chave PIX */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <QrCode className="h-4 w-4 text-emerald-400" />
                    Chave PIX (Aleatória / EVP):
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    Copia e Cola
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-white break-all select-all">
                  <span className="truncate pr-2">{PIX_KEY}</span>
                  <button
                    id="copy-pix-key-btn"
                    type="button"
                    onClick={handleCopyPixKey}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  >
                    {copiedPixKey ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Botão de Envio de Comprovante via WhatsApp */}
              <div className="space-y-2 pt-1">
                <a
                  id="btn-whatsapp-comprovante"
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getWhatsappMessage(pixSuccessOrder.id))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Enviar Comprovante no WhatsApp</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                </a>

                <button
                  type="button"
                  onClick={() => handleCopyWhatsappMsg(pixSuccessOrder.id)}
                  className="w-full py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedMsg ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Mensagem copiada para a área de transferência!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      <span>Copiar texto pronto para o WhatsApp</span>
                    </>
                  )}
                </button>
              </div>

              {/* Ações de Fechamento / Ir para Minhas Compras */}
              <div className="pt-2 flex gap-2">
                {onOpenMinhasCompras && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenMinhasCompras();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>Ver em Minhas Compras</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          ) : !createdOrder ? (
            /* Detalhes do Produto / Sala */
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                    {sala.categoria || 'Sala Individual'}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    🟢 Disponível para Compra
                  </span>
                </div>

                <h3 className="text-lg font-black text-white">{sala.nome}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{sala.descricao}</p>

                {/* Especificações Oficiais do Produto */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {sala.max_participantes
                        ? `Até ${sala.max_participantes} pessoas`
                        : sala.room_type?.startsWith('duo')
                        ? '2 pessoas (1x1)'
                        : 'Até 10 pessoas'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {sala.duracao_label ||
                        (sala.is_permanente
                          ? 'Permanente (Sem Expiração)'
                          : sala.duracao_minutos
                          ? `${sala.duracao_minutos} min`
                          : 'Temporária')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Valor da Sala:</span>
                  <span className="text-2xl font-black text-emerald-400">
                    R$ {sala.valor.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Status do Usuário / Comprador */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-emerald-400" />
                    Usuário Comprador:
                  </span>
                  <span className="font-semibold text-white">
                    {user ? displayName : 'Visitante (Requer Login)'}
                  </span>
                </div>
                {user ? (
                  <p className="text-[11px] text-slate-400">
                    Sua conta ({user.email}) será vinculada como titular deste pedido.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-400/90 font-medium">
                    Você precisará fazer login ou cadastro para vincular a compra à sua conta.
                  </p>
                )}
              </div>

              {/* Regra de Segurança */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  O clique em comprar cria uma <strong>ordem de compra pendente</strong> no Supabase. A
                  sala é liberada após a confirmação do pagamento (PIX manual verificado pelo admin ou Mercado Pago automático).
                </span>
              </div>

              {/* OPÇÕES DE COMPRA: PIX MANUAL E MERCADO PAGO */}
              <div className="space-y-2.5 pt-1">
                {/* BOTÃO PRINCIPAL: COMPRAR SALA VIA PIX */}
                <button
                  id="btn-comprar-sala-via-pix"
                  type="button"
                  onClick={handleComprarSalaViaPix}
                  disabled={isSubmittingPix || isSubmittingMP}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 ring-2 ring-emerald-500/30"
                >
                  {isSubmittingPix ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !user ? (
                    <>
                      <User className="h-4 w-4" />
                      <span>Fazer Login e Comprar Sala Via PIX</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4" />
                      <span>Comprar Sala Via PIX (R$ {sala.valor.toFixed(2).replace('.', ',')})</span>
                    </>
                  )}
                </button>

                {/* BOTÃO SECUNDÁRIO: MERCADO PAGO (Fluxo Automático) */}
                <button
                  id="btn-comprar-mercadopago"
                  type="button"
                  onClick={handleConfirmPurchaseMP}
                  disabled={isSubmittingPix || isSubmittingMP}
                  className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingMP ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <ShoppingBag className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Pagar com Mercado Pago (Cartão / Pix Automático)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Ordem Mercado Pago Aberta (Checkout Redirecionando) */
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-base font-black text-white">Redirecionando para Mercado Pago...</h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  A sua ordem foi registrada no Supabase com sucesso.
                </p>
              </div>

              <button
                id="btn-concluir-pedido-fechar"
                type="button"
                onClick={handleClose}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


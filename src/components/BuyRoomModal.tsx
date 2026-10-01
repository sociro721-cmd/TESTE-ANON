import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  MessageCircle,
  ShieldCheck,
  Clock,
  Layers,
  Sparkles,
  QrCode,
  Users,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  CreditCard,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { RoomType, RoomPricingOption, ROOM_CATALOGUE, PIX_KEY, PurchaseOrder } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultCatalogId?: string;
  onDirectEnterRoom?: (roomId: string) => void;
}

export const BuyRoomModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultCatalogId = 'group_temp_1h',
  onDirectEnterRoom,
}) => {
  // Step: 'select' (choose room & duration) | 'pay' (PIX key, copy, WhatsApp receipt)
  const [step, setStep] = useState<'select' | 'pay'>('select');

  // Selection states
  const [selectedType, setSelectedType] = useState<RoomType>('group_temp');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(60);
  const [customerName, setCustomerName] = useState('');
  const [desiredRoomName, setDesiredRoomName] = useState('');
  const [desiredPasscode, setDesiredPasscode] = useState('');

  // Active Order state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<PurchaseOrder | null>(null);
  const [whatsappProofMsg, setWhatsappProofMsg] = useState<string>('');

  // Copy feedback states
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [hasCopiedPixAtLeastOnce, setHasCopiedPixAtLeastOnce] = useState(false);

  // Status check state
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Initialize selection when opening
  useEffect(() => {
    if (isOpen) {
      const match = ROOM_CATALOGUE.find((c) => c.id === defaultCatalogId) || ROOM_CATALOGUE[1];
      setSelectedType(match.roomType);
      if (!match.isPermanent) {
        setSelectedMinutes(match.durationMinutes);
      }
      setCopiedPix(false);
      setCopiedMsg(false);
      setHasCopiedPixAtLeastOnce(false);
    }
  }, [isOpen, defaultCatalogId]);

  // Find selected catalogue item based on type and duration
  const currentCatalogItem: RoomPricingOption = React.useMemo(() => {
    if (selectedType === 'group_perm') {
      return ROOM_CATALOGUE.find((c) => c.id === 'group_perm') || ROOM_CATALOGUE[6];
    }
    if (selectedType === 'duo_perm') {
      return ROOM_CATALOGUE.find((c) => c.id === 'duo_perm') || ROOM_CATALOGUE[13];
    }
    if (selectedType === 'duo_temp') {
      return (
        ROOM_CATALOGUE.find((c) => c.roomType === 'duo_temp' && c.durationMinutes === selectedMinutes) ||
        ROOM_CATALOGUE[8]
      );
    }
    // Default: group_temp
    return (
      ROOM_CATALOGUE.find((c) => c.roomType === 'group_temp' && c.durationMinutes === selectedMinutes) ||
      ROOM_CATALOGUE[1]
    );
  }, [selectedType, selectedMinutes]);

  // Available duration options for temporary rooms
  const DURATION_LIST = [
    { minutes: 30, label: '30 Minutos', price: 'R$ 0,90' },
    { minutes: 60, label: '1 Hora', price: 'R$ 1,50' },
    { minutes: 120, label: '2 Horas', price: 'R$ 2,50' },
    { minutes: 240, label: '4 Horas', price: 'R$ 4,00' },
    { minutes: 720, label: '12 Horas', price: 'R$ 6,00' },
    { minutes: 1440, label: '24 Horas', price: 'R$ 10,00' },
  ];

  if (!isOpen) return null;

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setOrderError(null);

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogId: currentCatalogItem.id,
          customerName: customerName.trim() || 'Cliente Anônimo',
          desiredRoomName: desiredRoomName.trim() || undefined,
          desiredPasscode: desiredPasscode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar solicitação de compra.');
      }

      setActiveOrder(data.order);
      setWhatsappProofMsg(data.whatsappProofMessage);
      setStep('pay');
    } catch (err: any) {
      setOrderError(err.message || 'Falha na conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopiedPix(true);
    setHasCopiedPixAtLeastOnce(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleCopyMsg = () => {
    if (!whatsappProofMsg) return;
    navigator.clipboard.writeText(whatsappProofMsg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 3000);
  };

  const checkOrderStatus = async () => {
    if (!activeOrder) return;
    setIsCheckingStatus(true);
    try {
      const res = await fetch(`/api/purchase-orders/${activeOrder.id}`);
      if (res.ok) {
        const updated = await res.json();
        setActiveOrder(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappProofMsg)}`;

  return (
    <div
      id="buy-room-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="buy-room-modal-content"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-3xl border border-emerald-500/30 bg-slate-900/95 text-slate-100 shadow-2xl shadow-emerald-950/40 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[92vh]"
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-inner shrink-0">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Comprar Sala Privada
                </h2>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
                  Pix Imediato
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {step === 'select'
                  ? 'Escolha o tipo de sala, tempo e veja o valor'
                  : 'Realize o pagamento via Pix e envie o comprovante'}
              </p>
            </div>
          </div>

          <button
            id="close-buy-modal-btn"
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {step === 'select' && (
            <form onSubmit={handleCreateOrder} className="space-y-6">
              {/* 1. Escolha o Tipo de Sala */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                  1. Escolha o Tipo de Sala:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Sala de Grupo Temporária */}
                  <button
                    type="button"
                    onClick={() => setSelectedType('group_temp')}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all ${
                      selectedType === 'group_temp'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-sm text-white">
                        <Users className="h-4 w-4 text-emerald-400" />
                        <span>Sala de Grupo</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                        Temporária
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2">
                      Até 10 pessoas por sala com contagem regressiva.
                    </p>
                    <div className="mt-auto text-xs font-bold text-emerald-400">
                      A partir de R$ 0,90
                    </div>
                  </button>

                  {/* Sala de Grupo Permanente */}
                  <button
                    type="button"
                    onClick={() => setSelectedType('group_perm')}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all ${
                      selectedType === 'group_perm'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-sm text-white">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span>Sala de Grupo</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        Permanente
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2">
                      Até 10 pessoas. Sem expiração (não expira).
                    </p>
                    <div className="mt-auto text-xs font-bold text-emerald-400">
                      R$ 15,90 (Único)
                    </div>
                  </button>

                  {/* Sala Dupla Temporária */}
                  <button
                    type="button"
                    onClick={() => setSelectedType('duo_temp')}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all ${
                      selectedType === 'duo_temp'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-sm text-white">
                        <Users className="h-4 w-4 text-cyan-400" />
                        <span>Sala Dupla (1x1)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                        Temporária
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2">
                      Sala exclusiva para 2 participantes com link e senha privativa.
                    </p>
                    <div className="mt-auto text-xs font-bold text-cyan-400">
                      A partir de R$ 0,90
                    </div>
                  </button>

                  {/* Sala Dupla Permanente */}
                  <button
                    type="button"
                    onClick={() => setSelectedType('duo_perm')}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all ${
                      selectedType === 'duo_perm'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-sm text-white">
                        <ShieldCheck className="h-4 w-4 text-cyan-400" />
                        <span>Sala Dupla (1x1)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                        Permanente
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2">
                      2 participantes. Sem expiração (vitalícia).
                    </p>
                    <div className="mt-auto text-xs font-bold text-cyan-400">
                      R$ 19,90 (Único)
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Se for Temporária: Escolha a Duração */}
              {(selectedType === 'group_temp' || selectedType === 'duo_temp') && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      2. Escolha o Tempo de Duração:
                    </label>
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      Contagem regressiva em tempo real
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {DURATION_LIST.map((d) => (
                      <button
                        key={d.minutes}
                        type="button"
                        onClick={() => setSelectedMinutes(d.minutes)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                          selectedMinutes === d.minutes
                            ? 'border-emerald-500 bg-emerald-500/20 text-white font-bold ring-1 ring-emerald-500/40 shadow-sm'
                            : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-semibold">{d.label}</span>
                        <span className="text-sm font-extrabold text-emerald-400 mt-1">
                          {d.price}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Dados Opcionais da Sala */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Personalização da Sala (Opcional):</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Seu Nome ou Pseudônimo:
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Marcos (ou em branco)"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base sm:text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Nome Desejado para a Sala:
                    </label>
                    <input
                      type="text"
                      value={desiredRoomName}
                      onChange={(e) => setDesiredRoomName(e.target.value)}
                      placeholder="Ex: Bate-Papo VIP"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base sm:text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Box de Resumo da Compra & Valor Requisitado */}
              <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-900 p-4 shadow-lg shadow-emerald-950/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Item Selecionado
                    </span>
                    <h3 className="text-sm font-black text-white">
                      {currentCatalogItem.title}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Duração: <strong>{currentCatalogItem.durationLabel}</strong> • {currentCatalogItem.badge}
                    </p>
                  </div>

                  <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Valor do Pagamento Requisitado:
                    </span>
                    <span className="text-2xl font-black text-emerald-400">
                      {currentCatalogItem.priceFormatted}
                    </span>
                  </div>
                </div>
              </div>

              {orderError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}

              {/* Botão de Avançar para Pagamento */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-emerald-950/60 transition-all active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Gerando Pedido Pix...</span>
                  </>
                ) : (
                  <>
                    <span>Pagar {currentCatalogItem.priceFormatted} via Pix</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'pay' && activeOrder && (
            <div className="space-y-6 animate-fade-in">
              {/* Mensagem Destacada com o Tipo de Sala e Valor Requisitado */}
              <div className="rounded-2xl border border-emerald-500/40 bg-slate-950/80 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold uppercase text-emerald-400">
                      Pedido #{activeOrder.id} Criado com Sucesso
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Aguardando Pagamento Pix
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tipo de Sala Solicitada:</span>
                    <strong className="text-white text-sm">{activeOrder.roomTitle}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Duração Escolhida:</span>
                    <strong className="text-emerald-300 text-sm">{activeOrder.durationLabel}</strong>
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                      Valor do Pagamento Requisitado:
                    </span>
                    <div className="text-xl font-black text-emerald-300">
                      {activeOrder.priceFormatted}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 text-right">
                    Pagamento via Pix<br />Chave Única Oficial
                  </span>
                </div>
              </div>

              {/* Chave Pix e Opção de Copiar */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Chave Pix para Pagamento:
                  </span>
                  <span className="text-[10px] text-slate-500">Chave Aleatória / UUID</span>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <code className="flex-1 font-mono text-xs text-emerald-400 break-all select-all">
                    {PIX_KEY}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shrink-0 active:scale-95"
                  >
                    {copiedPix ? (
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

                {copiedPix && (
                  <p className="text-[11px] text-emerald-400 font-semibold animate-fade-in flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Chave Pix copiada para a área de transferência! Cole no aplicativo do seu banco para pagar.
                  </p>
                )}
              </div>

              {/* Opção "Enviar Comprovante" com Acesso ao WhatsApp */}
              <div
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 transition-all ${
                  hasCopiedPixAtLeastOnce
                    ? 'border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-500/40 shadow-lg'
                    : 'border-slate-800 bg-slate-950/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Enviar Comprovante de Pagamento
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Após realizar o Pix, envie o comprovante no WhatsApp com o texto já pronto sobre o item adquirido:
                    </p>
                  </div>
                </div>

                {/* Prévia da Mensagem Pronta */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {whatsappProofMsg}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  {/* Botão de Enviar no WhatsApp */}
                  <a
                    id="send-proof-whatsapp-btn"
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/50 transition-all active:scale-98 cursor-pointer"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Enviar Comprovante no WhatsApp</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                  </a>

                  {/* Botão de Copiar Texto da Mensagem */}
                  <button
                    type="button"
                    onClick={handleCopyMsg}
                    className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all shrink-0"
                  >
                    {copiedMsg ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Texto Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar Texto</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status do Pedido: Verificação / Sala Liberada */}
              {activeOrder.status === 'approved' && activeOrder.approvedRoomLink ? (
                <div className="rounded-2xl border border-emerald-500 bg-emerald-950/40 p-4 sm:p-5 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span>Pagamento Aprovado! Sua sala já foi criada!</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    O dono já aprovou o seu pagamento e liberou o seu acesso exclusivo:
                  </p>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Link da sua Sala:</span>
                      <a
                        href={activeOrder.approvedRoomLink}
                        className="text-emerald-400 underline font-semibold break-all"
                      >
                        {activeOrder.approvedRoomLink}
                      </a>
                    </div>
                    {activeOrder.approvedPasscode && (
                      <div>
                        <span className="text-slate-400 block text-[10px]">Senha Mestre de Acesso:</span>
                        <strong className="text-white font-mono text-sm">
                          {activeOrder.approvedPasscode}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {onDirectEnterRoom && activeOrder.approvedRoomId && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onDirectEnterRoom(activeOrder.approvedRoomId!);
                        }}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                      >
                        Entrar na Sala Agora
                      </button>
                    )}
                    <a
                      href={activeOrder.approvedRoomLink}
                      className="py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <span>Abrir Link</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/40 text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <RefreshCw className={`h-3.5 w-3.5 ${isCheckingStatus ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Status: Aguardando aprovação do dono no painel...</span>
                  </div>
                  <button
                    type="button"
                    onClick={checkOrderStatus}
                    disabled={isCheckingStatus}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                  >
                    Verificar Agora
                  </button>
                </div>
              )}

              {/* Voltar para Escolha */}
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  ← Alterar plano ou dados da sala
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

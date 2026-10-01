import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Clock,
  PlusCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Users,
  Timer,
  Trash2,
  ShieldAlert,
  KeyRound,
  RefreshCw,
  MessageCircle,
  LogIn,
  Layers,
  Sparkles,
  Tag,
  ArrowRight,
  Shield,
  HelpCircle,
  ShoppingBag,
  Send,
  CheckCircle2,
  QrCode,
} from 'lucide-react';
import { OwnerVoucher, OwnerRoomInfo, RoomType, PurchaseOrder, CompraOrdem } from '../types';
import {
  getComprasAdmin,
  aprovarCompraPixAdmin,
  cancelarCompraAdmin,
  deletarCompraAdmin,
} from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onActivateVoucherClientSide?: (token: string) => void;
  onRoomsChanged?: () => void;
  onEnterRoomDirectly?: (room: any, accessKey: string) => void;
}

const DURATION_PRESETS = [
  { label: '30 Minutos', minutes: 30 },
  { label: '1 Hora (60m)', minutes: 60 },
  { label: '2 Horas (120m)', minutes: 120 },
  { label: '4 Horas (240m)', minutes: 240 },
  { label: '12 Horas (720m)', minutes: 720 },
  { label: '24 Horas (1440m)', minutes: 1440 },
];

interface RoomOptionConfig {
  type: RoomType;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  capacityText: string;
  isPermanent: boolean;
  hasMultiChat: boolean;
  icon: React.ElementType;
}

const ROOM_OPTIONS: RoomOptionConfig[] = [
  {
    type: 'group_temp',
    title: 'Sala de Grupo (Temporária)',
    badge: '10 Pessoas • Temporária',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    description: 'Sala de bate-papo em grupo com limite de 10 participantes e contagem regressiva de tempo.',
    capacityText: 'Até 10 pessoas simultâneas',
    isPermanent: false,
    hasMultiChat: false,
    icon: Users,
  },
  {
    type: 'group_perm',
    title: 'Sala de Grupo (Permanente)',
    badge: '10 Pessoas • Permanente',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    description: 'Sala de bate-papo em grupo com limite de 10 participantes, sem limite de tempo (não expira).',
    capacityText: 'Até 10 pessoas simultâneas',
    isPermanent: true,
    hasMultiChat: false,
    icon: ShieldCheck,
  },
  {
    type: 'duo_temp',
    title: 'Sala Dupla (Temporária)',
    badge: '2 Pessoas • Temporária',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    description: 'Sala exclusiva para 2 pessoas com contagem regressiva de tempo.',
    capacityText: 'Até 2 pessoas simultâneas',
    isPermanent: false,
    hasMultiChat: false,
    icon: Clock,
  },
  {
    type: 'duo_perm',
    title: 'Sala Dupla (Permanente)',
    badge: '2 Pessoas • Permanente',
    badgeColor: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
    description: 'Sala exclusiva para 2 pessoas, permanente (sem expiração).',
    capacityText: 'Até 2 pessoas simultâneas',
    isPermanent: true,
    hasMultiChat: false,
    icon: ShieldCheck,
  },
];

export const OwnerAdminModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onRoomsChanged,
  onEnterRoomDirectly,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Active view tab: 'orders' | 'generate' | 'vouchers' | 'rooms'
  const [activeTab, setActiveTab] = useState<'orders' | 'generate' | 'vouchers' | 'rooms'>('orders');

  // Orders, Rooms and Vouchers data
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [supabaseCompras, setSupabaseCompras] = useState<CompraOrdem[]>([]);
  const [isApprovingOrderId, setIsApprovingOrderId] = useState<string | null>(null);
  const [isApprovingSupabaseId, setIsApprovingSupabaseId] = useState<string | null>(null);
  const [isDeletingOrderId, setIsDeletingOrderId] = useState<string | null>(null);
  const [deliveryModalData, setDeliveryModalData] = useState<{
    order: PurchaseOrder;
    shareUrl: string;
    whatsappDeliveryMessage: string;
  } | null>(null);

  const [ownerRooms, setOwnerRooms] = useState<OwnerRoomInfo[]>([]);
  const [vouchers, setVouchers] = useState<(OwnerVoucher & { activationUrl?: string; roomDirectUrl?: string })[]>([]);
  const [loading, setLoading] = useState(false);

  // Link Generation Form State
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType>('group_temp');
  const [ownerNote, setOwnerNote] = useState('');
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Generated Link Result
  const [lastGeneratedVoucher, setLastGeneratedVoucher] = useState<{
    voucher: OwnerVoucher;
    activationUrl: string;
  } | null>(null);

  // Copy Feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsAppMsg, setCopiedWhatsAppMsg] = useState(false);

  // Deletion Dialog State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'voucher' | 'room';
    id: string;
    name: string;
    timeLeft?: string;
  } | null>(null);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // PIX Order Deletion Dialog State
  const [orderToDelete, setOrderToDelete] = useState<{
    id: string;
    roomTitle: string;
    status: string;
  } | null>(null);

  // Check saved session
  useEffect(() => {
    const saved = sessionStorage.getItem('anonqr_owner_auth');
    if (saved === 'true') {
      setIsAuthenticated(true);
      const savedKey = sessionStorage.getItem('anonqr_owner_key');
      if (savedKey) setPasswordInput(savedKey);
    }
  }, []);

  // Fetch rooms, vouchers, orders and supabase purchases
  const refreshAllData = async () => {
    setLoading(true);
    try {
      const authKey = passwordInput || sessionStorage.getItem('anonqr_owner_key') || '8090';
      const [roomsRes, vouchersRes, ordersRes, sCompras] = await Promise.all([
        fetch('/api/owner/rooms', { headers: { 'x-owner-key': authKey } }),
        fetch('/api/owner/vouchers', { headers: { 'x-owner-key': authKey } }),
        fetch('/api/owner/purchase-orders', { headers: { 'x-owner-key': authKey } }),
        getComprasAdmin(authKey),
      ]);

      if (roomsRes.ok) {
        const rData = await roomsRes.json();
        if (Array.isArray(rData)) {
          const seen = new Set<string>();
          const deduped = rData.filter((r: any) => {
            if (!r || !r.id || seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
          setOwnerRooms(deduped);
        }
      }
      if (vouchersRes.ok) {
        const vData = await vouchersRes.json();
        setVouchers(vData);
      }
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData);
      }
      if (Array.isArray(sCompras)) {
        setSupabaseCompras(sCompras);
      }
    } catch (e) {
      console.error('Error fetching admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      refreshAllData();
    }
  }, [isOpen, isAuthenticated]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    try {
      const res = await fetch('/api/owner/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.authenticated) {
        setIsAuthenticated(true);
        sessionStorage.setItem('anonqr_owner_auth', 'true');
        sessionStorage.setItem('anonqr_owner_key', passwordInput.trim());
        refreshAllData();
      } else {
        setAuthError(data.error || 'Senha de acesso incorreta.');
      }
    } catch (err: any) {
      setAuthError('Erro ao comunicar com o servidor.');
    }
  };

  // Generate Link for Client to configure room name & password
  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerateError(null);
    setIsGenerating(true);

    const activeOption = ROOM_OPTIONS.find((o) => o.type === selectedRoomType) || ROOM_OPTIONS[0];
    const isPermanent = activeOption.isPermanent;
    let duration = 60;

    if (!isPermanent) {
      duration = customMinutes ? parseInt(customMinutes, 10) : selectedMinutes;
      if (isNaN(duration) || duration < 1) {
        setGenerateError('Por favor informe uma duração válida.');
        setIsGenerating(false);
        return;
      }
    } else {
      duration = 0;
    }

    const note = ownerNote.trim() || `Sala ${activeOption.title} (#${Math.floor(100 + Math.random() * 900)})`;

    try {
      const authKey = passwordInput || sessionStorage.getItem('anonqr_owner_key') || '8090';
      const res = await fetch('/api/owner/vouchers/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-key': authKey,
        },
        body: JSON.stringify({
          label: note,
          roomType: selectedRoomType,
          durationMinutes: duration,
          isPermanent,
        }),
      });

      const data = await res.json();
      if (res.ok && data.voucher) {
        const activationUrl = `${window.location.origin}/?voucher=${encodeURIComponent(data.voucher.token)}`;
        setLastGeneratedVoucher({
          voucher: data.voucher,
          activationUrl,
        });

        setSuccessBanner(`Link gerado com sucesso para "${note}"!`);
        setOwnerNote('');
        refreshAllData();
        onRoomsChanged?.();
      } else {
        setGenerateError(data.error || 'Erro ao gerar o link de acesso.');
      }
    } catch (err: any) {
      console.error('Error generating link:', err);
      setGenerateError('Erro de comunicação com o servidor.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      prompt('Copie o link abaixo:', text);
    }
  };

  const copyWhatsAppVoucherMessage = async (v: {
    label?: string;
    roomType: RoomType;
    durationMinutes: number;
    isPermanent: boolean;
    activationUrl: string;
  }) => {
    const opt = ROOM_OPTIONS.find((o) => o.type === v.roomType) || ROOM_OPTIONS[0];
    const durationText = v.isPermanent
      ? 'Permanente (Sem tempo de expiração)'
      : `${v.durationMinutes} minutos de sessão`;

    const text =
      `*Acesso Liberado - Ativação de Sala de Bate-Papo*\n\n` +
      `Olá! Aqui está o seu link exclusivo para ativar sua sala de bate-papo:\n` +
      `👉 ${v.activationUrl}\n\n` +
      `Ao abrir o link acima, você definirá o *Nome da Sala* e a *Senha de Acesso* para os seus convidados!\n\n` +
      `📋 *Detalhes da sua Sala:*\n` +
      `• Modalidade: *${opt.title}*\n` +
      `• Capacidade: *${opt.capacityText}*\n` +
      `• Duração: *${durationText}*\n\n` +
      `Acesse agora o link para configurar sua sala e começar a conversar.`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsAppMsg(true);
      setTimeout(() => setCopiedWhatsAppMsg(false), 2500);
    } catch (e) {
      prompt('Copie o texto para o WhatsApp:', text);
    }
  };

  const openDeleteConfirm = (
    type: 'voucher' | 'room',
    id: string,
    name: string,
    timeLeft?: string
  ) => {
    setDeleteTarget({ type, id, name, timeLeft });
    setDeletePinInput('');
    setDeleteError(null);
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;

    const pin = deletePinInput.trim();
    if (!pin) {
      setDeleteError('Digite a senha de autorização.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    const authKey = passwordInput || sessionStorage.getItem('anonqr_owner_key') || '8090';

    try {
      const endpoint =
        deleteTarget.type === 'voucher'
          ? `/api/owner/vouchers/${encodeURIComponent(deleteTarget.id)}/delete`
          : `/api/owner/rooms/${encodeURIComponent(deleteTarget.id)}/delete`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-key': authKey,
        },
        body: JSON.stringify({ deletePin: pin }),
      });

      const data = await res.json();
      if (res.ok) {
        setDeleteTarget(null);
        setSuccessBanner(
          deleteTarget.type === 'voucher'
            ? 'Link e sessão vinculada excluídos com sucesso!'
            : 'Sala excluída e participantes desconectados com sucesso!'
        );
        setTimeout(() => setSuccessBanner(null), 5000);
        refreshAllData();
        onRoomsChanged?.();
      } else {
        setDeleteError(data.error || 'Erro ao autorizar exclusão.');
      }
    } catch (e) {
      console.error('Error during deletion:', e);
      setDeleteError('Erro ao comunicar com o servidor durante a exclusão.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApproveOrderAndCreateRoom = async (orderId: string) => {
    setIsApprovingOrderId(orderId);
    try {
      const authKey = passwordInput || sessionStorage.getItem('anonqr_owner_key') || '8090';
      const res = await fetch(`/api/owner/purchase-orders/${encodeURIComponent(orderId)}/approve-and-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-key': authKey,
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessBanner(`Pagamento aprovado e sala criada com sucesso para o pedido #${orderId}!`);
        setTimeout(() => setSuccessBanner(null), 6000);
        setDeliveryModalData({
          order: data.order,
          shareUrl: data.shareUrl,
          whatsappDeliveryMessage: data.whatsappDeliveryMessage,
        });
        refreshAllData();
        onRoomsChanged?.();
      } else {
        alert(data.error || 'Erro ao aprovar e criar sala.');
      }
    } catch (err) {
      console.error('Error approving order:', err);
      alert('Erro de conexão ao aprovar pedido.');
    } finally {
      setIsApprovingOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const authKey = passwordInput || sessionStorage.getItem('anonqr_owner_key') || '8090';
      const res = await fetch(`/api/owner/purchase-orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-key': authKey,
        },
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
        );
        setSuccessBanner(`Solicitação #${orderId} marcada como cancelada.`);
        setTimeout(() => setSuccessBanner(null), 4000);
        refreshAllData();
      }
    } catch (err) {
      console.error('Error cancelling order:', err);
    }
  };

  const handleApproveSupabaseCompra = async (compra: CompraOrdem) => {
    setIsApprovingSupabaseId(compra.id);
    try {
      const authKey = passwordInput || sessionStorage.getItem('anonqr_owner_key') || '8090';
      const result = await aprovarCompraPixAdmin(compra.id, authKey);
      if (result.success) {
        setSuccessBanner(
          `Compra PIX #${compra.id} (Sala: ${compra.sala_id}) APROVADA com sucesso! Status alterado para 'paid'. O cliente já pode acessar a sala em 'Minhas Compras'.`
        );
        setTimeout(() => setSuccessBanner(null), 8000);
        await refreshAllData();
        onRoomsChanged?.();
      } else {
        alert(result.error || 'Erro ao aprovar compra PIX.');
      }
    } catch (err: any) {
      console.error('Erro ao aprovar compra PIX:', err);
      alert(err?.message || 'Erro de conexão ao aprovar compra.');
    } finally {
      setIsApprovingSupabaseId(null);
    }
  };

  const handleCancelSupabaseCompra = async (compraId: string) => {
    try {
      const authKey = passwordInput || sessionStorage.getItem('anonqr_owner_key') || '8090';
      const res = await cancelarCompraAdmin(compraId, authKey);
      if (res.success) {
        setSuccessBanner(`Solicitação de compra #${compraId} marcada como cancelada.`);
        setTimeout(() => setSuccessBanner(null), 4000);
        refreshAllData();
      }
    } catch (err) {
      console.error('Erro ao cancelar compra:', err);
    }
  };

  const handleDeleteSupabaseCompra = async (compraId: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o registro de compra #${compraId} do banco?`)) {
      return;
    }
    try {
      const authKey = passwordInput || sessionStorage.getItem('anonqr_owner_key') || '8090';
      const res = await deletarCompraAdmin(compraId, authKey);
      if (res.success) {
        setSupabaseCompras((prev) => prev.filter((c) => c.id !== compraId));
        setSuccessBanner(`Registro de compra #${compraId} excluído com sucesso.`);
        setTimeout(() => setSuccessBanner(null), 4000);
        refreshAllData();
      } else {
        alert(res.error || 'Erro ao excluir compra no servidor.');
      }
    } catch (err: any) {
      console.error('Erro ao excluir compra:', err);
      alert(err.message || 'Erro inesperado ao excluir compra.');
    }
  };

  const handleDeleteOrder = (orderId: string, roomTitle: string, status?: string) => {
    setOrderToDelete({
      id: orderId,
      roomTitle,
      status: status || 'pending',
    });
  };

  const confirmExecuteDeleteOrder = async () => {
    if (!orderToDelete) return;
    const orderId = orderToDelete.id;

    setIsDeletingOrderId(orderId);
    try {
      const authKey = passwordInput || sessionStorage.getItem('anonqr_owner_key') || '8090';
      const res = await fetch(`/api/owner/purchase-orders/${encodeURIComponent(orderId)}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-key': authKey,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setOrderToDelete(null);
        setSuccessBanner(`Solicitação #${orderId} excluída com sucesso!`);
        setTimeout(() => setSuccessBanner(null), 4500);
        refreshAllData();
        onRoomsChanged?.();
      } else {
        setSuccessBanner(`Aviso: ${data.error || 'Erro ao excluir solicitação.'}`);
        setTimeout(() => setSuccessBanner(null), 4500);
      }
    } catch (e) {
      console.error('Error deleting order:', e);
      setSuccessBanner('Erro de comunicação ao excluir solicitação.');
      setTimeout(() => setSuccessBanner(null), 4500);
    } finally {
      setIsDeletingOrderId(null);
    }
  };

  const formatRemaining = (timeLeftSeconds: number, isPermanent?: boolean) => {
    if (isPermanent) return 'Permanente';
    if (timeLeftSeconds <= 0) return 'Tempo esgotado';
    const mins = Math.floor(timeLeftSeconds / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}h ${mins % 60}m restantes`;
    }
    return `${mins} min restantes`;
  };

  const selectedOptionConfig = ROOM_OPTIONS.find((o) => o.type === selectedRoomType) || ROOM_OPTIONS[0];

  return (
    <div
      id="owner-admin-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
    >
      <div
        id="owner-admin-modal-content"
        className="relative w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  PAINEL DO DONO • GERADOR DE LINKS
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Exclusivo Desenvolvedor
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gere os links de acesso para os clientes criarem o nome e a senha da sala
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setIsAuthenticated(false);
                  setPasswordInput('');
                  sessionStorage.removeItem('anonqr_owner_auth');
                  sessionStorage.removeItem('anonqr_owner_key');
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                title="Sair do painel administrativo"
              >
                Sair
              </button>
            )}
            <button
              id="close-owner-modal-btn"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Fechar painel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {!isAuthenticated ? (
          /* Login Form */
          <div className="p-6 sm:p-8 max-w-md mx-auto w-full space-y-6 my-auto">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-emerald-400 border border-slate-700">
                <Key className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-white">Autenticação do Desenvolvedor</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Digite a senha de segurança do painel para criar os links das salas.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Senha de Acesso do Dono
                </label>
                <input
                  type="password"
                  id="owner-master-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Digite a senha..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                id="btn-login-owner-panel"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                Acessar Painel do Dono
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Success Banner */}
            {successBanner && (
              <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-6 py-2.5 text-xs text-emerald-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{successBanner}</span>
                </div>
                <button
                  onClick={() => setSuccessBanner(null)}
                  className="text-emerald-400 hover:text-white text-xs shrink-0 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* Top Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-5 pt-3 gap-2 overflow-x-auto">
              <div className="flex items-center gap-2">
                <button
                  id="tab-owner-orders-list"
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`pb-3 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer relative ${
                    activeTab === 'orders'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Solicitações PIX ({orders.length + supabaseCompras.length})</span>
                  {(orders.filter((o) => o.status === 'pending').length +
                    supabaseCompras.filter((c) => c.status === 'pending').length) > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse ml-1">
                      {orders.filter((o) => o.status === 'pending').length +
                        supabaseCompras.filter((c) => c.status === 'pending').length}{' '}
                      pendente{orders.filter((o) => o.status === 'pending').length +
                        supabaseCompras.filter((c) => c.status === 'pending').length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>

                <button
                  id="tab-owner-generate-link"
                  type="button"
                  onClick={() => setActiveTab('generate')}
                  className={`pb-3 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'generate'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>+ Gerar Link Manual</span>
                </button>

                <button
                  id="tab-owner-vouchers-list"
                  type="button"
                  onClick={() => setActiveTab('vouchers')}
                  className={`pb-3 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'vouchers'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Timer className="h-3.5 w-3.5" />
                  <span>Links & Salas ({vouchers.length})</span>
                </button>

                <button
                  id="tab-owner-rooms-list"
                  type="button"
                  onClick={() => setActiveTab('rooms')}
                  className={`pb-3 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'rooms'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Salas Ativas ({ownerRooms.length})</span>
                </button>
              </div>

              <button
                onClick={refreshAllData}
                disabled={loading}
                className="mb-2 flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-800/60 transition-colors cursor-pointer"
                title="Atualizar lista"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
              {/* TAB 0: PIX PURCHASE ORDERS */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  {/* Explanatory Banner */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-xs text-emerald-200 flex items-start gap-3 shadow-inner">
                    <ShoppingBag className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-white mb-1">
                        Solicitações de Compra de Salas via Pix:
                      </p>
                      <p className="text-slate-300 leading-relaxed">
                        Quando um cliente escolhe uma sala no catálogo e opta por <strong>"Comprar Sala Via PIX"</strong>, o registro é salvo no banco de dados e aguarda a sua aprovação aqui. Ao clicar em <strong>"Aprovar PIX (Mudar para Paid)"</strong>, o status é alterado para <code>paid</code> e a sala é liberada imediatamente na tela <em>Minhas Compras</em> do cliente!
                      </p>
                    </div>
                  </div>

                  {/* SEÇÃO 1: COMPRAS DE SALAS NO CATÁLOGO (SUPABASE) */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30">
                          <QrCode className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <span>Compras no Catálogo (Supabase)</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                              {supabaseCompras.length} registro{supabaseCompras.length !== 1 ? 's' : ''}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Aprovações manuais de compras via PIX sincronizadas com a tabela <code>public.compras</code>
                          </p>
                        </div>
                      </div>

                      {supabaseCompras.filter((c) => c.status === 'pending').length > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950 animate-pulse self-start sm:self-auto">
                          {supabaseCompras.filter((c) => c.status === 'pending').length} PIX pendente{supabaseCompras.filter((c) => c.status === 'pending').length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {supabaseCompras.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 p-4 space-y-2">
                        <p className="text-xs text-slate-400">
                          Nenhuma compra registrada na tabela <code>public.compras</code> do Supabase até o momento.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {supabaseCompras.map((compra) => {
                          const isPix =
                            compra.metodo_pagamento === 'pix_manual' ||
                            compra.payment_id === 'pix_manual' ||
                            compra.payment_id?.startsWith('pix_manual');
                          const isPending = compra.status === 'pending';
                          const isPaid = compra.status === 'paid';
                          const isApproving = isApprovingSupabaseId === compra.id;

                          return (
                            <div
                              key={compra.id}
                              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                isPending
                                  ? 'border-amber-500/60 bg-slate-900/95 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
                                  : isPaid
                                  ? 'border-emerald-500/40 bg-slate-900/90 shadow-md shadow-emerald-950/20'
                                  : 'border-slate-800 bg-slate-900/50 opacity-60'
                              }`}
                            >
                              {/* Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-xs text-white px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                                    #{compra.id}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {compra.created_at ? new Date(compra.created_at).toLocaleString('pt-BR') : '-'}
                                  </span>
                                  <span
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                      isPix
                                        ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                    }`}
                                  >
                                    {isPix ? 'PIX Manual' : 'Mercado Pago'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isPending && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                                      <Clock className="h-3 w-3" />
                                      <span>Aguardando Aprovação PIX</span>
                                    </span>
                                  )}
                                  {isPaid && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                      <Check className="h-3 w-3" />
                                      <span>Paga / Liberada (paid)</span>
                                    </span>
                                  )}
                                  {compra.status === 'cancelled' && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">
                                      Cancelada
                                    </span>
                                  )}

                                  {/* Excluir */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSupabaseCompra(compra.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 text-xs font-bold transition-all cursor-pointer shadow-sm ml-1"
                                    title="Excluir esta compra do banco"
                                  >
                                    <Trash2 className="h-3 w-3 text-rose-400" />
                                    <span>Excluir</span>
                                  </button>
                                </div>
                              </div>

                              {/* Informações da Sala e Usuário */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                                  <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                                    Sala Contratada:
                                  </span>
                                  <strong className="text-white text-xs font-bold block truncate">
                                    {compra.sala_id}
                                  </strong>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                                  <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                                    ID do Usuário / Comprador:
                                  </span>
                                  <strong className="text-slate-300 text-[11px] font-mono block truncate" title={compra.user_id}>
                                    {compra.user_id}
                                  </strong>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                                  <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                                    Valor da Compra:
                                  </span>
                                  <strong className="text-emerald-400 text-sm font-black block">
                                    R$ {compra.valor.toFixed(2).replace('.', ',')}
                                  </strong>
                                </div>
                              </div>

                              {/* Ações Administrativas */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                                {isPending ? (
                                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    {/* Botão de Aprovação Principal */}
                                    <button
                                      type="button"
                                      id={`btn-aprovar-pix-supabase-${compra.id}`}
                                      onClick={() => handleApproveSupabaseCompra(compra)}
                                      disabled={isApproving}
                                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-emerald-950/60 transition-all cursor-pointer active:scale-98"
                                      title="Aprova o pagamento PIX e altera o status para 'paid' no banco, liberando a sala para o cliente"
                                    >
                                      {isApproving ? (
                                        <>
                                          <RefreshCw className="h-4 w-4 animate-spin" />
                                          <span>Aprovando no Supabase...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="h-4 w-4" />
                                          <span>Aprovar PIX (Mudar para Paid)</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleCancelSupabaseCompra(compra.id)}
                                      className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                                      title="Marcar solicitação como cancelada"
                                    >
                                      Recusar / Cancelar
                                    </button>
                                  </div>
                                ) : isPaid ? (
                                  <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                                        <Check className="h-4 w-4" />
                                        Compra aprovada (status = paid). O cliente tem acesso liberado em Minhas Compras!
                                      </span>
                                    </div>

                                    {onEnterRoomDirectly && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onClose();
                                          window.location.href = `/?room=${encodeURIComponent(compra.sala_id)}`;
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold cursor-pointer"
                                      >
                                        <LogIn className="h-3.5 w-3.5" />
                                        <span>Acessar Sala</span>
                                      </button>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SEÇÃO 2: SOLICITAÇÕES AVULSAS (FORMULÁRIO LEGADO) */}
                  <div className="pt-4 border-t border-slate-800">
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingBag className="h-4 w-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Solicitações de Criação Avulsa via Formulário ({orders.length})
                      </h4>
                    </div>
                  </div>

                  {/* Orders List */}
                  {orders.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-800 rounded-3xl bg-slate-900/40 p-6 space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 border border-slate-700">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Nenhum Pedido Recebido</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Quando os usuários utilizarem a opção de comprar sala via Pix na tela inicial, as solicitações com o valor e os requisitos aparecerão aqui em tempo real.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => {
                        const isPending = order.status === 'pending';
                        const isApproved = order.status === 'approved';
                        const isApproving = isApprovingOrderId === order.id;

                        return (
                          <div
                            key={order.id}
                            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                              isPending
                                ? 'border-amber-500/50 bg-slate-900/95 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
                                : isApproved
                                ? 'border-emerald-500/40 bg-slate-900/90 shadow-md shadow-emerald-950/20'
                                : 'border-slate-800 bg-slate-900/50 opacity-60'
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-xs text-white px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                                  #{order.id}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {new Date(order.createdAt).toLocaleString('pt-BR')}
                                </span>
                                {order.customerName && (
                                  <span className="text-xs font-semibold text-slate-300">
                                    • Cliente: <strong className="text-white">{order.customerName}</strong>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {isPending && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                                    <Clock className="h-3 w-3" />
                                    <span>Aguardando Pagamento Pix</span>
                                  </span>
                                )}
                                {isApproved && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <Check className="h-3 w-3" />
                                    <span>Pagamento Aprovado & Sala Criada</span>
                                  </span>
                                )}
                                {order.status === 'cancelled' && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">
                                    Cancelado
                                  </span>
                                )}

                                {/* Botão Excluir Pedido / Sala */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOrder(order.id, order.roomTitle, order.status)}
                                  disabled={isDeletingOrderId === order.id}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 text-xs font-bold transition-all cursor-pointer shadow-sm ml-1"
                                  title="Excluir esta solicitação do sistema"
                                >
                                  {isDeletingOrderId === order.id ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 animate-spin text-rose-400" />
                                      <span>Excluindo...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-3 w-3 text-rose-400" />
                                      <span>Excluir</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Client Requirements & Payment Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 py-3 text-xs">
                              {/* Room Type */}
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                                <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                                  Tipo de Sala Solicitada:
                                </span>
                                <strong className="text-white text-xs font-bold block truncate">
                                  {order.roomTitle}
                                </strong>
                                <span className="text-[10px] text-emerald-400">
                                  {order.roomType?.startsWith('duo_') ? 'Sala Dupla (2 Pessoas)' : 'Sala de Grupo (10 Pessoas)'}
                                </span>
                              </div>

                              {/* Duration */}
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                                <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                                  Duração Requisitada:
                                </span>
                                <strong className="text-white text-xs font-bold block">
                                  {order.durationLabel}
                                </strong>
                                <span className="text-[10px] text-slate-400">
                                  {order.isPermanent ? 'Sem Expiração' : `${order.durationMinutes} Minutos`}
                                </span>
                              </div>

                              {/* Desired Name / Password */}
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                                <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                                  Personalização Desejada:
                                </span>
                                <div className="truncate text-slate-200">
                                  Nome: <strong>{order.desiredRoomName || 'Padrão'}</strong>
                                </div>
                                <div className="text-[11px] text-amber-300 font-mono">
                                  Senha: {order.desiredPasscode || 'Gerar aleatória'}
                                </div>
                              </div>

                              {/* Required Price */}
                              <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
                                <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">
                                  Valor Requisitado:
                                </span>
                                <div className="text-lg font-black text-emerald-300">
                                  {order.priceFormatted}
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  Chave: 1e74e...bc3
                                </span>
                              </div>
                            </div>

                            {/* Actions & Deliveries */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                              {isPending ? (
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                  {/* Botão Principal: Pagamento Aprovado e Criar Sala */}
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOrderAndCreateRoom(order.id)}
                                    disabled={isApproving}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-emerald-950/60 transition-all cursor-pointer active:scale-98"
                                    title="Aprova o pagamento e cria a sala conforme os requisitos solicitados"
                                  >
                                    {isApproving ? (
                                      <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        <span>Criando Sala...</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>Pagamento Aprovado & Criar Sala</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCancelOrder(order.id)}
                                    className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                                    title="Marcar solicitação como cancelada"
                                  >
                                    Recusar / Cancelar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order.id, order.roomTitle, order.status)}
                                    disabled={isDeletingOrderId === order.id}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 text-xs font-bold transition-all cursor-pointer"
                                    title="Excluir esta solicitação pendente do sistema"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                    <span>Excluir Solicitação</span>
                                  </button>
                                </div>
                              ) : isApproved ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Link da Sala */}
                                    {order.approvedRoomLink && (
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(order.approvedRoomLink!)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                                      >
                                        <Copy className="h-3.5 w-3.5 text-emerald-400" />
                                        <span>Copiar Link da Sala</span>
                                      </button>
                                    )}

                                    {/* Enviar no WhatsApp */}
                                    <a
                                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                        `🎉 *PAGAMENTO APROVADO! SUA SALA ESTÁ PRONTA* 🎉\n\nOlá *${order.customerName || 'Cliente'}*! Confirmamos o seu pagamento Pix de *${order.priceFormatted}* referente ao pedido *#${order.id}*.\n\n📋 *Sua Sala Privada:*\n• *Tipo:* ${order.roomTitle}\n• *Duração:* ${order.durationLabel}\n\n🔗 *Link de Acesso:*\n${order.approvedRoomLink}\n\n🔑 *Senha de Acesso:* ${order.approvedPasscode || 'Acesso Direto'}\n\nBom proveito!`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5" />
                                      <span>Enviar no WhatsApp</span>
                                      <ExternalLink className="h-3 w-3 opacity-80" />
                                    </a>

                                    {/* Entrar na Sala */}
                                    {onEnterRoomDirectly && order.approvedRoomId && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const matched = ownerRooms.find((r) => r.id === order.approvedRoomId);
                                          if (matched) {
                                            onClose();
                                            onEnterRoomDirectly(matched, matched.accessKey || '');
                                          } else {
                                            window.location.href = `/?room=${order.approvedRoomId}`;
                                          }
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold cursor-pointer"
                                      >
                                        <LogIn className="h-3.5 w-3.5" />
                                        <span>Entrar na Sala</span>
                                      </button>
                                    )}

                                    {/* Excluir Sala & Pedido */}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOrder(order.id, order.roomTitle, order.status)}
                                      disabled={isDeletingOrderId === order.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold cursor-pointer"
                                      title="Excluir esta sala e a solicitação permanentemente"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                      <span>Excluir Sala</span>
                                    </button>
                                  </div>

                                  <span className="text-[11px] text-slate-400 font-mono">
                                    Senha: {order.approvedPasscode}
                                  </span>
                                </div>
                              ) : order.status === 'cancelled' ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 w-full pt-1">
                                  <span className="text-[11px] text-slate-400">
                                    Solicitação com status cancelado.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order.id, order.roomTitle, order.status)}
                                    disabled={isDeletingOrderId === order.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 text-xs font-bold transition-colors cursor-pointer"
                                    title="Excluir solicitação definitivamente"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                    <span>Excluir Definitivamente</span>
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 1: GENERATE LINK FOR CLIENT */}
              {activeTab === 'generate' && (
                <div className="space-y-6">
                  {/* Explanatory Policy Notice */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200 flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-300 mb-0.5">
                        Fluxo de Geração de Links para Clientes:
                      </p>
                      <p className="text-slate-300 leading-relaxed">
                        Você gera o link exclusivo aqui. Ao abrir o link, <strong>quem acessa define o Nome da Sala e a Senha da Sala</strong> para os convidados. O identificador que você definir abaixo permite que você saiba exatamente de quem é a sala no seu painel!
                      </p>
                    </div>
                  </div>

                  {/* Result Box (if recently generated) */}
                  {lastGeneratedVoucher && (
                    <div className="rounded-3xl border-2 border-emerald-500/60 bg-emerald-950/30 p-5 space-y-4 shadow-xl shadow-emerald-950/30 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                            <Check className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              <span>Link Gerado com Sucesso!</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                {lastGeneratedVoucher.voucher.label || 'Sem Identificador'}
                              </span>
                            </h4>
                            <p className="text-[11px] text-emerald-300">
                              Status: Aguardando o cliente abrir o link e definir Nome & Senha
                            </p>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 text-slate-300 border border-slate-700">
                          {ROOM_OPTIONS.find((o) => o.type === lastGeneratedVoucher.voucher.roomType)?.badge}
                        </span>
                      </div>

                      {/* Direct Activation URL Input */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Link Exclusivo de Ativação (Envie para o Cliente):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={lastGeneratedVoucher.activationUrl}
                            className="flex-1 rounded-xl border border-emerald-500/40 bg-slate-950 px-3 py-2 text-xs font-mono text-emerald-300 select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(lastGeneratedVoucher.activationUrl)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          >
                            {copiedLink ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Ready-to-Send WhatsApp Text */}
                      <div className="pt-2 border-t border-emerald-500/20">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                            Mensagem Formatada com Instruções para WhatsApp
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyWhatsAppVoucherMessage({
                                label: lastGeneratedVoucher.voucher.label,
                                roomType: lastGeneratedVoucher.voucher.roomType,
                                durationMinutes: lastGeneratedVoucher.voucher.durationMinutes,
                                isPermanent: lastGeneratedVoucher.voucher.isPermanent,
                                activationUrl: lastGeneratedVoucher.activationUrl,
                              })
                            }
                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline decoration-emerald-500/40 cursor-pointer flex items-center gap-1"
                          >
                            {copiedWhatsAppMsg ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedWhatsAppMsg ? 'Copiado para WhatsApp!' : 'Copiar Texto Completo'}</span>
                          </button>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-line leading-relaxed">
                          {`*Acesso Liberado - Ativação de Sala de Bate-Papo*

Olá! Aqui está o seu link exclusivo para ativar sua sala de bate-papo:
👉 ${lastGeneratedVoucher.activationUrl}

Ao abrir o link acima, você definirá o *Nome da Sala* e a *Senha de Acesso* para os seus convidados!

📋 *Detalhes da sua Sala:*
• Modalidade: *${ROOM_OPTIONS.find((o) => o.type === lastGeneratedVoucher.voucher.roomType)?.title}*
• Capacidade: *${ROOM_OPTIONS.find((o) => o.type === lastGeneratedVoucher.voucher.roomType)?.capacityText}*
• Duração: *${lastGeneratedVoucher.voucher.isPermanent ? 'Permanente (Sem expiração)' : `${lastGeneratedVoucher.voucher.durationMinutes} minutos`}*

Acesse o link acima para configurar e começar a conversar.`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form to generate link */}
                  <form onSubmit={handleGenerateLink} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-800/40 p-5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <PlusCircle className="h-4 w-4 text-emerald-400" />
                          Configurar Novo Link de Sala
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Escolha o formato da sala e atribua um identificador para o seu controle.
                        </p>
                      </div>
                    </div>

                    {generateError && (
                      <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{generateError}</span>
                      </div>
                    )}

                    {/* Step 1: Select Room Format */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold">1</span>
                        Selecione o Tipo de Sala / Link:
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {ROOM_OPTIONS.map((opt) => {
                          const isSelected = selectedRoomType === opt.type;
                          const IconComp = opt.icon;
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => setSelectedRoomType(opt.type)}
                              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/30 shadow-md'
                                  : 'border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-400'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`p-1.5 rounded-xl border ${
                                      isSelected
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}
                                  >
                                    <IconComp className="h-4 w-4" />
                                  </div>
                                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                    {opt.title}
                                  </span>
                                </div>

                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${opt.badgeColor}`}>
                                  {opt.badge}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {opt.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: Owner Note / Identifier */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold">2</span>
                          Identificador do Dono (Para você saber que sala é essa):
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">Opcional</span>
                      </label>
                      <input
                        type="text"
                        value={ownerNote}
                        onChange={(e) => setOwnerNote(e.target.value)}
                        placeholder="Ex: Cliente João - WhatsApp, Contrato Duo #12, Amigos da Empresa..."
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Esta nota aparece exclusivamente no seu painel para você identificar de quem é o link mesmo depois que o cliente criar o nome e senha da sala.
                      </p>
                    </div>

                    {/* Step 3: Duration (Only for temporary rooms) */}
                    {!selectedOptionConfig.isPermanent ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold">3</span>
                          Duração da Sessão Temporizada:
                        </label>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                          {DURATION_PRESETS.map((preset) => (
                            <button
                              key={preset.minutes}
                              type="button"
                              onClick={() => {
                                setSelectedMinutes(preset.minutes);
                                setCustomMinutes('');
                              }}
                              className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer ${
                                selectedMinutes === preset.minutes && !customMinutes
                                  ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300 font-bold shadow-sm'
                                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-slate-400 whitespace-nowrap">Ou minutos personalizados:</span>
                          <input
                            type="number"
                            min="1"
                            max="43200"
                            placeholder="Ex: 45"
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(e.target.value)}
                            className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                          <span className="text-xs text-slate-500">minutos</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-3 flex items-center gap-2.5 text-xs text-emerald-300">
                        <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Esta modalidade é <strong>Permanente</strong> (não possui tempo de expiração).</span>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      id="btn-owner-generate-client-link"
                      type="submit"
                      disabled={isGenerating}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Gerando Link Exclusivo...</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-4 w-4" />
                          <span>Gerar Link de Acesso para o Cliente</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: VOUCHERS / CLIENTS LINKS & CREATED ROOMS */}
              {activeTab === 'vouchers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Timer className="h-4 w-4 text-emerald-400" />
                        Links Emitidos & Salas Configuradas pelos Clientes
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Veja o nome da sala e a senha escolhidos por quem recebeu o link, além dos participantes online.
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveTab('generate')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      <span>Novo Link</span>
                    </button>
                  </div>

                  {loading ? (
                    <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                      <span>Carregando links e salas de clientes...</span>
                    </div>
                  ) : vouchers.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400 space-y-3">
                      <p>Nenhum link emitido ainda.</p>
                      <button
                        onClick={() => setActiveTab('generate')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Gerar Primeiro Link para Cliente
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {vouchers.map((v) => {
                        const actUrl = v.activationUrl || `${window.location.origin}/?voucher=${encodeURIComponent(v.token)}`;
                        const opt = ROOM_OPTIONS.find((o) => o.type === v.roomType) || ROOM_OPTIONS[0];

                        const isConfigured = v.status === 'active' && !!v.usedByRoomId;
                        const isPending = v.status === 'available';

                        return (
                          <div
                            key={v.token}
                            className={`p-4 rounded-2xl border transition-all ${
                              isConfigured
                                ? 'border-emerald-500/40 bg-slate-900/90 shadow-md shadow-emerald-950/20'
                                : 'border-slate-800 bg-slate-900/60'
                            }`}
                          >
                            {/* Top row: Owner Identifier + Status Badge */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-1.5 font-bold text-xs text-white">
                                  <Tag className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>{v.label || 'Sem Identificador'}</span>
                                </span>

                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${opt.badgeColor}`}>
                                  {opt.badge}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {isPending && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>Aguardando Cliente Configurar</span>
                                  </span>
                                )}

                                {isConfigured && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <Check className="h-3 w-3" />
                                    <span>Sala Ativada pelo Cliente</span>
                                  </span>
                                )}

                                {v.status === 'expired' && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                    Sessão Expirada
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Middle row: Client Room Name & Password Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 py-3 text-xs">
                              {/* Room Name */}
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                                <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                                  Nome Definido pelo Cliente:
                                </span>
                                {v.roomName ? (
                                  <strong className="text-white text-xs font-bold block truncate">
                                    {v.roomName}
                                  </strong>
                                ) : (
                                  <span className="text-slate-500 italic text-[11px]">
                                    Ainda não definido
                                  </span>
                                )}
                              </div>

                              {/* Passcode */}
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                                <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                                  Senha Definida pelo Cliente:
                                </span>
                                {v.creatorPasscode ? (
                                  <span className="font-mono font-bold text-amber-300 text-xs flex items-center gap-1">
                                    <KeyRound className="h-3 w-3 text-amber-400" />
                                    {v.creatorPasscode}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic text-[11px]">
                                    Ainda não definida
                                  </span>
                                )}
                              </div>

                              {/* Participants & Duration */}
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                                <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                                  Online / Duração:
                                </span>
                                <div className="flex items-center justify-between">
                                  <span className="text-emerald-400 font-bold">
                                    {v.roomOnlineCount || 0} / {v.maxParticipants || 10} pessoas
                                  </span>
                                  <span className="text-slate-400 text-[11px]">
                                    {v.isPermanent ? 'Permanente' : `${v.durationMinutes}m`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Bottom row: Action Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                              <div className="flex items-center gap-2">
                                {/* If active: Enter directly as Owner */}
                                {isConfigured && onEnterRoomDirectly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const matchedRoom = ownerRooms.find((r) => r.id === v.usedByRoomId);
                                      if (matchedRoom) {
                                        onClose();
                                        onEnterRoomDirectly(matchedRoom, matchedRoom.accessKey || '');
                                      } else {
                                        window.location.href = `/?room=${v.usedByRoomId}`;
                                      }
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
                                    title="Entrar na sala agora como dono"
                                  >
                                    <LogIn className="h-3.5 w-3.5" />
                                    <span>Entrar na Sala</span>
                                  </button>
                                )}

                                {/* Copy Activation Link or Direct URL */}
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(v.roomDirectUrl || actUrl)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                                  title="Copiar link"
                                >
                                  <Copy className="h-3 w-3" />
                                  <span>{isConfigured ? 'Link da Sala' : 'Link de Ativação'}</span>
                                </button>

                                {/* Copy WhatsApp Instructions */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyWhatsAppVoucherMessage({
                                      label: v.label,
                                      roomType: v.roomType,
                                      durationMinutes: v.durationMinutes,
                                      isPermanent: v.isPermanent,
                                      activationUrl: actUrl,
                                    })
                                  }
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-600/40 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium transition-colors cursor-pointer"
                                  title="Copiar mensagem pronta para WhatsApp"
                                >
                                  <MessageCircle className="h-3 w-3" />
                                  <span>WhatsApp</span>
                                </button>
                              </div>

                              {/* Delete Link / Terminate Room */}
                              <button
                                type="button"
                                onClick={() =>
                                  openDeleteConfirm(
                                    'voucher',
                                    v.token,
                                    v.label || v.roomName || 'Voucher ' + v.token,
                                    v.isPermanent ? 'Permanente' : `${v.durationMinutes} min`
                                  )
                                }
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-colors cursor-pointer"
                                title="Excluir link e derrubar sessão ativa imediatamente"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ACTIVE ROOMS LIST */}
              {activeTab === 'rooms' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-400" />
                        Salas no Servidor (Abertas & Privadas)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Visualização de todas as salas registradas e ativas no backend.
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveTab('generate')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      <span>Gerar Link</span>
                    </button>
                  </div>

                  {loading ? (
                    <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                      <span>Carregando salas...</span>
                    </div>
                  ) : ownerRooms.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400 space-y-3">
                      <p>Nenhuma sala ativa no momento.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {ownerRooms.map((room, idx) => {
                        const isRoomPermanent =
                          !!room.isPermanent ||
                          room.roomType === 'group_perm' ||
                          room.roomType === 'duo_perm' ||
                          room.durationMinutes === 0 ||
                          !!room.isOpenRoom;
                        const remainingText = isRoomPermanent
                          ? 'Permanente'
                          : formatRemaining(room.timeLeftSeconds, isRoomPermanent);
                        const directUrl = `${window.location.origin}/?room=${encodeURIComponent(room.id)}${
                          room.accessKey ? `&key=${encodeURIComponent(room.accessKey)}` : ''
                        }`;

                        return (
                          <div
                            key={`${room.id}-${idx}`}
                            className="p-4 rounded-2xl border border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition-all"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-xs text-white truncate">
                                  {room.name}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                  {room.category}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    room.isOpenRoom
                                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                                      : isRoomPermanent
                                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                      : room.isExpired
                                      ? 'bg-slate-800 text-slate-500'
                                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                  }`}
                                >
                                  {room.isOpenRoom ? 'Aberta (Lobby)' : remainingText}
                                </span>

                                {room.hasMultiChat && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/10 text-pink-300 border border-pink-500/20">
                                    5 Chats no Link
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                                <span>
                                  Participantes:{' '}
                                  <strong className="text-emerald-400">
                                    {room.onlineCount} / {room.maxParticipants}
                                  </strong>
                                </span>
                                {room.creatorPasscode ? (
                                  <span className="flex items-center gap-1 text-amber-300 font-medium">
                                    <KeyRound className="h-3 w-3" />
                                    Senha: <strong>{room.creatorPasscode}</strong>
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">
                                    (Entrada livre pelo link)
                                  </span>
                                )}

                                {room.hasMultiChat && room.channelPasscodes && (
                                  <div className="w-full mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] uppercase font-bold text-pink-400">Senhas dos 5 Chats:</span>
                                    {Object.entries(room.channelPasscodes).map(([chKey, code]) => (
                                      <span key={chKey} className="px-1.5 py-0.5 rounded bg-slate-800 border border-pink-500/30 font-mono text-[10px] text-pink-300">
                                        Chat {chKey.replace('chat_', '')}: <strong>{code}</strong>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {/* Enter Room directly as owner */}
                              {onEnterRoomDirectly && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onEnterRoomDirectly(room, room.accessKey || '');
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
                                  title="Entrar nesta sala agora"
                                >
                                  <LogIn className="h-3 w-3" />
                                  <span>Entrar</span>
                                </button>
                              )}

                              {/* Copy Direct Link */}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(directUrl)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                                title="Copiar link"
                              >
                                <Copy className="h-3 w-3" />
                                <span>Link</span>
                              </button>

                              {/* Terminate & Delete Room (Only if not seeded open room) */}
                              {!room.isOpenRoom && (
                                <button
                                  id={`btn-delete-room-${room.id}`}
                                  type="button"
                                  onClick={() =>
                                    openDeleteConfirm(
                                      'room',
                                      room.id,
                                      room.name,
                                      remainingText
                                    )
                                  }
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-colors cursor-pointer"
                                  title="Encerrar sessão e desconectar participantes imediatamente"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                  <span>Excluir</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal (Pin Protected) */}
        {deleteTarget && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md rounded-3xl border border-rose-500/40 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Autorizar Exclusão Imediata</h4>
                  <p className="text-xs text-slate-400">
                    {deleteTarget.type === 'room'
                      ? 'Encerrar e excluir sessão de sala ativa'
                      : 'Excluir link de voucher e derrubar sala'}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="text-slate-400">Alvo da exclusão:</div>
                <div className="font-bold text-white text-sm">{deleteTarget.name}</div>
                {deleteTarget.timeLeft && (
                  <div className="text-amber-300 text-[11px]">
                    Duração / Tempo: {deleteTarget.timeLeft}
                  </div>
                )}
                <p className="text-[11px] text-rose-400/90 mt-1">
                  Aviso: Os participantes conectados serão desconectados imediatamente.
                </p>
              </div>

              <form onSubmit={handleConfirmDelete} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Digite a Senha de Autorização
                  </label>
                  <input
                    type="password"
                    id="input-delete-auth-pin"
                    value={deletePinInput}
                    onChange={(e) => setDeletePinInput(e.target.value)}
                    placeholder="Digite a senha..."
                    autoFocus
                    className="w-full rounded-xl border border-rose-500/30 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                  />
                </div>

                {deleteError && (
                  <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400">
                    {deleteError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-delete-execute"
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/40 cursor-pointer flex items-center gap-1.5"
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Excluindo...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Confirmar Exclusão</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão de Solicitação PIX */}
        {orderToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md rounded-3xl border border-rose-500/40 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Excluir Solicitação PIX</h4>
                  <p className="text-xs text-slate-400">
                    {orderToDelete.status === 'pending'
                      ? 'Excluir solicitação pendente do sistema'
                      : 'Excluir solicitação e remover sala vinculada'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                <div className="text-slate-400">Solicitação a ser excluída:</div>
                <div className="font-bold text-white text-sm">
                  #{orderToDelete.id} — {orderToDelete.roomTitle}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-400 text-[11px]">Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      orderToDelete.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : orderToDelete.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {orderToDelete.status === 'pending'
                      ? 'Pendente'
                      : orderToDelete.status === 'approved'
                      ? 'Aprovada'
                      : 'Cancelada'}
                  </span>
                </div>
                <p className="text-[11px] text-rose-400/90 pt-1">
                  Esta solicitação será removida permanentemente do painel e qualquer sala vinculada será encerrada.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToDelete(null)}
                  disabled={isDeletingOrderId !== null}
                  className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmExecuteDeleteOrder}
                  disabled={isDeletingOrderId !== null}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/40 cursor-pointer flex items-center gap-1.5 active:scale-98"
                >
                  {isDeletingOrderId ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Sim, Excluir Definitivamente</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Entrega da Sala Aprovada (WhatsApp & Link) */}
        {deliveryModalData && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-lg rounded-3xl border border-emerald-500/50 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Sala Criada com Sucesso!</h4>
                    <p className="text-xs text-slate-400">
                      Pedido #{deliveryModalData.order.id} • {deliveryModalData.order.customerName}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDeliveryModalData(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Informações da Sala */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Tipo: <strong className="text-white">{deliveryModalData.order.roomTitle}</strong></span>
                  <span className="text-emerald-400 font-bold">{deliveryModalData.order.durationLabel}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] mb-1">Link de Acesso da Sala:</span>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <code className="text-emerald-400 font-mono text-xs flex-1 truncate select-all">
                      {deliveryModalData.shareUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(deliveryModalData.shareUrl)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {deliveryModalData.order.approvedPasscode && (
                  <div>
                    <span className="text-slate-400 text-[11px]">Senha Mestre de Acesso: </span>
                    <strong className="text-amber-300 font-mono font-bold text-xs">
                      {deliveryModalData.order.approvedPasscode}
                    </strong>
                  </div>
                )}
              </div>

              {/* Prévia da Mensagem de WhatsApp Pronta */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-300 block">
                  Mensagem Pronta para Envio no WhatsApp do Cliente:
                </span>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {deliveryModalData.whatsappDeliveryMessage}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    deliveryModalData.whatsappDeliveryMessage
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Enviar no WhatsApp do Cliente</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(deliveryModalData.whatsappDeliveryMessage)}
                  className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Copiar Mensagem
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

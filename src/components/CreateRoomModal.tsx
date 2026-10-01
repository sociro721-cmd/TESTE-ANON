import React, { useState, useEffect } from 'react';
import {
  X,
  PlusCircle,
  Sparkles,
  Lock,
  Clock,
  KeyRound,
  Users,
  ShieldCheck,
  Check,
  AlertTriangle,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import { ThemedRoom } from '../types';

const WHATSAPP_CONTACT_URL = 'https://wa.me/qr/FVT7IK7T3SAGC1';

interface Props {
  isOpen: boolean;
  voucherToken?: string | null;
  onClose: () => void;
  onCreated: (room: ThemedRoom, shareUrl: string, creatorPasscode: string) => void;
}

const CATEGORIES = [
  'Mente & Reflexão',
  'Segredos & Desabafos',
  'Cinema & Séries',
  'Tecnologia & Cyber',
  'Games & Cultura Geek',
  'Música & Arte',
  'Café & Conversa',
  'Privado & Restrito',
];

const COLORS = [
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ef4444', // red
];

export const CreateRoomModal: React.FC<Props> = ({
  isOpen,
  voucherToken,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [passcode, setPasscode] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);

  const [voucherInfo, setVoucherInfo] = useState<any>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a friendly random 4-digit code if empty
  const regeneratePasscode = () => {
    const random4 = Math.floor(1000 + Math.random() * 9000).toString();
    setPasscode(random4);
  };

  useEffect(() => {
    if (isOpen && !passcode) {
      regeneratePasscode();
    }
  }, [isOpen]);

  // If a voucherToken was passed, fetch voucher info
  useEffect(() => {
    if (isOpen && voucherToken) {
      setVoucherError(null);
      fetch(`/api/vouchers/${encodeURIComponent(voucherToken.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.existingRoom?.id) {
            // Origin link converts strictly to access the room!
            window.location.replace(`/?room=${encodeURIComponent(data.existingRoom.id)}`);
            return;
          }
          if (data.error) {
            setVoucherError(data.error);
          } else {
            setVoucherInfo(data);
            if (data.durationMinutes) {
              setDurationMinutes(data.durationMinutes);
            }
            if (data.roomName && !name) {
              setName(data.roomName);
            }
            if (data.creatorPasscode) {
              setPasscode(data.creatorPasscode);
            }
          }
        })
        .catch(() => {
          setVoucherError('Não foi possível verificar os dados do voucher no servidor.');
        });
    }
  }, [isOpen, voucherToken]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    if (!finalName) {
      setError('Por favor, informe o Nome da Sala.');
      return;
    }

    const finalPasscode = passcode.trim();
    if (finalPasscode.length < 3) {
      setError('A Senha da Sala deve ter pelo menos 3 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          description: description.trim() || 'Sala privada temporizada com capacidade de até 10 pessoas.',
          category,
          color,
          icon: 'MessageSquare',
          creatorPasscode: finalPasscode,
          voucherToken: voucherToken ? voucherToken.trim() : undefined,
          customDurationMinutes: durationMinutes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao criar sala.');
      }

      onCreated(data.room, data.shareUrl, finalPasscode);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar criação da sala.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="create-room-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="create-room-modal-content"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Criar Sala Privada</h3>
              <p className="text-xs text-slate-400">Até 10 pessoas • Tempo regressivo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* If accessed without voucher: Show requirement to request link from developer via WhatsApp */}
          {!voucherToken && (
            <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 p-4 text-xs space-y-2.5 shadow-lg shadow-emerald-950/30">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <MessageCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Solicitação de Link Exclusivo via WhatsApp</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11.5px]">
                Neste sistema, somente o desenvolvedor pode gerar os links das salas no painel administrativo. Entre em contato para solicitar seu link exclusivo:
              </p>
              <a
                id="whatsapp-contact-room-btn"
                href={WHATSAPP_CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/60 transition-all active:scale-[0.99] cursor-pointer"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Chamar no WhatsApp para Obter Link</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>
            </div>
          )}

          {/* Voucher Info Banner */}
          {voucherInfo ? (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Link Autorizado pelo Desenvolvedor!</span>
              </div>
              <p className="text-slate-200 leading-relaxed text-[11.5px]">
                Defina abaixo o <strong>Nome da Sala</strong> e a <strong>Senha de Acesso</strong> para seus convidados. O dono do sistema identificará sua sala pelo nome escolhido.
              </p>

              {/* Room Type Details */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded-xl bg-slate-900/80 border border-emerald-500/20 text-[11px]">
                  <span className="text-slate-400 block">Capacidade:</span>
                  <strong className="text-white">
                    {voucherInfo.roomType?.startsWith('duo_') || voucherInfo.maxParticipants === 2
                      ? '2 Pessoas (Sala Dupla)'
                      : 'Até 10 Pessoas'}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/80 border border-emerald-500/20 text-[11px]">
                  <span className="text-slate-400 block">Modalidade:</span>
                  <strong className="text-white">
                    {voucherInfo.roomType?.startsWith('duo_') || voucherInfo.maxParticipants === 2
                      ? 'Chat Duplo Exclusivo'
                      : 'Chat em Grupo Privado'}
                  </strong>
                </div>
                <div className="col-span-2 p-2 rounded-xl bg-slate-900/80 border border-emerald-500/20 text-[11px] flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block">Duração:</span>
                    <strong className="text-amber-300">
                      {voucherInfo.isPermanent ? 'Permanente (Sem expiração)' : `${voucherInfo.durationMinutes} minutos de sessão`}
                    </strong>
                  </div>
                  {voucherInfo.label && (
                    <div className="text-right">
                      <span className="text-slate-400 block">Identificador:</span>
                      <span className="text-slate-300 font-mono text-[10px]">{voucherInfo.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Voucher warning/error fallback */}
          {voucherError && (
            <div className="rounded-2xl border border-amber-500/50 bg-amber-950/30 p-3.5 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block">Aviso do Link de Acesso</span>
                {voucherError}. Não se preocupe, você ainda pode criar sua sala agora mesmo pelo botão abaixo.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Room Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nome da Sala *
            </label>
            <input
              id="input-room-name"
              type="text"
              required
              maxLength={50}
              placeholder="Ex: Reunião VIP, Papo Noturno, Debate Tech..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Guest Passcode (Crucial requirement!) */}
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-amber-400" />
                Senha da Sala para os Convidados *
              </label>
              <span className="text-[10px] text-amber-400/80 font-mono">Obrigatório</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Você deve informar esta senha para os demais participantes que receberem seu link entrarem na sala.
            </p>
            <div className="flex items-center gap-2">
              <input
                id="input-room-passcode"
                type="text"
                required
                maxLength={12}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Ex: 8492 ou VIP26"
                className="flex-1 rounded-xl border border-amber-500/50 bg-slate-950 px-3.5 py-2.5 text-base font-mono font-bold tracking-widest text-amber-300 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={regeneratePasscode}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold shrink-0 border border-slate-700 transition-colors"
                title="Gerar outro código aleatório"
              >
                Gerar Outro
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Categoria do Tema
            </label>
            <select
              id="select-room-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Descrição / Regras de Convivência (opcional)
            </label>
            <textarea
              id="input-room-description"
              rows={2}
              maxLength={150}
              placeholder="Ex: Discussão produtiva, respeito mútuo, sem expor dados pessoais."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Cor de Destaque
            </label>
            <div className="flex items-center gap-2.5">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    color === c ? 'scale-110 border-white ring-2 ring-white/20' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              id="submit-create-room-btn"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50 active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Iniciando Sessão...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {voucherInfo?.isPermanent
                      ? 'Ativar Sala Permanente'
                      : `Criar Sala & Iniciar Tempo (${durationMinutes} min)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

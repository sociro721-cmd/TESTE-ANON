import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Download, Copy, Check, ShieldCheck, QrCode, Smartphone, Share2, ExternalLink } from 'lucide-react';
import { ThemedRoom } from '../types';

interface Props {
  room: ThemedRoom | null;
  isOpen: boolean;
  onClose: () => void;
  onScanThisRoom?: (qrData: string) => void;
}

export const QRCodeDisplayModal: React.FC<Props> = ({
  room,
  isOpen,
  onClose,
  onScanThisRoom,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [accessUrl, setAccessUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  useEffect(() => {
    if (!isOpen || !room) {
      setQrDataUrl('');
      setAccessUrl('');
      return;
    }

    setLoading(true);
    fetch(`/api/rooms/${room.id}/ticket`)
      .then((res) => res.json())
      .then(async (data) => {
        // Construct standard web URL using current window origin to ensure it matches user's exact host/port/domain
        const key = data.accessKey || '';
        const mobileWebUrl = key
          ? `${window.location.origin}/?room=${encodeURIComponent(room.id)}&key=${encodeURIComponent(key)}`
          : (data.qrUrl || data.qrData);

        setAccessUrl(mobileWebUrl);

        // Generate QR Code encoding the direct HTTPS URL so ANY phone camera app will recognize it as a clickable web link
        const dataUrl = await QRCode.toDataURL(mobileWebUrl, {
          width: 340,
          margin: 2,
          color: {
            dark: '#020617',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });
        setQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error('Failed to fetch room ticket:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, room]);

  if (!isOpen || !room) return null;

  const handleCopyLink = () => {
    if (accessUrl) {
      navigator.clipboard.writeText(accessUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShare = async () => {
    if (navigator.share && accessUrl) {
      try {
        await navigator.share({
          title: `Convite AnonQR: ${room.name}`,
          text: `Você foi convidado para a sala de bate-papo anônima "${room.name}". Clique no link para ingressar:`,
          url: accessUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `anonqr-${room.id}.png`;
    a.click();
  };

  return (
    <div
      id="qr-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="qr-modal-content"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 p-6 text-slate-100 shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id="close-qr-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1.5 text-emerald-400">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-semibold tracking-wider uppercase">
            Ingresso Seguro & Criptografado
          </span>
        </div>

        <h3 className="text-xl font-bold text-white mb-1">{room.name}</h3>
        <p className="text-xs text-slate-400 mb-4">
          Acesso exclusivo via leitura do código óptico ou link de convite único.
        </p>

        {/* Mobile scan testing tip */}
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3 mb-4 text-xs text-emerald-300">
          <Smartphone className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <span className="font-semibold text-white block mb-0.5">Como acessar por outro celular:</span>
            <span>Aponte a <strong>câmera nativa</strong> do segundo celular para o QR Code abaixo. Ao aparecer o link amarelo ou pop-up, toque nele para entrar diretamente no bate-papo!</span>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-4 shadow-xl mb-4">
          {loading ? (
            <div className="h-64 w-64 flex items-center justify-center text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : qrDataUrl ? (
            <div className="relative group">
              <img
                src={qrDataUrl}
                alt={`QR Code para ${room.name}`}
                className="h-60 w-60 sm:h-64 sm:w-64 rounded-xl object-contain"
              />
            </div>
          ) : (
            <div className="h-64 w-64 flex items-center justify-center text-rose-500 text-sm">
              Erro ao gerar QR Code
            </div>
          )}
          <span className="text-[11px] font-mono text-slate-600 font-medium mt-2">
            Sala: {room.name}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {onScanThisRoom && accessUrl && (
            <button
              id="simulate-scan-this-room-btn"
              onClick={() => {
                onScanThisRoom(accessUrl);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-950/50 active:scale-98"
            >
              <QrCode className="h-4 w-4" />
              Entrar Nesta Sala Neste Dispositivo
            </button>
          )}

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              id="copy-payload-btn"
              onClick={handleCopyLink}
              disabled={!accessUrl}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Link Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>

            {canShare ? (
              <button
                id="share-link-btn"
                onClick={handleShare}
                disabled={!accessUrl}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5 text-slate-400" />
                <span>Compartilhar</span>
              </button>
            ) : (
              <button
                id="download-qr-btn"
                onClick={handleDownload}
                disabled={!qrDataUrl}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span>Baixar Imagem</span>
              </button>
            )}
          </div>

          {canShare && (
            <button
              id="download-qr-secondary-btn"
              onClick={handleDownload}
              disabled={!qrDataUrl}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Download className="h-3 w-3" />
              <span>Baixar arquivo de imagem do QR Code (.png)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

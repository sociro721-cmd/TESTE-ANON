import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  X,
  Camera,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { ThemedRoom } from '../types';
import { sounds } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (room: ThemedRoom, accessKey: string) => void;
  presetRooms?: ThemedRoom[];
}

export const QRScannerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  presetRooms = [],
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{ room: ThemedRoom; accessKey: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [dragOver, setDragOver] = useState<boolean>(false);

  // Stop camera stream cleanly
  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Process decoded QR text
  const verifyAndConnect = async (qrDataText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/verify-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData: qrDataText }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'QR Code inválido ou não autorizado.');
      }

      sounds.playScanSuccess();
      setScanResult({ room: data.room, accessKey: data.accessKey });

      // Automatically transition to the room after brief celebratory feedback
      setTimeout(() => {
        onSuccess(data.room, data.accessKey);
        onClose();
      }, 1000);
    } catch (err: any) {
      sounds.playError();
      setErrorMessage(err.message || 'Falha ao autenticar QR Code.');
      setIsProcessing(false);
    }
  };

  // Frame scanning loop with jsQR
  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data && !isProcessing) {
      stopCamera();
      verifyAndConnect(code.data);
      return;
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Start camera
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setErrorMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCamera(false);
      setCameraError('Câmera não suportada neste navegador.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setHasCamera(false);
      setCameraError(
        'Permissão de câmera não concedida ou dispositivo sem câmera. Utilize o upload de imagem do QR Code abaixo.'
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      setScanResult(null);
      setErrorMessage(null);
      if (activeTab === 'camera') {
        startCamera();
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  // Handle uploaded image file
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, envie um arquivo de imagem válido (PNG, JPG, WebP).');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const offscreenCanvas = document.createElement('canvas');
        const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setIsProcessing(false);
          setErrorMessage('Erro ao preparar processamento de imagem.');
          return;
        }

        offscreenCanvas.width = img.width;
        offscreenCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          verifyAndConnect(code.data);
        } else {
          sounds.playError();
          setIsProcessing(false);
          setErrorMessage('Nenhum QR Code legível foi detectado na imagem enviada.');
        }
      };
      img.onerror = () => {
        setIsProcessing(false);
        setErrorMessage('Falha ao abrir a imagem.');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div
      id="qr-scanner-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="qr-scanner-modal"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Escanear QR Code</h3>
              <p className="text-xs text-slate-400">Acesso exclusivo e anônimo por leitura</p>
            </div>
          </div>
          <button
            id="close-scanner-btn"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-4 text-xs font-medium">
          <button
            id="scanner-tab-camera"
            onClick={() => setActiveTab('camera')}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === 'camera'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="h-4 w-4" />
            Câmera Ao Vivo
          </button>
          <button
            id="scanner-tab-upload"
            onClick={() => {
              setActiveTab('upload');
              stopCamera();
            }}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="h-4 w-4" />
            Carregar Imagem / Arquivo
          </button>
        </div>

        {/* Body content */}
        <div className="p-6">
          {scanResult ? (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-8 ring-emerald-500/10">
                <CheckCircle2 className="h-10 w-10 animate-bounce" />
              </div>
              <h4 className="text-lg font-bold text-white mb-1">
                QR Code Validado com Sucesso!
              </h4>
              <p className="text-sm text-emerald-400 font-medium mb-1">
                Ingressando em: {scanResult.room.name}
              </p>
              <span className="text-xs text-slate-400">
                Estabelecendo conexão criptografada anônima...
              </span>
            </div>
          ) : activeTab === 'camera' ? (
            /* Camera Scanner View */
            <div className="flex flex-col items-center">
              <div className="relative w-full aspect-square max-w-[340px] overflow-hidden rounded-2xl bg-black border border-slate-800 shadow-inner">
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
                    <p className="text-xs mb-4 leading-relaxed">{cameraError}</p>
                    <button
                      id="retry-camera-btn"
                      onClick={() => startCamera()}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-xs text-white hover:bg-slate-700 transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Tentar Novamente
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      muted
                      autoPlay
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Futuristic Scanner HUD Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      {/* Darkened mask around viewfinder */}
                      <div className="relative w-56 h-56 border-2 border-emerald-500/80 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        {/* Corner Accents */}
                        <div className="absolute -top-1 -left-1 h-5 w-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 h-5 w-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                        {/* Animated Laser Scan Bar */}
                        <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[scan_2s_ease-in-out_infinite]" />
                      </div>
                    </div>

                    <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
                      <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                        Buscando QR Code...
                      </span>
                    </div>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-3 text-center">
                Aponte sua câmera para o QR Code da sala temática privada
              </p>
            </div>
          ) : (
            /* Upload Image View */
            <div className="flex flex-col items-center">
              <label
                id="dropzone-qr-upload"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleImageFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`relative flex flex-col items-center justify-center w-full aspect-[4/3] max-w-[340px] rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all ${
                  dragOver
                    ? 'border-emerald-500 bg-emerald-950/20'
                    : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-300 mb-3 border border-slate-700">
                  <Upload className="h-6 w-6" />
                </div>
                <span className="text-sm font-semibold text-slate-200 mb-1">
                  Clique ou solte o print do QR Code
                </span>
                <span className="text-xs text-slate-400 text-center">
                  Suporta arquivos PNG, JPG, WebP de capturas de tela
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          )}

          {/* Error display */}
          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick test rooms helper: allows testing scan instantly */}
          {presetRooms && presetRooms.length > 0 && !scanResult && (
            <div className="mt-6 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Escanear salas ativas disponíveis:
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                {presetRooms.map((room) => (
                  <button
                    key={room.id}
                    id={`test-scan-room-${room.id}`}
                    onClick={async () => {
                      try {
                        setIsProcessing(true);
                        const res = await fetch(`/api/rooms/${room.id}/ticket`);
                        const data = await res.json();
                        if (data.qrData) {
                          verifyAndConnect(data.qrData);
                        }
                      } catch (e) {
                        setIsProcessing(false);
                      }
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/60 hover:bg-slate-800 text-left transition-colors"
                  >
                    <QrCode className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-200 truncate">{room.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{room.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  QrCode,
  Shield,
  FileText,
  Lock,
  HelpCircle,
  AlertTriangle,
  MessageCircle,
  ExternalLink,
  Key,
  ShoppingBag,
  Info,
} from 'lucide-react';
import { WHATSAPP_SUPPORT_URL } from '../types';

interface FooterProps {
  onNavigate: (path: string) => void;
  onOpenBuyRoom?: () => void;
  onOpenOwnerPanel?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onOpenBuyRoom,
  onOpenOwnerPanel,
}) => {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <footer
      id="site-main-footer"
      className="w-full border-t border-slate-800/90 bg-slate-950/95 text-slate-300 mt-auto transition-colors"
    >
      {/* Top Footer Section with Columns */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand & Introduction Column */}
          <div className="sm:col-span-2 lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-950/40 shrink-0">
                <QrCode className="h-5 w-5" />
              </div>
              <span className="text-lg font-black tracking-tight text-white">
                Anon<span className="text-emerald-400">QR</span>
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Plataforma de comunicação digital para salas de conversa privativas e abertas com controle de acesso prático via link e QR Code.
            </p>

            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                <Shield className="h-3 w-3" />
                Privacidade & Acesso
              </span>
            </div>
          </div>

          {/* Coluna 1: ANÔNQR */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              AnônQr
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="/quem-somos"
                  onClick={(e) => handleLinkClick(e, '/quem-somos')}
                  className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer min-h-[36px]"
                >
                  <Info className="h-3.5 w-3.5 text-slate-500" />
                  <span>Quem Somos</span>
                </a>
              </li>
              <li>
                <a
                  href="/como-funciona"
                  onClick={(e) => handleLinkClick(e, '/como-funciona')}
                  className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer min-h-[36px]"
                >
                  <QrCode className="h-3.5 w-3.5 text-slate-500" />
                  <span>Como Funciona</span>
                </a>
              </li>
              {onOpenBuyRoom && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenBuyRoom}
                    className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer min-h-[36px] text-left"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Comprar Sala</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Coluna 2: LEGAL */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Legal
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="/termos"
                  onClick={(e) => handleLinkClick(e, '/termos')}
                  className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer min-h-[36px]"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  <span>Termos de Uso</span>
                </a>
              </li>
              <li>
                <a
                  href="/privacidade"
                  onClick={(e) => handleLinkClick(e, '/privacidade')}
                  className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer min-h-[36px]"
                >
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Política de Privacidade</span>
                </a>
              </li>
              <li>
                <a
                  href="/regras"
                  onClick={(e) => handleLinkClick(e, '/regras')}
                  className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer min-h-[36px]"
                >
                  <Shield className="h-3.5 w-3.5 text-slate-500" />
                  <span>Política de Conteúdo</span>
                </a>
              </li>
              <li>
                <a
                  href="/regras"
                  onClick={(e) => handleLinkClick(e, '/regras')}
                  className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer min-h-[36px]"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  <span>Diretrizes da Comunidade</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Coluna 3: SUPORTE */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Suporte
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="/suporte"
                  onClick={(e) => handleLinkClick(e, '/suporte')}
                  className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer min-h-[36px]"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                  <span>Central de Suporte</span>
                </a>
              </li>
              <li>
                <a
                  href={WHATSAPP_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 py-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer min-h-[36px]"
                  title="Atendimento via WhatsApp Oficial"
                  aria-label="Falar com o suporte no WhatsApp oficial"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Falar com o Suporte</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </li>
              <li>
                <a
                  href="/denunciar"
                  onClick={(e) => handleLinkClick(e, '/denunciar')}
                  className="inline-flex items-center gap-1.5 py-1 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer min-h-[36px]"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>Denunciar Conteúdo</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Coluna 4: ADMINISTRAÇÃO */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Administração
            </h3>
            <ul className="space-y-2 text-xs">
              {onOpenOwnerPanel && (
                <li>
                  <button
                    type="button"
                    id="footer-owner-panel-link"
                    onClick={onOpenOwnerPanel}
                    className="inline-flex items-center gap-1.5 py-1 text-slate-400 hover:text-amber-400 text-xs transition-colors cursor-pointer min-h-[36px] text-left"
                    title="Acesso restrito ao Painel do Dono com PIN/Senha de proteção"
                    aria-label="Acessar Painel do Dono"
                  >
                    <Key className="h-3.5 w-3.5 text-amber-500/70" />
                    <span>Acessar Painel do Dono</span>
                  </button>
                </li>
              )}
              <li className="text-[11px] text-slate-400 leading-relaxed pt-1">
                Acesso protegido exclusivamente por código de autorização do administrador.
              </li>
            </ul>
          </div>
        </div>

        {/* Separator & Bottom Row */}
        <div className="mt-10 border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-slate-400">
          <p>© 2026 AnônQr. Todos os direitos reservados.</p>
          <p className="text-[11px] text-slate-400 max-w-xl">
            Plataforma digital para criação e participação em salas temáticas e privativas. O AnônQr opera em conformidade com as leis e diretrizes vigentes aplicáveis.
          </p>
        </div>
      </div>
    </footer>
  );
};

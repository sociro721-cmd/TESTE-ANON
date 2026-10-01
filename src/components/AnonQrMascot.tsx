import React from 'react';

interface AnonQrMascotProps {
  variant?: 'hero' | 'game' | 'confession' | 'scanner' | 'compact';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  className?: string;
}

export const AnonQrMascot: React.FC<AnonQrMascotProps> = ({
  variant = 'hero',
  size = 'md',
  className = '',
}) => {
  // Mapeamento de tamanhos
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-28 h-28 sm:w-32 sm:h-32',
    lg: 'w-40 h-40 sm:w-48 sm:h-48',
    xl: 'w-56 h-56 sm:w-72 sm:h-72',
    custom: '',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${sizeClasses[size]} ${className}`}
      aria-label="Mascote Alienígena AnônQr"
    >
      {/* Halo de Brilho Glowing de Fundo */}
      <div
        className={`absolute inset-0 rounded-full blur-3xl opacity-35 transition-all duration-500 pointer-events-none ${
          variant === 'confession'
            ? 'bg-indigo-500/35'
            : variant === 'game'
            ? 'bg-purple-500/35'
            : 'bg-emerald-500/35'
        }`}
      />

      {/* ILUSTRAÇÃO VETORIAL VIVA E DETALHADA DO PEQUENO ET ALIENÍGENA HUMANOIDE ANÔNQR */}
      <svg
        viewBox="0 0 240 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_12px_28px_rgba(16,185,129,0.3)] animate-float"
      >
        <defs>
          {/* Gradientes da Pele do ET (Verde Esmeralda Agradável e Suave) */}
          <radialGradient id="etHeadSkin" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="55%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </radialGradient>

          <radialGradient id="etBodySkin" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="70%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#065f46" />
          </radialGradient>

          {/* Gradientes dos Olhos Grandes e Amendoado */}
          <radialGradient id="etEyeGlow" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="60%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>

          <radialGradient id="etIrisLight" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="60%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </radialGradient>

          {/* Gradiente da Antena */}
          <linearGradient id="etAntennaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Gradiente do Visor / Acessório Modo Jogo */}
          <linearGradient id="etGameVisor" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e879f9" />
            <stop offset="100%" stopColor="#a21caf" />
          </linearGradient>

          {/* Sombra de apoio no chão */}
          <radialGradient id="etFloorShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#047857" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sombra suave no chão */}
        <ellipse cx="120" cy="245" rx="55" ry="10" fill="url(#etFloorShadow)" />

        {/* 1. ANTENA NA CABEÇA DO ET */}
        <path
          d="M120 62 Q122 35 125 18"
          stroke="url(#etAntennaGrad)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="126" cy="14" r="9" fill="#a7f3d0" className="animate-pulse" />
        <circle cx="126" cy="14" r="4.5" fill="#ffffff" />

        {/* 2. ORELHAS/ALETAS ALIENÍGENAS SUAVES */}
        {/* Orelha Esquerda */}
        <path
          d="M52 105 C30 92 20 115 48 122 Z"
          fill="url(#etBodySkin)"
          stroke="#047857"
          strokeWidth="1.5"
        />
        {/* Orelha Direita */}
        <path
          d="M188 105 C210 92 220 115 192 122 Z"
          fill="url(#etBodySkin)"
          stroke="#047857"
          strokeWidth="1.5"
        />

        {/* 3. PERNAS E PÉS HUMANOIDES NITIDAMENTE VISÍVEIS */}
        {/* Perna e Pé Esquerdo */}
        <path
          d="M100 205 L96 230 C96 236 80 238 78 240 C75 242 85 245 98 245 C108 245 108 238 108 230 L108 205 Z"
          fill="url(#etBodySkin)"
          stroke="#047857"
          strokeWidth="1.5"
        />
        {/* Perna e Pé Direito */}
        <path
          d="M140 205 L144 230 C144 236 160 238 162 240 C165 242 155 245 142 245 C132 245 132 238 132 230 L132 205 Z"
          fill="url(#etBodySkin)"
          stroke="#047857"
          strokeWidth="1.5"
        />

        {/* 4. TRONCO / CORPO PEQUENO E HUMANOIDE */}
        <path
          d="M92 165 C88 185 92 210 120 210 C148 210 152 185 148 165 C145 152 95 152 92 165 Z"
          fill="url(#etBodySkin)"
          stroke="#059669"
          strokeWidth="2"
        />

        {/* Detalhe de luz suave na barriguinha fofa */}
        <ellipse cx="120" cy="182" rx="18" ry="15" fill="#a7f3d0" fillOpacity="0.25" />

        {/* 5. BRAÇOS E MÃOS COM DEDOS NITIDAMENTE VISÍVEIS */}
        {/* Braço Esquerdo (Acenando Amigavelmente) */}
        <path
          d="M92 162 C75 168 62 155 58 142 C56 138 62 135 66 140 C72 148 82 154 90 155 Z"
          fill="url(#etBodySkin)"
          stroke="#047857"
          strokeWidth="1.5"
        />
        {/* Mão Esquerda (3 dedinhos alienígenas fofos) */}
        <circle cx="56" cy="138" r="4.5" fill="#6ee7b7" />
        <circle cx="52" cy="144" r="4" fill="#6ee7b7" />
        <circle cx="61" cy="135" r="4" fill="#6ee7b7" />

        {/* Braço Direito (Apoiado Curioso) */}
        <path
          d="M148 162 C165 168 178 172 182 180 C185 184 179 187 175 182 C170 176 158 170 150 166 Z"
          fill="url(#etBodySkin)"
          stroke="#047857"
          strokeWidth="1.5"
        />
        {/* Mão Direita */}
        <circle cx="183" cy="182" r="4.5" fill="#6ee7b7" />
        <circle cx="187" cy="177" r="4" fill="#6ee7b7" />

        {/* VARIANTE CONFESSION: Capuz/Manto Misterioso */}
        {variant === 'confession' && (
          <path
            d="M62 65 C90 42 150 42 178 65 C192 100 185 170 175 200 C140 215 100 215 65 200 Z"
            fill="#1e1b4b"
            fillOpacity="0.75"
            stroke="#4338ca"
            strokeWidth="3"
          />
        )}

        {/* 6. CABEÇA OVAL GRANDE DO ET (Anatomia Alienígena Inconfundível) */}
        <path
          d="M120 50 C168 50 195 72 195 115 C195 152 162 166 120 166 C78 166 45 152 45 115 C45 72 72 50 120 50 Z"
          fill="url(#etHeadSkin)"
          stroke="#059669"
          strokeWidth="3"
        />

        {/* 7. OLHOS ALIENÍGENAS GRANDES, AMENDOADOS E EXPRESSIVOS */}
        {/* OLHO ESQUERDO */}
        <g>
          {/* Sombra da pálpebra alienígena */}
          <path d="M68 96 C80 88 102 92 106 112 C108 132 86 138 72 132 C60 126 60 108 68 96 Z" fill="url(#etEyeGlow)" stroke="#047857" strokeWidth="1.5" />
          {/* Íris com Brilho Celeste */}
          <ellipse cx="86" cy="114" rx="12" ry="16" fill="url(#etIrisLight)" />
          {/* Brilhos e Reflexos de Curiosidade */}
          <circle cx="91" cy="106" r="6" fill="#ffffff" />
          <circle cx="82" cy="120" r="2.5" fill="#ffffff" />
        </g>

        {/* OLHO DIREITO */}
        <g>
          {/* Sombra da pálpebra alienígena */}
          <path d="M172 96 C160 88 138 92 134 112 C132 132 154 138 168 132 C180 126 180 108 172 96 Z" fill="url(#etEyeGlow)" stroke="#047857" strokeWidth="1.5" />
          {/* Íris com Brilho Celeste */}
          <ellipse cx="154" cy="114" rx="12" ry="16" fill="url(#etIrisLight)" />
          {/* Brilhos e Reflexos de Curiosidade */}
          <circle cx="159" cy="106" r="6" fill="#ffffff" />
          <circle cx="150" cy="120" r="2.5" fill="#ffffff" />
        </g>

        {/* VARIANTE GAME: Óculos Holográfico Divertido */}
        {variant === 'game' && (
          <g>
            <path
              d="M62 98 C100 90 140 90 178 98 L182 122 C140 128 100 128 58 122 Z"
              fill="url(#etGameVisor)"
              fillOpacity="0.85"
              stroke="#f43f5e"
              strokeWidth="2"
            />
            <line x1="70" y1="106" x2="170" y2="106" stroke="#ffffff" strokeWidth="2" strokeDasharray="6 4" />
          </g>
        )}

        {/* VARIANTE SCANNER: QR Code Holográfico Flutuante */}
        {variant === 'scanner' && (
          <g transform="translate(160, 150)">
            <rect x="0" y="0" width="42" height="42" rx="10" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
            <rect x="7" y="7" width="10" height="10" fill="#38bdf8" />
            <rect x="25" y="7" width="10" height="10" fill="#38bdf8" />
            <rect x="7" y="25" width="10" height="10" fill="#38bdf8" />
            <rect x="21" y="21" width="14" height="14" fill="#38bdf8" />
          </g>
        )}

        {/* 8. ROSTO: SORRISINHO CURANTO E BOCHECHINHAS AMIGÁVEIS */}
        {/* Sorriso Simpático */}
        <path
          d="M106 145 Q120 155 134 145"
          stroke="#064e3b"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Bochechinhas Rosadas Suaves */}
        <ellipse cx="68" cy="136" rx="9" ry="5" fill="#f43f5e" fillOpacity="0.3" />
        <ellipse cx="172" cy="136" rx="9" ry="5" fill="#f43f5e" fillOpacity="0.3" />

        {/* Sobrancelhas Alienígenas Expressivas (Curiosidade) */}
        <path d="M72 88 Q85 82 96 89" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
        <path d="M168 88 Q155 82 144 89" stroke="#047857" strokeWidth="2" strokeLinecap="round" />

      </svg>
    </div>
  );
};

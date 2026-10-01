import React, { useState, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  Clock,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { RoomType, RoomPricingOption, ROOM_CATALOGUE, SalaProduto } from '../types';

interface Props {
  onBuySala: (sala: SalaProduto) => void;
  onOpenMinhasCompras?: () => void;
}

export const CommercialRoomSelector: React.FC<Props> = ({
  onBuySala,
  onOpenMinhasCompras,
}) => {
  // 1. Tipo selecionado: 'group_temp' | 'group_perm' | 'duo_temp' | 'duo_perm'
  const [selectedType, setSelectedType] = useState<RoomType>('group_temp');

  // 2. Duração selecionada para salas temporárias (em minutos): 30, 60, 120, 240, 720, 1440
  const [selectedMinutes, setSelectedMinutes] = useState<number>(60);

  // Lista oficial de durações para salas temporárias baseada no ROOM_CATALOGUE
  const DURATION_OPTIONS = [
    { minutes: 30, label: '30 Minutos', priceFormatted: 'R$ 0,90' },
    { minutes: 60, label: '1 Hora', priceFormatted: 'R$ 1,50' },
    { minutes: 120, label: '2 Horas', priceFormatted: 'R$ 2,50' },
    { minutes: 240, label: '4 Horas', priceFormatted: 'R$ 4,00' },
    { minutes: 720, label: '12 Horas', priceFormatted: 'R$ 6,00' },
    { minutes: 1440, label: '24 Horas', priceFormatted: 'R$ 10,00' },
  ];

  // Identifica o item oficial exato do ROOM_CATALOGUE
  const currentCatalogItem: RoomPricingOption = useMemo(() => {
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
    // Padrão: group_temp
    return (
      ROOM_CATALOGUE.find((c) => c.roomType === 'group_temp' && c.durationMinutes === selectedMinutes) ||
      ROOM_CATALOGUE[1]
    );
  }, [selectedType, selectedMinutes]);

  const isTemporary = selectedType === 'group_temp' || selectedType === 'duo_temp';
  const isDuo = selectedType === 'duo_temp' || selectedType === 'duo_perm';

  const handleProceedToPurchase = () => {
    const item = currentCatalogItem;
    const salaToBuy: SalaProduto = {
      id: item.id,
      nome: `${item.title} - ${item.durationLabel}`,
      descricao: item.description,
      valor: item.priceValue,
      status: 'available',
      categoria: item.isPermanent ? 'Permanente' : 'Temporária',
      icone: item.isPermanent ? 'ShieldCheck' : 'Clock',
      cor: item.roomType === 'group_perm'
        ? '#10b981'
        : item.roomType === 'duo_perm'
        ? '#ec4899'
        : item.roomType === 'duo_temp'
        ? '#06b6d4'
        : '#f59e0b',
      max_participantes: item.roomType.startsWith('duo') ? 2 : 10,
      duracao_label: item.durationLabel,
      duracao_minutos: item.durationMinutes,
      is_permanente: item.isPermanent,
      room_type: item.roomType,
      badge: item.badge,
    };

    onBuySala(salaToBuy);
  };

  return (
    <section className="mb-14">
      {/* Cabeçalho da Seção Comercial */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Catálogo Oficial • Salas Privadas</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Salas Privadas Disponíveis para Compra
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Escolha o formato e a duração ideal da sua sala privativa. Link de acesso exclusivo e senha privativa liberados na confirmação.
          </p>
        </div>

        {onOpenMinhasCompras && (
          <button
            type="button"
            onClick={onOpenMinhasCompras}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer shrink-0 shadow-sm"
          >
            <Clock className="h-4 w-4 text-amber-400" />
            <span>Minhas Compras</span>
          </button>
        )}
      </div>

      {/* Painel Unificado de Configuração e Compra */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-sm space-y-6">
        {/* PASSO 1: Escolha a Categoria Principal (4 Opções) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-black">
              1
            </span>
            <span>Escolha o Tipo de Sala:</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Opção A: Sala de Grupo Temporária */}
            <button
              type="button"
              onClick={() => setSelectedType('group_temp')}
              className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedType === 'group_temp'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                  : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-950/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <Users className="h-4 w-4 text-emerald-400" />
                  <span>Sala de Grupo</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                  Temporária
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Até 10 pessoas por sala com timer de encerramento automático.
              </p>
              <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-500">Valores:</span>
                <span className="font-extrabold text-emerald-400">A partir de R$ 0,90</span>
              </div>
            </button>

            {/* Opção B: Sala de Grupo Permanente */}
            <button
              type="button"
              onClick={() => setSelectedType('group_perm')}
              className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedType === 'group_perm'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                  : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-950/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Sala de Grupo</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  Permanente
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Até 10 pessoas. Sala vitalícia que nunca expira.
              </p>
              <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-500">Valor Único:</span>
                <span className="font-extrabold text-emerald-400">R$ 15,90</span>
              </div>
            </button>

            {/* Opção C: Sala Dupla 1x1 Temporária */}
            <button
              type="button"
              onClick={() => setSelectedType('duo_temp')}
              className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedType === 'duo_temp'
                  ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                  : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-950/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <Lock className="h-4 w-4 text-cyan-400" />
                  <span>Sala Dupla 1×1</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  Temporária
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Exclusiva para 2 pessoas com contagem regressiva.
              </p>
              <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-500">Valores:</span>
                <span className="font-extrabold text-cyan-400">A partir de R$ 0,90</span>
              </div>
            </button>

            {/* Opção D: Sala Dupla 1x1 Permanente */}
            <button
              type="button"
              onClick={() => setSelectedType('duo_perm')}
              className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedType === 'duo_perm'
                  ? 'border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-950/40 ring-1 ring-pink-500/50'
                  : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-950/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <ShieldCheck className="h-4 w-4 text-pink-400" />
                  <span>Sala Dupla 1×1</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-300">
                  Permanente
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Exclusiva para 2 pessoas. Sem expiração (vitalícia).
              </p>
              <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-500">Valor Único:</span>
                <span className="font-extrabold text-pink-400">R$ 19,90</span>
              </div>
            </button>
          </div>
        </div>

        {/* PASSO 2: Se for Temporária, Escolha a Duração (6 Opções) */}
        {isTemporary && (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-black">
                  2
                </span>
                <span>Escolha o Tempo de Duração:</span>
              </label>
              <span className="text-[11px] text-slate-400">
                O cronômetro inicia no momento do primeiro acesso à sala.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {DURATION_OPTIONS.map((d) => {
                const isSelected = selectedMinutes === d.minutes;
                return (
                  <button
                    key={d.minutes}
                    type="button"
                    onClick={() => setSelectedMinutes(d.minutes)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? isDuo
                          ? 'border-cyan-500 bg-cyan-500/20 text-white font-bold ring-1 ring-cyan-500/50 shadow-md'
                          : 'border-emerald-500 bg-emerald-500/20 text-white font-bold ring-1 ring-emerald-500/50 shadow-md'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-950/90'
                    }`}
                  >
                    <span className="text-xs font-semibold">{d.label}</span>
                    <span
                      className={`text-sm font-extrabold mt-1 ${
                        isDuo ? 'text-cyan-400' : 'text-emerald-400'
                      }`}
                    >
                      {d.priceFormatted}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PASSO 3: Resumo do Produto Selecionado & Botão de Compra */}
        <div className="pt-4 border-t border-slate-800/80">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Configuração Selecionada:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${currentCatalogItem.badgeColor}`}>
                  {currentCatalogItem.badge}
                </span>
              </div>

              <h4 className="text-base sm:text-lg font-black text-white truncate">
                {currentCatalogItem.title} • {currentCatalogItem.durationLabel}
              </h4>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{isDuo ? '2 pessoas (1x1 exclusivo)' : 'Até 10 participantes'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Link criptografado + Senha privativa</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
              <div className="text-right sm:text-right md:px-3">
                <span className="text-[11px] text-slate-400 block uppercase tracking-wider">Valor Oficial:</span>
                <span className="text-2xl font-black text-emerald-400">
                  {currentCatalogItem.priceFormatted}
                </span>
              </div>

              <button
                id="btn-comprar-sala-catalogo"
                type="button"
                onClick={handleProceedToPurchase}
                className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.98] cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Comprar Sala Agora</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

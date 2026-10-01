import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  Clock,
  Heart,
  Target,
  Plus,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  UserPresentation,
  SUGGESTIONS_LOOKING_FOR,
  SUGGESTIONS_INTERESTS,
  SUGGESTIONS_AVAILABILITY,
  SUGGESTIONS_DESIRES,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_CATEGORY,
} from '../constants/presentation';

interface Props {
  value: UserPresentation;
  onChange: (updated: UserPresentation) => void;
  disabled?: boolean;
}

type ActiveCategory = 'lookingFor' | 'interests' | 'availability' | 'desires' | null;

export const UserPresentationEditor: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
}) => {
  // Modal / Inline Prompt para adicionar opção personalizada
  const [activeModalCategory, setActiveModalCategory] = useState<ActiveCategory>(null);
  const [customInputText, setCustomInputText] = useState('');
  const [customInputError, setCustomInputError] = useState<string | null>(null);

  // Lista de tags personalizadas criadas nesta sessão ou extraídas das seleções
  const [customLookingFor, setCustomLookingFor] = useState<string[]>(() =>
    value.profileLookingFor.filter((item) => !SUGGESTIONS_LOOKING_FOR.includes(item))
  );
  const [customInterests, setCustomInterests] = useState<string[]>(() =>
    value.profileInterests.filter((item) => !SUGGESTIONS_INTERESTS.includes(item))
  );
  const [customAvailability, setCustomAvailability] = useState<string[]>(() =>
    value.profileAvailability && !SUGGESTIONS_AVAILABILITY.includes(value.profileAvailability)
      ? [value.profileAvailability]
      : []
  );
  const [customDesires, setCustomDesires] = useState<string[]>(() =>
    value.profileDesires.filter((item) => !SUGGESTIONS_DESIRES.includes(item))
  );

  // Toggle para categorias de múltipla escolha
  const toggleMultiItem = (
    categoryKey: 'profileLookingFor' | 'profileInterests' | 'profileDesires',
    item: string
  ) => {
    if (disabled) return;
    const currentList = value[categoryKey] || [];
    const isSelected = currentList.includes(item);

    let updatedList: string[];
    if (isSelected) {
      updatedList = currentList.filter((i) => i !== item);
    } else {
      if (currentList.length >= MAX_TAGS_PER_CATEGORY) {
        return;
      }
      updatedList = [...currentList, item];
    }

    onChange({
      ...value,
      [categoryKey]: updatedList,
    });
  };

  // Toggle para seleção única (Estou disponível para)
  const toggleAvailability = (item: string) => {
    if (disabled) return;
    const isCurrentlySelected = value.profileAvailability === item;
    onChange({
      ...value,
      profileAvailability: isCurrentlySelected ? null : item,
    });
  };

  // Abertura do modal de adicionar opção
  const handleOpenAddModal = (cat: ActiveCategory) => {
    if (disabled) return;
    setActiveModalCategory(cat);
    setCustomInputText('');
    setCustomInputError(null);
  };

  // Salvar nova opção personalizada
  const handleConfirmCustomOption = () => {
    const clean = customInputText.trim();
    if (!clean) {
      setCustomInputError('O texto da opção não pode ser vazio.');
      return;
    }
    if (clean.length > MAX_TAG_LENGTH) {
      setCustomInputError(`Limite máximo de ${MAX_TAG_LENGTH} caracteres.`);
      return;
    }

    if (activeModalCategory === 'lookingFor') {
      const allKnown = [...SUGGESTIONS_LOOKING_FOR, ...customLookingFor];
      if (allKnown.some((k) => k.toLowerCase() === clean.toLowerCase())) {
        setCustomInputError('Esta opção já existe na lista.');
        return;
      }
      setCustomLookingFor((prev) => [...prev, clean]);
      onChange({
        ...value,
        profileLookingFor: [...(value.profileLookingFor || []), clean],
      });
    } else if (activeModalCategory === 'interests') {
      const allKnown = [...SUGGESTIONS_INTERESTS, ...customInterests];
      if (allKnown.some((k) => k.toLowerCase() === clean.toLowerCase())) {
        setCustomInputError('Este interesse já existe na lista.');
        return;
      }
      setCustomInterests((prev) => [...prev, clean]);
      onChange({
        ...value,
        profileInterests: [...(value.profileInterests || []), clean],
      });
    } else if (activeModalCategory === 'availability') {
      const allKnown = [...SUGGESTIONS_AVAILABILITY, ...customAvailability];
      if (allKnown.some((k) => k.toLowerCase() === clean.toLowerCase())) {
        setCustomInputError('Esta disponibilidade já existe na lista.');
        return;
      }
      setCustomAvailability((prev) => [...prev, clean]);
      onChange({
        ...value,
        profileAvailability: clean,
      });
    } else if (activeModalCategory === 'desires') {
      const allKnown = [...SUGGESTIONS_DESIRES, ...customDesires];
      if (allKnown.some((k) => k.toLowerCase() === clean.toLowerCase())) {
        setCustomInputError('Este desejo já existe na lista.');
        return;
      }
      setCustomDesires((prev) => [...prev, clean]);
      onChange({
        ...value,
        profileDesires: [...(value.profileDesires || []), clean],
      });
    }

    setActiveModalCategory(null);
    setCustomInputText('');
    setCustomInputError(null);
  };

  // Remover uma opção personalizada criada
  const handleRemoveCustomOption = (
    category: 'lookingFor' | 'interests' | 'availability' | 'desires',
    item: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (disabled) return;

    if (category === 'lookingFor') {
      setCustomLookingFor((prev) => prev.filter((i) => i !== item));
      onChange({
        ...value,
        profileLookingFor: (value.profileLookingFor || []).filter((i) => i !== item),
      });
    } else if (category === 'interests') {
      setCustomInterests((prev) => prev.filter((i) => i !== item));
      onChange({
        ...value,
        profileInterests: (value.profileInterests || []).filter((i) => i !== item),
      });
    } else if (category === 'availability') {
      setCustomAvailability((prev) => prev.filter((i) => i !== item));
      if (value.profileAvailability === item) {
        onChange({
          ...value,
          profileAvailability: null,
        });
      }
    } else if (category === 'desires') {
      setCustomDesires((prev) => prev.filter((i) => i !== item));
      onChange({
        ...value,
        profileDesires: (value.profileDesires || []).filter((i) => i !== item),
      });
    }
  };

  const getCategoryModalTitle = () => {
    switch (activeModalCategory) {
      case 'lookingFor':
        return 'Adicionar o que você procura';
      case 'interests':
        return 'Adicionar um interesse';
      case 'availability':
        return 'Adicionar disponibilidade personalizada';
      case 'desires':
        return 'Adicionar um desejo ou plano';
      default:
        return 'Nova opção personalizada';
    }
  };

  const getCategoryPlaceholder = () => {
    switch (activeModalCategory) {
      case 'lookingFor':
        return 'Ex: 🎵 Música ao vivo, ♟️ Xadrez...';
      case 'interests':
        return 'Ex: 🏎️ Automóveis, 📚 História, 🎸 Rock...';
      case 'availability':
        return 'Ex: 🟣 Disponível à noite, ☕ Fins de semana...';
      case 'desires':
        return 'Ex: ⛺ Acampar no feriado, 🎒 Mochilão...';
      default:
        return 'Digite sua opção...';
    }
  };

  return (
    <div className="space-y-5 text-left">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white">Sobre mim / O que procuro</h4>
            <p className="text-[11px] text-slate-400">
              Personalize suas intenções e interesses para que outras pessoas te conheçam melhor.
            </p>
          </div>
        </div>
      </div>

      {/* 1. À PROCURA DE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Target className="h-3.5 w-3.5 text-teal-400" />
            <span>À procura de</span>
          </div>
          <span className="text-[10px] text-slate-500">Múltipla escolha</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS_LOOKING_FOR.map((item) => {
            const isSelected = (value.profileLookingFor || []).includes(item);
            return (
              <button
                type="button"
                key={item}
                disabled={disabled}
                onClick={() => toggleMultiItem('profileLookingFor', item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-teal-600/30 text-teal-200 border border-teal-500/60 shadow-sm shadow-teal-950/40'
                    : 'bg-slate-800/70 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item}</span>
                {isSelected && <Check className="h-3 w-3 text-teal-400 shrink-0" />}
              </button>
            );
          })}

          {customLookingFor.map((item) => {
            const isSelected = (value.profileLookingFor || []).includes(item);
            return (
              <div
                key={item}
                onClick={() => toggleMultiItem('profileLookingFor', item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-teal-600/30 text-teal-200 border border-teal-500/60 shadow-sm shadow-teal-950/40'
                    : 'bg-slate-800/70 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item}</span>
                {isSelected && <Check className="h-3 w-3 text-teal-400 shrink-0" />}
                <button
                  type="button"
                  title="Remover opção personalizada"
                  onClick={(e) => handleRemoveCustomOption('lookingFor', item, e)}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            disabled={disabled}
            onClick={() => handleOpenAddModal('lookingFor')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-teal-500/40 bg-teal-950/20 hover:bg-teal-950/40 text-teal-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar outra</span>
          </button>
        </div>
      </div>

      {/* 2. INTERESSES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Interesses</span>
          </div>
          <span className="text-[10px] text-slate-500">Múltipla escolha</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS_INTERESTS.map((item) => {
            const isSelected = (value.profileInterests || []).includes(item);
            return (
              <button
                type="button"
                key={item}
                disabled={disabled}
                onClick={() => toggleMultiItem('profileInterests', item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/60 shadow-sm shadow-emerald-950/40'
                    : 'bg-slate-800/70 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item}</span>
                {isSelected && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
              </button>
            );
          })}

          {customInterests.map((item) => {
            const isSelected = (value.profileInterests || []).includes(item);
            return (
              <div
                key={item}
                onClick={() => toggleMultiItem('profileInterests', item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/60 shadow-sm shadow-emerald-950/40'
                    : 'bg-slate-800/70 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item}</span>
                {isSelected && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                <button
                  type="button"
                  title="Remover opção personalizada"
                  onClick={(e) => handleRemoveCustomOption('interests', item, e)}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            disabled={disabled}
            onClick={() => handleOpenAddModal('interests')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar outro</span>
          </button>
        </div>
      </div>

      {/* 3. ESTOU DISPONÍVEL PARA (SELEÇÃO ÚNICA) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span>Estou disponível para</span>
          </div>
          <span className="text-[10px] text-amber-400/80 font-medium">Seleção única</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS_AVAILABILITY.map((item) => {
            const isSelected = value.profileAvailability === item;
            return (
              <button
                type="button"
                key={item}
                disabled={disabled}
                onClick={() => toggleAvailability(item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-amber-600/30 text-amber-200 border border-amber-500/60 shadow-sm shadow-amber-950/40 ring-1 ring-amber-500/30'
                    : 'bg-slate-800/70 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item}</span>
                {isSelected && <Check className="h-3 w-3 text-amber-400 shrink-0" />}
              </button>
            );
          })}

          {customAvailability.map((item) => {
            const isSelected = value.profileAvailability === item;
            return (
              <div
                key={item}
                onClick={() => toggleAvailability(item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-amber-600/30 text-amber-200 border border-amber-500/60 shadow-sm shadow-amber-950/40 ring-1 ring-amber-500/30'
                    : 'bg-slate-800/70 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item}</span>
                {isSelected && <Check className="h-3 w-3 text-amber-400 shrink-0" />}
                <button
                  type="button"
                  title="Remover opção personalizada"
                  onClick={(e) => handleRemoveCustomOption('availability', item, e)}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            disabled={disabled}
            onClick={() => handleOpenAddModal('availability')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-950/20 hover:bg-amber-950/40 text-amber-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar outra</span>
          </button>
        </div>
      </div>

      {/* 4. DESEJOS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Heart className="h-3.5 w-3.5 text-rose-400" />
            <span>Desejos</span>
          </div>
          <span className="text-[10px] text-slate-500">Múltipla escolha</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS_DESIRES.map((item) => {
            const isSelected = (value.profileDesires || []).includes(item);
            return (
              <button
                type="button"
                key={item}
                disabled={disabled}
                onClick={() => toggleMultiItem('profileDesires', item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-rose-600/30 text-rose-200 border border-rose-500/60 shadow-sm shadow-rose-950/40'
                    : 'bg-slate-800/70 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item}</span>
                {isSelected && <Check className="h-3 w-3 text-rose-400 shrink-0" />}
              </button>
            );
          })}

          {customDesires.map((item) => {
            const isSelected = (value.profileDesires || []).includes(item);
            return (
              <div
                key={item}
                onClick={() => toggleMultiItem('profileDesires', item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-rose-600/30 text-rose-200 border border-rose-500/60 shadow-sm shadow-rose-950/40'
                    : 'bg-slate-800/70 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item}</span>
                {isSelected && <Check className="h-3 w-3 text-rose-400 shrink-0" />}
                <button
                  type="button"
                  title="Remover opção personalizada"
                  onClick={(e) => handleRemoveCustomOption('desires', item, e)}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            disabled={disabled}
            onClick={() => handleOpenAddModal('desires')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-rose-500/40 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar outro</span>
          </button>
        </div>
      </div>

      {/* MODAL / DIALOG PARA OPÇÃO PERSONALIZADA */}
      {activeModalCategory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setActiveModalCategory(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h5 className="text-xs sm:text-sm font-bold text-white">
                {getCategoryModalTitle()}
              </h5>
              <button
                type="button"
                onClick={() => setActiveModalCategory(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-slate-300 font-medium">
                Digite sua própria opção (com ou sem emoji):
              </label>
              <input
                type="text"
                autoFocus
                maxLength={MAX_TAG_LENGTH}
                value={customInputText}
                onChange={(e) => {
                  setCustomInputText(e.target.value);
                  setCustomInputError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmCustomOption();
                  }
                }}
                placeholder={getCategoryPlaceholder()}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Limite: {MAX_TAG_LENGTH} caracteres</span>
                <span>{customInputText.length}/{MAX_TAG_LENGTH}</span>
              </div>
            </div>

            {customInputError && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{customInputError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveModalCategory(null)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCustomOption}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/50 cursor-pointer active:scale-95"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

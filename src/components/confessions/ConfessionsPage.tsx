import React, { useEffect, useState } from 'react';
import { Confession, ConfessionSortFilter, CONFESSION_CATEGORIES, ConfessionCategory } from '../../types/confessions';
import { ConfessionCard } from './ConfessionCard';
import { Flame, Sparkles, MessageSquare, Shuffle, Clock, ArrowLeft, Plus, Loader2 } from 'lucide-react';

interface ConfessionsPageProps {
  onBack: () => void;
  onOpenCreateModal: () => void;
  onOpenDetailModal: (id: string) => void;
}

export const ConfessionsPage: React.FC<ConfessionsPageProps> = ({
  onBack,
  onOpenCreateModal,
  onOpenDetailModal,
}) => {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortFilter, setSortFilter] = useState<ConfessionSortFilter>('trending');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  const fetchConfessions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ sort: sortFilter });
      if (selectedCategory && selectedCategory !== 'Todas') {
        params.set('category', selectedCategory);
      }

      const res = await fetch(`/api/confessions?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setConfessions(data.confessions || []);
      }
    } catch (err) {
      console.error('Erro ao buscar confissões:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfessions();
  }, [sortFilter, selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="Voltar ao início"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-base">
              🕯️
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white">Mural das Confissões</h1>
              <p className="text-[11px] sm:text-xs text-slate-400">“O que você nunca diria usando seu nome?”</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Nova Confissão</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Filtros de Ordenação */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex rounded-2xl bg-slate-900 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setSortFilter('trending')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sortFilter === 'trending' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Em alta</span>
            </button>
            <button
              type="button"
              onClick={() => setSortFilter('recent')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sortFilter === 'recent' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Recentes</span>
            </button>
            <button
              type="button"
              onClick={() => setSortFilter('discussed')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sortFilter === 'discussed' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Mais discutidas</span>
            </button>
            <button
              type="button"
              onClick={() => setSortFilter('random')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sortFilter === 'random' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>Aleatórias</span>
            </button>
          </div>

          {/* Filtro por Categoria */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('Todas')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'Todas'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Todas
            </button>
            {CONFESSION_CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.name
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Confissões */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-xs text-slate-400">Carregando mural...</p>
          </div>
        ) : confessions.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800/60 space-y-4">
            <p className="text-base text-slate-300 font-medium">Nenhuma confissão encontrada.</p>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              Fazer a primeira confissão
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {confessions.map((confession) => (
              <ConfessionCard
                key={confession.id}
                confession={confession}
                onClick={() => onOpenDetailModal(confession.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

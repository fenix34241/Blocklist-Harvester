import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Sliders, ChevronDown, ChevronUp, Globe2, Layers, RefreshCw } from 'lucide-react';
import { SearchQueryInfo } from '../types';

interface SearchFormProps {
  isLoading: boolean;
  onHarvest: (data: {
    termino_busqueda: string;
    titulo_lista: string;
    descripcion: string;
    max_resultados: number;
  }) => void;
  executedQueries?: SearchQueryInfo[];
  appendMode: boolean;
  onToggleAppendMode: (enabled: boolean) => void;
  currentDomainCount: number;
}

const PRESETS = [
  {
    label: 'Juegos de Navegador',
    term: 'juegos de navegador',
    title: 'Browser Games Blocklist',
    desc: 'Blocklist de juegos web casuales, portales HTML5 y plataformas de juegos online para navegador.'
  },
  {
    label: 'Rastreadores Torrent',
    term: 'rastreadores torrent',
    title: 'Torrent Trackers & Portals Blocklist',
    desc: 'Lista de dominios de índices P2P, trackers de torrents y directorios de enlaces magnet.'
  },
  {
    label: 'Apuestas y Casinos',
    term: 'sitios de apuestas y casinos',
    title: 'Online Gambling & Casino Blocklist',
    desc: 'Dominios de apuestas deportivas, casinos virtuales y plataformas de juegos de azar online.'
  },
  {
    label: 'Crypto Faucets & Miners',
    term: 'crypto faucets',
    title: 'Crypto Faucets & Web Miners Blocklist',
    desc: 'Sitios web de faucets de criptomonedas, pay-to-click crypto y scripts de minería en navegador.'
  },
  {
    label: 'Streaming No Oficial',
    term: 'sitios de peliculas streaming gratis',
    title: 'Unofficial Streaming Portals Blocklist',
    desc: 'Portales de reproducción de series y películas en línea no oficiales con alta carga publicitaria.'
  }
];

export const SearchForm: React.FC<SearchFormProps> = ({
  isLoading,
  onHarvest,
  executedQueries,
  appendMode,
  onToggleAppendMode,
  currentDomainCount
}) => {
  const [terminoBusqueda, setTerminoBusqueda] = useState('juegos de navegador');
  const [tituloLista, setTituloLista] = useState('Browser Games Blocklist');
  const [descripcion, setDescripcion] = useState('Blocklist de juegos web y plataformas de juegos casuales en navegador.');
  const [maxResultados, setMaxResultados] = useState(50);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-sync title when term changes if user hasn't explicitly customized
  const handleTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTerminoBusqueda(val);
    if (!tituloLista || tituloLista.includes('Blocklist')) {
      const formatted = val.trim() ? `${val.trim().charAt(0).toUpperCase() + val.trim().slice(1)} Blocklist` : '';
      setTituloLista(formatted);
    }
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setTerminoBusqueda(preset.term);
    setTituloLista(preset.title);
    setDescripcion(preset.desc);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminoBusqueda.trim()) return;

    onHarvest({
      termino_busqueda: terminoBusqueda.trim(),
      titulo_lista: tituloLista.trim() || `${terminoBusqueda.trim()} Blocklist`,
      descripcion: descripcion.trim() || `Blocklist de dominios recolectados para ${terminoBusqueda.trim()}`,
      max_resultados: maxResultados
    });
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 sm:p-6 shadow-xl">
      {/* Preset selector bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-zinc-400">
            Plantillas rápidas recomendadas:
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const isActive = terminoBusqueda.toLowerCase() === p.term.toLowerCase();
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                  isActive
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-medium'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main Term Input */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
            Término de búsqueda <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={terminoBusqueda}
              onChange={handleTermChange}
              placeholder="ej. juegos de navegador, torrent trackers, crypto faucets, casinos..."
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium transition-colors"
            />
            <div className="absolute right-3 top-2.5 text-zinc-500">
              <Search className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            El sistema generará múltiples variaciones (sinónimos, consultas en inglés/español, "mejores sitios de X", etc.) para ampliar la cobertura orgánica.
          </p>
        </div>

        {/* Secondary Title and Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
              Título de la lista
            </label>
            <input
              type="text"
              value={tituloLista}
              onChange={(e) => setTituloLista(e.target.value)}
              placeholder="ej. Browser Games Blocklist"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
              Descripción del propósito
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="ej. Bloqueo de plataformas de juegos web en redes de trabajo"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Opciones de recolección y límite</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3.5 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-medium text-zinc-200">
                    Límite máximo de dominios a recolectar:
                  </span>
                  <p className="text-[11px] text-zinc-500">
                    Controla el tamaño de la lista antes de la deduplicación y el filtrado RFC 1035.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {[25, 50, 75, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxResultados(num)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        maxResultados === num
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button & Append / Merge Mode Switch */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            type="submit"
            disabled={isLoading || !terminoBusqueda.trim()}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm rounded-lg transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                <span>Ejecutando búsquedas y extrayendo dominios...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {appendMode && currentDomainCount > 0
                    ? 'Recolectar y Anexar a la Lista'
                    : 'Recolectar y Generar Blocklist'}
                </span>
              </>
            )}
          </button>

          {/* Append / Merge Mode Toggle Switch */}
          <label className="flex items-center gap-3 cursor-pointer select-none px-3.5 py-2 rounded-lg bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 transition-colors">
            <button
              type="button"
              role="switch"
              aria-checked={appendMode}
              onClick={() => onToggleAppendMode(!appendMode)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                appendMode ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-950 shadow-sm ring-0 transition duration-200 ease-in-out ${
                  appendMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                <Layers className={`w-3.5 h-3.5 ${appendMode ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span>Modo acumulativo: anexar a la lista actual</span>
              </span>
              <span className="text-[10px] text-zinc-500">
                {appendMode
                  ? `Fusionará nuevos dominios con los ${currentDomainCount} actuales sin duplicados`
                  : 'Reemplazará la lista actual en cada nueva búsqueda'}
              </span>
            </div>
          </label>
        </div>
      </form>

      {/* Executed Queries Inspector */}
      {executedQueries && executedQueries.length > 0 && (
        <div className="mt-5 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2">
            <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Consultas de búsqueda ejecutadas para amplitud de cobertura:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {executedQueries.map((q, idx) => (
              <div
                key={idx}
                className="bg-zinc-950/60 border border-zinc-800/80 rounded px-2.5 py-1.5 flex items-center justify-between text-xs"
              >
                <div className="truncate text-zinc-300 font-mono text-[11px]" title={q.query}>
                  "{q.query}"
                </div>
                <div className="flex items-center gap-1.5 ml-2 text-[10px] text-zinc-500 uppercase font-mono shrink-0">
                  <span>{q.language}</span>
                  <span>·</span>
                  <span>{q.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

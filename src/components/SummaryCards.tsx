import React from 'react';
import { HarvestSummary } from '../types';
import { ShieldCheck, AlertTriangle, Layers, Globe, CheckCircle2 } from 'lucide-react';

interface SummaryCardsProps {
  summary: HarvestSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 my-6">
      {/* 1. Dominios únicos en blocklist */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs font-medium text-zinc-400 mb-1">
          Dominios Únicos en Lista
        </div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
          {summary.uniqueCount}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Entradas activas 0.0.0.0
        </div>
      </div>

      {/* 2. Total recolectados */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs font-medium text-zinc-400 mb-1">
          Total Extraídos
        </div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-zinc-100">
          {summary.totalFound}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Resultados orgánicos analizados
        </div>
      </div>

      {/* 3. Búsquedas variadas ejecutadas */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs font-medium text-zinc-400 mb-1">
          Búsquedas Realizadas
        </div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-zinc-100">
          {summary.searchesExecutedCount}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Variaciones ES / EN / Intención
        </div>
      </div>

      {/* 4. Marcados para revisión */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs font-medium text-zinc-400 mb-1">
          Marcados para Revisión
        </div>
        <div className={`text-2xl sm:text-3xl font-bold font-mono ${
          summary.flaggedCount > 0 ? 'text-amber-400' : 'text-zinc-400'
        }`}>
          {summary.flaggedCount}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {summary.flaggedCount > 0 ? 'Riesgo de falso positivo o RFC' : 'Sin advertencias detectadas'}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DomainEntry, DnsCheckProgress } from '../types';
import {
  Search,
  AlertTriangle,
  XCircle,
  Layers,
  Plus,
  Activity,
  Trash2,
  GitCompare,
  CornerDownRight,
  Check,
  X,
  Sparkles,
  Filter
} from 'lucide-react';

export type DomainFilterTab = 'all' | 'included' | 'flagged' | 'variants' | 'diff_new' | 'diff_existing';

interface DomainTableProps {
  domains: DomainEntry[];
  onToggleDomain: (domain: string) => void;
  onSelectAll: (include: boolean) => void;
  onRemoveDomain: (domain: string) => void;
  onOpenAddModal: () => void;
  onOpenDiffModal: () => void;
  onCheckDnsBatch: (domainsToCheck: string[]) => void;
  onCancelDnsCheck: () => void;
  dnsProgress: DnsCheckProgress;
  onBlockRedirectTarget: (targetDomain: string) => void;
  diffSet: Set<string> | null;
  onClearDiff: () => void;
  onSelectOnlyNewDiff: () => void;
  activeTab: DomainFilterTab;
  onTabChange: (tab: DomainFilterTab) => void;
}

export const DomainTable: React.FC<DomainTableProps> = ({
  domains,
  onToggleDomain,
  onSelectAll,
  onRemoveDomain,
  onOpenAddModal,
  onOpenDiffModal,
  onCheckDnsBatch,
  onCancelDnsCheck,
  dnsProgress,
  onBlockRedirectTarget,
  diffSet,
  onClearDiff,
  onSelectOnlyNewDiff,
  activeTab,
  onTabChange
}) => {
  const [filterText, setFilterText] = useState('');
  const scrollParentRef = useRef<HTMLDivElement>(null);

  // O(1) lookup Map for checking whether a redirect/CNAME target is already in list/included
  const domainMap = useMemo(() => {
    const map = new Map<string, DomainEntry>();
    for (let i = 0; i < domains.length; i++) {
      map.set(domains[i].domain, domains[i]);
    }
    return map;
  }, [domains]);

  // Single-pass statistics computation in O(N)
  const stats = useMemo(() => {
    let flaggedCount = 0;
    let variantsCount = 0;
    let includedCount = 0;
    let diffExistingCount = 0;
    let diffNewCount = 0;

    for (let i = 0; i < domains.length; i++) {
      const d = domains[i];
      if (d.isIncluded) includedCount++;
      if (d.falsePositiveRisk.isHighRisk || !d.isValidRfc1035) flaggedCount++;
      if (d.variantDomains && d.variantDomains.length > 0) variantsCount++;
      if (diffSet) {
        if (diffSet.has(d.domain)) diffExistingCount++;
        else diffNewCount++;
      }
    }

    return {
      flaggedCount,
      variantsCount,
      includedCount,
      diffExistingCount,
      diffNewCount
    };
  }, [domains, diffSet]);

  const filteredDomains = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    const result: DomainEntry[] = [];

    for (let i = 0; i < domains.length; i++) {
      const item = domains[i];

      if (activeTab === 'included' && !item.isIncluded) continue;
      if (activeTab === 'flagged' && !item.falsePositiveRisk.isHighRisk && item.isValidRfc1035) continue;
      if (activeTab === 'variants' && (!item.variantDomains || item.variantDomains.length === 0)) continue;
      if (activeTab === 'diff_new' && diffSet && diffSet.has(item.domain)) continue;
      if (activeTab === 'diff_existing' && diffSet && !diffSet.has(item.domain)) continue;

      if (query) {
        const matchDomain = item.domain.includes(query);
        const matchTld = item.tld.includes(query);
        const matchReason = item.falsePositiveRisk.reason?.toLowerCase().includes(query);
        const matchTarget =
          item.cnameTarget?.includes(query) || item.redirectTarget?.includes(query);
        if (!matchDomain && !matchTld && !matchReason && !matchTarget) continue;
      }

      result.push(item);
    }

    return result;
  }, [domains, activeTab, filterText, diffSet]);

  const rowVirtualizer = useVirtualizer({
    count: filteredDomains.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 72,
    overscan: 8
  });

  const handleRunDnsOnVisible = () => {
    const list = filteredDomains.map(d => d.domain);
    onCheckDnsBatch(list);
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl mb-8">
      {/* Top Toolbar */}
      <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <span>Revisión y Gestión de Dominios</span>
            <span className="text-xs font-mono text-zinc-400 font-normal">
              ({filteredDomains.length.toLocaleString()} mostrados / {domains.length.toLocaleString()} total)
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Lista virtualizada de alto rendimiento. Activa o desactiva dominios individuales para actualizar la exportación en tiempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenDiffModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              diffSet
                ? 'text-emerald-300 bg-emerald-950/50 border-emerald-700/60 hover:bg-emerald-950/80'
                : 'text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border-zinc-700'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Comparar con lista existente (Diff)</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Añadir / Importar</span>
          </button>

          <button
            type="button"
            disabled={dnsProgress.isChecking || filteredDomains.length === 0}
            onClick={handleRunDnsOnVisible}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors disabled:opacity-50"
            title="Comprueba resolución DNS, registros CNAME y hasta 3 saltos de redirección HTTP en lotes"
          >
            <Activity className={`w-3.5 h-3.5 ${dnsProgress.isChecking ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
            <span>
              {dnsProgress.isChecking
                ? `DNS ${dnsProgress.percentage}%`
                : 'Comprobar DNS / CNAME'}
            </span>
          </button>
        </div>
      </div>

      {/* DNS Batch Progress Bar */}
      {dnsProgress.isChecking && (
        <div className="px-4 sm:px-5 py-3 bg-emerald-950/20 border-b border-emerald-900/40">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <Activity className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>
                Inspeccionando DNS, CNAME y redirecciones HTTP en lotes ({dnsProgress.processed.toLocaleString()} / {dnsProgress.total.toLocaleString()})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-semibold text-emerald-400">
                {dnsProgress.percentage}%
              </span>
              <button
                type="button"
                onClick={onCancelDnsCheck}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${dnsProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Diff Mode Active Banner */}
      {diffSet && (
        <div className="px-4 sm:px-5 py-3 bg-zinc-950/90 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-200">
              <GitCompare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Modo Diff activo:</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[11px]">
              Ya en tu lista: {stats.diffExistingCount.toLocaleString()}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 font-mono text-[11px]">
              Nuevos descubiertos: {stats.diffNewCount.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onTabChange('diff_new')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
                activeTab === 'diff_new'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-medium'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-zinc-100'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>Filtrar solo nuevos</span>
            </button>

            <button
              type="button"
              onClick={onSelectOnlyNewDiff}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>Seleccionar solo los nuevos para exportar</span>
            </button>

            <button
              type="button"
              onClick={onClearDiff}
              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Salir del modo Diff"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar Diff</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Tab Bar */}
      <div className="px-4 sm:px-5 py-3 bg-zinc-950/60 border-b border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Functional Segmented Controls */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900/90 border border-zinc-800 rounded-lg overflow-x-auto">
          <button
            onClick={() => onTabChange('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos ({domains.length.toLocaleString()})
          </button>

          <button
            onClick={() => onTabChange('included')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'included'
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Incluidos ({stats.includedCount.toLocaleString()})
          </button>

          <button
            onClick={() => onTabChange('flagged')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'flagged'
                ? 'bg-amber-950/70 text-amber-300 border border-amber-800/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Revisión Manual ({stats.flaggedCount.toLocaleString()})
          </button>

          <button
            onClick={() => onTabChange('variants')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'variants'
                ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Variantes TLD ({stats.variantsCount.toLocaleString()})
          </button>

          {diffSet && (
            <>
              <button
                onClick={() => onTabChange('diff_new')}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  activeTab === 'diff_new'
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Nuevos ({stats.diffNewCount.toLocaleString()})
              </button>
              <button
                onClick={() => onTabChange('diff_existing')}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  activeTab === 'diff_existing'
                    ? 'bg-zinc-800 text-zinc-200 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Ya en lista ({stats.diffExistingCount.toLocaleString()})
              </button>
            </>
          )}
        </div>

        {/* Search input inside table */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrar dominios, TLD o destino..."
            className="w-full bg-zinc-900 border border-zinc-700/70 rounded-md pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
        </div>
      </div>

      {/* Batch Select Controls */}
      <div className="px-4 sm:px-5 py-2 bg-zinc-950/30 border-b border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectAll(true)}
            className="hover:text-emerald-400 transition-colors"
          >
            Seleccionar todos
          </button>
          <span>·</span>
          <button
            onClick={() => onSelectAll(false)}
            className="hover:text-rose-400 transition-colors"
          >
            Deseleccionar todos
          </button>
        </div>
        <div className="text-[11px] text-zinc-400">
          Entrada Hosts: <span className="font-mono text-zinc-300">0.0.0.0 dominio</span>
        </div>
      </div>

      {/* Virtualized Table Content */}
      {filteredDomains.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-xs">
          No se encontraron dominios para este criterio de filtro.
        </div>
      ) : (
        <div
          ref={scrollParentRef}
          className="overflow-y-auto h-[460px] w-full"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = filteredDomains[virtualRow.index];
              const redirectOrAliasTarget = item.redirectTarget || item.cnameTarget || null;
              const targetEntry = redirectOrAliasTarget ? domainMap.get(redirectOrAliasTarget) : undefined;
              const isTargetIncluded = Boolean(targetEntry?.isIncluded);
              const isInDiffList = diffSet ? diffSet.has(item.domain) : false;

              return (
                <div
                  key={item.domain}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  className={`flex items-start sm:items-center justify-between px-4 sm:px-5 py-3 border-b border-zinc-800/80 transition-colors ${
                    item.isIncluded
                      ? 'bg-zinc-900/30 hover:bg-zinc-800/40'
                      : 'bg-zinc-950/40 opacity-60 hover:opacity-90'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0 pr-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={item.isIncluded}
                      onChange={() => onToggleDomain(item.domain)}
                      className="mt-1 sm:mt-0 rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-emerald-500/30 w-4 h-4 cursor-pointer shrink-0"
                    />

                    {/* Domain and alerts */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-zinc-100 tracking-tight">
                          {item.domain}
                        </span>

                        {/* Diff Classification Badges */}
                        {diffSet && (
                          isInDiffList ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                              Ya en tu lista
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-950/70 text-emerald-300 border border-emerald-700/60">
                              Nuevo descubierto
                            </span>
                          )
                        )}

                        {/* RFC 1035 Warning */}
                        {!item.isValidRfc1035 && (
                          <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            <span>No RFC 1035: {item.rfc1035Error}</span>
                          </span>
                        )}

                        {/* High Risk False Positive Warning */}
                        {item.falsePositiveRisk.isHighRisk && (
                          <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Riesgo Alto Falso Positivo</span>
                          </span>
                        )}

                        {/* DNS Status if resolved */}
                        {item.dnsStatus === 'active' && item.resolvedIp && (
                          <span className="text-[10px] font-mono text-emerald-400/90">
                            DNS: {item.resolvedIp}
                          </span>
                        )}
                        {item.dnsStatus === 'nxdomain' && (
                          <span className="text-[10px] font-mono text-zinc-500">
                            DNS: NXDOMAIN
                          </span>
                        )}
                      </div>

                      {/* CNAME / HTTP Redirect tag + Quick block target action */}
                      {redirectOrAliasTarget && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-800/50 text-cyan-300 font-mono">
                            <CornerDownRight className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>
                              ↳ CNAME / Redirige a: <strong className="text-cyan-200">{redirectOrAliasTarget}</strong>
                            </span>
                          </span>

                          {isTargetIncluded ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                              <Check className="w-3 h-3" />
                              <span>Destino incluido</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onBlockRedirectTarget(redirectOrAliasTarget)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-[10px] font-medium transition-colors"
                              title={`Añadir y marcar ${redirectOrAliasTarget} para bloqueo`}
                            >
                              <Plus className="w-3 h-3" />
                              <span>Bloquear destino ({redirectOrAliasTarget})</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Explanatory text for warnings, notes or variants */}
                      {item.notes && (
                        <p className="text-[11px] text-zinc-300 mt-0.5">
                          {item.notes}
                        </p>
                      )}

                      {item.falsePositiveRisk.reason && (
                        <p className="text-[11px] text-amber-400/90 mt-0.5">
                          ⚠️ {item.falsePositiveRisk.reason}
                        </p>
                      )}

                      {item.variantDomains && item.variantDomains.length > 0 && (
                        <div className="text-[11px] text-indigo-400/90 flex items-center gap-1.5 mt-0.5 font-mono">
                          <Layers className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span className="truncate">Variantes de TLD detectadas: {item.variantDomains.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions on right */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRemoveDomain(item.domain)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 rounded transition-colors"
                      title="Eliminar de la lista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

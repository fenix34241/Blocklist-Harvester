/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SearchForm } from './components/SearchForm';
import { SummaryCards } from './components/SummaryCards';
import { DomainTable, DomainFilterTab } from './components/DomainTable';
import { OutputViewer } from './components/OutputViewer';
import { AddDomainModal } from './components/AddDomainModal';
import { DiffCompareModal } from './components/DiffCompareModal';
import { PiholeInstructionsModal } from './components/PiholeInstructionsModal';
import { DomainEntry, HarvestResponse, DnsCheckProgress, SearchQueryInfo, ExportFormatMode } from './types';
import {
  formatPiHoleBlocklist,
  detectVariants,
  isValidRfc1035,
  assessFalsePositiveRisk,
  getIsoUtcTimestamp,
  slugify,
  normalizeDomain
} from './utils/domainExtractor';
import { AlertCircle, Shield, Plus, GitCompareArrows, Search } from 'lucide-react';

class HtmlResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HtmlResponseError';
  }
}

async function parseJsonResponse<T>(res: Response, endpointLabel: string): Promise<T> {
  const rawText = await res.text();
  const trimmed = rawText.trim();
  const contentType = res.headers.get('content-type') || '';

  if (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    (contentType.includes('text/html') && !contentType.includes('application/json'))
  ) {
    throw new HtmlResponseError(
      `El endpoint ${endpointLabel} devolvió HTML en lugar de JSON (HTTP ${res.status}). Verifica que el servidor backend Express esté activo (npm run dev / npm start) y no solo el frontend estático.`
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Respuesta no válida de ${endpointLabel} (HTTP ${res.status}): ${trimmed.slice(0, 120) || 'respuesta vacía'}`
    );
  }

  if (!res.ok) {
    throw new Error(parsed?.error || parsed?.details || `Error del servidor HTTP ${res.status}`);
  }

  return parsed as T;
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [harvestData, setHarvestData] = useState<HarvestResponse | null>(null);
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [executedQueries, setExecutedQueries] = useState<SearchQueryInfo[]>([]);
  const [formattedOutput, setFormattedOutput] = useState<string>('');
  const [timestamp, setTimestamp] = useState<string>(getIsoUtcTimestamp());

  // Append / Merge Mode
  const [appendMode, setAppendMode] = useState(false);

  // Selected Export Format (shared across Header guide button, OutputViewer & Guide Modal)
  const [formatMode, setFormatMode] = useState<ExportFormatMode>('pihole');

  // Modals & Filter Tab
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [activeTab, setActiveTab] = useState<DomainFilterTab>('all');

  // Diff Mode state (O(1) Set lookup)
  const [diffSet, setDiffSet] = useState<Set<string> | null>(null);

  // Batch DNS Check Progress & AbortController
  const [dnsProgress, setDnsProgress] = useState<DnsCheckProgress>({
    isChecking: false,
    processed: 0,
    total: 0,
    percentage: 0
  });
  const dnsAbortRef = useRef<AbortController | null>(null);
  const harvestAbortRef = useRef<AbortController | null>(null);

  // Ref to always access latest domains inside async append harvests
  const domainsRef = useRef<DomainEntry[]>(domains);
  domainsRef.current = domains;

  const queriesRef = useRef<SearchQueryInfo[]>(executedQueries);
  queriesRef.current = executedQueries;

  const updateBlocklistOutput = useCallback((
    updatedDomains: DomainEntry[],
    meta?: { title?: string; desc?: string; ts?: string }
  ) => {
    const included: string[] = [];
    for (let i = 0; i < updatedDomains.length; i++) {
      if (updatedDomains[i].isIncluded) {
        included.push(updatedDomains[i].domain);
      }
    }
    const title = meta?.title || harvestData?.metadata.titulo_lista || 'Blocklist';
    const desc = meta?.desc || harvestData?.metadata.descripcion || 'Pi-hole blocklist';
    const ts = meta?.ts || timestamp;

    const newOutput = formatPiHoleBlocklist({
      title,
      description: desc,
      timestamp: ts,
      domains: included
    });

    setFormattedOutput(newOutput);
  }, [harvestData, timestamp]);

  const handleCancelHarvest = useCallback(() => {
    if (harvestAbortRef.current) {
      harvestAbortRef.current.abort();
      harvestAbortRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const handleHarvest = async (params: {
    termino_busqueda: string;
    titulo_lista: string;
    descripcion: string;
    max_resultados: number;
  }, retryAttempt = 0) => {
    if (harvestAbortRef.current) {
      harvestAbortRef.current.abort();
    }
    const controller = new AbortController();
    harvestAbortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/harvest', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(params),
        signal: controller.signal
      });

      // Retry on transient gateway/startup 502/503/504
      if (retryAttempt < 2 && (response.status === 502 || response.status === 503 || response.status === 504)) {
        await new Promise(r => setTimeout(r, 900 * (retryAttempt + 1)));
        if (controller.signal.aborted) return;
        return handleHarvest(params, retryAttempt + 1);
      }

      let data: HarvestResponse;
      try {
        data = await parseJsonResponse<HarvestResponse>(response, '/api/harvest');
      } catch (parseErr) {
        // Retry if proxy/gateway temporarily returned an HTML splash/loading page (e.g. HTTP 200 during server restart)
        if (parseErr instanceof HtmlResponseError && retryAttempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * (retryAttempt + 1)));
          if (controller.signal.aborted) return;
          return handleHarvest(params, retryAttempt + 1);
        }
        throw parseErr;
      }

      if (!data.domains || data.domains.length === 0) {
        setError(`No se encontraron dominios orgánicos para "${params.termino_busqueda}". Prueba con términos más amplios o en inglés.`);
      }

      if (appendMode && domainsRef.current.length > 0) {
        // Merge existing domains + new domains in O(N) using Map<string, DomainEntry>
        const mergedMap = new Map<string, DomainEntry>();

        for (let i = 0; i < domainsRef.current.length; i++) {
          const existing = domainsRef.current[i];
          mergedMap.set(existing.domain, existing);
        }

        for (let i = 0; i < data.domains.length; i++) {
          const incoming = data.domains[i];
          const prev = mergedMap.get(incoming.domain);
          if (prev) {
            // Preserve user's selection, DNS results, and merge sourceUrls using Set
            const urlSet = new Set<string>(prev.sourceUrls);
            for (let u = 0; u < incoming.sourceUrls.length; u++) {
              urlSet.add(incoming.sourceUrls[u]);
            }
            mergedMap.set(incoming.domain, {
              ...prev,
              sourceUrls: Array.from(urlSet),
              notes: prev.notes || incoming.notes
            });
          } else {
            mergedMap.set(incoming.domain, incoming);
          }
        }

        const allNames = Array.from(mergedMap.keys());
        const variantMap = detectVariants(allNames);
        const mergedList: DomainEntry[] = new Array(allNames.length);
        for (let i = 0; i < allNames.length; i++) {
          const name = allNames[i];
          const entry = mergedMap.get(name)!;
          mergedList[i] = {
            ...entry,
            variantDomains: variantMap.get(name)
          };
        }
        mergedList.sort((a, b) => (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0));

        // Merge executed queries using Set
        const querySet = new Set<string>(queriesRef.current.map(q => q.query.toLowerCase()));
        const mergedQueries = [...queriesRef.current];
        for (const q of data.queriesExecuted) {
          if (!querySet.has(q.query.toLowerCase())) {
            querySet.add(q.query.toLowerCase());
            mergedQueries.push(q);
          }
        }

        const newTs = data.metadata.timestamp;
        setHarvestData({
          ...data,
          queriesExecuted: mergedQueries
        });
        setExecutedQueries(mergedQueries);
        setDomains(mergedList);
        setTimestamp(newTs);
        updateBlocklistOutput(mergedList, {
          title: data.metadata.titulo_lista,
          desc: data.metadata.descripcion,
          ts: newTs
        });
      } else {
        // Replace mode
        setHarvestData(data);
        setExecutedQueries(data.queriesExecuted);
        setDomains(data.domains);
        setFormattedOutput(data.formattedOutput);
        setTimestamp(data.metadata.timestamp);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      console.error('Harvest request failed:', err);
      setError(err?.message || 'Error al recolectar dominios.');
    } finally {
      if (harvestAbortRef.current === controller) {
        harvestAbortRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const handleToggleDomain = useCallback((domainName: string) => {
    setDomains(prev => {
      const updated = prev.map(d =>
        d.domain === domainName ? { ...d, isIncluded: !d.isIncluded } : d
      );
      updateBlocklistOutput(updated);
      return updated;
    });
  }, [updateBlocklistOutput]);

  const handleSelectAll = useCallback((include: boolean) => {
    setDomains(prev => {
      const updated = prev.map(d => ({ ...d, isIncluded: include }));
      updateBlocklistOutput(updated);
      return updated;
    });
  }, [updateBlocklistOutput]);

  const handleRemoveDomain = useCallback((domainName: string) => {
    setDomains(prev => {
      const updated = prev.filter(d => d.domain !== domainName);
      updateBlocklistOutput(updated);
      return updated;
    });
  }, [updateBlocklistOutput]);

  const handleAddEntries = useCallback((newEntries: DomainEntry[]) => {
    setDomains(prev => {
      const mergedMap = new Map<string, DomainEntry>();
      for (let i = 0; i < prev.length; i++) {
        mergedMap.set(prev[i].domain, prev[i]);
      }
      for (let i = 0; i < newEntries.length; i++) {
        if (!mergedMap.has(newEntries[i].domain)) {
          mergedMap.set(newEntries[i].domain, newEntries[i]);
        }
      }

      const allNames = Array.from(mergedMap.keys());
      const variantMap = detectVariants(allNames);
      const updated: DomainEntry[] = new Array(allNames.length);
      for (let i = 0; i < allNames.length; i++) {
        const name = allNames[i];
        const entry = mergedMap.get(name)!;
        updated[i] = {
          ...entry,
          variantDomains: variantMap.get(name)
        };
      }
      updated.sort((a, b) => (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0));
      updateBlocklistOutput(updated);
      return updated;
    });
  }, [updateBlocklistOutput]);

  const handleBlockRedirectTarget = useCallback((rawTarget: string) => {
    const normalized = normalizeDomain(rawTarget);
    if (!normalized) return;

    const rfc = isValidRfc1035(normalized);
    if (!rfc.isValid) {
      setError(`No se puede añadir "${normalized}": ${rfc.error}`);
      return;
    }

    setDomains(prev => {
      const map = new Map<string, DomainEntry>();
      for (let i = 0; i < prev.length; i++) {
        map.set(prev[i].domain, prev[i]);
      }

      const existing = map.get(normalized);
      if (existing) {
        map.set(normalized, { ...existing, isIncluded: true });
      } else {
        const risk = assessFalsePositiveRisk(normalized);
        const dotIdx = normalized.lastIndexOf('.');
        const tld = dotIdx !== -1 ? normalized.slice(dotIdx + 1) : '';
        map.set(normalized, {
          domain: normalized,
          sourceUrls: ['CNAME / Redirección HTTP'],
          tld,
          isValidRfc1035: true,
          falsePositiveRisk: risk,
          isIncluded: true,
          notes: 'Destino detectado mediante inspección CNAME / redirección HTTP'
        });
      }

      const allNames = Array.from(map.keys());
      const variantMap = detectVariants(allNames);
      const updated: DomainEntry[] = new Array(allNames.length);
      for (let i = 0; i < allNames.length; i++) {
        const name = allNames[i];
        updated[i] = {
          ...map.get(name)!,
          variantDomains: variantMap.get(name)
        };
      }
      updated.sort((a, b) => (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0));
      updateBlocklistOutput(updated);
      return updated;
    });
  }, [updateBlocklistOutput]);

  /**
   * Batch DNS + CNAME + Redirect check with chunking (30 per batch) & concurrency semaphore (max 2 parallel)
   */
  const handleCheckDnsBatch = async (domainList: string[]) => {
    if (domainList.length === 0) return;

    if (dnsAbortRef.current) {
      dnsAbortRef.current.abort();
    }
    const controller = new AbortController();
    dnsAbortRef.current = controller;

    // Deduplicate input list with Set
    const uniqueDomains = Array.from(new Set(domainList));
    const CHUNK_SIZE = 30;
    const CONCURRENCY = 2;

    const chunks: string[][] = [];
    for (let i = 0; i < uniqueDomains.length; i += CHUNK_SIZE) {
      chunks.push(uniqueDomains.slice(i, i + CHUNK_SIZE));
    }

    const total = uniqueDomains.length;
    let processed = 0;

    setDnsProgress({
      isChecking: true,
      processed: 0,
      total,
      percentage: 0
    });

    let chunkCursor = 0;

    const runChunkWorker = async () => {
      while (chunkCursor < chunks.length) {
        if (controller.signal.aborted) break;
        const idx = chunkCursor++;
        const batch = chunks[idx];

        try {
          const fetchDnsBatch = async (attempt = 0): Promise<{ results?: Record<string, any> }> => {
            const res = await fetch('/api/dns-check', {
              method: 'POST',
              credentials: 'same-origin',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({ domains: batch }),
              signal: controller.signal
            });
            if (attempt === 0 && (res.status === 502 || res.status === 503 || res.status === 504)) {
              await new Promise(r => setTimeout(r, 900));
              if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
              return fetchDnsBatch(1);
            }
            try {
              return await parseJsonResponse<{ results?: Record<string, any> }>(res, '/api/dns-check');
            } catch (err) {
              if (err instanceof HtmlResponseError && attempt === 0) {
                await new Promise(r => setTimeout(r, 900));
                if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                return fetchDnsBatch(1);
              }
              throw err;
            }
          };

          const data = await fetchDnsBatch();
          const results = data.results || {};

          // Merge batch results via O(1) Map lookup
          setDomains(prev => prev.map(d => {
            const info = results[d.domain];
            if (!info) return d;
            return {
              ...d,
              dnsStatus: info.status,
              resolvedIp: info.ip,
              cnameTarget: info.cnameTarget ?? null,
              redirectTarget: info.redirectTarget ?? null,
              redirectChain: info.redirectChain,
              isRedirectOrAlias: info.isRedirectOrAlias
            };
          }));
        } catch (err: any) {
          if (err?.name === 'AbortError') break;
          if (err instanceof HtmlResponseError) {
            setError(err.message);
            controller.abort();
            break;
          }
          console.warn('Chunk DNS lookup failed:', err);
        } finally {
          processed = Math.min(total, processed + batch.length);
          const percentage = Math.round((processed / total) * 100);
          setDnsProgress({
            isChecking: !controller.signal.aborted && processed < total,
            processed,
            total,
            percentage
          });
        }
      }
    };

    try {
      const workers = Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => runChunkWorker());
      await Promise.all(workers);
    } finally {
      setDnsProgress(prev => ({
        ...prev,
        isChecking: false
      }));
    }
  };

  const handleCancelDnsCheck = useCallback(() => {
    if (dnsAbortRef.current) {
      dnsAbortRef.current.abort();
      dnsAbortRef.current = null;
    }
    setDnsProgress(prev => ({ ...prev, isChecking: false }));
  }, []);

  // Diff Mode handlers
  const handleApplyDiff = useCallback((
    importedSet: Set<string>,
    options: { filterNewOnly?: boolean; selectNewOnly?: boolean }
  ) => {
    setDiffSet(importedSet);
    if (options.filterNewOnly) {
      setActiveTab('diff_new');
    }
    if (options.selectNewOnly) {
      setDomains(prev => {
        const updated = prev.map(d => ({
          ...d,
          isIncluded: !importedSet.has(d.domain) && d.isValidRfc1035 && !d.falsePositiveRisk.isHighRisk
        }));
        updateBlocklistOutput(updated);
        return updated;
      });
    }
  }, [updateBlocklistOutput]);

  const handleSelectOnlyNewDiff = useCallback(() => {
    if (!diffSet) return;
    setDomains(prev => {
      const updated = prev.map(d => ({
        ...d,
        isIncluded: !diffSet.has(d.domain) && d.isValidRfc1035 && !d.falsePositiveRisk.isHighRisk
      }));
      updateBlocklistOutput(updated);
      return updated;
    });
  }, [diffSet, updateBlocklistOutput]);

  const handleClearDiff = useCallback(() => {
    setDiffSet(null);
    if (activeTab === 'diff_new' || activeTab === 'diff_existing') {
      setActiveTab('all');
    }
  }, [activeTab]);

  // Single-pass summary stats memoized for tens of thousands of domains
  const { currentSummary, existingDomainNames } = useMemo(() => {
    let includedCount = 0;
    let flaggedCount = 0;
    let variantsCount = 0;
    const names: string[] = new Array(domains.length);

    for (let i = 0; i < domains.length; i++) {
      const d = domains[i];
      names[i] = d.domain;
      if (d.isIncluded) includedCount++;
      if (d.falsePositiveRisk.isHighRisk || !d.isValidRfc1035) flaggedCount++;
      if (d.variantDomains && d.variantDomains.length > 0) variantsCount++;
    }

    return {
      existingDomainNames: names,
      currentSummary: {
        totalFound: domains.length,
        uniqueCount: includedCount,
        searchesExecutedCount: executedQueries.length || harvestData?.summary.searchesExecutedCount || 5,
        flaggedCount,
        variantsCount,
        excludedCount: domains.length - includedCount
      }
    };
  }, [domains, executedQueries.length, harvestData]);

  const currentTitle = harvestData?.metadata.titulo_lista || 'Custom Blocklist';
  const currentSlug = harvestData?.metadata.slug || `${slugify(currentTitle)}.txt`;
  const limitations = harvestData?.limitations || [
    'Esta lista es generada automáticamente a partir de resultados de búsqueda públicos; no reemplaza revisión manual antes de desplegar en producción.',
    'Puede haber falsos positivos (dominios legítimos que aparecen en resultados relacionados tangencialmente) y falsos negativos (sitios que no indexan bien).'
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30">
      <Header onOpenDocs={() => setShowDocsModal(true)} formatMode={formatMode} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error notification if any */}
        {error && (
          <div className="mb-6 p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-200 text-xs font-semibold"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Search and configuration block */}
        <SearchForm
          isLoading={isLoading}
          onHarvest={handleHarvest}
          onCancelHarvest={handleCancelHarvest}
          executedQueries={executedQueries}
          appendMode={appendMode}
          onToggleAppendMode={setAppendMode}
          currentDomainCount={domains.length}
        />

        {/* Empty state before first search or manual import */}
        {domains.length === 0 && !isLoading && (
          <div className="mt-6 bg-zinc-900/60 border border-dashed border-zinc-800 rounded-xl p-8 text-center">
            <div className="w-11 h-11 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-emerald-400">
              <Search className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-200">
              Listo para recolectar dominios
            </h2>
            <p className="text-xs text-zinc-400 max-w-lg mx-auto mt-1.5 leading-relaxed">
              Escribe un término de búsqueda arriba o elige una plantilla rápida para comenzar. También puedes importar una lista existente en <code className="text-zinc-300">.txt</code> para filtrarla, validarla con RFC 1035 o inspeccionar su DNS.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Importar lista / añadir dominios</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDiffModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg transition-colors"
              >
                <GitCompareArrows className="w-3.5 h-3.5 text-indigo-400" />
                <span>Cargar lista base (Diff)</span>
              </button>
            </div>
          </div>
        )}

        {/* Summary Metric Cards */}
        {domains.length > 0 && (
          <SummaryCards summary={currentSummary} />
        )}

        {/* Virtualized Domain review table */}
        {domains.length > 0 && (
          <DomainTable
            domains={domains}
            onToggleDomain={handleToggleDomain}
            onSelectAll={handleSelectAll}
            onRemoveDomain={handleRemoveDomain}
            onOpenAddModal={() => setShowAddModal(true)}
            onOpenDiffModal={() => setShowDiffModal(true)}
            onCheckDnsBatch={handleCheckDnsBatch}
            onCancelDnsCheck={handleCancelDnsCheck}
            dnsProgress={dnsProgress}
            onBlockRedirectTarget={handleBlockRedirectTarget}
            diffSet={diffSet}
            onClearDiff={handleClearDiff}
            onSelectOnlyNewDiff={handleSelectOnlyNewDiff}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}

        {/* Exact Pi-hole & Network Export Viewer */}
        {formattedOutput && (
          <OutputViewer
            formattedOutput={formattedOutput}
            domains={domains}
            slug={currentSlug}
            title={currentTitle}
            uniqueCount={currentSummary.uniqueCount}
            limitations={limitations}
            formatMode={formatMode}
            onFormatModeChange={setFormatMode}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/70 bg-zinc-950/80 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Blocklist Harvester</span>
            <span>·</span>
            <span>Estándar RFC 1035 / Hosts</span>
          </div>
          <div>
            Filtrado DNS y protección de red local
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddDomainModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddEntries={handleAddEntries}
        existingDomains={existingDomainNames}
      />

      <DiffCompareModal
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        currentDomains={existingDomainNames}
        onApplyDiff={handleApplyDiff}
      />

      <PiholeInstructionsModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
        slug={currentSlug}
        formatMode={formatMode}
      />
    </div>
  );
}

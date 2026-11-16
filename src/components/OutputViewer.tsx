import React, { useState, useMemo } from 'react';
import {
  Download,
  Copy,
  Check,
  ShieldAlert,
  Info
} from 'lucide-react';
import { DomainEntry, ExportFormatMode } from '../types';

interface OutputViewerProps {
  formattedOutput: string;
  domains: DomainEntry[];
  slug: string;
  title: string;
  uniqueCount: number;
  limitations: string[];
  formatMode: ExportFormatMode;
  onFormatModeChange: (mode: ExportFormatMode) => void;
}

const PREVIEW_LINE_LIMIT = 1000;

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const OutputViewer: React.FC<OutputViewerProps> = ({
  formattedOutput,
  domains,
  slug,
  title,
  uniqueCount,
  limitations,
  formatMode,
  onFormatModeChange
}) => {
  const [copied, setCopied] = useState(false);

  // Extract sorted included DomainEntry items once with useMemo
  const includedEntries = useMemo(() => {
    const seen = new Set<string>();
    const list: DomainEntry[] = [];
    for (let i = 0; i < domains.length; i++) {
      const entry = domains[i];
      if (entry.isIncluded && !seen.has(entry.domain)) {
        seen.add(entry.domain);
        list.push(entry);
      }
    }
    list.sort((a, b) => (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0));
    return list;
  }, [domains]);

  const displayedText = useMemo(() => {
    if (formatMode === 'pihole') {
      return formattedOutput;
    }

    if (formatMode === 'plain') {
      return includedEntries.map(e => e.domain).join('\n');
    }

    if (formatMode === 'adguard') {
      const header = `! Title: ${title}\n! Format: AdGuard Home\n! Total: ${includedEntries.length}\n`;
      const rules = includedEntries.map(e => `||${e.domain}^`).join('\n');
      return `${header}\n${rules}`;
    }

    if (formatMode === 'dnsmasq') {
      const header = `# Title: ${title}\n# Format: Dnsmasq\n# Total: ${includedEntries.length}\n`;
      const rules = includedEntries.map(e => `address=/${e.domain}/0.0.0.0`).join('\n');
      return `${header}\n${rules}`;
    }

    if (formatMode === 'unbound') {
      const header = `# Title: ${title}\n# Format: Unbound DNS\n# Total: ${includedEntries.length}\n`;
      const rules = includedEntries.map(e => `local-zone: "${e.domain}" always_nxdomain`).join('\n');
      return `${header}\n${rules}`;
    }

    if (formatMode === 'mikrotik') {
      const header = `# Title: ${title}\n# Format: MikroTik RouterOS DNS Static\n# Total: ${includedEntries.length}\n`;
      const rules = includedEntries.map(e => `/ip dns static add name="${e.domain}" address=0.0.0.0`).join('\n');
      return `${header}\n${rules}`;
    }

    if (formatMode === 'pfsense') {
      const header = `# Title: ${title}\n# Format: pfSense / OPNsense (pfBlockerNG DNSBL)\n# Total: ${includedEntries.length}\n`;
      const rules = includedEntries.map(e => e.domain).join('\n');
      return `${header}\n${rules}`;
    }

    if (formatMode === 'csv') {
      const header = 'dominio,estado_dns,ip_resuelta,variante_tld,es_redireccion';
      const rows = includedEntries.map(e => {
        const estadoDns = e.dnsStatus || 'unknown';
        const ipResuelta = e.resolvedIp || '';
        const varianteTld = e.variantDomains && e.variantDomains.length > 0 ? e.variantDomains.join('; ') : '';
        const esRedireccion = e.isRedirectOrAlias || Boolean(e.cnameTarget || e.redirectTarget) ? 'true' : 'false';
        return [
          escapeCsvField(e.domain),
          escapeCsvField(estadoDns),
          escapeCsvField(ipResuelta),
          escapeCsvField(varianteTld),
          esRedireccion
        ].join(',');
      });
      return `${header}\n${rows.join('\n')}`;
    }

    return formattedOutput;
  }, [formatMode, formattedOutput, includedEntries, title]);

  // Fast preview truncation for massive lists (>1000 lines) to keep DOM instantaneous
  const { previewText, totalLinesCount, isTruncated } = useMemo(() => {
    const lines = displayedText.split('\n');
    if (lines.length > PREVIEW_LINE_LIMIT) {
      return {
        previewText: lines.slice(0, PREVIEW_LINE_LIMIT).join('\n'),
        totalLinesCount: lines.length,
        isTruncated: true
      };
    }
    return {
      previewText: displayedText,
      totalLinesCount: lines.length,
      isTruncated: false
    };
  }, [displayedText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = displayedText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getDownloadFilename = () => {
    if (formatMode === 'pihole') return slug;
    if (formatMode === 'csv') return `${slug.replace(/\.txt$/i, '')}.csv`;
    return `${slug.replace(/\.txt$/i, '')}-${formatMode}.txt`;
  };

  const handleDownload = () => {
    const filename = getDownloadFilename();
    const mime = formatMode === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([displayedText], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Verify exact Pi-hole format conformance without splitting huge strings twice
  const isCountExact = includedEntries.length === uniqueCount;
  const downloadFilename = getDownloadFilename();

  const FORMAT_TABS: Array<{ id: ExportFormatMode; label: string }> = [
    { id: 'pihole', label: 'Pi-hole / hosts' },
    { id: 'unbound', label: 'Unbound DNS' },
    { id: 'mikrotik', label: 'MikroTik RouterOS' },
    { id: 'pfsense', label: 'pfSense / pfBlockerNG' },
    { id: 'adguard', label: 'AdGuard Home' },
    { id: 'dnsmasq', label: 'Dnsmasq' },
    { id: 'plain', label: 'Solo dominios' },
    { id: 'csv', label: 'CSV' }
  ];

  return (
    <div id="output-section" className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl mb-10">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100">
              Archivo Generado: <span className="font-mono text-emerald-400">{downloadFilename}</span>
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Formato estándar RFC 1035, UTF-8, saltos de línea LF. Compatible con Pi-hole, routers y firewalls DNSBL.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copiar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-all shadow-md shadow-emerald-950/40"
          >
            <Download className="w-3.5 h-3.5 text-zinc-950" />
            <span>Descargar {downloadFilename}</span>
          </button>
        </div>
      </div>

      {/* Format Selector Bar */}
      <div className="px-4 sm:px-5 py-2.5 bg-zinc-950/70 border-b border-zinc-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-zinc-500 mr-1">Formato:</span>
          {FORMAT_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onFormatModeChange(tab.id)}
              className={`px-2.5 py-1 rounded transition-colors ${
                formatMode === tab.id
                  ? 'bg-zinc-800 text-emerald-400 font-medium border border-zinc-700/70'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-zinc-500 font-mono text-[11px] shrink-0">
          <span>Dominios: {includedEntries.length.toLocaleString()}</span>
          <span>·</span>
          <span className={isCountExact ? 'text-emerald-400' : 'text-rose-400'}>
            {isCountExact ? 'Sincronizado con Unique domains' : 'Discrepancia en conteo'}
          </span>
        </div>
      </div>

      {/* Truncated Preview Notice for massive lists */}
      {isTruncated && (
        <div className="px-4 sm:px-5 py-2 bg-zinc-900/70 border-b border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            Vista previa limitada a las primeras {PREVIEW_LINE_LIMIT.toLocaleString()} líneas de {totalLinesCount.toLocaleString()} para mantener fluidez. Al copiar o descargar se exportará el 100% del archivo.
          </span>
        </div>
      )}

      {/* Code Text Area */}
      <div className="p-4 sm:p-5 bg-zinc-950 font-mono text-xs text-zinc-300 overflow-x-auto max-h-[380px] leading-relaxed selection:bg-emerald-500/30">
        <pre className="whitespace-pre">{previewText}</pre>
      </div>

      {/* Mandatory Limitations block */}
      <div className="p-4 sm:p-5 bg-zinc-950/90 border-t border-zinc-800/80">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-zinc-200">
              Limitaciones a declarar antes del despliegue:
            </h4>
            <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
              {limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

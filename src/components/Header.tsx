import React from 'react';
import { Shield, BookOpen, Download } from 'lucide-react';
import { ExportFormatMode } from '../types';

interface HeaderProps {
  onOpenDocs: () => void;
  formatMode: ExportFormatMode;
}

const GUIDE_LABELS: Record<ExportFormatMode, string> = {
  pihole: 'Guía Pi-hole',
  unbound: 'Guía Unbound DNS',
  mikrotik: 'Guía MikroTik RouterOS',
  pfsense: 'Guía pfSense / pfBlockerNG',
  adguard: 'Guía AdGuard Home',
  dnsmasq: 'Guía Dnsmasq',
  plain: 'Guía Solo dominios',
  csv: 'Guía CSV'
};

export const Header: React.FC<HeaderProps> = ({ onOpenDocs, formatMode }) => {
  const guideLabel = GUIDE_LABELS[formatMode] || 'Guía Pi-hole';
  const fileExtLabel = formatMode === 'csv' ? 'Ver Archivo .csv' : 'Ver Archivo .txt';

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-zinc-100 tracking-tight">
                Blocklist Harvester
              </h1>
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400/90 font-medium">
                RFC 1035
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Recolección inteligente de dominios, deduplicación y exportación multiformato
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenDocs}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 rounded-md transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>{guideLabel}</span>
          </button>

          <a
            href="#output-section"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/50 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{fileExtLabel}</span>
          </a>
        </div>
      </div>
    </header>
  );
};

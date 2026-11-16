import React, { useState, useRef } from 'react';
import { X, GitCompare, Upload, FileText, AlertCircle, Cpu, CheckCircle2, Sparkles } from 'lucide-react';
import { parseDiffListAsync } from '../utils/workerClient';

interface DiffCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDomains: string[];
  onApplyDiff: (importedSet: Set<string>, options: { filterNewOnly?: boolean; selectNewOnly?: boolean }) => void;
}

export const DiffCompareModal: React.FC<DiffCompareModalProps> = ({
  isOpen,
  onClose,
  currentDomains,
  onApplyDiff
}) => {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewStats, setPreviewStats] = useState<{
    importedSet: Set<string>;
    importedCount: number;
    existingCount: number;
    newCount: number;
    usedWorker: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const analyzeText = async (text: string) => {
    if (!text.trim()) {
      setPreviewStats(null);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const { parsedDomains, usedWorker } = await parseDiffListAsync(text);
      const importedSet = new Set<string>(parsedDomains);

      let existingCount = 0;
      let newCount = 0;
      for (let i = 0; i < currentDomains.length; i++) {
        if (importedSet.has(currentDomains[i])) {
          existingCount++;
        } else {
          newCount++;
        }
      }

      setPreviewStats({
        importedSet,
        importedCount: importedSet.size,
        existingCount,
        newCount,
        usedWorker
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error procesando la lista para comparación.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = String(ev.target?.result || '');
      setInputText(content);
      await analyzeText(content);
    };
    reader.onerror = () => {
      setErrorMsg('No se pudo leer el archivo seleccionado.');
    };
    reader.readAsText(file);
  };

  const handleApply = async (options: { filterNewOnly?: boolean; selectNewOnly?: boolean }) => {
    if (!inputText.trim()) {
      setErrorMsg('Pega el contenido de tu lista o carga un archivo .txt primero.');
      return;
    }

    let stats = previewStats;
    if (!stats) {
      setIsProcessing(true);
      try {
        const { parsedDomains, usedWorker } = await parseDiffListAsync(inputText);
        const importedSet = new Set<string>(parsedDomains);
        let existingCount = 0;
        let newCount = 0;
        for (let i = 0; i < currentDomains.length; i++) {
          if (importedSet.has(currentDomains[i])) existingCount++;
          else newCount++;
        }
        stats = {
          importedSet,
          importedCount: importedSet.size,
          existingCount,
          newCount,
          usedWorker
        };
      } catch (err: any) {
        setErrorMsg(err?.message || 'Error al analizar la lista.');
        setIsProcessing(false);
        return;
      } finally {
        setIsProcessing(false);
      }
    }

    if (stats.importedCount === 0) {
      setErrorMsg('No se encontraron dominios válidos en el texto o archivo proporcionado.');
      return;
    }

    onApplyDiff(stats.importedSet, options);
    onClose();
  };

  const lineEstimate = inputText ? inputText.split('\n').length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <GitCompare className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-semibold text-zinc-100">
            Comparar con lista existente (Diff Mode)
          </h3>
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          Importa tu blocklist actual (Pi-hole hosts, AdGuard, Dnsmasq, Unbound o dominios planos) para identificar al instante qué dominios ya tienes y cuáles son nuevos descubiertos.
        </p>

        <div className="space-y-4">
          {/* File upload bar */}
          <div className="flex items-center justify-between gap-2 p-3 bg-zinc-950/80 border border-dashed border-zinc-700 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-zinc-400 truncate">
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">
                {fileName ? `${fileName} (~${lineEstimate.toLocaleString()} líneas)` : 'Cargar archivo .txt existente o pegar texto abajo'}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.list,.hosts,.conf,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Subir archivo .txt</span>
            </button>
          </div>

          <div>
            <textarea
              rows={6}
              value={inputText.length > 250000 ? `${inputText.slice(0, 5000)}\n\n... [${lineEstimate.toLocaleString()} líneas cargadas para Diff]` : inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setFileName(null);
                setPreviewStats(null);
                setErrorMsg(null);
              }}
              readOnly={inputText.length > 250000}
              placeholder="0.0.0.0 poki.com&#10;0.0.0.0 miniclip.com&#10;crazygames.com"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {lineEstimate > 5000 ? (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Procesamiento en Web Worker (&gt;5.000 líneas)</span>
                </span>
              ) : (
                <span className="text-[11px] text-zinc-500">
                  Extracción y normalización O(1) mediante Set en cliente
                </span>
              )}

              {inputText.trim() && !previewStats && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => analyzeText(inputText)}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {isProcessing ? 'Analizando...' : 'Previsualizar Diff'}
                </button>
              )}
            </div>
          </div>

          {/* Preview Diff Summary */}
          {previewStats && (
            <div className="p-3.5 bg-zinc-950/90 border border-zinc-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Dominios únicos en tu archivo/texto:</span>
                <span className="font-mono font-semibold text-zinc-100">
                  {previewStats.importedCount.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Ya en tu lista:</span>
                  <span className="font-mono text-xs font-semibold text-zinc-300">
                    {previewStats.existingCount.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-between">
                  <span className="text-[11px] text-emerald-300">Nuevos descubiertos:</span>
                  <span className="font-mono text-xs font-semibold text-emerald-400">
                    {previewStats.newCount.toLocaleString()}
                  </span>
                </div>
              </div>
              {previewStats.usedWorker && (
                <div className="text-[10px] text-zinc-500 flex items-center gap-1 pt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Parseado y deduplicado en segundo plano mediante Web Worker</span>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-rose-950/30 border border-rose-800/50 rounded text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isProcessing || !inputText.trim()}
              onClick={() => handleApply({ filterNewOnly: false, selectNewOnly: false })}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors disabled:opacity-50"
            >
              Comparar en Tabla
            </button>
            <button
              type="button"
              disabled={isProcessing || !inputText.trim()}
              onClick={() => handleApply({ filterNewOnly: true, selectNewOnly: true })}
              className="px-4 py-1.5 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-all shadow-md shadow-emerald-950/30 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Filtrar y Seleccionar Solo Nuevos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

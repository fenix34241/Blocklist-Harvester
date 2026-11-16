import React, { useState, useRef } from 'react';
import { X, Plus, AlertCircle, Upload, Cpu, FileText } from 'lucide-react';
import { DomainEntry } from '../types';
import { buildEntriesFromTextAsync } from '../utils/workerClient';

interface AddDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEntries: (newEntries: DomainEntry[], info: { usedWorker: boolean; skippedLines: number }) => void;
  existingDomains: string[];
}

export const AddDomainModal: React.FC<AddDomainModalProps> = ({
  isOpen,
  onClose,
  onAddEntries,
  existingDomains
}) => {
  const [inputText, setInputText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      setInputText(content);
    };
    reader.onerror = () => {
      setErrorMsg('No se pudo leer el archivo seleccionado.');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!inputText.trim()) {
      setErrorMsg('Ingresa al menos un dominio o carga un archivo .txt.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await buildEntriesFromTextAsync(inputText, existingDomains);

      if (result.entries.length === 0) {
        setErrorMsg(
          result.totalLines > 0
            ? 'No se encontraron nuevos dominios válidos RFC 1035 (o todos ya estaban en la lista).'
            : 'No se detectaron dominios válidos.'
        );
        setIsProcessing(false);
        return;
      }

      onAddEntries(result.entries, {
        usedWorker: result.usedWorker,
        skippedLines: result.skippedLines
      });
      setInputText('');
      setFileName(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar los dominios.');
    } finally {
      setIsProcessing(false);
    }
  };

  const lineEstimate = inputText ? inputText.split('\n').length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg p-5 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-semibold text-zinc-100 mb-1">
          Añadir o Importar Dominios Manualmente
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          Pega dominios, URLs, listas hosts/AdGuard o carga un archivo <code className="font-mono text-emerald-400">.txt</code> masivo. Se validarán conforme a RFC 1035 y se deduplicarán con <code className="font-mono text-zinc-300">Set</code>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File upload bar */}
          <div className="flex items-center justify-between gap-2 p-2.5 bg-zinc-950/80 border border-dashed border-zinc-700 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-zinc-400 truncate">
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">
                {fileName ? `Archivo: ${fileName} (~${lineEstimate.toLocaleString()} líneas)` : 'Opcional: importar archivo .txt (soporta >50.000 líneas)'}
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
              className="px-2.5 py-1 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cargar .txt</span>
            </button>
          </div>

          <div>
            <textarea
              rows={6}
              value={inputText.length > 250000 ? `${inputText.slice(0, 5000)}\n\n... [${lineEstimate.toLocaleString()} líneas cargadas en memoria para procesar]` : inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setFileName(null);
                setErrorMsg(null);
              }}
              readOnly={inputText.length > 250000}
              placeholder="ejemplo.com&#10;0.0.0.0 juegos-online.net&#10;||portal.co.uk^"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
            />
            {lineEstimate > 5000 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
                <span>
                  Más de 5.000 líneas detectadas: el parseo y deduplicación se ejecutará en Web Worker en segundo plano.
                </span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-950/30 border border-rose-800/50 rounded text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-1.5 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-all shadow-md shadow-emerald-950/30 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Procesando en segundo plano...' : 'Añadir a la Blocklist'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

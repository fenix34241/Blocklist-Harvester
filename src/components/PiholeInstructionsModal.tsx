import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ShieldCheck } from 'lucide-react';
import { ExportFormatMode } from '../types';

interface PiholeInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  formatMode: ExportFormatMode;
}

const FORMAT_GUIDES: Array<{ id: ExportFormatMode; label: string }> = [
  { id: 'pihole', label: 'Pi-hole / hosts' },
  { id: 'unbound', label: 'Unbound DNS' },
  { id: 'mikrotik', label: 'MikroTik' },
  { id: 'pfsense', label: 'pfSense' },
  { id: 'adguard', label: 'AdGuard Home' },
  { id: 'dnsmasq', label: 'Dnsmasq' },
  { id: 'plain', label: 'Solo dominios' },
  { id: 'csv', label: 'CSV' }
];

export const PiholeInstructionsModal: React.FC<PiholeInstructionsModalProps> = ({
  isOpen,
  onClose,
  slug,
  formatMode
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activeGuide, setActiveGuide] = useState<ExportFormatMode>(formatMode);

  useEffect(() => {
    if (isOpen) {
      setActiveGuide(formatMode);
    }
  }, [isOpen, formatMode]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const baseSlug = slug.replace(/\.txt$/i, '');
  const exportedFilename =
    activeGuide === 'pihole'
      ? slug
      : activeGuide === 'csv'
      ? `${baseSlug}.csv`
      : `${baseSlug}-${activeGuide}.txt`;

  const activeLabel = FORMAT_GUIDES.find(g => g.id === activeGuide)?.label || 'Pi-hole / hosts';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-zinc-100">
            Guía de Despliegue: {activeLabel}
          </h3>
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          Instrucciones paso a paso para integrar el archivo <code className="text-emerald-400 font-mono">{exportedFilename}</code> en tu entorno de red.
        </p>

        {/* Format Switcher inside Modal */}
        <div className="flex flex-wrap gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-lg mb-5">
          {FORMAT_GUIDES.map(guide => (
            <button
              key={guide.id}
              type="button"
              onClick={() => setActiveGuide(guide.id)}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                activeGuide === guide.id
                  ? 'bg-zinc-800 text-emerald-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {guide.label}
            </button>
          ))}
        </div>

        {/* PI-HOLE / HOSTS */}
        {activeGuide === 'pihole' && (
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                Opción 1: Panel Web de Pi-hole (Adlists)
              </h4>
              <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                <li>
                  Sube tu archivo descargado (<code className="text-zinc-200 font-mono">{exportedFilename}</code>) a tu servidor web local o repositorio privado.
                </li>
                <li>
                  En Pi-hole, ve a <strong className="text-zinc-100">Group Management</strong> → <strong className="text-zinc-100">Adlists</strong>.
                </li>
                <li>
                  Pega la URL del archivo en <em className="text-zinc-400">Address</em> y haz clic en <strong className="text-zinc-100">Add</strong>.
                </li>
                <li>
                  Actualiza Gravity desde <strong className="text-zinc-100">Tools → Update Gravity</strong>.
                </li>
              </ol>
            </div>

            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-zinc-200">
                  Opción 2: Terminal SSH en Pi-hole
                </h4>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`sudo cp ${exportedFilename} /etc/pihole/blocklist-${exportedFilename} && pihole -g`, 'pihole-cli')}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                >
                  {copiedSnippet === 'pihole-cli' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar comando</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-zinc-950 p-3 rounded font-mono text-xs text-emerald-300 overflow-x-auto">
                sudo cp {exportedFilename} /etc/pihole/blocklist-{exportedFilename}<br />
                pihole -g
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                Opción 3: Archivo hosts local del sistema operativo
              </h4>
              <ul className="text-xs text-zinc-300 space-y-1">
                <li>• <strong>Linux / macOS:</strong> <code className="font-mono text-zinc-200">/etc/hosts</code></li>
                <li>• <strong>Windows:</strong> <code className="font-mono text-zinc-200">C:\Windows\System32\drivers\etc\hosts</code></li>
              </ul>
            </div>
          </div>
        )}

        {/* UNBOUND DNS */}
        {activeGuide === 'unbound' && (
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                Configuración de zonas locales en Unbound DNS
              </h4>
              <p className="text-xs text-zinc-300 mb-3">
                Este formato utiliza directivas <code className="font-mono text-emerald-400">local-zone: "dominio.com" always_nxdomain</code> para responder inmediatamente con <code className="font-mono text-zinc-200">NXDOMAIN</code> sin reenviar consultas aguas arriba.
              </p>
              <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                <li>
                  Renombra el archivo a <code className="font-mono text-zinc-200">{baseSlug}.conf</code> y cópialo en <code className="font-mono text-zinc-200">/etc/unbound/unbound.conf.d/</code>.
                </li>
                <li>
                  Asegúrate de que tu <code className="font-mono text-zinc-200">unbound.conf</code> incluya <code className="font-mono text-emerald-300">include-toplevel: "/etc/unbound/unbound.conf.d/*.conf"</code> dentro del bloque <code className="font-mono text-zinc-200">server:</code>.
                </li>
                <li>
                  Verifica la sintaxis y recarga el servicio Unbound.
                </li>
              </ol>
            </div>

            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-zinc-200">
                  Comandos de validación y recarga
                </h4>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`sudo cp ${exportedFilename} /etc/unbound/unbound.conf.d/${baseSlug}.conf\nsudo unbound-checkconf\nsudo systemctl reload unbound`, 'unbound-cli')}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                >
                  {copiedSnippet === 'unbound-cli' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar comandos</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-zinc-950 p-3 rounded font-mono text-xs text-emerald-300 overflow-x-auto">
                sudo cp {exportedFilename} /etc/unbound/unbound.conf.d/{baseSlug}.conf<br />
                sudo unbound-checkconf<br />
                sudo systemctl reload unbound
              </div>
            </div>
          </div>
        )}

        {/* MIKROTIK ROUTEROS */}
        {activeGuide === 'mikrotik' && (
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                Importación en MikroTik RouterOS (DNS Static)
              </h4>
              <p className="text-xs text-zinc-300 mb-3">
                Cada línea ejecuta <code className="font-mono text-emerald-400">/ip dns static add name="dominio.com" address=0.0.0.0</code>, resolviendo los dominios bloqueados a <code className="font-mono text-zinc-200">0.0.0.0</code> directamente en el router.
              </p>
              <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                <li>
                  Renombra el archivo descargado a <code className="font-mono text-zinc-200">{baseSlug}.rsc</code> y súbelo al router vía WinBox (<strong className="text-zinc-100">Files</strong>) o SCP/FTP.
                </li>
                <li>
                  Asegúrate de que tus clientes de red usen el router como servidor DNS y que <strong className="text-zinc-100">Allow Remote Requests</strong> esté habilitado en <code className="font-mono text-zinc-200">/ip dns</code>.
                </li>
                <li>
                  Ejecuta el script desde la terminal de RouterOS y limpia la caché DNS.
                </li>
              </ol>
            </div>

            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-zinc-200">
                  Comandos en Terminal RouterOS
                </h4>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`/import file-name=${baseSlug}.rsc\n/ip dns cache flush`, 'mikrotik-cli')}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                >
                  {copiedSnippet === 'mikrotik-cli' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar comandos</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-zinc-950 p-3 rounded font-mono text-xs text-emerald-300 overflow-x-auto">
                /import file-name={baseSlug}.rsc<br />
                /ip dns cache flush
              </div>
            </div>
          </div>
        )}

        {/* PFSENSE / OPNSENSE PFBLOCKERNG */}
        {activeGuide === 'pfsense' && (
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                Integración en pfSense / OPNsense (pfBlockerNG DNSBL)
              </h4>
              <p className="text-xs text-zinc-300 mb-3">
                Formato de lista limpia con un dominio por línea y metadatos comentados con <code className="font-mono text-zinc-200">#</code>, ideal para el parser nativo DNSBL de pfBlockerNG.
              </p>
              <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                <li>
                  Aloja el archivo <code className="font-mono text-zinc-200">{exportedFilename}</code> en un servidor HTTP interno o súbelo a <code className="font-mono text-zinc-200">/var/db/pfblockerng/dnsblorig/</code>.
                </li>
                <li>
                  En pfSense ve a <strong className="text-zinc-100">Firewall → pfBlockerNG → DNSBL → DNSBL Groups</strong> y crea o edita un grupo.
                </li>
                <li>
                  En <strong className="text-zinc-100">DNSBL Source Definitions</strong>, selecciona <em className="text-zinc-400">Format: Auto</em>, pega la URL o ruta local, activa el estado <strong className="text-zinc-100">ON</strong> y guarda.
                </li>
                <li>
                  Ve a <strong className="text-zinc-100">Update → Reload → DNSBL</strong> para compilar las reglas en Unbound.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* ADGUARD HOME */}
        {activeGuide === 'adguard' && (
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                Integración en AdGuard Home
              </h4>
              <p className="text-xs text-zinc-300 mb-3">
                Generado con sintaxis de reglas Adblock <code className="font-mono text-emerald-400">||dominio.com^</code> que bloquea tanto el dominio raíz como todos sus subdominios automáticamente.
              </p>
              <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                <li>
                  Abre la interfaz web de AdGuard Home y ve a <strong className="text-zinc-100">Filtros → Listas de bloqueo DNS</strong>.
                </li>
                <li>
                  Haz clic en <strong className="text-zinc-100">Añadir lista de bloqueo → Añadir una lista personalizada</strong>.
                </li>
                <li>
                  Asigna un nombre y especifica la URL donde alojes <code className="font-mono text-zinc-200">{exportedFilename}</code> o la ruta local del servidor (ej. <code className="font-mono text-zinc-200">/opt/adguardhome/{exportedFilename}</code>).
                </li>
                <li>
                  Opcionalmente, pega las reglas directamente en <strong className="text-zinc-100">Filtros → Reglas de filtrado personalizadas</strong>.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* DNSMASQ */}
        {activeGuide === 'dnsmasq' && (
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                Integración en Dnsmasq (Linux / OpenWrt)
              </h4>
              <p className="text-xs text-zinc-300 mb-3">
                Cada entrada usa <code className="font-mono text-emerald-400">address=/dominio.com/0.0.0.0</code>, bloqueando el dominio y sus subdominios en routers OpenWrt o servidores Linux con Dnsmasq.
              </p>
              <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside">
                <li>
                  Copia el archivo a <code className="font-mono text-zinc-200">/etc/dnsmasq.d/{baseSlug}.conf</code> (o <code className="font-mono text-zinc-200">/tmp/dnsmasq.d/</code> en OpenWrt).
                </li>
                <li>
                  Valida la configuración con <code className="font-mono text-zinc-200">dnsmasq --test</code> y reinicia el demonio DNS.
                </li>
              </ol>
            </div>

            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-zinc-200">
                  Comandos de despliegue
                </h4>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`sudo cp ${exportedFilename} /etc/dnsmasq.d/${baseSlug}.conf\nsudo dnsmasq --test\nsudo systemctl restart dnsmasq`, 'dnsmasq-cli')}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                >
                  {copiedSnippet === 'dnsmasq-cli' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar comandos</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-zinc-950 p-3 rounded font-mono text-xs text-emerald-300 overflow-x-auto">
                sudo cp {exportedFilename} /etc/dnsmasq.d/{baseSlug}.conf<br />
                sudo dnsmasq --test<br />
                sudo systemctl restart dnsmasq
              </div>
            </div>
          </div>
        )}

        {/* SOLO DOMINIOS */}
        {activeGuide === 'plain' && (
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                Lista pura de dominios (1 por línea)
              </h4>
              <p className="text-xs text-zinc-300 mb-3">
                Formato universal sin comentarios ni prefijos IP, ideal para scripts de automatización, firewalls NGFW (FortiGate, Palo Alto External Dynamic Lists), NextDNS o importación masiva en Pi-hole CLI.
              </p>
              <div className="bg-zinc-950 p-3 rounded font-mono text-xs text-emerald-300 overflow-x-auto">
                # Ejemplo: bloqueo masivo directo en Pi-hole desde terminal<br />
                xargs -a {exportedFilename} -n 50 pihole -b
              </div>
            </div>
          </div>
        )}

        {/* CSV */}
        {activeGuide === 'csv' && (
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                Exportación analítica CSV para auditoría y SIEM
              </h4>
              <p className="text-xs text-zinc-300 mb-3">
                El archivo <code className="font-mono text-emerald-400">{exportedFilename}</code> incluye columnas estructuradas listas para abrir en Excel, LibreOffice Calc, Google Sheets, Pandas o herramientas SIEM/SOAR:
              </p>
              <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside font-mono">
                <li><strong className="text-emerald-300">dominio</strong>: Nombre de dominio normalizado RFC 1035</li>
                <li><strong className="text-emerald-300">estado_dns</strong>: active / nxdomain / unknown</li>
                <li><strong className="text-emerald-300">ip_resuelta</strong>: Dirección IPv4/IPv6 resuelta</li>
                <li><strong className="text-emerald-300">variante_tld</strong>: Variantes relacionadas detectadas</li>
                <li><strong className="text-emerald-300">es_redireccion</strong>: true si tiene CNAME o redirección HTTP</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

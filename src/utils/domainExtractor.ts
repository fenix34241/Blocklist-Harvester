import { DomainEntry } from '../types';

/**
 * Common shared hosting, multi-tenant services, cloud storage, CDNs, and platforms
 * where blocking the root domain or apex causes severe collateral damage (high false positive risk).
 */
export const SHARED_HOSTING_AND_PLATFORMS = new Map<string, { reason: string; category: DomainEntry['falsePositiveRisk']['category'] }>([
  ['github.io', { reason: 'Páginas de GitHub multi-usuario (bloquear afectaría miles de proyectos)', category: 'shared_hosting' }],
  ['gitlab.io', { reason: 'Páginas de GitLab multi-usuario', category: 'shared_hosting' }],
  ['vercel.app', { reason: 'Dominio de despliegue Vercel compartido para miles de aplicaciones legítimas', category: 'shared_hosting' }],
  ['netlify.app', { reason: 'Plataforma de despliegue Netlify compartida para sitios web legítimos', category: 'shared_hosting' }],
  ['pages.dev', { reason: 'Cloudflare Pages multi-inquilino', category: 'shared_hosting' }],
  ['firebaseapp.com', { reason: 'Infraestructura compartida de Google Firebase para apps legítimas', category: 'shared_hosting' }],
  ['web.app', { reason: 'Hosting compartido de Google Firebase', category: 'shared_hosting' }],
  ['herokuapp.com', { reason: 'Plataforma Heroku multi-inquilino', category: 'shared_hosting' }],
  ['onrender.com', { reason: 'Plataforma de renderizado en la nube compartida', category: 'shared_hosting' }],
  ['render.com', { reason: 'Plataforma en la nube Render compartida', category: 'shared_hosting' }],
  ['azurewebsites.net', { reason: 'Servicios en la nube Microsoft Azure compartidos', category: 'shared_hosting' }],
  ['cloudfront.net', { reason: 'Red de distribución de contenidos (CDN) de Amazon AWS', category: 'cdn' }],
  ['amazonaws.com', { reason: 'Infraestructura de Amazon Web Services', category: 'infrastructure' }],
  ['s3.amazonaws.com', { reason: 'Almacenamiento S3 de Amazon compartido', category: 'infrastructure' }],
  ['googleapis.com', { reason: 'APIs fundamentales de Google usadas por millones de servicios', category: 'infrastructure' }],
  ['akamaihd.net', { reason: 'CDN global de Akamai para múltiples empresas legítimas', category: 'cdn' }],
  ['fastly.net', { reason: 'CDN global de Fastly', category: 'cdn' }],
  ['wordpress.com', { reason: 'Plataforma de blogs WordPress multi-usuario', category: 'shared_hosting' }],
  ['blogspot.com', { reason: 'Plataforma de blogs Blogger/Google multi-usuario', category: 'shared_hosting' }],
  ['tumblr.com', { reason: 'Plataforma de blogs Tumblr compartida', category: 'shared_hosting' }],
  ['wixsite.com', { reason: 'Plataforma de sitios web Wix compartida', category: 'shared_hosting' }],
  ['squarespace.com', { reason: 'Plataforma de sitios web Squarespace compartida', category: 'shared_hosting' }],
  ['myshopify.com', { reason: 'Plataforma de comercio electrónico Shopify compartida', category: 'shared_hosting' }],
  ['cloudflare.com', { reason: 'Proveedor de DNS y CDN de internet; riesgo crítico de bloqueo de infraestructura', category: 'infrastructure' }],
  ['cloudflare-ipfs.com', { reason: 'Gateway IPFS de Cloudflare', category: 'infrastructure' }],
  ['jsdelivr.net', { reason: 'CDN de librerías JavaScript de código abierto', category: 'cdn' }],
  ['unpkg.com', { reason: 'CDN de paquetes npm', category: 'cdn' }],
  ['cdnjs.cloudflare.com', { reason: 'CDN de recursos web compartidos', category: 'cdn' }],
  ['paypal.com', { reason: 'Pasarela de pagos internacional (posible falso positivo crítico)', category: 'auth_gateway' }],
  ['stripe.com', { reason: 'Pasarela de pagos mundial', category: 'auth_gateway' }],
  ['auth0.com', { reason: 'Servicio de autenticación e identidad', category: 'auth_gateway' }]
]);

/**
 * Aggregators, encyclopedias, major search engines, social networks, and generic services
 * that must be discarded unless they are the direct target.
 */
export const GENERIC_AGGREGATORS_AND_ENGINES = new Set<string>([
  'google.com', 'google.es', 'google.co.uk', 'google.com.mx', 'google.com.ar', 'google.fr', 'google.de', 'google.it',
  'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.com', 'yandex.ru', 'ask.com',
  'wikipedia.org', 'wikimedia.org', 'wiktionary.org', 'wikihow.com',
  'youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv',
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com', 'pinterest.com',
  'reddit.com', 'quora.com', 'medium.com', 'discord.com', 'discord.gg', 't.me', 'telegram.org',
  'github.com', 'gitlab.com', 'stackoverflow.com', 'stackexchange.com',
  'amazon.com', 'apple.com', 'microsoft.com', 'msn.com', 'android.com',
  'archive.org', 'web.archive.org',
  // Common URL shorteners
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'linktr.ee',
  'localhost', 'local', 'lan', 'internal'
]);

/**
 * Known multi-part public suffixes (ccTLDs with second-level categories)
 */
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk',
  'com.es', 'org.es', 'nom.es',
  'com.mx', 'org.mx', 'edu.mx', 'gob.mx',
  'com.ar', 'org.ar', 'net.ar',
  'com.br', 'org.br', 'net.br',
  'co.jp', 'ne.jp', 'or.jp',
  'com.au', 'net.au', 'org.au',
  'co.nz', 'net.nz', 'org.nz',
  'co.za', 'net.za', 'org.za',
  'com.co', 'org.co', 'edu.co',
  'com.cl', 'com.pe', 'com.uy', 'com.ve'
]);

/**
 * Slugify title for filenames: "Browser Games Blocklist" -> "browser-games-blocklist"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'blocklist';
}

/**
 * Normalizes a URL or raw string to a pure domain string.
 * Strips protocol, auth, ports, paths, query, hash.
 * Strips 'www.', 'www2.', 'm.', 'amp.' prefixes if redundant.
 * Normalizes to lower case.
 */
export function normalizeDomain(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  let raw = input.trim().toLowerCase();
  if (!raw) return null;

  // Strip leading protocols or markdown/quotes
  raw = raw.replace(/^[<"'\(`[]+/, '').replace(/[>"'\)`\]]+$/, '');
  if (!raw) return null;

  // Fast path for plain domains without scheme/path/port/auth
  if (!raw.includes('/') && !raw.includes(':') && !raw.includes('@') && !raw.includes('?') && !raw.includes('#') && !raw.includes(' ')) {
    let hostname = raw.endsWith('.') ? raw.slice(0, -1) : raw;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    } else if (/^www\d+\./.test(hostname)) {
      hostname = hostname.replace(/^www\d+\./, '');
    } else if (hostname.startsWith('m.')) {
      hostname = hostname.slice(2);
    } else if (hostname.startsWith('amp.')) {
      hostname = hostname.slice(4);
    }
    if (!hostname || hostname.length > 253) return null;
    return hostname;
  }

  if (raw.startsWith('//')) {
    raw = 'http:' + raw;
  }
  if (!raw.startsWith('http://') && !raw.startsWith('https://') && !raw.startsWith('ftp://')) {
    raw = 'http://' + raw;
  }

  try {
    const parsed = new URL(raw);
    let hostname = parsed.hostname.toLowerCase();

    // Remove trailing dot if present
    if (hostname.endsWith('.')) {
      hostname = hostname.slice(0, -1);
    }

    // Strip common www prefixes (e.g. www.domain.com -> domain.com)
    // but keep subdomains if they represent different parts like 'games.domain.com'
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    } else if (/^www\d+\./.test(hostname)) {
      hostname = hostname.replace(/^www\d+\./, '');
    } else if (hostname.startsWith('m.')) {
      hostname = hostname.slice(2);
    } else if (hostname.startsWith('amp.')) {
      hostname = hostname.slice(4);
    }

    if (!hostname || hostname.includes(' ') || hostname.length > 253) {
      return null;
    }

    return hostname;
  } catch {
    // Fallback regex extraction if URL constructor fails
    const match = input.toLowerCase().match(/(?:https?:\/\/)?(?:[^@\n]+@)?([a-z0-9.-]+)(?::[0-9]+)?/);
    if (!match) return null;
    let fallback = match[1].replace(/^\.+|\.+$/g, '');
    if (fallback.startsWith('www.')) fallback = fallback.slice(4);
    return fallback || null;
  }
}

/**
 * Validates domain against RFC 1035 / RFC 1123 format.
 * - Total length <= 253 chars
 * - At least two labels separated by dot
 * - Each label between 1 and 63 chars
 * - Allowed chars: a-z, 0-9, and hyphen (-)
 * - Labels cannot start or end with a hyphen
 * - No IP addresses (IPv4 or IPv6)
 * - Valid TLD (at least 2 letters or xn-- punycode, not pure digits)
 */
export function isValidRfc1035(domain: string): { isValid: boolean; error?: string } {
  if (!domain || typeof domain !== 'string') {
    return { isValid: false, error: 'Dominio vacío o no válido' };
  }

  if (domain.length < 3) {
    return { isValid: false, error: 'Longitud mínima insuficiente' };
  }

  if (domain.length > 253) {
    return { isValid: false, error: 'Excede longitud máxima de 253 caracteres (RFC 1035)' };
  }

  // Reject IPv4 addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(domain)) {
    return { isValid: false, error: 'Es una dirección IP numérica, no un nombre de dominio RFC 1035' };
  }

  // Reject localhost or single label
  const labels = domain.split('.');
  if (labels.length < 2) {
    return { isValid: false, error: 'Debe contener al menos dos etiquetas (ej. nombre.tld)' };
  }

  // Validate TLD
  const tld = labels[labels.length - 1];
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(tld)) {
    return { isValid: false, error: `TLD "${tld}" no es válido conforme a RFC 1035 (debe ser alfabético o punycode)` };
  }

  // Validate each label
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label.length === 0) {
      return { isValid: false, error: 'Contiene puntos consecutivos o vacíos' };
    }
    if (label.length > 63) {
      return { isValid: false, error: `Etiqueta "${label}" excede los 63 caracteres permitidos` };
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(label)) {
      return { isValid: false, error: `Etiqueta "${label}" contiene caracteres inválidos o empieza/termina con guión` };
    }
  }

  return { isValid: true };
}

/**
 * Checks whether a domain is an ignored search engine or generic aggregator.
 */
export function isIgnoredAggregator(domain: string): boolean {
  if (GENERIC_AGGREGATORS_AND_ENGINES.has(domain)) return true;

  // Check wildcard TLD prefixes (e.g. google.com.mx, bing.es, wikipedia.es)
  if (
    domain.startsWith('google.') ||
    domain.startsWith('bing.') ||
    domain.startsWith('yahoo.') ||
    domain.startsWith('wikipedia.') ||
    domain.startsWith('msn.')
  ) {
    return true;
  }

  // Check subdomains of known search engines / aggregators (e.g. r.bing.com, es.wikipedia.org)
  for (const agg of GENERIC_AGGREGATORS_AND_ENGINES) {
    if (domain.endsWith('.' + agg)) {
      return true;
    }
  }

  return false;
}

/**
 * Assesses false positive risk (shared hosting, CDN, cloud infrastructure).
 */
export function assessFalsePositiveRisk(domain: string): DomainEntry['falsePositiveRisk'] {
  // Direct match on shared hosting / CDN platform
  if (SHARED_HOSTING_AND_PLATFORMS.has(domain)) {
    const info = SHARED_HOSTING_AND_PLATFORMS.get(domain)!;
    return {
      isHighRisk: true,
      reason: info.reason,
      category: info.category
    };
  }

  // Check if domain is a direct apex of a high-risk multi-tenant platform
  for (const [platform, info] of SHARED_HOSTING_AND_PLATFORMS.entries()) {
    if (domain.endsWith('.' + platform)) {
      return {
        isHighRisk: false,
        reason: `Alojado en plataforma compartida (${platform}). Bloquear este subdominio específico es seguro si no es el dominio raíz.`,
        category: info.category
      };
    }
  }

  return { isHighRisk: false };
}

/**
 * Extracts root SLD (Second-Level Domain) without TLD for variant clustering.
 * e.g., '1000games.io' -> '1000games'
 * e.g., 'games.crazygames.co.uk' -> 'crazygames'
 */
export function extractBaseName(domain: string): { baseName: string; tld: string; rootDomain: string } {
  const parts = domain.split('.');
  if (parts.length <= 1) {
    return { baseName: domain, tld: '', rootDomain: domain };
  }

  // Check if ending matches multi-part TLD (e.g. .co.uk, .com.ar)
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    const baseName = parts[parts.length - 3];
    const rootDomain = `${baseName}.${lastTwo}`;
    return { baseName, tld: lastTwo, rootDomain };
  }

  const tld = parts[parts.length - 1];
  const baseName = parts[parts.length - 2];
  const rootDomain = `${baseName}.${tld}`;
  return { baseName, tld, rootDomain };
}

/**
 * High-performance O(N) variant detection using Map<string, Set<string>>.
 * Detects domain variants by grouping domains with matching base names across different TLDs
 * or subdomains (e.g. poki.com and poki.io, or 1000games.com and 1000games.io).
 */
export function detectVariants(domains: string[]): Map<string, string[]> {
  const baseMap = new Map<string, Set<string>>();

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const { baseName } = extractBaseName(domain);
    // Ignore extremely short generic base names (e.g. "go", "io", "tv")
    if (baseName.length >= 3) {
      let group = baseMap.get(baseName);
      if (!group) {
        group = new Set<string>();
        baseMap.set(baseName, group);
      }
      group.add(domain);
    }
  }

  const variantMap = new Map<string, string[]>();
  for (const groupSet of baseMap.values()) {
    if (groupSet.size > 1) {
      const groupArr = Array.from(groupSet);
      for (let i = 0; i < groupArr.length; i++) {
        const d = groupArr[i];
        variantMap.set(d, groupArr.filter(x => x !== d));
      }
    }
  }

  return variantMap;
}

/**
 * Extracts and normalizes domains from multi-format blocklist text (Pi-hole hosts, AdGuard,
 * Dnsmasq, Unbound, MikroTik, pfBlockerNG, CSV, or plain domain lines) using O(1) Set deduplication.
 */
export function parseRawBlocklistText(rawText: string): {
  uniqueDomains: string[];
  totalLines: number;
  skippedLines: number;
} {
  const lines = rawText.split(/\r?\n/);
  const uniqueSet = new Set<string>();
  let skippedLines = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Skip comments and metadata headers
    if (
      line.startsWith('#') ||
      line.startsWith('!') ||
      line.startsWith('//') ||
      line.startsWith(';') ||
      /^(title|description|updated|unique domains|format):/i.test(line)
    ) {
      skippedLines++;
      continue;
    }

    // Remove inline comments
    const commentIdx = line.indexOf('#');
    if (commentIdx !== -1) {
      line = line.slice(0, commentIdx).trim();
      if (!line) {
        skippedLines++;
        continue;
      }
    }

    // Handle known network syntax formats
    // 1. AdGuard: ||domain.com^ or ||domain.com^$important
    if (line.startsWith('||')) {
      const match = line.match(/^\|\|([^\^\/\$]+)/);
      if (match) line = match[1];
    }
    // 2. Dnsmasq: address=/domain.com/0.0.0.0 or server=/domain.com/
    else if (/^(?:address|server)=\//i.test(line)) {
      const match = line.match(/^(?:address|server)=\/([^\/]+)\//i);
      if (match) line = match[1];
    }
    // 3. Unbound: local-zone: "domain.com" always_nxdomain
    else if (/^local-zone:/i.test(line)) {
      const match = line.match(/local-zone:\s*["']?([^"'\s]+)["']?/i);
      if (match) line = match[1];
    }
    // 4. MikroTik: /ip dns static add name="domain.com" address=0.0.0.0
    else if (/name=/i.test(line) && line.startsWith('/ip')) {
      const match = line.match(/name=["']?([^"'\s]+)["']?/i);
      if (match) line = match[1];
    }
    // 5. Hosts format: 0.0.0.0 domain.com or 127.0.0.1 domain.com
    else if (/^(?:0\.0\.0\.0|127\.0\.0\.1|::1|::)\s+/.test(line)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        line = parts[1];
      }
    }
    // 6. CSV row: domain.com,active,...
    else if (line.includes(',')) {
      const firstCol = line.split(',')[0].trim().replace(/^["']|["']$/g, '');
      if (firstCol.toLowerCase() === 'dominio' || firstCol.toLowerCase() === 'domain') {
        skippedLines++;
        continue;
      }
      line = firstCol;
    }

    // Support comma/space separated lists on a single line
    const tokens = line.split(/[\s,;]+/);
    let addedFromLine = false;
    for (let t = 0; t < tokens.length; t++) {
      const tok = tokens[t];
      if (!tok || tok === '0.0.0.0' || tok === '127.0.0.1' || tok === 'localhost') continue;
      const normalized = normalizeDomain(tok);
      if (normalized && isValidRfc1035(normalized).isValid) {
        uniqueSet.add(normalized);
        addedFromLine = true;
      }
    }

    if (!addedFromLine) {
      skippedLines++;
    }
  }

  return {
    uniqueDomains: Array.from(uniqueSet),
    totalLines: lines.length,
    skippedLines
  };
}

/**
 * Generates ISO 8601 timestamp with explicit UTC offset:
 * e.g. "2026-09-25T14:19:22.123456+00:00"
 */
export function getIsoUtcTimestamp(date: Date = new Date()): string {
  const iso = date.toISOString();
  const msPart = (date.getMilliseconds() * 1000).toString().padStart(6, '0');
  const base = iso.slice(0, 19);
  return `${base}.${msPart}+00:00`;
}

/**
 * Strictly formats the blocklist into Pi-hole / hosts format according to the exact specification:
 *
 * Title: {titulo_lista}
 * Description: {descripcion}
 * Updated: {timestamp ISO 8601 con offset UTC, ej. 2026-09-04T12:42:51.232227+00:00}
 * Unique domains: {conteo total de dominios únicos}
 * Format: Pi-hole / hosts-compatible
 *
 * 0.0.0.0 dominio1.com
 * 0.0.0.0 dominio2.net
 */
export function formatPiHoleBlocklist(params: {
  title: string;
  description: string;
  timestamp?: string;
  domains: string[];
}): string {
  const { title, description, domains } = params;
  const timestamp = params.timestamp || getIsoUtcTimestamp();

  // O(N) Set deduplication and alphabetical sort
  const seen = new Set<string>();
  for (let i = 0; i < domains.length; i++) {
    const clean = domains[i].trim().toLowerCase();
    if (clean) seen.add(clean);
  }
  const uniqueSorted = Array.from(seen).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const headers = [
    `Title: ${title.trim()}`,
    `Description: ${description.trim()}`,
    `Updated: ${timestamp}`,
    `Unique domains: ${uniqueSorted.length}`,
    `Format: Pi-hole / hosts-compatible`
  ].join('\n');

  if (uniqueSorted.length === 0) {
    return headers;
  }

  const domainLines = uniqueSorted.map(domain => `0.0.0.0 ${domain}`).join('\n');

  return `${headers}\n\n${domainLines}`;
}

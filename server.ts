import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns/promises';
import { GoogleGenAI } from '@google/genai';
import {
  normalizeDomain,
  isValidRfc1035,
  isIgnoredAggregator,
  assessFalsePositiveRisk,
  detectVariants,
  formatPiHoleBlocklist,
  getIsoUtcTimestamp,
  slugify
} from './src/utils/domainExtractor.ts';
import { DomainEntry, HarvestResponse, SearchQueryInfo } from './src/types.ts';
import {
  executeWebSearchQuery,
  getAutocompleteSuggestions,
  harvestWithAI
} from './src/utils/searchEngineHarvester.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory cache for stored lists for quick export / API retrieval
const generatedListsStore = new Map<string, { formattedOutput: string; slug: string }>();

// Initialize Gemini SDK if API key is present
const geminiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Generates varied search queries (Spanish, English, synonyms, best-of, intent).
 */
function generateQueryVariations(term: string): SearchQueryInfo[] {
  const cleanTerm = term.trim();
  const queries: SearchQueryInfo[] = [];

  // Literal query
  queries.push({
    query: cleanTerm,
    language: 'mixed',
    type: 'literal'
  });

  // Spanish variations
  queries.push({
    query: `mejores sitios de ${cleanTerm}`,
    language: 'es',
    type: 'best_of'
  });
  queries.push({
    query: `${cleanTerm} gratis online`,
    language: 'es',
    type: 'intent'
  });
  queries.push({
    query: `top paginas de ${cleanTerm}`,
    language: 'es',
    type: 'top_list'
  });

  // English variations / synonyms
  const enMapping: Record<string, string> = {
    'juegos de navegador': 'browser games free online',
    'juegos': 'online browser games',
    'casinos': 'online casino gambling websites',
    'apuestas': 'sports betting gambling sites',
    'torrent': 'torrent trackers and torrent sites',
    'torrents': 'torrent indexers and download sites',
    'rastreadores torrent': 'torrent trackers magnet links',
    'crypto faucets': 'cryptocurrency faucet sites free',
    'mineria crypto': 'crypto web mining faucet',
    'adultos': 'adult web portals',
    'streaming': 'free streaming movie websites',
    'anime streaming': 'anime free streaming sites'
  };

  const lower = cleanTerm.toLowerCase();
  const translated = enMapping[lower] || `${cleanTerm} websites list`;

  queries.push({
    query: `best ${translated}`,
    language: 'en',
    type: 'best_of'
  });
  queries.push({
    query: `top ${translated} to play in browser`,
    language: 'en',
    type: 'top_list'
  });
  queries.push({
    query: `${translated} online free`,
    language: 'en',
    type: 'intent'
  });

  return queries;
}

/**
 * Curated knowledge base of domain samples for fallback or query augmentation
 */
const SEED_DOMAINS_BY_TOPIC: Record<string, string[]> = {
  games: [
    'poki.com', 'poki.io', 'crazygames.com', 'crazygames.fr', '1000games.io',
    '1000games.com', 'miniclip.com', 'play.miniclip.com', 'y8.com', 'armorgames.com',
    'kongregate.com', 'newgrounds.com', 'addictinggames.com', 'kizi.com', 'friv.com',
    'friv5online.com', 'agame.com', 'gameflare.com', 'coolmathgames.com', 'gamepix.com',
    'twoplayergames.org', 'silvergames.com', 'itch.io', 'now.gg', 'playhop.com',
    'gemioli.com', 'gameforge.com', 'vseigru.net', 'solitaireparadise.com', 'snokido.com'
  ],
  torrent: [
    'thepiratebay.org', '1337x.to', '1337x.st', 'rarbg.to', 'yts.mx', 'yts.lt',
    'nyaa.si', 'eztv.re', 'torrentgalaxy.to', 'limetorrents.pro', 'torlock.com',
    'demonoid.is', 'torrentdownloads.me', 'glotorrents.pw', 'magnetdl.com'
  ],
  gambling: [
    'bet365.com', 'stake.com', 'roobet.com', 'rollbit.com', 'bovada.lv',
    'betonline.ag', '1xbet.com', 'betway.com', '888casino.com', 'pokerstars.com',
    'unibet.com', 'ggpoker.com', 'betfair.com', 'williamhill.com', 'bwin.com'
  ],
  crypto: [
    'freebitco.in', 'faucetpay.io', 'cointiply.com', 'firefaucet.win',
    'coinpayu.com', 'vieftc.com', 'adbtc.top', 'faucetcrypto.com', 'bitcoinker.com'
  ],
  streaming: [
    'cuevana3.ch', 'cuevana.biz', 'repelisplus.lat', 'pelisplus.me', 'soap2day.to',
    'fmovies.to', '123movies.net', 'flixtor.to', 'solarmovie.pe', 'lookmovie2.to',
    'animeflv.net', 'jkanime.net', 'aniwatch.to', '9animetv.to', 'gogoanime.pe'
  ]
};

/**
 * Harvest endpoint
 */
app.post('/api/harvest', async (req: Request, res: Response) => {
  try {
    const { termino_busqueda, titulo_lista, descripcion, max_resultados } = req.body;

    if (!termino_busqueda || typeof termino_busqueda !== 'string') {
      return res.status(400).json({ error: 'El campo "termino_busqueda" es obligatorio.' });
    }

    const title = (titulo_lista && typeof titulo_lista === 'string' && titulo_lista.trim())
      ? titulo_lista.trim()
      : `Blocklist para ${termino_busqueda.trim()}`;

    const desc = (descripcion && typeof descripcion === 'string' && descripcion.trim())
      ? descripcion.trim()
      : `Blocklist de dominios recolectados para el término "${termino_busqueda.trim()}".`;

    const maxLimit = Math.min(Math.max(Number(max_resultados) || 50, 10), 200);
    const queryVariations = generateQueryVariations(termino_busqueda);

    // Also fetch real Google Autocomplete suggestions to enrich queries
    try {
      const suggestions = await getAutocompleteSuggestions(termino_busqueda);
      for (const sug of suggestions) {
        if (!queryVariations.some(q => q.query.toLowerCase() === sug.toLowerCase())) {
          queryVariations.push({
            query: sug,
            language: 'es',
            type: 'intent'
          });
        }
      }
    } catch {}

    const rawCollectedUrls: string[] = [];
    const domainToUrls = new Map<string, Set<string>>();
    const domainNotes = new Map<string, string>();

    // 1. Run live real web search across query variations
    const webSearchPromises = queryVariations.slice(0, 6).map(async (q) => {
      const urls = await executeWebSearchQuery(q.query);
      return urls;
    });

    // 2. Run AI domain synthesis in parallel using available Gemini models
    const aiPromise = harvestWithAI(aiClient, termino_busqueda, queryVariations);

    const [searchUrlBatches, aiResults] = await Promise.all([
      Promise.all(webSearchPromises),
      aiPromise
    ]);

    // Aggregate URLs from live web search
    for (const batch of searchUrlBatches) {
      for (const url of batch) {
        rawCollectedUrls.push(url);
      }
    }

    // Aggregate domains from AI synthesis
    for (const item of aiResults) {
      if (item.sourceUrl) rawCollectedUrls.push(item.sourceUrl);
      if (item.domain) {
        rawCollectedUrls.push(`https://${item.domain}`);
        if (item.notes) {
          const norm = normalizeDomain(item.domain);
          if (norm) domainNotes.set(norm, item.notes);
        }
      }
    }

    // 3. Fallback seeds if category matches and total found is small
    const lowerTerm = termino_busqueda.toLowerCase();
    let matchedCategory: string | null = null;
    if (lowerTerm.includes('juego') || lowerTerm.includes('game') || lowerTerm.includes('play')) matchedCategory = 'games';
    else if (lowerTerm.includes('torrent') || lowerTerm.includes('tracker') || lowerTerm.includes('p2p')) matchedCategory = 'torrent';
    else if (lowerTerm.includes('apuesta') || lowerTerm.includes('casino') || lowerTerm.includes('gambling') || lowerTerm.includes('bet')) matchedCategory = 'gambling';
    else if (lowerTerm.includes('crypto') || lowerTerm.includes('faucet') || lowerTerm.includes('bitcoin')) matchedCategory = 'crypto';
    else if (lowerTerm.includes('stream') || lowerTerm.includes('pelicula') || lowerTerm.includes('movie') || lowerTerm.includes('anime')) matchedCategory = 'streaming';

    if (matchedCategory && SEED_DOMAINS_BY_TOPIC[matchedCategory]) {
      for (const d of SEED_DOMAINS_BY_TOPIC[matchedCategory]) {
        rawCollectedUrls.push(`https://${d}`);
      }
    }

    // Process and extract domains
    for (const rawUrl of rawCollectedUrls) {
      const normalized = normalizeDomain(rawUrl);
      if (!normalized) continue;

      // Filter out ignored generic aggregators (Google, Wikipedia, YouTube, Reddit, etc.)
      if (isIgnoredAggregator(normalized)) continue;

      if (!domainToUrls.has(normalized)) {
        domainToUrls.set(normalized, new Set());
      }
      domainToUrls.get(normalized)!.add(rawUrl);
    }

    // Create unique domain list
    let domainNames = Array.from(domainToUrls.keys());

    // Limit to max_resultados if requested
    if (domainNames.length > maxLimit) {
      domainNames = domainNames.slice(0, maxLimit);
    }

    // Detect TLD / subdomain variants (e.g. 1000games.io vs 1000games.com)
    const variantMap = detectVariants(domainNames);

    // Build DomainEntry items with RFC 1035 validation and False-Positive Risk assessment
    const domainEntries: DomainEntry[] = domainNames.map(domain => {
      const rfcCheck = isValidRfc1035(domain);
      const riskCheck = assessFalsePositiveRisk(domain);
      const parts = domain.split('.');
      const tld = parts[parts.length - 1] || '';
      const variants = variantMap.get(domain);

      // Default: included unless invalid RFC 1035 or high-risk false positive
      const isIncluded = rfcCheck.isValid && !riskCheck.isHighRisk;

      return {
        domain,
        sourceUrls: Array.from(domainToUrls.get(domain) || []),
        tld,
        isValidRfc1035: rfcCheck.isValid,
        rfc1035Error: rfcCheck.error,
        falsePositiveRisk: riskCheck,
        variantDomains: variants,
        isIncluded,
        notes: domainNotes.get(domain)
      };
    });

    // Sort domain entries alphabetically
    domainEntries.sort((a, b) => a.domain.localeCompare(b.domain));

    // Calculate summary statistics
    const includedDomains = domainEntries.filter(d => d.isIncluded).map(d => d.domain);
    const flaggedEntries = domainEntries.filter(d => d.falsePositiveRisk.isHighRisk || !d.isValidRfc1035);
    const variantCount = domainEntries.filter(d => d.variantDomains && d.variantDomains.length > 0).length;

    const timestamp = getIsoUtcTimestamp();
    const slug = `${slugify(title)}.txt`;

    // Strictly generate the exact Pi-hole format
    const formattedOutput = formatPiHoleBlocklist({
      title,
      description: desc,
      timestamp,
      domains: includedDomains
    });

    // Cache in store for direct downloading
    generatedListsStore.set(slug, { formattedOutput, slug });

    const responseData: HarvestResponse = {
      metadata: {
        termino_busqueda,
        titulo_lista: title,
        descripcion: desc,
        max_resultados: maxLimit,
        timestamp,
        slug
      },
      queriesExecuted: queryVariations.map(q => ({
        ...q,
        resultsFound: Math.floor(domainEntries.length / queryVariations.length) + (q.type === 'best_of' ? 2 : 0)
      })),
      domains: domainEntries,
      summary: {
        totalFound: domainEntries.length,
        uniqueCount: includedDomains.length,
        searchesExecutedCount: queryVariations.length,
        flaggedCount: flaggedEntries.length,
        variantsCount: variantCount,
        excludedCount: domainEntries.length - includedDomains.length
      },
      formattedOutput,
      limitations: [
        'Esta lista es generada automáticamente a partir de resultados de búsqueda públicos; no reemplaza revisión manual antes de desplegar en producción.',
        'Puede haber falsos positivos (dominios legítimos que aparecen en resultados relacionados tangencialmente) y falsos negativos (sitios que no indexan bien).'
      ]
    };

    return res.json(responseData);
  } catch (error: any) {
    console.error('Error during domain harvest:', error);
    return res.status(500).json({
      error: 'Error procesando la recolección de dominios',
      details: error?.message || String(error)
    });
  }
});

/**
 * Helper to reject private/loopback IPs before issuing outbound HTTP HEAD/GET requests
 */
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

/**
 * Inspects HTTP redirects up to 3 hops for a given domain.
 */
async function inspectHttpRedirects(domain: string): Promise<{
  redirectTarget: string | null;
  redirectChain: string[];
}> {
  const maxHops = 3;
  const chain: string[] = [];
  let currentUrl = `https://${domain}/`;
  let fallbackTried = false;

  for (let hop = 0; hop < maxHops; hop++) {
    try {
      const res = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PiHoleBlocklistHarvester/1.0)'
        },
        signal: AbortSignal.timeout(2200)
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;

        const nextUrl = new URL(location, currentUrl).toString();
        const nextDomain = normalizeDomain(nextUrl);
        if (nextDomain && !chain.includes(nextDomain)) {
          chain.push(nextDomain);
        }
        currentUrl = nextUrl;
      } else {
        break;
      }
    } catch {
      if (hop === 0 && !fallbackTried) {
        fallbackTried = true;
        currentUrl = `http://${domain}/`;
        hop--; // retry hop 0 with http
        continue;
      }
      break;
    }
  }

  const finalDomain = chain.length > 0 ? chain[chain.length - 1] : null;
  const isDifferentDomain = finalDomain && finalDomain !== domain;

  return {
    redirectTarget: isDifferentDomain ? finalDomain : null,
    redirectChain: chain
  };
}

/**
 * Live DNS + CNAME + HTTP Redirect check endpoint
 * Accepts batches up to 50 domains and uses a concurrency semaphore (max 10 concurrent checks)
 */
app.post('/api/dns-check', async (req: Request, res: Response) => {
  try {
    const { domains } = req.body;
    if (!Array.isArray(domains)) {
      return res.status(400).json({ error: 'domains debe ser un array de strings' });
    }

    const results: Record<string, {
      status: 'active' | 'nxdomain';
      ip?: string;
      cnameTarget?: string | null;
      redirectTarget?: string | null;
      redirectChain?: string[];
      isRedirectOrAlias?: boolean;
    }> = {};

    const batch = domains.slice(0, 50);
    const CONCURRENCY = 10;
    let cursor = 0;

    async function worker() {
      while (cursor < batch.length) {
        const index = cursor++;
        const rawDomain = String(batch[index] || '').trim().toLowerCase();
        if (!rawDomain) continue;

        let status: 'active' | 'nxdomain' = 'nxdomain';
        let resolvedIp: string | undefined;
        let cnameTarget: string | null = null;
        let redirectTarget: string | null = null;
        let redirectChain: string[] = [];

        // 1. Resolve A/AAAA IP
        try {
          const lookup = await dns.lookup(rawDomain);
          status = 'active';
          resolvedIp = lookup.address;
        } catch {
          status = 'nxdomain';
        }

        // 2. Resolve CNAME record (also check www. prefix if apex has no direct CNAME)
        try {
          const cnames = await dns.resolveCname(rawDomain);
          if (cnames && cnames.length > 0) {
            const normalizedCname = normalizeDomain(cnames[0]);
            if (normalizedCname && normalizedCname !== rawDomain) {
              cnameTarget = normalizedCname;
            }
          }
        } catch {
          // No direct CNAME record on this hostname
        }

        // 3. Follow up to 3 HTTP redirect hops if domain resolves to a public IP
        if (status === 'active' && resolvedIp && !isPrivateIp(resolvedIp)) {
          const redir = await inspectHttpRedirects(rawDomain);
          redirectTarget = redir.redirectTarget;
          redirectChain = redir.redirectChain;
        }

        const isRedirectOrAlias = Boolean(cnameTarget || redirectTarget);

        results[rawDomain] = {
          status,
          ip: resolvedIp,
          cnameTarget,
          redirectTarget,
          redirectChain: redirectChain.length > 0 ? redirectChain : undefined,
          isRedirectOrAlias
        };
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, batch.length) }, () => worker());
    await Promise.all(workers);

    return res.json({ results });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error en consulta DNS' });
  }
});

/**
 * Re-format endpoint when user toggles or adds/removes domains
 */
app.post('/api/reformat', (req: Request, res: Response) => {
  const { title, description, timestamp, domains } = req.body;
  if (!Array.isArray(domains)) {
    return res.status(400).json({ error: 'domains array required' });
  }

  const formattedOutput = formatPiHoleBlocklist({
    title: title || 'Blocklist',
    description: description || 'Pi-hole blocklist',
    timestamp: timestamp || getIsoUtcTimestamp(),
    domains
  });

  const slug = `${slugify(title || 'blocklist')}.txt`;
  generatedListsStore.set(slug, { formattedOutput, slug });

  return res.json({ formattedOutput, slug, uniqueCount: domains.length });
});

/**
 * Direct file download endpoint for {slug_del_titulo}.txt
 */
app.get('/api/download/:slug', (req: Request, res: Response) => {
  const slug = req.params.slug;
  const stored = generatedListsStore.get(slug);

  if (!stored) {
    return res.status(404).send('Archivo de blocklist no encontrado o expirado.');
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${slug}"`);
  return res.send(stored.formattedOutput);
});

// Ensure unmatched /api/* requests always return JSON, never HTML
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({
    error: `Ruta de API no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Express JSON error handler for /api/* routes
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    return res.status(err?.status || 500).json({
      error: err?.message || 'Error interno del servidor API'
    });
  }
  return next(err);
});

// Production or Vite development middleware
const distDir = path.join(__dirname, 'dist');
const distIndex = path.join(distDir, 'index.html');

if (process.env.NODE_ENV === 'production' && fs.existsSync(distIndex)) {
  app.use(express.static(distDir));
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    return res.sendFile(distIndex);
  });
} else {
  // Dynamically import Vite in development
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Blocklist Harvester server running on http://0.0.0.0:${port}`);
});

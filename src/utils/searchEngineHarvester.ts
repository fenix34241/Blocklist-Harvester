import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { SearchQueryInfo } from '../types';

export interface RawHarvestResult {
  domain: string;
  sourceUrl?: string;
  notes?: string;
  sourceEngine: 'web_search' | 'ai_synthesis' | 'google_suggest';
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Decodes Bing click-tracking redirect parameter `u=a1<base64url>`
 */
function decodeBingRedirectUrl(encoded: string): string | null {
  try {
    const clean = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(clean, 'base64').toString('utf8').trim();
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded;
    }
  } catch {
    // Ignore malformed base64
  }
  return null;
}

/**
 * Executes a live web search on Bing (and DuckDuckGo fallback) and parses organic result URLs.
 * Enforces strict timeouts so requests never hang.
 */
export async function executeWebSearchQuery(query: string): Promise<string[]> {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (u: string | null | undefined) => {
    if (!u) return;
    const trimmed = u.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return;
    if (
      trimmed.includes('bing.com/') ||
      trimmed.includes('microsoft.com/') ||
      trimmed.includes('duckduckgo.com/') ||
      trimmed.includes('go.microsoft.com/')
    ) {
      return;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      urls.push(trimmed);
    }
  };

  // 1. Primary: Live Bing organic search (fast & reliable from server environments)
  try {
    const res = await fetch(
      `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`,
      {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        },
        signal: AbortSignal.timeout(4500)
      }
    );

    if (res.ok) {
      const html = await res.text();

      // Extract Bing encoded organic target URLs (u=a1<base64>)
      const ckMatches = html.matchAll(/u=a1([A-Za-z0-9_-]+)/g);
      for (const m of ckMatches) {
        addUrl(decodeBingRedirectUrl(m[1]));
      }

      // Extract direct <li class="b_algo"> links
      const algoLinks = html.matchAll(/<li class="b_algo"[\s\S]*?href="(https?:\/\/[^"]+)"/gi);
      for (const m of algoLinks) {
        addUrl(m[1]);
      }

      // Extract clean <cite> display URLs (e.g. "https://itch.io › games")
      const citeMatches = html.matchAll(/<cite[^>]*>([\s\S]*?)<\/cite>/gi);
      for (const m of citeMatches) {
        const plain = m[1].replace(/<[^>]+>/g, '').trim();
        const hostPart = plain.split(/\s+[›>]\s+|\s+/)[0]?.trim();
        if (hostPart && hostPart.includes('.')) {
          const normalizedUrl = hostPart.startsWith('http') ? hostPart : `https://${hostPart}`;
          addUrl(normalizedUrl);
        }
      }
    }
  } catch {
    // Bing fetch failed or timed out
  }

  // 2. Fallback: DuckDuckGo HTML if Bing yielded fewer than 3 URLs
  if (urls.length < 3) {
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        },
        signal: AbortSignal.timeout(3000)
      });

      if (res.ok) {
        const html = await res.text();
        const matches = html.matchAll(/uddg=([^&"'\s]+)/g);
        for (const m of matches) {
          try {
            addUrl(decodeURIComponent(m[1]));
          } catch {}
        }
      }
    } catch {
      // DDG blocked or timed out
    }
  }

  return urls;
}

/**
 * Uses Google Suggest queries to discover related queries
 */
export async function getAutocompleteSuggestions(term: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(term)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(2500)
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 5).map(s => String(s));
    }
  } catch {}
  return [];
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>(resolve => {
      timer = setTimeout(() => resolve(fallback), ms);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Harvests domains using active Gemini models + Google Search Grounding with strict timeouts
 * so the API never hangs.
 */
export async function harvestWithAI(
  aiClient: GoogleGenAI | null,
  term: string,
  _queries: SearchQueryInfo[]
): Promise<Array<{ domain: string; sourceUrl?: string; notes?: string }>> {
  if (!aiClient) return [];

  const structuredPrompt = `Actúa como un motor de búsqueda web y analista de ciberseguridad para filtrado DNS de Pi-hole.
El usuario desea recolectar dominios relacionados con el término: "${term}".

Instrucciones:
1. Proporciona una lista exhaustiva de dominios reales, activos y existentes en internet que correspondan a este tema.
2. Incluye plataformas web, portales líderes, sitios secundarios, diferentes TLDs si existen (ej. .com, .io, .net, .org, .to, etc.).
3. Incluye sitios en español y en inglés si es relevante.
4. Devuelve entre 25 y 45 dominios relevantes.`;

  const structuredTask = async (): Promise<Array<{ domain: string; sourceUrl?: string; notes?: string }>> => {
    const models: Array<{ name: string; thinkingLow?: boolean }> = [
      { name: 'gemini-3.1-flash-lite' },
      { name: 'gemini-4-hydrogen', thinkingLow: true }
    ];

    for (const m of models) {
      try {
        const response = await withTimeout(
          aiClient.models.generateContent({
            model: m.name,
            contents: structuredPrompt,
            config: {
              ...(m.thinkingLow ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    domain: { type: Type.STRING, description: 'Nombre de dominio sin protocolo ni ruta' },
                    sourceUrl: { type: Type.STRING, description: 'URL de origen https://...' },
                    notes: { type: Type.STRING, description: 'Breve descripción del sitio' }
                  },
                  required: ['domain']
                }
              },
              abortSignal: AbortSignal.timeout(7000)
            }
          }),
          7200,
          null
        );

        const text = response?.text?.trim();
        if (!text) continue;

        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .map(item => ({
              domain: String(item.domain || item.dominio || '').trim(),
              sourceUrl: item.sourceUrl || item.url || (item.domain ? `https://${item.domain}` : undefined),
              notes: item.notes || item.descripcion || undefined
            }))
            .filter(x => Boolean(x.domain));
        }
      } catch (err: any) {
        console.warn(`Model ${m.name} structured harvest failed:`, err?.message || err);
      }
    }
    return [];
  };

  // Run Google Search Grounding in parallel with gemini-4-hydrogen to extract real grounded web URLs
  const groundingTask = async (): Promise<Array<{ domain: string; sourceUrl?: string; notes?: string }>> => {
    try {
      const response = await withTimeout(
        aiClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Lista los principales sitios web y dominios reales relacionados con "${term}" (en español e inglés).`,
          config: {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: AbortSignal.timeout(7000)
          }
        }),
        7200,
        null
      );

      if (!response) return [];
      const results: Array<{ domain: string; sourceUrl?: string; notes?: string }> = [];

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunks)) {
        for (const chunk of chunks) {
          const uri = chunk?.web?.uri;
          const title = chunk?.web?.title;
          if (uri && typeof uri === 'string') {
            results.push({
              domain: uri,
              sourceUrl: uri,
              notes: title ? `Google Search: ${title}` : 'Google Search Grounding'
            });
          }
        }
      }

      // Also extract explicit domain mentions from grounded text
      const text = response.text || '';
      const domainMatches = text.match(
        /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|gg|tv|to|co|es|mx|lat|biz|is|me|app|dev|games|site|xyz|online|cc|in|de|fr|uk|info)\b/gi
      );
      if (domainMatches) {
        for (const d of domainMatches) {
          results.push({
            domain: d.toLowerCase(),
            sourceUrl: `https://${d.toLowerCase()}`,
            notes: 'Google Search Grounding'
          });
        }
      }

      return results;
    } catch (err: any) {
      console.warn('Google Search Grounding harvest failed:', err?.message || err);
      return [];
    }
  };

  const [structuredSettled, groundingSettled] = await withTimeout(
    Promise.allSettled([structuredTask(), groundingTask()]),
    8500,
    [
      { status: 'fulfilled', value: [] },
      { status: 'fulfilled', value: [] }
    ] as PromiseSettledResult<Array<{ domain: string; sourceUrl?: string; notes?: string }>>[]
  );

  const combined: Array<{ domain: string; sourceUrl?: string; notes?: string }> = [];
  if (structuredSettled.status === 'fulfilled') {
    combined.push(...structuredSettled.value);
  }
  if (groundingSettled.status === 'fulfilled') {
    combined.push(...groundingSettled.value);
  }

  return combined;
}

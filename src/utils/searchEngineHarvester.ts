import { GoogleGenAI } from '@google/genai';
import { SearchQueryInfo } from '../types';

export interface RawHarvestResult {
  domain: string;
  sourceUrl?: string;
  notes?: string;
  sourceEngine: 'web_search' | 'ai_synthesis' | 'google_suggest';
}

/**
 * Executes a live web search on DuckDuckGo HTML and parses organic results
 */
export async function executeWebSearchQuery(query: string): Promise<string[]> {
  const urls: string[] = [];
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return urls;

    const html = await res.text();
    // DuckDuckGo redirects through /uddg=
    const matches = [...html.matchAll(/uddg=([^&"'\s]+)/g)]
      .map(m => {
        try {
          return decodeURIComponent(m[1]);
        } catch {
          return '';
        }
      })
      .filter(u => u && !u.includes('duckduckgo.com/') && !u.includes('bing.com/') && !u.includes('msn.com/'));

    urls.push(...matches);

    // Also extract explicit URLs mentioned in snippets
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)].map(m => m[1]);
    for (const snip of snippets) {
      const explicitDomains = snip.match(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|gg|tv|to|co|es|mx|lat|biz|is|me|app|dev|games|site|xyz|online|cc|ru|in|de|fr|uk)\b/gi) || [];
      for (const d of explicitDomains) {
        urls.push(`https://${d}`);
      }
    }
  } catch (err) {
    // Network or timeout
  }
  return urls;
}

/**
 * Uses Google Suggest queries to discover related queries
 */
export async function getAutocompleteSuggestions(term: string): Promise<string[]> {
  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(term)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 5).map(s => String(s));
    }
  } catch {}
  return [];
}

/**
 * Harvests domains using Gemini with fallback models
 */
export async function harvestWithAI(
  aiClient: GoogleGenAI | null,
  term: string,
  queries: SearchQueryInfo[]
): Promise<Array<{ domain: string; sourceUrl?: string; notes?: string }>> {
  if (!aiClient) return [];

  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

  const prompt = `Actúa como un motor de búsqueda web y analista de ciberseguridad para filtrado DNS de Pi-hole.
El usuario desea recolectar dominios relacionados con el término: "${term}".

Instrucciones:
1. Proporciona una lista exhaustiva de dominios reales, activos y existentes en internet que correspondan a este tema.
2. Incluye plataformas web, portales líderes, sitios secundarios, diferentes TLDs si existen (ej. .com, .io, .net, .org, .to, etc.).
3. Incluye sitios en español y en inglés si es relevante.
4. Identifica la URL y el motivo/nota de inclusión.

Devuelve EXCLUSIVAMENTE un array JSON válido con la siguiente estructura de objetos:
[
  {
    "domain": "dominio.com",
    "sourceUrl": "https://dominio.com",
    "notes": "breve descripción del sitio o servicio"
  }
]
Proporciona entre 25 y 45 dominios relevantes. Sin bloques de markdown ni texto adicional fuera del JSON.`;

  for (const model of modelsToTry) {
    try {
      const response = await aiClient.models.generateContent({
        model,
        contents: prompt
      });

      const text = response.text || '';
      // Parse JSON from text
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const firstBracket = cleanJson.indexOf('[');
      const lastBracket = cleanJson.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        const jsonSubstring = cleanJson.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(jsonSubstring);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => ({
            domain: String(item.domain || item.dominio || '').trim(),
            sourceUrl: item.sourceUrl || item.url || `https://${item.domain}`,
            notes: item.notes || item.descripcion || undefined
          })).filter(x => Boolean(x.domain));
        }
      }
    } catch (err: any) {
      console.warn(`Model ${model} failed for harvestWithAI:`, err?.message || err);
    }
  }

  return [];
}

/**
 * Research Service — Google Custom Search + YouTube Data API v3 + Ollama synthesis
 * Permite buscar en Internet y YouTube para encontrar buenas prácticas y mejorar el ERP.
 *
 * Requiere en .env:
 *   GOOGLE_SEARCH_API_KEY  → Google Cloud: Custom Search API key
 *   GOOGLE_SEARCH_CX       → Programmable Search Engine ID
 *   YOUTUBE_API_KEY        → Google Cloud: YouTube Data API v3 key
 */

import axios from 'axios';
import * as ollamaService from './ollama.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface GoogleResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export interface YoutubeResult {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string;
  url: string;
}

export interface ResearchResponse {
  googleResults: GoogleResult[];
  youtubeResults: YoutubeResult[];
  synthesis: string;
  query: string;
  timestamp: string;
  configStatus: {
    googleConfigured: boolean;
    youtubeConfigured: boolean;
  };
}

// ── Config status ─────────────────────────────────────────────────────────────

export function getConfigStatus() {
  return {
    googleConfigured:
      !!process.env.GOOGLE_SEARCH_API_KEY &&
      process.env.GOOGLE_SEARCH_API_KEY !== 'tu_google_api_key_aqui' &&
      !!process.env.GOOGLE_SEARCH_CX &&
      process.env.GOOGLE_SEARCH_CX !== 'tu_search_engine_id_aqui',
    youtubeConfigured:
      !!process.env.YOUTUBE_API_KEY &&
      process.env.YOUTUBE_API_KEY !== 'tu_youtube_api_key_aqui',
  };
}

// ── Google Custom Search ──────────────────────────────────────────────────────

export async function searchGoogle(query: string, numResults = 5): Promise<GoogleResult[]> {
  const { googleConfigured } = getConfigStatus();
  if (!googleConfigured) return [];

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY!;
  const cx = process.env.GOOGLE_SEARCH_CX!;

  const url = 'https://www.googleapis.com/customsearch/v1';
  const resp = await axios.get(url, {
    params: { key: apiKey, cx, q: query, num: Math.min(numResults, 10) },
    timeout: 10_000,
  });

  const items: any[] = resp.data.items || [];
  return items.map((item) => ({
    title: item.title || '',
    link: item.link || '',
    snippet: item.snippet || '',
    displayLink: item.displayLink || '',
  }));
}

// ── YouTube Data API v3 ───────────────────────────────────────────────────────

export async function searchYouTube(query: string, maxResults = 5): Promise<YoutubeResult[]> {
  const { youtubeConfigured } = getConfigStatus();
  if (!youtubeConfigured) return [];

  const apiKey = process.env.YOUTUBE_API_KEY!;

  const url = 'https://www.googleapis.com/youtube/v3/search';
  const resp = await axios.get(url, {
    params: {
      key: apiKey,
      q: query,
      type: 'video',
      part: 'snippet',
      maxResults: Math.min(maxResults, 10),
      relevanceLanguage: 'es',
    },
    timeout: 10_000,
  });

  const items: any[] = resp.data.items || [];
  return items.map((item) => {
    const videoId: string = item.id?.videoId || '';
    const snippet = item.snippet || {};
    return {
      videoId,
      title: snippet.title || '',
      description: snippet.description || '',
      channelTitle: snippet.channelTitle || '',
      thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  });
}

// ── Ollama Synthesis ──────────────────────────────────────────────────────────

export async function synthesizeResearch(
  query: string,
  googleResults: GoogleResult[],
  youtubeResults: YoutubeResult[],
  erpContext?: string,
): Promise<string> {
  const contextLabel = erpContext || 'General ERP';

  // Build prompt content from results
  let contentSections = '';

  if (googleResults.length > 0) {
    contentSections += `\n### Resultados de búsqueda web:\n`;
    googleResults.forEach((r, i) => {
      contentSections += `${i + 1}. **${r.title}** (${r.displayLink})\n   ${r.snippet}\n`;
    });
  }

  if (youtubeResults.length > 0) {
    contentSections += `\n### Videos de YouTube encontrados:\n`;
    youtubeResults.forEach((r, i) => {
      contentSections += `${i + 1}. **${r.title}** — Canal: ${r.channelTitle}\n   ${r.description.slice(0, 200)}\n`;
    });
  }

  if (!contentSections) {
    return 'No se encontraron resultados para analizar. Verifica que las APIs de Google estén configuradas correctamente.';
  }

  const systemPrompt = `Eres un consultor ERP senior especializado en sistemas de gestión empresarial para empresas de Latinoamérica.
Tu misión es analizar resultados de investigación web y YouTube, y extraer las ideas más valiosas y accionables para mejorar un sistema ERP.
Responde siempre en español. Sé conciso, práctico y orientado a resultados de negocio.
Contexto ERP actual: ${contextLabel}.`;

  const userPrompt = `El usuario buscó: "${query}"

${contentSections}

Basándote en estos resultados, proporciona:
1. **Resumen ejecutivo** (2-3 oraciones): ¿qué encontraste más relevante?
2. **Ideas clave** (3-5 puntos): mejores prácticas o recomendaciones directamente aplicables al ERP
3. **Recursos destacados**: menciona el recurso web o video más valioso encontrado y por qué
4. **Próximos pasos sugeridos**: 2-3 acciones concretas para implementar en el sistema

Sé directo y práctico. Evita genéricos — habla de lo que específicamente aplica al contexto ${contextLabel}.`;

  try {
    const synthesis = await ollamaService.generate(userPrompt, systemPrompt);
    return synthesis;
  } catch {
    return 'El análisis con IA no está disponible en este momento (Ollama offline). Los resultados de búsqueda están disponibles arriba.';
  }
}

// ── Combined search + synthesis ───────────────────────────────────────────────

export async function fullResearch(
  query: string,
  erpContext?: string,
  numResults = 5,
): Promise<ResearchResponse> {
  const configStatus = getConfigStatus();

  // Run Google + YouTube in parallel
  const [googleResults, youtubeResults] = await Promise.all([
    searchGoogle(query, numResults).catch(() => [] as GoogleResult[]),
    searchYouTube(query, numResults).catch(() => [] as YoutubeResult[]),
  ]);

  // Synthesize with Ollama
  const synthesis = await synthesizeResearch(query, googleResults, youtubeResults, erpContext);

  return {
    googleResults,
    youtubeResults,
    synthesis,
    query,
    timestamp: new Date().toISOString(),
    configStatus,
  };
}

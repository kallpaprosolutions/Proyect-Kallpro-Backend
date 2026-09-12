import { Request } from 'express';
import * as researchService from '../services/research.service';
import * as ollamaService from '../services/ollama.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

// GET /api/research/status
export const getResearchStatus = asyncHandler(async (_req: Request, res) => {
  const { googleConfigured, youtubeConfigured } = researchService.getConfigStatus();
  let ollamaOnline = false;
  try {
    const ping = await ollamaService.pingOllama();
    ollamaOnline = ping.ok;
  } catch {
    ollamaOnline = false;
  }
  res.json({ google: googleConfigured, youtube: youtubeConfigured, ollama: ollamaOnline });
});

// POST /api/research/google  { query, numResults? }
export const searchGoogleCtrl = asyncHandler(async (req: Request, res) => {
  const { query, numResults } = req.body;
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw AppError.badRequest('El campo "query" es requerido', 'VALIDATION_ERROR');
  }
  const { googleConfigured } = researchService.getConfigStatus();
  if (!googleConfigured) {
    // Respuesta con campo `instructions` específico (shape preservado).
    res.status(503).json({
      error: 'Google Custom Search API no está configurada',
      instructions: 'Agrega GOOGLE_SEARCH_API_KEY y GOOGLE_SEARCH_CX al archivo .env del backend',
    });
    return;
  }
  try {
    const results = await researchService.searchGoogle(query.trim(), numResults || 5);
    res.json({ results, query: query.trim() });
  } catch (err: any) {
    throw new AppError(err?.response?.data?.error?.message || err.message || 'Error al buscar en Google', 500, 'GOOGLE_SEARCH_ERROR');
  }
});

// POST /api/research/youtube  { query, maxResults? }
export const searchYoutubeCtrl = asyncHandler(async (req: Request, res) => {
  const { query, maxResults } = req.body;
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw AppError.badRequest('El campo "query" es requerido', 'VALIDATION_ERROR');
  }
  const { youtubeConfigured } = researchService.getConfigStatus();
  if (!youtubeConfigured) {
    res.status(503).json({
      error: 'YouTube Data API no está configurada',
      instructions: 'Agrega YOUTUBE_API_KEY al archivo .env del backend',
    });
    return;
  }
  try {
    const results = await researchService.searchYouTube(query.trim(), maxResults || 5);
    res.json({ results, query: query.trim() });
  } catch (err: any) {
    throw new AppError(err?.response?.data?.error?.message || err.message || 'Error al buscar en YouTube', 500, 'YOUTUBE_SEARCH_ERROR');
  }
});

// POST /api/research/synthesize  { query, erpContext?, numResults? }
export const synthesizeResearchCtrl = asyncHandler(async (req: Request, res) => {
  const { query, erpContext, numResults } = req.body;
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw AppError.badRequest('El campo "query" es requerido', 'VALIDATION_ERROR');
  }
  try {
    const result = await researchService.fullResearch(query.trim(), erpContext, numResults || 5);
    res.json(result);
  } catch (err: any) {
    throw new AppError(err.message || 'Error en la investigación', 500, 'RESEARCH_ERROR');
  }
});

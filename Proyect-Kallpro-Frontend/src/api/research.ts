import client from './client';

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

export const researchApi = {
  getStatus: () =>
    client.get<{ google: boolean; youtube: boolean; ollama: boolean }>('/research/status'),

  searchGoogle: (query: string, numResults = 5) =>
    client.post<{ results: GoogleResult[]; query: string }>('/research/google', { query, numResults }),

  searchYouTube: (query: string, maxResults = 5) =>
    client.post<{ results: YoutubeResult[]; query: string }>('/research/youtube', { query, maxResults }),

  synthesize: (query: string, erpContext?: string, numResults = 5) =>
    client.post<ResearchResponse>('/research/synthesize', { query, erpContext, numResults }),
};

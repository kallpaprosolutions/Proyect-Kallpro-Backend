import axios from 'axios';
import { AgentContext } from '../agents/base.agent';

export async function execute(args: { query: string; maxResults?: number }, _ctx: AgentContext) {
  // Use DuckDuckGo Instant Answer API (no key needed)
  try {
    const res = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: args.query,
        format: 'json',
        no_html: 1,
        skip_disambig: 1,
      },
      timeout: 5000,
    });

    const data = res.data;
    const results: any[] = [];

    if (data.AbstractText) {
      results.push({ title: data.Heading, snippet: data.AbstractText, url: data.AbstractURL });
    }

    if (data.RelatedTopics) {
      for (const topic of (data.RelatedTopics as any[]).slice(0, (args.maxResults ?? 3) - results.length)) {
        if (topic.Text) {
          results.push({ title: topic.Text.substring(0, 60), snippet: topic.Text, url: topic.FirstURL ?? '' });
        }
      }
    }

    return { query: args.query, results, source: 'duckduckgo' };
  } catch (err: any) {
    return { query: args.query, results: [], error: err.message };
  }
}

export default execute;

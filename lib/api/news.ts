import RSSParser from 'rss-parser';
import type { NewsItem } from '@/lib/types';
import { RSS_FEEDS, CACHE_KEYS } from '@/lib/constants';
import { cacheSet } from '@/lib/cache/helpers';

// Fetch feed XML via native fetch (WHATWG URL) instead of rss-parser's
// parseURL, which relies on the deprecated url.parse() under the hood.
async function parseFeed(parser: RSSParser, url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": "aip-dash/1.0 (+https://github.com/maniksinghvalid/ai-dashboard)" },
  });
  if (!res.ok) {
    throw new Error(`feed fetch failed: ${res.status} ${url}`);
  }
  const xml = await res.text();
  return parser.parseString(xml);
}

export async function fetchNews(): Promise<NewsItem[]> {
  const parser = new RSSParser();

  const results = await Promise.allSettled(
    RSS_FEEDS.map((feed) => parseFeed(parser, feed.url))
  );

  const items: NewsItem[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const feed = RSS_FEEDS[index];
      const mapped = (result.value.items ?? []).map((item): NewsItem => ({
        title: item.title || 'Untitled',
        link: item.link || '',
        source: feed.name,
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
        summary: item.contentSnippet || item.content?.slice(0, 300) || '',
      }));
      items.push(...mapped);
    }
  });

  items.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const top = items.slice(0, 30);

  await cacheSet(CACHE_KEYS.news, top);

  return top;
}

import { kv } from '@vercel/kv';

const KV_KEY = 'rubber-duck-news';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ITEMS = 10;
const RSS_URL = 'https://news.google.com/rss/search?q=' +
  encodeURIComponent('ラバーダック OR ラバー・ダック OR "rubber duck"') +
  '&hl=ja&gl=JP&ceid=JP:ja';

function parseItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null && items.length < MAX_ITEMS) {
    const block = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
    if (title) {
      items.push({
        title: title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
        link: link.trim(),
        date: pubDate.trim(),
        source: source.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
      });
    }
  }
  return items;
}

async function fetchNews() {
  const res = await fetch(RSS_URL);
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseItems(xml);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const cached = await kv.get(KV_KEY);
    const now = Date.now();

    if (cached && cached.updatedAt && (now - cached.updatedAt) < CACHE_TTL_MS) {
      return res.status(200).json({ items: cached.items, updatedAt: cached.updatedAt });
    }

    // Cache is stale or missing — refresh
    const items = await fetchNews();
    const data = { items, updatedAt: now };
    await kv.set(KV_KEY, data);
    return res.status(200).json(data);
  } catch (error) {
    // If refresh fails but we have stale cache, return it
    try {
      const cached = await kv.get(KV_KEY);
      if (cached && cached.items) {
        return res.status(200).json({ items: cached.items, updatedAt: cached.updatedAt, stale: true });
      }
    } catch (_) {}
    return res.status(200).json({ items: [], updatedAt: null });
  }
}

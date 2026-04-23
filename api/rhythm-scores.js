import { kv } from '@vercel/kv';

const KEY_PREFIX = 'duck-rhythm-lb-';
const VALID_DIFFS = ['おさんぽクワック', 'はじめてのクワック', 'クワッくんのおでかけ', 'ポンドパーティー', 'ミッドナイトスワン', 'サンダークワック'];
const MAX_ENTRIES = 20;

function keyFor(diff) {
  return KEY_PREFIX + (VALID_DIFFS.includes(diff) ? diff : VALID_DIFFS[0]);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const diff = req.query.difficulty;
      if (diff && VALID_DIFFS.includes(diff)) {
        const scores = await kv.get(keyFor(diff)) || [];
        return res.status(200).json(scores);
      }
      // No difficulty specified: return all
      const all = await Promise.all(
        VALID_DIFFS.map(d => kv.get(keyFor(d)).then(s => s || []))
      );
      const result = {};
      VALID_DIFFS.forEach((d, i) => { result[d] = all[i]; });
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const { name, score, maxCombo, perfect, great, good, miss, difficulty } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (typeof score !== 'number' || score <= 0 || score > 99999999) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      const diff = VALID_DIFFS.includes(difficulty) ? difficulty : VALID_DIFFS[0];
      const cleanName = name.trim().slice(0, 15);
      const key = keyFor(diff);
      let scores = await kv.get(key) || [];

      scores.push({
        name: cleanName,
        score: Math.floor(score),
        maxCombo: typeof maxCombo === 'number' ? Math.floor(maxCombo) : 0,
        perfect: typeof perfect === 'number' ? Math.floor(perfect) : 0,
        great: typeof great === 'number' ? Math.floor(great) : 0,
        good: typeof good === 'number' ? Math.floor(good) : 0,
        miss: typeof miss === 'number' ? Math.floor(miss) : 0,
        date: new Date().toISOString()
      });

      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, MAX_ENTRIES);

      await kv.set(key, scores);
      return res.status(200).json(scores);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (req.method === 'GET') {
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: 'Server error' });
  }
}

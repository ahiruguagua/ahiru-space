import { kv } from '@vercel/kv';

const KEY_PREFIX = 'duck-osouji-lb-';
const VALID_DIFFS = ['かんたん', 'ふつう', 'むずかしい'];
const MAX_ENTRIES = 20;

function keyFor(diff) {
  return KEY_PREFIX + (VALID_DIFFS.includes(diff) ? diff : 'ふつう');
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
      // No difficulty specified: return all 3
      const [easy, normal, hard] = await Promise.all(
        VALID_DIFFS.map(d => kv.get(keyFor(d)).then(s => s || []))
      );
      return res.status(200).json({ 'かんたん': easy, 'ふつう': normal, 'むずかしい': hard });
    }

    if (req.method === 'POST') {
      const { name, score, difficulty } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (typeof score !== 'number' || score <= 0 || score > 99999999) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      const diff = VALID_DIFFS.includes(difficulty) ? difficulty : 'ふつう';
      const cleanName = name.trim().slice(0, 15);
      const key = keyFor(diff);
      let scores = await kv.get(key) || [];

      scores.push({
        name: cleanName,
        score: Math.floor(score),
        difficulty: diff,
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

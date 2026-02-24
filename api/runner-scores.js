import { kv } from '@vercel/kv';

const LEADERBOARD_KEY = 'duck-runner-leaderboard';
const MAX_ENTRIES = 20;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const scores = await kv.get(LEADERBOARD_KEY) || [];
      return res.status(200).json(scores);
    }

    if (req.method === 'POST') {
      const { name, score, laps, zone } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (typeof score !== 'number' || score <= 0 || score > 99999999) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      const cleanName = name.trim().slice(0, 15);
      let scores = await kv.get(LEADERBOARD_KEY) || [];

      scores.push({
        name: cleanName,
        score: Math.floor(score),
        laps: typeof laps === 'number' ? Math.floor(laps) : 1,
        zone: typeof zone === 'string' ? zone.slice(0, 20) : '',
        date: new Date().toISOString()
      });

      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, MAX_ENTRIES);

      await kv.set(LEADERBOARD_KEY, scores);
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

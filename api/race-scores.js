import { kv } from '@vercel/kv';

const LEADERBOARD_KEY = 'duck-race-leaderboard';
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
      const { name, time } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (typeof time !== 'number' || time <= 0 || time > 999999) {
        return res.status(400).json({ error: 'Invalid time' });
      }

      const cleanName = name.trim().slice(0, 15);
      let scores = await kv.get(LEADERBOARD_KEY) || [];

      scores.push({
        name: cleanName,
        time: Math.floor(time),
        date: new Date().toISOString()
      });

      scores.sort((a, b) => a.time - b.time);
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

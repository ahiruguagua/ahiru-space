import { kv } from '@vercel/kv';

// Serves multiple games to stay under Vercel's 12-function hobby limit.
// No ?game param (legacy) = Duck Only Up.
const GAMES = {
  onlyup: 'duck-only-up-leaderboard',
  dodge: 'duck-dodge-leaderboard',
};
const MAX_ENTRIES = 20;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const game = GAMES[req.query && req.query.game] ? req.query.game : 'onlyup';
  const LEADERBOARD_KEY = GAMES[game];

  try {
    if (req.method === 'GET') {
      const scores = await kv.get(LEADERBOARD_KEY) || [];
      return res.status(200).json(scores);
    }

    if (req.method === 'POST') {
      const { name, score, eggs, stars, maxCombo, time } = req.body;

      // Validation
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (typeof score !== 'number' || score <= 0 || score > 99999999) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      const cleanName = name.trim().slice(0, 15);
      let scores = await kv.get(LEADERBOARD_KEY) || [];

      const entry = {
        name: cleanName,
        score: Math.floor(score),
        date: new Date().toISOString()
      };
      if (game === 'dodge') {
        entry.stars = typeof stars === 'number' ? Math.max(0, Math.floor(stars)) : 0;
        entry.maxCombo = typeof maxCombo === 'number' ? Math.max(0, Math.floor(maxCombo)) : 0;
        entry.time = typeof time === 'number' ? Math.max(0, Math.round(time * 10) / 10) : 0;
      } else {
        entry.eggs = typeof eggs === 'number' ? Math.floor(eggs) : 0;
      }
      scores.push(entry);

      // Sort descending and keep top 20
      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, MAX_ENTRIES);

      await kv.set(LEADERBOARD_KEY, scores);
      return res.status(200).json(scores);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    // If KV is not configured, return empty array for GET
    if (req.method === 'GET') {
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: 'Server error' });
  }
}

import { kv } from '@vercel/kv';

const KV_KEY = 'duck-pond-state';
const MAX_DUCKS = 50;
const DUCK_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function filterExpired(ducks) {
  const now = Date.now();
  return ducks.filter(d => now - d.t < DUCK_TTL_MS);
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const state = await kv.get(KV_KEY) || { ducks: [] };
      const ducks = filterExpired(state.ducks || []);
      return res.status(200).json({ ducks });
    }

    if (req.method === 'POST') {
      const state = await kv.get(KV_KEY) || { ducks: [] };
      let ducks = filterExpired(state.ducks || []);

      if (ducks.length >= MAX_DUCKS) {
        return res.status(200).json({ ducks });
      }

      ducks.push({ id: generateId(), t: Date.now() });
      await kv.set(KV_KEY, { ducks });
      return res.status(200).json({ ducks });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (req.method === 'GET') {
      return res.status(200).json({ ducks: [] });
    }
    return res.status(500).json({ error: 'Server error' });
  }
}

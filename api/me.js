// "My mascots": what a Critterkit key holds. GET /api/me with the key in x-pip-pass.
import { whoIs, refuse } from './_keys.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'Use GET.' }); return; }
  const who = await whoIs(req);
  if (refuse(res, who, 'This page')) return;
  if (who.owner) { res.json({ owner: true, credits: null, mascots: [] }); return; }
  res.json({ credits: who.rec.credits || 0, mascots: (who.rec.mascots || []).map(({ id, name, created }) => ({ id, name, created })) });
}

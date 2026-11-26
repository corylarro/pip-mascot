// Small Stripe helpers shared by checkout and the webhook (plain fetch, no SDK).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readKey, writeKey, newKey, findCheckout, saveCheckout } from './_keys.js';

// Credits each plan adds. painted: the mascot itself (5) plus 10 to start. 'credits' is the old name of credits10.
export const CREDITS = { painted: 15, credits: 10, credits10: 10, credits30: 30, credits100: 100 };

export async function stripe(method, path, form) {
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(Object.entries(form).map(([k, v]) => [k, String(v)])).toString() : undefined
  });
  let json = {}; try { json = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, json };
}

// Turn a paid Checkout Session into a key (new, or more paints on an existing one). Safe to call more than once:
// the session id is recorded, so the webhook and the buyer's return visit can't both add paints.
export async function fulfil(s) {
  const done = await findCheckout(s.id);
  if (done && done.key) { const rec = await readKey(done.key); return { key: done.key, credits: rec ? rec.credits : null, already: true }; }
  const meta = s.metadata || {}, plan = CREDITS[meta.plan] ? meta.plan : 'painted';
  let key = null, rec = null;
  if (meta.topup) { rec = await readKey(meta.topup); if (rec) key = meta.topup; }
  if (!key) { key = newKey(); rec = { credits: 0, cv: 2, email: (s.customer_details && s.customer_details.email) || null, created: new Date().toISOString(), orders: [] }; }
  rec.credits = (rec.credits || 0) + CREDITS[plan];
  rec.orders = [...(rec.orders || []), { checkout: s.id, plan, total: s.amount_total ?? null, currency: s.currency || 'usd', at: new Date().toISOString() }];
  await saveCheckout(s.id, { key, plan });   // record first, so a second caller finds it
  await writeKey(key, rec);
  return { key, credits: rec.credits };
}

// Checks the Stripe-Signature header (t=…,v1=…) against the raw body, allowing 5 minutes of clock drift.
export function verifySignature(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k, v]));
  const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return sigs.some(s => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

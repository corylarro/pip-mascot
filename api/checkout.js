// Checkout with Polar.
//   GET  /api/checkout?plan=painted          -> sends the buyer to Polar's payment page
//   GET  /api/checkout?plan=credits&key=ck_… -> buys more credits for an existing key
//   GET  /api/checkout?redeem=<checkout id>  -> after paying: checks with Polar that it succeeded, then hands out the key (once)
import { readKey, writeKey, newKey, findCheckout, saveCheckout } from './_keys.js';

const PRODUCTS = {
  painted: process.env.POLAR_PRODUCT_PAINTED || '4e2de512-68ad-4643-88ab-52662c42ca03',
  credits: process.env.POLAR_PRODUCT_CREDITS || '557e1836-e7c6-4ab2-9af8-01b256588799'
};
const CREDITS = { painted: 6, credits: 10 };   // painted: the first paint + 5 repaints
const API = () => (process.env.POLAR_SERVER === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh');

export default async function handler(req, res) {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) { res.status(500).json({ error: 'Checkout isn’t connected yet. Add POLAR_ACCESS_TOKEN in Vercel.' }); return; }
  if (!process.env.BLOB_READ_WRITE_TOKEN) { res.status(500).json({ error: 'Storage isn’t connected yet.' }); return; }
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const q = req.query || {};
  try {
    if (q.redeem) {
      const id = String(q.redeem);
      if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(400).json({ error: 'That payment link looks off.' }); return; }
      const done = await findCheckout(id);
      if (done && done.key) { const rec = await readKey(done.key); res.json({ key: done.key, credits: rec ? rec.credits : null, already: true }); return; }
      const r = await fetch(`${API()}/v1/checkouts/${id}`, { headers: H });
      const c = await r.json().catch(() => ({}));
      if (!r.ok) { res.status(r.status === 404 ? 404 : 502).json({ error: 'Couldn’t find that payment. If you were charged, reply to your receipt email and we’ll sort it out.' }); return; }
      if (c.status !== 'succeeded') {
        res.status(409).json({ status: c.status, error: c.status === 'confirmed' ? 'Your payment is still going through. Try again in a minute.' : 'This payment didn’t go through, so nothing was charged.' });
        return;
      }
      const meta = c.metadata || {}, plan = meta.plan || (c.product_id && c.product_id === PRODUCTS.credits ? 'credits' : 'painted');
      let key = null, rec = null;
      if (meta.topup) { rec = await readKey(meta.topup); if (rec) key = meta.topup; }
      if (!key) { key = newKey(); rec = { credits: 0, email: c.customer_email || null, created: new Date().toISOString(), orders: [] }; }
      rec.credits = (rec.credits || 0) + (CREDITS[plan] || 0);
      rec.orders = [...(rec.orders || []), { checkout: id, plan, total: c.total_amount ?? null, at: new Date().toISOString() }];
      await writeKey(key, rec);
      await saveCheckout(id, { key, plan });
      res.json({ key, credits: rec.credits });
      return;
    }

    const plan = String(q.plan || 'painted'), product = PRODUCTS[plan];
    if (!product) { res.status(400).json({ error: 'That one isn’t for sale yet.' }); return; }
    const meta = { plan };
    if (q.key && await readKey(String(q.key))) meta.topup = String(q.key);
    const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const r = await fetch(`${API()}/v1/checkouts/`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ products: [product], success_url: `${origin}/paint?checkout_id={CHECKOUT_ID}`, allow_discount_codes: true, metadata: meta,
        // launch price: a Polar discount applied automatically to the painted plan
        ...(plan === 'painted' && process.env.POLAR_DISCOUNT_ID ? { discount_id: process.env.POLAR_DISCOUNT_ID } : {}) })
    });
    const c = await r.json().catch(() => ({}));
    if (!r.ok || !c.url) { res.status(502).json({ error: 'Couldn’t start checkout. Try again in a moment.', detail: c.detail || c.error || null }); return; }
    if (req.method === 'GET') { res.writeHead(303, { Location: c.url }); res.end(); return; }
    res.json({ url: c.url });
  } catch (e) {
    res.status(500).json({ error: 'Checkout hit a snag. Try again in a moment.' });
  }
}

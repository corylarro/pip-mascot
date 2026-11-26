// Stripe calls this when a checkout finishes, so the buyer's key exists even if they closed the tab before
// coming back to critterkit.com. Env: STRIPE_WEBHOOK_SECRET (whsec_…), from the webhook endpoint in Stripe.
import { verifySignature, fulfil } from './_stripe.js';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  // read the stream directly: touching req.body would make Vercel parse it and the signature check needs the exact bytes
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET is not set.' }); return; }
  const raw = await rawBody(req);
  if (!verifySignature(raw, req.headers['stripe-signature'], secret)) { res.status(400).json({ error: 'Bad signature.' }); return; }
  let event; try { event = JSON.parse(raw); } catch (e) { res.status(400).end(); return; }
  try {
    const s = event.data && event.data.object;
    const paid = (event.type === 'checkout.session.completed' && s.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded';
    if (paid) { const out = await fulfil(s); console.log('stripe webhook: fulfilled', s.id, out.already ? '(already)' : ''); }
    res.json({ received: true });
  } catch (e) {
    console.log('stripe webhook error', e && e.message);
    res.status(500).json({ error: 'Could not record the purchase.' });   // Stripe retries on 5xx
  }
}

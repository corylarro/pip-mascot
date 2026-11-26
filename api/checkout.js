// Checkout with Stripe (Checkout Sessions, one-time payments).
//   GET /api/checkout?plan=painted          -> sends the buyer to Stripe's payment page
//   GET /api/checkout?plan=credits&key=ck_… -> buys more paints for an existing key
//   GET /api/checkout?redeem=<session id>   -> after paying: checks with Stripe that it's paid, then hands out the key (once)
// Env: STRIPE_SECRET_KEY (required). Optional: STRIPE_TAX=1 to turn on Stripe Tax, STRIPE_INVOICES=0 to stop
// creating an invoice for each purchase, PRICE_PAINTED / PRICE_CREDITS in cents to change prices.
import { readKey } from './_keys.js';
import { stripe, fulfil } from './_stripe.js';

const PRICES = {
  painted: { cents: Number(process.env.PRICE_PAINTED) || 1900, name: 'Critterkit painted mascot',
    desc: 'One-time license for a custom animated mascot. Includes 6 paints to get it right.' },
  credits: { cents: Number(process.env.PRICE_CREDITS) || 900, name: 'Critterkit 10 more paints',
    desc: 'Adds 10 paints to your existing Critterkit key.' }
};

export default async function handler(req, res) {
  if (!process.env.STRIPE_SECRET_KEY) { res.status(500).json({ error: 'Checkout isn’t connected yet. Add STRIPE_SECRET_KEY in Vercel.' }); return; }
  if (!process.env.BLOB_READ_WRITE_TOKEN) { res.status(500).json({ error: 'Storage isn’t connected yet.' }); return; }
  const q = req.query || {};
  try {
    if (q.redeem) {
      const id = String(q.redeem);
      if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) { res.status(400).json({ error: 'That payment link looks off.' }); return; }
      const r = await stripe('GET', `/checkout/sessions/${id}`);
      if (!r.ok) { res.status(r.status === 404 ? 404 : 502).json({ error: 'Couldn’t find that payment. If you were charged, email hello@zerotobuild.dev and we’ll sort it out.' }); return; }
      const s = r.json;
      if (s.status !== 'complete') { res.status(409).json({ status: s.status, error: 'This payment didn’t go through, so nothing was charged.' }); return; }
      if (s.payment_status !== 'paid') { res.status(409).json({ status: 'processing', error: 'Your payment is still going through. Try again in a minute.' }); return; }
      res.json(await fulfil(s));
      return;
    }

    const plan = String(q.plan || 'painted'), p = PRICES[plan];
    if (!p) { res.status(400).json({ error: 'That one isn’t for sale yet.' }); return; }
    const topup = q.key && await readKey(String(q.key)) ? String(q.key) : '';
    if (plan === 'credits' && !topup) { res.status(400).json({ error: 'Open this from the paint page so the paints go on your key.' }); return; }
    const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const form = {
      mode: 'payment',
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': p.cents,
      'line_items[0][price_data][product_data][name]': p.name,
      'line_items[0][price_data][product_data][description]': p.desc,
      success_url: `${origin}/paint?checkout_id={CHECKOUT_SESSION_ID}`,
      cancel_url: plan === 'credits' ? `${origin}/paint` : `${origin}/`,
      allow_promotion_codes: 'true',
      'metadata[plan]': plan,
      'payment_intent_data[metadata][plan]': plan,
      'custom_text[submit][message]': 'All sales are final. By paying you agree to the Terms at critterkit.com/terms.',
      ...(topup ? { 'metadata[topup]': topup } : {}),
      // an invoice (with a PDF) for every purchase, emailed by Stripe once email receipts are on in the dashboard
      ...(process.env.STRIPE_INVOICES !== '0' ? { 'invoice_creation[enabled]': 'true',
        'invoice_creation[invoice_data][footer]': 'Critterkit is a product of Zero to Build LLC. All sales are final.' } : {}),
      ...(process.env.STRIPE_TAX === '1' ? { 'automatic_tax[enabled]': 'true', 'billing_address_collection': 'required' } : {})
    };
    const r = await stripe('POST', '/checkout/sessions', form);
    if (!r.ok || !r.json.url) {
      console.log('stripe checkout failed', r.status, r.json && r.json.error && r.json.error.message);
      res.status(502).json({ error: 'Couldn’t start checkout. Try again in a moment.' }); return;
    }
    if (req.method === 'GET') { res.writeHead(303, { Location: r.json.url }); res.end(); return; }
    res.json({ url: r.json.url });
  } catch (e) {
    console.log('checkout error', e && e.message);
    res.status(500).json({ error: 'Checkout hit a snag. Try again in a moment.' });
  }
}

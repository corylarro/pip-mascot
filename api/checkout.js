// Checkout with Stripe (Checkout Sessions, one-time payments).
//   GET /api/checkout?plan=painted          -> sends the buyer to Stripe's payment page
//   GET /api/checkout?plan=credits10|credits30|credits100&key=ck_… -> adds credits to an existing key
//   GET /api/checkout?redeem=<session id>   -> after paying: checks with Stripe that it's paid, then hands out the key (once)
// Env: STRIPE_SECRET_KEY (required). Optional: PRICE_PAINTED / PRICE_CREDITS in cents to change prices.
// Managed Payments is on by default: Stripe sells as merchant of record, so it calculates, collects and files sales
// tax/VAT and sends receipts and invoices. STRIPE_MANAGED=0 turns it off (then STRIPE_TAX=1 / STRIPE_INVOICES=0 apply).
const MANAGED = process.env.STRIPE_MANAGED !== '0';
// Product tax code Stripe uses for tax. Default: AI as a Service, cloud based, business use (eligible for Managed Payments).
const TAX_CODE = process.env.STRIPE_TAX_CODE || 'txcd_10105002';
import { readKey } from './_keys.js';
import { stripe, fulfil } from './_stripe.js';

const pack = (n, cents) => ({ cents, name: `Critterkit ${n} credits`, desc: `Adds ${n} credits to your Critterkit key. A custom pose uses 1, a new mascot uses 5.`, topup: true });
const PRICES = {
  painted: { cents: Number(process.env.PRICE_PAINTED) || 1900, name: 'Critterkit painted mascot',
    desc: 'One-time license for a custom animated mascot, plus 10 credits for custom poses or redos.' },
  credits10: pack(10, 900), credits30: pack(30, 1900), credits100: pack(100, 4900)
};
PRICES.credits = PRICES.credits10;   // old links

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
      if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') { res.status(409).json({ status: 'processing', error: 'Your payment is still going through. Try again in a minute.' }); return; }
      res.json(await fulfil(s));
      return;
    }

    const plan = String(q.plan || 'painted'), p = PRICES[plan];
    if (!p) { res.status(400).json({ error: 'That one isn’t for sale yet.' }); return; }
    const topup = q.key && await readKey(String(q.key)) ? String(q.key) : '';
    if (p.topup && !topup) { res.status(400).json({ error: 'Open this from your mascot page so the credits go on your key.' }); return; }
    const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const form = {
      mode: 'payment',
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': p.cents,
      'line_items[0][price_data][product_data][name]': p.name,
      'line_items[0][price_data][product_data][description]': p.desc,
      'line_items[0][price_data][product_data][tax_code]': TAX_CODE,
      success_url: p.topup ? `${origin}/mascots?checkout_id={CHECKOUT_SESSION_ID}` : `${origin}/paint?checkout_id={CHECKOUT_SESSION_ID}`,
      cancel_url: p.topup ? `${origin}/mascots` : `${origin}/`,
      allow_promotion_codes: 'true',
      'metadata[plan]': plan,
      'payment_intent_data[metadata][plan]': plan,
      ...(topup ? { 'metadata[topup]': topup } : {}),
      ...(MANAGED ? { 'managed_payments[enabled]': 'true' } : {
        // without Managed Payments: our own note on the pay button, our own invoice, optional Stripe Tax
        'custom_text[submit][message]': 'All sales are final. By paying you agree to the Terms at critterkit.com/terms.',
        ...(process.env.STRIPE_INVOICES !== '0' ? { 'invoice_creation[enabled]': 'true',
          'invoice_creation[invoice_data][footer]': 'Critterkit is a product of Zero to Build LLC. All sales are final.' } : {}),
        ...(process.env.STRIPE_TAX === '1' ? { 'automatic_tax[enabled]': 'true', 'billing_address_collection': 'required' } : {})
      })
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

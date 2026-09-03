const path = require('path');
module.paths.push(
  path.join(__dirname, '..', 'my-react-app', 'node_modules'),
  path.join(__dirname, '..', 'Playwright_Razorpay', 'node_modules')
);

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('./config');
const { verifyMandateChain } = require('./mandates');
const { MandateValidationError } = require('./errors');

const app = express();
const PORT = process.env.X402_PORT || 6004;

app.use(cors());
app.use(express.json());

// In-memory Orders DB Table (columns: order_ref, status, amount, currency, nonce, nonce_consumed, expires_at, razorpay_order_id, payment_id)
const ordersDB = new Map();

/**
 * Helper to decode base64 or JSON headers
 */
function parseHeader(headerVal) {
  if (!headerVal) return null;
  if (typeof headerVal === 'object') return headerVal;
  try {
    // Try base64 decode first
    const decoded = Buffer.from(headerVal, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (_) {
    try {
      return JSON.parse(headerVal);
    } catch (_) {
      return null;
    }
  }
}

/**
 * Helper to encode object to base64 JSON
 */
function encodeHeader(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

/**
 * Core Checkout Handler for X-402 Challenge & Razorpay Settlement
 */
async function handleCheckout(req, res) {
  try {
    // 1. Extract Mandates from Headers (or Body fallback)
    const rawCart = req.headers['cart-mandate'] || req.body.cartMandate;
    const rawPayment = req.headers['payment-mandate'] || req.body.paymentMandate;

    const cartMandate = parseHeader(rawCart);
    const paymentMandate = parseHeader(rawPayment);

    // 2. Validate Mandate Chain
    verifyMandateChain(cartMandate, paymentMandate);

    // 3. Check for Payment-Signature Header (Settlement Step)
    const rawPaymentSig = req.headers['payment-signature'] || req.body.paymentSignature;

    if (!rawPaymentSig) {
      // ══════════════════════════════════════════════════════════════════════
      // STEP 1: INITIAL HIT -> ISSUE X-402 PAYMENT REQUIRED CHALLENGE
      // ══════════════════════════════════════════════════════════════════════
      const orderRef = `order_ref_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const nonce = crypto.randomBytes(16).toString('hex');
      const amount = Number(cartMandate.total_amount);
      const currency = cartMandate.currency || 'INR';
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min window

      // Generate real live Razorpay order via Razorpay API
      let razorpayOrderId = `order_rzp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      try {
        const { createRazorpayOrder } = require('../Razorpay_Test_Mode/razorpay_service');
        const liveOrder = await createRazorpayOrder(amount, currency, orderRef, {
          cart_mandate_id: cartMandate.id,
          payment_mandate_id: paymentMandate.id
        });
        if (liveOrder && liveOrder.id) {
          razorpayOrderId = liveOrder.id;
        }
      } catch (rzpErr) {
        console.warn('[X402 Gateway] Razorpay live order creation fallback:', rzpErr.message);
      }

      const orderRow = {
        order_ref: orderRef,
        status: 'pending_payment',
        amount: amount,
        currency: currency,
        cart_mandate_id: cartMandate.id,
        payment_mandate_id: paymentMandate.id,
        nonce: nonce,
        nonce_consumed: false,
        expires_at: expiresAt,
        razorpay_order_id: razorpayOrderId,
        created_at: new Date().toISOString()
      };

      ordersDB.set(orderRef, orderRow);
      console.log(`[X402 Gateway] 🛡️ Mandate Chain Verified! Issued HTTP 402 Challenge for Order: ${orderRef} (Amount: ₹${amount})`);

      const challengePayload = {
        amount: amount,
        currency: currency,
        order_ref: orderRef,
        methods: ['razorpay'],
        nonce: nonce,
        expires_at: expiresAt,
        razorpay_order_id: razorpayOrderId,
        razorpay_key_id: RAZORPAY_KEY_ID
      };

      res.setHeader('Payment-Required', encodeHeader(challengePayload));
      return res.status(402).json({
        success: false,
        status: 'payment_required',
        message: 'HTTP 402: Payment Required. Please fulfill the payment challenge.',
        challenge: challengePayload
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // STEP 2: SETTLEMENT RETRY -> VERIFY RAZORPAY PAYMENT & SETTLE
    // ══════════════════════════════════════════════════════════════════════
    const paymentSigData = parseHeader(rawPaymentSig);
    if (!paymentSigData || !paymentSigData.order_ref) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing Payment-Signature payload.',
        code: 'PAYMENT_SIGNATURE_INVALID'
      });
    }

    const { order_ref, razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentSigData;

    // Look up pending order
    const order = ordersDB.get(order_ref);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Pending order "${order_ref}" not found.`,
        code: 'ORDER_NOT_FOUND'
      });
    }

    // Replay attack protection: check if nonce was already consumed
    if (order.nonce_consumed) {
      return res.status(400).json({
        success: false,
        error: 'Nonce already consumed. Replay attack rejected.',
        code: 'NONCE_ALREADY_CONSUMED'
      });
    }

    // Check expiration
    if (Date.now() > new Date(order.expires_at).getTime()) {
      return res.status(400).json({
        success: false,
        error: 'Payment challenge has expired. Please initiate checkout again.',
        code: 'CHALLENGE_EXPIRED'
      });
    }

    // Verify Razorpay HMAC signature: HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
    const expectedData = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(expectedData).digest('hex');

    let isSigValid = false;
    try {
      const expBuf = Buffer.from(expectedSignature, 'hex');
      const actBuf = Buffer.from(razorpay_signature, 'hex');
      if (expBuf.length === actBuf.length) {
        isSigValid = crypto.timingSafeEqual(expBuf, actBuf);
      }
    } catch (_) {}

    if (!isSigValid) {
      console.warn(`[X402 Gateway] ❌ Razorpay signature verification failed for order ${order_ref}`);
      return res.status(400).json({
        success: false,
        error: 'Razorpay payment signature verification failed.',
        code: 'RAZORPAY_SIGNATURE_MISMATCH'
      });
    }

    // Mark order confirmed and consume nonce
    order.status = 'confirmed';
    order.nonce_consumed = true;
    order.razorpay_payment_id = razorpay_payment_id;
    order.confirmed_at = new Date().toISOString();
    ordersDB.set(order_ref, order);

    console.log(`[X402 Gateway] ✅ Payment Confirmed! Order: ${order_ref}, Payment ID: ${razorpay_payment_id}, Amount: ₹${order.amount}`);

    return res.status(200).json({
      success: true,
      status: 'confirmed',
      message: 'Payment settlement completed successfully via AP2/X402 protocol.',
      order_ref: order_ref,
      amount: order.amount,
      currency: order.currency,
      payment_id: razorpay_payment_id,
      razorpay_order_id: razorpay_order_id,
      cart_mandate_id: order.cart_mandate_id,
      payment_mandate_id: order.payment_mandate_id,
      confirmed_at: order.confirmed_at
    });

  } catch (err) {
    if (err instanceof MandateValidationError) {
      console.warn(`[X402 Gateway] ❌ Mandate Validation Error (HTTP 400): ${err.message}`);
      return res.status(400).json({
        success: false,
        error: err.message,
        code: err.code
      });
    }
    console.error('[X402 Gateway] Internal error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error during checkout.'
    });
  }
}

// Root route: Status dashboard & AP2 explorer
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>X-402 AP2 Payment Gateway</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; }
    .card { background: #1e293b; border-radius: 12px; padding: 24px; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.4); border: 1px solid #334155; }
    h1 { color: #38bdf8; margin-top: 0; display: flex; align-items: center; gap: 10px; }
    .status { background: #065f46; color: #34d399; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; }
    .links a { display: inline-block; margin-right: 12px; margin-top: 10px; color: #38bdf8; text-decoration: none; padding: 8px 16px; background: #334155; border-radius: 6px; font-weight: 500; }
    .links a:hover { background: #475569; }
    pre { background: #0f172a; padding: 12px; border-radius: 6px; overflow-x: auto; color: #cbd5e1; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🛡️ X-402 AP2 Payment Gateway <span class="status">● Active</span></h1>
    <p>Agentic Payment Protocol (AP2) verification and Razorpay challenge-settlement layer.</p>
    <div class="links">
      <a href="/api/orders" target="_blank">📋 View Orders JSON</a>
      <a href="http://localhost:5173" target="_blank">🛍️ Go to Store (5173)</a>
      <a href="http://localhost:6003" target="_blank">🎙️ Voice Dashboard (6003)</a>
      <a href="http://localhost:5000/commanding.html" target="_blank">🤖 Automation Panel (5000)</a>
    </div>
    <h3 style="margin-top:24px;color:#94a3b8;">Active Configuration:</h3>
    <pre>Port: ${PORT}\nRazorpay Key: ${RAZORPAY_KEY_ID}\nTotal In-Memory Orders: ${ordersDB.size}</pre>
  </div>
</body>
</html>`);
});

// Register checkout endpoints
app.post('/checkout', handleCheckout);
app.post('/api/checkout', handleCheckout);

// Helper endpoint: Get all orders
app.get('/api/orders', (req, res) => {
  res.json(Array.from(ordersDB.values()));
});

// Helper endpoint to simulate a user payment and compute Razorpay signature (for tests & client agent)
app.post('/api/simulate-razorpay-payment', (req, res) => {
  const { razorpay_order_id, payment_id } = req.body;
  if (!razorpay_order_id) {
    return res.status(400).json({ error: 'razorpay_order_id required' });
  }
  const pid = payment_id || `pay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const data = `${razorpay_order_id}|${pid}`;
  const signature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(data).digest('hex');

  res.json({
    razorpay_order_id,
    razorpay_payment_id: pid,
    razorpay_signature: signature
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`X-402 Gateway & Checkout Server running at http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  ordersDB,
  handleCheckout,
  parseHeader,
  encodeHeader
};

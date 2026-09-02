const crypto = require('crypto');
const {
  createIntentMandate,
  createCartMandate,
  createPaymentMandate,
  verifyMandateChain
} = require('../mandates');
const { RAZORPAY_KEY_SECRET } = require('../config');
const { app, ordersDB } = require('../checkout_server');

// Simple test runner for Node.js
async function runAllTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING AP2 / X-402 / RAZORPAY TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`✅ PASS: ${message}`);
      passed++;
    }
  }

  // ──────────────────────────────────────────────────────────
  // TEST 1: Valid mandate chain passes verification
  // ──────────────────────────────────────────────────────────
  try {
    console.log('--- Test 1: Valid Mandate Chain Verification ---');
    const user = { id: 'user_alice_99' };
    const product = { id: 'shoe_007', merchantId: 'merchant_acp_razorpay_001' };
    const intent = createIntentMandate(user, product, 1500);

    const cartItems = [{ id: 'shoe_007', name: 'Converse Street Sneaker', price: 1299, quantity: 1 }];
    const cart = createCartMandate(intent, cartItems, 'merchant_acp_razorpay_001');
    const payment = createPaymentMandate(cart);

    const result = verifyMandateChain(cart, payment);
    assert(result.valid === true, 'Valid mandate chain passes verifyMandateChain');
  } catch (err) {
    console.error(err.message);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 2: Tampered cart total fails verification
  // ──────────────────────────────────────────────────────────
  try {
    console.log('\n--- Test 2: Tampered Cart Total Rejection ---');
    const user = { id: 'user_bob_01' };
    const product = { id: 'shoe_007', merchantId: 'merchant_acp_razorpay_001' };
    const intent = createIntentMandate(user, product, 2000);

    const cartItems = [{ id: 'shoe_007', name: 'Converse Street Sneaker', price: 1299, quantity: 1 }];
    const cart = createCartMandate(intent, cartItems, 'merchant_acp_razorpay_001');
    const payment = createPaymentMandate(cart);

    // Malicious modification: tamper with cart total
    const tamperedCart = { ...cart, total_amount: 100 };

    let threw = false;
    try {
      verifyMandateChain(tamperedCart, payment);
    } catch (e) {
      threw = true;
      assert(e.code === 'INVALID_CART_SIGNATURE', `Tampered cart correctly threw INVALID_CART_SIGNATURE (${e.message})`);
    }
    assert(threw === true, 'Tampered cart total was rejected by verifyMandateChain');
  } catch (err) {
    console.error(err.message);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 3: Expired intent mandate is rejected
  // ──────────────────────────────────────────────────────────
  try {
    console.log('\n--- Test 3: Expired Intent Mandate Rejection ---');
    const user = { id: 'user_charlie_02' };
    const product = { id: 'shoe_007', merchantId: 'merchant_acp_razorpay_001' };
    const intent = createIntentMandate(user, product, 1500);

    // Artificially expire the intent mandate
    intent.payload.expires_at = new Date(Date.now() - 1000).toISOString();

    const cartItems = [{ id: 'shoe_007', name: 'Converse Street Sneaker', price: 1299, quantity: 1 }];
    let threw = false;
    try {
      createCartMandate(intent, cartItems, 'merchant_acp_razorpay_001');
    } catch (e) {
      threw = true;
      assert(e.code === 'INTENT_EXPIRED', `Expired intent correctly threw INTENT_EXPIRED (${e.message})`);
    }
    assert(threw === true, 'Expired intent mandate was rejected during cart creation');
  } catch (err) {
    console.error(err.message);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 4: 402 is returned on first checkout call with no Payment-Signature header
  // ──────────────────────────────────────────────────────────
  try {
    console.log('\n--- Test 4: HTTP 402 Payment Required Challenge ---');
    const user = { id: 'user_dave_03' };
    const product = { id: 'shoe_007', merchantId: 'merchant_acp_razorpay_001' };
    const intent = createIntentMandate(user, product, 2000);
    const cart = createCartMandate(intent, [{ id: 'shoe_007', name: 'Converse Street Sneaker', price: 1299, quantity: 1 }], 'merchant_acp_razorpay_001');
    const payment = createPaymentMandate(cart);

    // Mock Express request/response
    let statusCode = null;
    let responseHeaders = {};
    let responseBody = null;

    const mockReq = {
      headers: {
        'cart-mandate': Buffer.from(JSON.stringify(cart)).toString('base64'),
        'payment-mandate': Buffer.from(JSON.stringify(payment)).toString('base64')
      },
      body: {}
    };

    const mockRes = {
      setHeader(k, v) { responseHeaders[k] = v; },
      status(s) { statusCode = s; return this; },
      json(data) { responseBody = data; }
    };

    const { handleCheckout } = require('../checkout_server');
    await handleCheckout(mockReq, mockRes);

    assert(statusCode === 402, `First checkout call returned HTTP 402 (Got: ${statusCode})`);
    assert(responseHeaders['Payment-Required'] !== undefined, 'Payment-Required header is present in 402 response');
    
    const decodedChallenge = JSON.parse(Buffer.from(responseHeaders['Payment-Required'], 'base64').toString('utf8'));
    assert(decodedChallenge.amount === 1299, `Challenge amount is correct: ₹${decodedChallenge.amount}`);
    assert(decodedChallenge.methods.includes('razorpay'), 'Challenge payment methods include "razorpay"');
    assert(decodedChallenge.nonce !== undefined, 'Challenge contains cryptographic nonce');
  } catch (err) {
    console.error(err.message);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 5: Replay of a consumed nonce is rejected on retry
  // ──────────────────────────────────────────────────────────
  try {
    console.log('\n--- Test 5: Nonce Replay Attack Protection ---');
    const user = { id: 'user_eve_04' };
    const product = { id: 'shoe_007', merchantId: 'merchant_acp_razorpay_001' };
    const intent = createIntentMandate(user, product, 2000);
    const cart = createCartMandate(intent, [{ id: 'shoe_007', name: 'Converse Street Sneaker', price: 1299, quantity: 1 }], 'merchant_acp_razorpay_001');
    const payment = createPaymentMandate(cart);

    // Step 4a: First Hit -> Get 402 & Challenge Nonce
    let headers1 = {};
    let body1 = null;
    const { handleCheckout } = require('../checkout_server');
    await handleCheckout({
      headers: {
        'cart-mandate': JSON.stringify(cart),
        'payment-mandate': JSON.stringify(payment)
      },
      body: {}
    }, {
      setHeader(k, v) { headers1[k] = v; },
      status(s) { return this; },
      json(d) { body1 = d; }
    });

    const challenge = JSON.parse(Buffer.from(headers1['Payment-Required'], 'base64').toString('utf8'));
    const orderRef = challenge.order_ref;
    const rzpOrderId = challenge.razorpay_order_id;
    const rzpPaymentId = `pay_mock_${Date.now()}`;

    // Compute genuine Razorpay HMAC Signature
    const rzpData = `${rzpOrderId}|${rzpPaymentId}`;
    const rzpSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(rzpData).digest('hex');

    const paymentSigHeader = {
      order_ref: orderRef,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: rzpSignature
    };

    // Step 4b: First Settlement Attempt -> Should Succeed (HTTP 200)
    let status2 = null;
    let body2 = null;
    await handleCheckout({
      headers: {
        'cart-mandate': JSON.stringify(cart),
        'payment-mandate': JSON.stringify(payment),
        'payment-signature': JSON.stringify(paymentSigHeader)
      },
      body: {}
    }, {
      setHeader() {},
      status(s) { status2 = s; return this; },
      json(d) { body2 = d; }
    });

    assert(status2 === 200, `First settlement attempt returned HTTP 200 (Got: ${status2})`);
    assert(body2.status === 'confirmed', 'Order marked confirmed on first settlement');

    // Step 4c: REPLAY ATTEMPT WITH SAME NONCE/SIGNATURE -> Should Fail (HTTP 400)
    let status3 = null;
    let body3 = null;
    await handleCheckout({
      headers: {
        'cart-mandate': JSON.stringify(cart),
        'payment-mandate': JSON.stringify(payment),
        'payment-signature': JSON.stringify(paymentSigHeader)
      },
      body: {}
    }, {
      setHeader() {},
      status(s) { status3 = s; return this; },
      json(d) { body3 = d; }
    });

    assert(status3 === 400, `Replay attack returned HTTP 400 (Got: ${status3})`);
    assert(body3.code === 'NONCE_ALREADY_CONSUMED', `Replay rejected with NONCE_ALREADY_CONSUMED (${body3.error})`);

  } catch (err) {
    console.error(err.message);
  }

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };

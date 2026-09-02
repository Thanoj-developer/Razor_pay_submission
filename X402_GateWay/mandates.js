const fs = require('fs');
const path = require('path');
const { AGENT_ID, signPayload, verifySignature, generateId } = require('./config');
const { MandateValidationError } = require('./errors');

// Database / storage directory
const DATABASE_DIR = path.join(__dirname, '..', 'MANDATE(AP2)', 'MANDATES_DATABASE');
if (!fs.existsSync(DATABASE_DIR)) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

// In-memory Mandates DB Map
const mandatesDB = new Map();

/**
 * Persist mandate to memory map and MANDATES_DATABASE disk
 */
function persistMandate(mandate) {
  mandatesDB.set(mandate.id, mandate);

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${mandate.type}_Mandate_${timestamp}_${mandate.id}.json`;
    const filePath = path.join(DATABASE_DIR, filename);

    fs.writeFileSync(filePath, JSON.stringify(mandate, null, 2), 'utf8');

    // Update index.json
    const indexFile = path.join(DATABASE_DIR, 'index.json');
    let indexList = [];
    if (fs.existsSync(indexFile)) {
      try { indexList = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch (_) {}
    }
    indexList.unshift({
      id: mandate.id,
      filename,
      type: mandate.type,
      parent_id: mandate.parent_id || mandate.parent_cart_id || null,
      agent_id: mandate.agent_id,
      issuer: mandate.issuer || null,
      amount: mandate.total_amount || mandate.payload?.max_amount || null,
      currency: mandate.currency || mandate.payload?.currency || 'INR',
      created_at: mandate.signed_at || mandate.created_at,
      expires_at: mandate.payload?.expires_at || null,
      storedAt: new Date().toISOString()
    });
    fs.writeFileSync(indexFile, JSON.stringify(indexList, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Mandates DB] Warning while writing to disk:', err.message);
  }

  return mandate;
}

/**
 * 1. Create and sign an Intent Mandate
 */
function createIntentMandate(user, product, confirmedPrice) {
  const userId = typeof user === 'object' ? (user.id || user.userDid || 'user_001') : String(user);
  const merchantId = product?.merchantId || 'merchant_acp_razorpay_001';
  const productId = product?.id || 'shoe_007';
  const now = Date.now();
  const expiresAt = new Date(now + 15 * 60 * 1000).toISOString(); // 15 minutes validity

  const payload = {
    max_amount: Number(confirmedPrice),
    currency: 'INR',
    merchant_ids: Array.isArray(product?.merchant_ids) ? product.merchant_ids : [merchantId],
    item_ref: productId,
    expires_at: expiresAt
  };

  const signedAt = new Date(now).toISOString();
  const signature = signPayload(payload);

  const mandate = {
    id: generateId('intent'),
    type: 'intent',
    issuer: userId,
    agent_id: AGENT_ID,
    payload: payload,
    signed_at: signedAt,
    signature: signature
  };

  persistMandate(mandate);
  return mandate;
}

/**
 * 2. Create and sign a Cart Mandate with validation
 */
function createCartMandate(intentMandate, cartItems, merchantId) {
  if (!intentMandate || !intentMandate.payload) {
    throw new MandateValidationError('Missing or invalid Intent Mandate.', 'INTENT_MANDATE_MISSING');
  }

  // Check 1: Expiration check on Intent Mandate
  const intentExpires = new Date(intentMandate.payload.expires_at).getTime();
  if (Date.now() > intentExpires) {
    throw new MandateValidationError(`Intent Mandate (${intentMandate.id}) has expired.`, 'INTENT_EXPIRED');
  }

  // Format line items
  const items = Array.isArray(cartItems) ? cartItems : [cartItems];
  const totalAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.price || item.unitPrice || 0);
    return sum + (unitPrice * qty);
  }, 0);

  // Check 2: Budget / Spend limit check
  if (totalAmount > Number(intentMandate.payload.max_amount)) {
    throw new MandateValidationError(
      `Cart total (₹${totalAmount}) exceeds authorized max amount (₹${intentMandate.payload.max_amount}).`,
      'BUDGET_EXCEEDED'
    );
  }

  // Check 3: Merchant ID match check
  const allowedMerchants = intentMandate.payload.merchant_ids || [];
  if (allowedMerchants.length > 0 && !allowedMerchants.includes(merchantId)) {
    throw new MandateValidationError(
      `Merchant "${merchantId}" not authorized in Intent Mandate. Allowed: ${JSON.stringify(allowedMerchants)}`,
      'MERCHANT_NOT_AUTHORIZED'
    );
  }

  const payloadToSign = {
    parent_id: intentMandate.id,
    agent_id: AGENT_ID,
    merchant_id: merchantId,
    line_items: items,
    total_amount: totalAmount,
    currency: 'INR'
  };

  const signedAt = new Date().toISOString();
  const signature = signPayload(payloadToSign);

  const mandate = {
    id: generateId('cart'),
    type: 'cart',
    parent_id: intentMandate.id,
    agent_id: AGENT_ID,
    merchant_id: merchantId,
    line_items: items,
    total_amount: totalAmount,
    currency: 'INR',
    signed_at: signedAt,
    signature: signature
  };

  persistMandate(mandate);
  return mandate;
}

/**
 * 3. Create and sign a Payment Mandate
 */
function createPaymentMandate(cartMandate) {
  if (!cartMandate || cartMandate.type !== 'cart') {
    throw new MandateValidationError('Missing or invalid Cart Mandate.', 'CART_MANDATE_MISSING');
  }

  const createdAt = new Date().toISOString();
  const payloadToSign = {
    parent_cart_id: cartMandate.id,
    agent_id: AGENT_ID,
    modality: 'human-present',
    created_at: createdAt
  };

  const signature = signPayload(payloadToSign);

  const mandate = {
    id: generateId('payment'),
    type: 'payment',
    parent_cart_id: cartMandate.id,
    agent_id: AGENT_ID,
    modality: 'human-present',
    created_at: createdAt,
    signature: signature
  };

  persistMandate(mandate);
  return mandate;
}

/**
 * 4. Verify Mandate Chain
 * Validates CartMandate and PaymentMandate in strict order:
 * 1. verifySignature on both mandates
 * 2. paymentMandate.parent_cart_id === cartMandate.id
 * 3. cartMandate not expired
 * 4. cartMandate.agent_id === paymentMandate.agent_id
 */
function verifyMandateChain(cartMandate, paymentMandate) {
  if (!cartMandate || typeof cartMandate !== 'object') {
    throw new MandateValidationError('Cart-Mandate header or object missing.', 'CART_MANDATE_MISSING');
  }
  if (!paymentMandate || typeof paymentMandate !== 'object') {
    throw new MandateValidationError('Payment-Mandate header or object missing.', 'PAYMENT_MANDATE_MISSING');
  }

  // 1. Verify signatures on both mandates
  const cartPayload = {
    parent_id: cartMandate.parent_id,
    agent_id: cartMandate.agent_id,
    merchant_id: cartMandate.merchant_id,
    line_items: cartMandate.line_items,
    total_amount: cartMandate.total_amount,
    currency: cartMandate.currency || 'INR'
  };

  const isCartSigValid = verifySignature(cartPayload, cartMandate.signature);
  if (!isCartSigValid) {
    throw new MandateValidationError('Cart Mandate signature verification failed. Payload tampered or invalid signature.', 'INVALID_CART_SIGNATURE');
  }

  const paymentPayload = {
    parent_cart_id: paymentMandate.parent_cart_id,
    agent_id: paymentMandate.agent_id,
    modality: paymentMandate.modality,
    created_at: paymentMandate.created_at
  };

  const isPaySigValid = verifySignature(paymentPayload, paymentMandate.signature);
  if (!isPaySigValid) {
    throw new MandateValidationError('Payment Mandate signature verification failed. Payload tampered or invalid signature.', 'INVALID_PAYMENT_SIGNATURE');
  }

  // 2. Linkage: paymentMandate.parent_cart_id === cartMandate.id
  if (paymentMandate.parent_cart_id !== cartMandate.id) {
    throw new MandateValidationError(
      `Payment Mandate parent_cart_id (${paymentMandate.parent_cart_id}) does not match Cart Mandate id (${cartMandate.id}).`,
      'MANDATE_CHAIN_DISCONNECTED'
    );
  }

  // 3. Expiration: check cart age (cart mandates valid for 15 minutes by default)
  const cartCreatedAt = new Date(cartMandate.signed_at || cartMandate.created_at).getTime();
  const maxAge = 15 * 60 * 1000;
  if (Date.now() - cartCreatedAt > maxAge) {
    throw new MandateValidationError('Cart Mandate has expired.', 'CART_MANDATE_EXPIRED');
  }

  // 4. Agent alignment: cartMandate.agent_id === paymentMandate.agent_id
  if (cartMandate.agent_id !== paymentMandate.agent_id) {
    throw new MandateValidationError(
      `Agent ID mismatch: Cart (${cartMandate.agent_id}) vs Payment (${paymentMandate.agent_id}).`,
      'AGENT_ID_MISMATCH'
    );
  }

  return { valid: true };
}

module.exports = {
  createIntentMandate,
  createCartMandate,
  createPaymentMandate,
  verifyMandateChain,
  mandatesDB,
  DATABASE_DIR
};

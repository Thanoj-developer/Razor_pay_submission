const crypto = require('crypto');

// Agent Identity Configuration
const AGENT_ID = process.env.AGENT_ID || 'agent_myshoppingapp_prod_01';
const AGENT_SIGNING_SECRET = process.env.AGENT_SIGNING_SECRET || 'agent_hmac_secret_ap2_prod_key_779201';

// Razorpay Test Mode Configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_MockKey123456';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_MockSecretSecretKey123';

/**
 * Deterministic JSON Canonicalizer (sorts keys recursively for consistent cryptographic hashing)
 */
function canonicalize(obj) {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

/**
 * Compute HMAC-SHA256 signature over the canonicalized payload using the Agent Secret
 */
function signPayload(payload, secret = AGENT_SIGNING_SECRET) {
  const data = canonicalize(payload);
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

/**
 * Verify HMAC-SHA256 signature with constant-time equality check
 */
function verifySignature(payload, signature, secret = AGENT_SIGNING_SECRET) {
  if (!signature || typeof signature !== 'string') {
    return false;
  }
  try {
    const expectedSig = signPayload(payload, secret);
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Generate a unique prefixed ID
 */
function generateId(prefix = 'man') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = {
  AGENT_ID,
  AGENT_SIGNING_SECRET,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  canonicalize,
  signPayload,
  verifySignature,
  generateId
};

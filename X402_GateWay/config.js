const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Agent Identity Configuration
const AGENT_ID = process.env.AGENT_ID || 'agent_myshoppingapp_prod_01';
const AGENT_SIGNING_SECRET = process.env.AGENT_SIGNING_SECRET || 'agent_hmac_secret_ap2_prod_key_779201';

// Razorpay Test Mode Configuration (loads from Razorpay_Test_Mode/.env)
function getRazorpayCredentials() {
  const envPath = path.join(__dirname, '..', 'Razorpay_Test_Mode', '.env');
  let keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TX3JklSxdGOmx0';
  let keySecret = process.env.RAZORPAY_KEY_SECRET || 'SmY8SX7moFf3T0HdPcC2QHQ9';

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...rest] = trimmed.split('=');
        if (k && rest.length > 0) {
          const val = rest.join('=').trim();
          if (k.trim() === 'Razor_Pay_Api' || k.trim() === 'RAZORPAY_KEY_ID') keyId = val;
          if (k.trim() === 'Razor_Pay_Secrete' || k.trim() === 'RAZORPAY_KEY_SECRET') keySecret = val;
        }
      }
    }
  }
  return { keyId, keySecret };
}

const { keyId: RAZORPAY_KEY_ID, keySecret: RAZORPAY_KEY_SECRET } = getRazorpayCredentials();

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

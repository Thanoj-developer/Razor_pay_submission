const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, 'MANDATES_DATABASE');
const KEYS_FILE = path.join(KEYS_DIR, 'user_keys.json');

/**
 * Generate an ECDSA Secp256r1 (P-256 / prime256v1) key pair
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

/**
 * Get or initialize persistent user keys for signing mandates
 */
function getUserKeyPair() {
  try {
    if (!fs.existsSync(KEYS_DIR)) {
      fs.mkdirSync(KEYS_DIR, { recursive: true });
    }
    if (fs.existsSync(KEYS_FILE)) {
      const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      if (data.publicKey && data.privateKey) {
        return data;
      }
    }
  } catch (_) {}

  const keyPair = generateKeyPair();
  const userKeys = {
    userDid: 'did:example:user123456789',
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    createdAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(userKeys, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Crypto] Could not persist user_keys.json:', err.message);
  }
  return userKeys;
}

/**
 * Deterministic JSON Canonicalizer (sorts keys recursively and ignores undefined for consistent cryptographic hashing)
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
 * Sign payload with ECDSA Secp256r1 SHA-256
 */
function signPayload(payload, privateKeyPem) {
  const data = Buffer.from(canonicalize(payload), 'utf8');
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
}

/**
 * Verify payload signature with ECDSA Secp256r1 SHA-256
 */
function verifyPayload(payload, signatureBase64, publicKeyPem) {
  try {
    const data = Buffer.from(canonicalize(payload), 'utf8');
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKeyPem, signatureBase64, 'base64');
  } catch (err) {
    console.error('[Crypto] Verification error:', err.message);
    return false;
  }
}

module.exports = {
  generateKeyPair,
  getUserKeyPair,
  canonicalize,
  signPayload,
  verifyPayload
};

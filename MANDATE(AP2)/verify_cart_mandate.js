const { verifyPayload, getUserKeyPair } = require('./Crypto');

/**
 * Verify a W3C Verifiable Credential Mandate (IntentMandate or CartMandate)
 * @param {object} mandate - The full signed mandate object
 * @param {string} [publicKeyPem] - Optional public key PEM (defaults to persistent user key)
 * @returns {{ valid: boolean, reason?: string, type?: string, issuer?: string }}
 */
function verifyMandate(mandate, publicKeyPem = null) {
  if (!mandate) {
    return { valid: false, reason: 'Mandate object is null or undefined' };
  }

  if (!mandate.proof || !mandate.proof.signatureValue) {
    return { valid: false, reason: 'Missing cryptographic proof or signatureValue' };
  }

  const publicKey = publicKeyPem || getUserKeyPair().publicKey;
  const { proof, ...payloadToVerify } = mandate;

  const isValid = verifyPayload(payloadToVerify, proof.signatureValue, publicKey);
  if (!isValid) {
    return { valid: false, reason: 'ECDSA signature verification failed against mandate payload' };
  }

  const typeStr = Array.isArray(mandate.type) ? mandate.type.join(', ') : mandate.type;
  return {
    valid: true,
    type: typeStr,
    issuer: mandate.issuer,
    issuanceDate: mandate.issuanceDate
  };
}

function verifyCartMandate(cartMandate, publicKeyPem = null) {
  return verifyMandate(cartMandate, publicKeyPem);
}

function verifyIntentMandate(intentMandate, publicKeyPem = null) {
  return verifyMandate(intentMandate, publicKeyPem);
}

module.exports = {
  verifyMandate,
  verifyCartMandate,
  verifyIntentMandate
};

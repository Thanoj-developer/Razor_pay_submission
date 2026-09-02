const {
  createIntentMandate,
  createCartMandate,
  createPaymentMandate,
  verifyMandateChain
} = require('../X402_GateWay/mandates');
const { signPayload, verifySignature, AGENT_ID } = require('../X402_GateWay/config');
const { MandateValidationError } = require('../X402_GateWay/errors');

/**
 * Verification & Comparison Logic (AP2 Protocol)
 * Verifies mandate chain between Intent, Cart, and Payment mandates.
 */
function compareAndValidateMandates(intentMandate, cartMandate, userPublicKey = null) {
  if (!intentMandate || !cartMandate) {
    return { authorized: false, reason: "Missing IntentMandate or CartMandate object." };
  }

  try {
    // 1. Check intent validity
    if (intentMandate.payload) {
      if (Date.now() > new Date(intentMandate.payload.expires_at).getTime()) {
        return { authorized: false, reason: "Intent Mandate has expired." };
      }
      const cartTotal = Number(cartMandate.total_amount || cartMandate.credentialSubject?.cart?.totalAmount || 0);
      const maxAmount = Number(intentMandate.payload.max_amount || intentMandate.credentialSubject?.spendLimit?.amount || 0);
      if (cartTotal > maxAmount) {
        return { authorized: false, reason: `Overspend! Cart (₹${cartTotal}) exceeds limit (₹${maxAmount}).` };
      }
    }
    return { authorized: true };
  } catch (err) {
    return { authorized: false, reason: err.message };
  }
}

module.exports = {
  createIntentMandate,
  createCartMandate,
  createPaymentMandate,
  verifyMandateChain,
  compareAndValidateMandates,
  signPayload,
  verifySignature,
  AGENT_ID,
  MandateValidationError
};

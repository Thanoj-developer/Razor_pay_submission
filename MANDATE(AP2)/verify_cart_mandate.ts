// src/verify_cart_mandate.ts
import { verifyPayload } from './Crypto';
import { IntentMandate, CartMandate } from './Mandate';

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  type?: string;
  issuer?: string;
}

export function verifyCartMandate(mandate: CartMandate | IntentMandate, publicKeyPem: string): VerificationResult {
  if (!mandate || !mandate.proof || !mandate.proof.signatureValue) {
    return { valid: false, reason: 'Missing cryptographic proof signature' };
  }

  const { proof, ...payloadToVerify } = mandate;
  const ok = verifyPayload(payloadToVerify, proof.signatureValue, publicKeyPem);
  if (!ok) {
    return { valid: false, reason: 'Signature does not match payload' };
  }

  return {
    valid: true,
    type: Array.isArray(mandate.type) ? mandate.type.join(', ') : mandate.type,
    issuer: mandate.issuer
  };
}
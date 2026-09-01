export function verifyCartMandate(m: CartMandate, publicKey: KeyObject): VerificationResult {
    if (!m.signature) return { valid: false, reason: "missing signature" };
    const ok = verifyPayload(withoutSignature(m), m.signature, publicKey);
    if (!ok) return { valid: false, reason: "signature does not match payload" };
    return { valid: true };
}
// src/crypto.ts

export function signPayload(payload: unknown, keyPair: KeyPair): Signature {
    // Sort keys so the same mandate always produces identical bytes,
    // no matter what order fields were set in — otherwise two
    // logically-identical mandates could produce different signatures.
    const data = Buffer.from(canonicalize(payload));

    // ECDSA sign with the signer's private key (never leaves their side)
    const der = nodeSign(null, data, keyPair.privateKey);

    return {
        keyId: keyPair.keyId,
        value: der.toString("base64"),
        algorithm: "ES256",
    };
}
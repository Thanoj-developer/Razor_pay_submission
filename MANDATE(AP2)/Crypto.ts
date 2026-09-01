// src/Crypto.ts
import * as crypto from 'crypto';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  userDid?: string;
}

export interface Signature {
  keyId: string;
  value: string;
  algorithm: string;
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize((obj as Record<string, unknown>)[k])).join(',') + '}';
}

export function signPayload(payload: unknown, privateKeyPem: string): string {
  const data = Buffer.from(canonicalize(payload), 'utf8');
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
}

export function verifyPayload(payload: unknown, signatureBase64: string, publicKeyPem: string): boolean {
  try {
    const data = Buffer.from(canonicalize(payload), 'utf8');
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKeyPem, signatureBase64, 'base64');
  } catch (err) {
    return false;
  }
}
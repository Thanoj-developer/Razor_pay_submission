// src/Mandate.ts
import { KeyPair, signPayload } from './Crypto';

export interface SpendLimit {
  amount: number;
  currency: string;
}

export interface IntentMandateSubject {
  authorizedItem: string;
  spendLimit: SpendLimit;
}

export interface Proof {
  type: string;
  created: string;
  proofPurpose: string;
  verificationMethod: string;
  signatureValue: string;
}

export interface IntentMandate {
  '@context': string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: IntentMandateSubject;
  proof: Proof;
}

export interface CartItem {
  id?: string;
  name: string;
  sku?: string;
  unitPrice: number;
  quantity: number;
}

export interface CartMandateSubject {
  merchantId: string;
  merchantName?: string;
  cart: {
    items: CartItem[];
    currency: string;
    totalAmount: number;
  };
  status: string;
}

export interface CartMandate {
  '@context': string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  intentMandateId?: string;
  credentialSubject: CartMandateSubject;
  proof: Proof;
}
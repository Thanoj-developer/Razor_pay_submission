// src/Generate_The_PaymentMandate.ts
import { IntentMandate, CartMandate, Proof } from '../MANDATE(AP2)/Mandate';
import { KeyPair } from '../MANDATE(AP2)/Crypto';

export interface PaymentSubject {
  paymentMethod: string;
  paymentGateway: string;
  amount: number;
  currency: string;
  humanPresent: boolean;
  cartMandateRef: string;
  intentMandateRef: string;
  merchantId: string;
  merchantName?: string;
  validationStatus: string;
}

export interface PaymentMandate {
  '@context': string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: PaymentSubject;
  proof: Proof;
}

export interface ComparisonResult {
  authorized: boolean;
  reason?: string;
}

export interface PaymentMandateParams {
  intentMandate: IntentMandate;
  cartMandate: CartMandate;
  paymentMethod?: string;
  paymentGateway?: string;
  userKeys?: KeyPair;
  cartMandateRef?: string;
  intentMandateRef?: string;
  merchantId?: string;
  merchantName?: string;
  issuanceDate?: string;
  saveToDisk?: boolean;
}

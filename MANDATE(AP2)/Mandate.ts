// src/mandate.ts

export function createCartMandate(
  params: {
    userId: string;
    agentId: string;
    intentMandateId?: string;
    merchantId: string;
    items: Array<{ name: string; sku: string; unitPrice: number; quantity: number }>;
    currency: string;
  },
  signerKeyPair: KeyPair
): CartMandate {
  // 1. Compute the total from the actual items — never trust a
  //    total passed in separately, always derive it.
  const totalAmount = params.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0
  );

  // 2. Build the unsigned payload
  const unsigned: CartMandate = {
    type: "CartMandate",
    id: randomUUID(),
    userId: params.userId,
    agentId: params.agentId,
    intentMandateId: params.intentMandateId,
    cart: {
      merchantId: params.merchantId,
      items: params.items,
      currency: params.currency,
      totalAmount,
    },
    issuedAt: new Date().toISOString(),
  };

  // 3. Sign the payload — this is the "I'm authorized to..." proof
  const signature = signPayload(unsigned, signerKeyPair);
  return { ...unsigned, signature };
}
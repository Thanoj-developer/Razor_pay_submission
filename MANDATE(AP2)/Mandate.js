const fs = require('fs');
const path = require('path');
const { signPayload, getUserKeyPair } = require('./Crypto');

const DATABASE_DIR = path.join(__dirname, 'MANDATES_DATABASE');

// Ensure MANDATES_DATABASE exists
if (!fs.existsSync(DATABASE_DIR)) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

/**
 * Save a signed mandate JSON file to the MANDATES_DATABASE directory
 */
function storeMandate(mandate, prefix = 'mandate') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const typeStr = Array.isArray(mandate.type) ? mandate.type[1] || mandate.type[0] : (mandate.type || 'Mandate');
  const filename = `${prefix}_${typeStr}_${timestamp}.json`;
  const filePath = path.join(DATABASE_DIR, filename);

  fs.writeFileSync(filePath, JSON.stringify(mandate, null, 2), 'utf8');
  console.log(`[Mandate Storage] ✅ Mandate saved to: ${filePath}`);

  // Maintain index.json
  const indexFile = path.join(DATABASE_DIR, 'index.json');
  let indexList = [];
  try {
    if (fs.existsSync(indexFile)) {
      indexList = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    }
  } catch (_) {}

  indexList.unshift({
    filename,
    type: typeStr,
    issuer: mandate.issuer || mandate.userId,
    item: mandate.credentialSubject?.authorizedItem || mandate.credentialSubject?.cart?.items?.[0]?.name,
    amount: mandate.credentialSubject?.spendLimit?.amount || mandate.credentialSubject?.cart?.totalAmount,
    currency: mandate.credentialSubject?.spendLimit?.currency || mandate.credentialSubject?.cart?.currency || 'INR',
    issuanceDate: mandate.issuanceDate || mandate.issuedAt,
    storedAt: new Date().toISOString()
  });

  try {
    fs.writeFileSync(indexFile, JSON.stringify(indexList, null, 2), 'utf8');
  } catch (_) {}

  return { filename, filePath, mandate };
}

/**
 * Create a W3C Verifiable Credential Intent Mandate matching Expected_Mandate.json
 */
function createIntentMandate(params = {}) {
  const userKeys = params.keyPair || getUserKeyPair();
  const userDid = params.userDid || userKeys.userDid || 'did:example:user123456789';
  const issuanceDate = params.issuanceDate || new Date().toISOString();

  // 1. Construct raw W3C Verifiable Credential payload
  const rawMandate = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1'
    ],
    type: [
      'VerifiableCredential',
      'IntentMandate'
    ],
    issuer: userDid,
    issuanceDate: issuanceDate,
    credentialSubject: {
      authorizedItem: params.authorizedItem || params.item || 'sneakers',
      spendLimit: {
        amount: Number(params.amount || params.maxAmount || params.price || 5000),
        currency: params.currency || 'INR'
      }
    }
  };

  // 2. Cryptographically sign the canonical payload with ECDSA Secp256r1
  const signatureValue = signPayload(rawMandate, userKeys.privateKey);

  // 3. Assemble final Intent Mandate with Proof block
  const fullMandate = {
    ...rawMandate,
    proof: {
      type: 'EcdsaSecp256r1Signature2019',
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: `${userDid}#key-1`,
      signatureValue: signatureValue
    }
  };

  if (params.saveToDisk !== false) {
    storeMandate(fullMandate, 'intent');
  }

  return fullMandate;
}

/**
 * Create a Cart Mandate locking in the specific merchant item and price
 */
function createCartMandate(params = {}) {
  const userKeys = params.keyPair || getUserKeyPair();
  const userDid = params.userDid || userKeys.userDid || 'did:example:user123456789';
  const issuanceDate = params.issuanceDate || new Date().toISOString();

  const items = params.items || [
    {
      id: params.productId || 'shoe_007',
      name: params.productName || params.authorizedItem || 'Converse Street Sneaker',
      sku: params.sku || params.productId || 'shoe_007',
      unitPrice: Number(params.price || params.amount || 1299),
      quantity: Number(params.quantity || 1)
    }
  ];

  // Derive total amount directly from items
  const totalAmount = items.reduce((sum, item) => sum + (item.unitPrice * (item.quantity || 1)), 0);

  const rawCartMandate = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1'
    ],
    type: [
      'VerifiableCredential',
      'CartMandate'
    ],
    issuer: userDid,
    issuanceDate: issuanceDate,
    ...(params.intentMandateId ? { intentMandateId: params.intentMandateId } : {}),
    credentialSubject: {
      merchantId: params.merchantId || 'merchant_acp_razorpay_001',
      merchantName: params.merchantName || 'Razorpay ACP Store',
      cart: {
        items: items,
        currency: params.currency || 'INR',
        totalAmount: totalAmount
      },
      status: 'USER_CONSENT_APPROVED'
    }
  };

  const signatureValue = signPayload(rawCartMandate, userKeys.privateKey);

  const fullCartMandate = {
    ...rawCartMandate,
    proof: {
      type: 'EcdsaSecp256r1Signature2019',
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: `${userDid}#key-1`,
      signatureValue: signatureValue
    }
  };

  if (params.saveToDisk !== false) {
    storeMandate(fullCartMandate, 'cart');
  }

  return fullCartMandate;
}

/**
 * List all mandates stored in MANDATES_DATABASE
 */
function getAllStoredMandates() {
  const indexFile = path.join(DATABASE_DIR, 'index.json');
  try {
    if (fs.existsSync(indexFile)) {
      return JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    }
  } catch (_) {}
  return [];
}

module.exports = {
  createIntentMandate,
  createCartMandate,
  storeMandate,
  getAllStoredMandates,
  DATABASE_DIR
};

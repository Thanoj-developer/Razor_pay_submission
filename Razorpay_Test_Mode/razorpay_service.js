const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Load configuration from Razorpay_Test_Mode/.env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const envConfig = {};

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0) {
          envConfig[key.trim()] = rest.join('=').trim();
        }
      }
    }
  }

  return {
    keyId: envConfig.Razor_Pay_Api || envConfig.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TX3JklSxdGOmx0',
    keySecret: envConfig.Razor_Pay_Secrete || envConfig.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || 'SmY8SX7moFf3T0HdPcC2QHQ9'
  };
}

const { keyId: RAZORPAY_KEY_ID, keySecret: RAZORPAY_KEY_SECRET } = loadEnv();

/**
 * 2. Function: createRazorpayOrder
 * Calls Razorpay REST API (https://api.razorpay.com/v1/orders) to create a live test order.
 * 
 * @param {number} amount - Amount in INR (e.g. 1299 or 1599)
 * @param {string} [currency='INR'] - Currency code
 * @param {string} [receipt] - Internal order reference receipt
 * @param {object} [notes={}] - Metadata notes (e.g. cart/payment mandate IDs)
 * @returns {Promise<object>} Created Razorpay Order details
 */
async function createRazorpayOrder(amount, currency = 'INR', receipt = null, notes = {}) {
  if (!amount || amount <= 0) {
    throw new Error(`Invalid order amount: ${amount}`);
  }

  // Razorpay requires amount in subunits (paise for INR). 1 INR = 100 paise.
  const amountInSubunits = Math.round(amount * 100);
  const orderReceipt = receipt || `order_rcpt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const payload = {
    amount: amountInSubunits,
    currency: currency,
    receipt: orderReceipt,
    notes: {
      protocol: 'AP2/X-402',
      ...notes
    }
  };

  const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.description || data.error?.message || `Razorpay order creation failed with HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    console.log(`[Razorpay Service] ✅ Live Test Order Created: ${data.id} (Amount: ₹${amount} INR / ${amountInSubunits} paise)`);
    return data;
  } catch (err) {
    console.error('[Razorpay Service] ❌ Order creation error:', err.message);
    throw err;
  }
}

/**
 * 3. Function: verifyRazorpayPaymentSignature
 * Verifies the HMAC-SHA256 signature returned by Razorpay after payment capture.
 * Formula: HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET) === razorpay_signature
 * 
 * @param {string} orderId - Razorpay Order ID (e.g. "order_TX3XIfJSMrPZdI")
 * @param {string} paymentId - Razorpay Payment ID (e.g. "pay_TX3Yabc123")
 * @param {string} signature - Razorpay Signature hex string
 * @returns {boolean} True if signature is valid, false otherwise
 */
function verifyRazorpayPaymentSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  try {
    const dataToSign = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(dataToSign)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch (err) {
    console.error('[Razorpay Service] Signature verification error:', err.message);
    return false;
  }
}

/**
 * Helper to simulate a valid test payment signature (for testing & mock flow)
 */
function simulatePaymentProof(orderId, paymentId = null) {
  const pid = paymentId || `pay_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const data = `${orderId}|${pid}`;
  const signature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(data).digest('hex');

  return {
    razorpay_order_id: orderId,
    razorpay_payment_id: pid,
    razorpay_signature: signature
  };
}

module.exports = {
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  simulatePaymentProof
};

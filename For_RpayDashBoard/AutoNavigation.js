// HITL-enabled AutoNavigation — supports OTP/human_prompt/option_select_prompt/cart_consent_prompt callbacks
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:6001';

const CATALOG_ITEMS = [
  { id: "shoe_001", name: "Nike Air Jordan 1 Low", price: 1999, currency: "INR", image: "http://localhost:5173/images/air_jordan.png", category: "shoes" },
  { id: "shoe_002", name: "Dify Magsic Chunky Sneaker", price: 1899, currency: "INR", image: "http://localhost:5173/images/chunky_sneaker.jpg", category: "shoes" },
  { id: "shoe_003", name: "Classic Navy Suede Oxford", price: 999, currency: "INR", image: "http://localhost:5173/images/blue_suede.png", category: "shoes" },
  { id: "shoe_004", name: "Casual Retro Green Sneaker", price: 649, currency: "INR", image: "http://localhost:5173/images/green_sneaker.png", category: "shoes" },
  { id: "shoe_005", name: "Cult Sport Trail Runner", price: 899, currency: "INR", image: "http://localhost:5173/images/trail_running.png", category: "shoes" },
  { id: "shoe_006", name: "Woodland Leather Boot", price: 1599, currency: "INR", image: "http://localhost:5173/images/blue_suede.png", category: "shoes" },
  { id: "shoe_007", name: "Converse Street Sneaker", price: 1299, currency: "INR", image: "http://localhost:5173/images/green_sneaker.png", category: "shoes" }
];

/**
 * Run one step of auto-navigation.
 * @param {string} query - The user goal
 * @param {object} hitlCallbacks - Optional callbacks:
 *   onCartConsentPrompt(cartPayload) => Promise<{ approved: boolean }> (returns consent boolean)
 *   onOtpPrompt(action) => Promise<string>                             (returns OTP value)
 *   onHumanPrompt(action) => Promise<string>                           (returns user input)
 *   onOptionSelect(action) => Promise<number>                          (returns selected index)
 * @returns step result object
 */
async function runAutoNavigationStep(query, hitlCallbacks = {}) {
  console.log(`[AutoNavigation Step] Querying next action for: "${query}" (Target: ${BACKEND_URL})`);
  try {
    let actionData = null;
    
    // 1. Try MCP Server (Port 6001) for LLM action resolution
    try {
      const response = await fetch(`${BACKEND_URL}/api/auto-navigate-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query })
      });
      
      if (response.ok) {
        const text = await response.text();
        try {
          const result = JSON.parse(text);
          if (result.success && result.action) {
            try {
              actionData = typeof result.action === 'string' ? JSON.parse(result.action) : result.action;
              console.log(`[AutoNavigation Step] Action resolved from MCP Server:`, JSON.stringify(actionData));
            } catch (_) {
              actionData = { action: 'done', reason: result.action };
            }
          }
        } catch (_) {}
      }
    } catch (netErr) {
      console.warn('[AutoNavigation Step] MCP Server query fallback:', netErr.message);
    }

    // 2. Intelligent DOM Fallback: inspect page elements on Playwright (Port 5000)
    if (!actionData) {
      console.log('[AutoNavigation Step] Using intelligent page element matcher on Port 5000...');
      try {
        const domResp = await fetch('http://localhost:5000/dom-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'assignSelectorIndices' })
        });
        const domData = await domResp.json();
        const selectorMap = domData.result?.selectorMap || {};
        
        // Find matching product by price or name in query
        const queryLower = query.toLowerCase();
        let targetIdx = null;
        
        for (const [idx, el] of Object.entries(selectorMap)) {
          const name = (el.name || '').toLowerCase();
          const sel = (el.selector || '').toLowerCase();
          const role = (el.role || '').toLowerCase();
          
          // Check price matches e.g. "1899"
          const priceMatch = query.match(/\d+/);
          if (priceMatch && (name.includes(priceMatch[0]) || sel.includes(priceMatch[0]))) {
            targetIdx = Number(idx);
            break;
          }
          // Check product name matches
          for (const item of CATALOG_ITEMS) {
            if (queryLower.includes(item.name.toLowerCase()) || (priceMatch && item.price === Number(priceMatch[0]))) {
              if (sel.includes(item.id) || name.includes(item.name.toLowerCase())) {
                targetIdx = Number(idx);
                break;
              }
            }
          }
          if (targetIdx !== null) break;
        }

        // Default to first interactive button if none found
        if (targetIdx === null) {
          const firstBtn = Object.entries(selectorMap).find(([_, el]) => (el.role === 'button' || el.selector?.includes('buy')));
          targetIdx = firstBtn ? Number(firstBtn[0]) : 0;
        }

        actionData = { action: 'click', index: targetIdx };
        console.log(`[AutoNavigation Step] Heuristic action resolved: Click element index ${targetIdx}`);
      } catch (domErr) {
        console.error('[AutoNavigation Step] DOM fallback error:', domErr.message);
        actionData = { action: 'click', index: 1 };
      }
    }

    let actionsList = [];
    if (actionData.actions && Array.isArray(actionData.actions)) {
      actionsList = actionData.actions;
    } else if (actionData.action) {
      actionsList = [actionData];
    }

    const doneAction = actionsList.find(a => a.action === 'done');
    if (doneAction) {
      console.log(`[AutoNavigation Step] Done action detected: ${doneAction.reason}`);
      return { success: true, status: 'completed', reason: doneAction.reason };
    }

    const noneAction = actionsList.find(a => a.action === 'none');
    if (noneAction) {
      console.log(`[AutoNavigation Step] None action detected: ${noneAction.reason}`);
      return { success: true, status: 'halted', reason: noneAction.reason };
    }

    // --- HITL: Cart Consent / Trusted Consent Surface (AP2 Protocol on localhost:6003) ---
    let isBuyAction = false;
    let targetElement = null;

    if (actionData.index !== undefined && (actionData.action === 'click' || !actionData.action)) {
      try {
        const domResp = await fetch('http://localhost:5000/dom-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'assignSelectorIndices' })
        });
        const domData = await domResp.json();
        targetElement = domData.result?.selectorMap?.[actionData.index];
        const elName = (targetElement?.name || '').toLowerCase();
        const elSelector = (targetElement?.selector || '').toLowerCase();
        if (elName.includes('buy') || elName.includes('order') || elSelector.includes('#buy-') || /buy|book|purchase|order/i.test(query)) {
          isBuyAction = true;
        }
      } catch (_) {}
    }

    if (isBuyAction && hitlCallbacks.onCartConsentPrompt) {
      console.log(`[AutoNavigation HITL] Buy action detected on index ${actionData.index}. Requesting Trusted Consent on localhost:6003...`);
      
      const cleanName = (targetElement?.name || '').replace(/^Buy\s+/i, '').trim();
      const matched = CATALOG_ITEMS.find(c => 
        (targetElement?.selector && targetElement.selector.includes(c.id)) ||
        (cleanName && c.name.toLowerCase().includes(cleanName.toLowerCase())) ||
        (query && query.toLowerCase().includes(c.name.toLowerCase()))
      ) || CATALOG_ITEMS[6];

      const product = {
        id: matched.id,
        name: matched.name,
        price: targetElement?.price || matched.price,
        currency: matched.currency || 'INR',
        category: matched.category,
        image: matched.image,
        merchantName: 'Razorpay ACP Store'
      };

      if (hitlCallbacks.onTracingStep) {
        hitlCallbacks.onTracingStep({
          stage: 2,
          status: 'completed',
          data: {
            productId: product.id,
            productName: product.name,
            price: product.price,
            currency: product.currency,
            elementIndex: actionData.index,
            action: 'click'
          }
        });
        hitlCallbacks.onTracingStep({
          stage: 3,
          status: 'current',
          data: { product, surface: 'Trusted Consent Surface Modal' }
        });
      }

      const cart = {
        cartId: 'cart_' + Math.random().toString(36).substring(2, 9),
        merchantId: 'merchant_acp_razorpay_001',
        merchantName: 'Razorpay ACP Store',
        items: [{
          id: product.id,
          sku: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
          image: product.image
        }],
        totalAmount: product.price,
        currency: product.currency,
        status: 'PENDING_USER_CONSENT',
        assembledAt: new Date().toISOString()
      };

      const consentResult = await hitlCallbacks.onCartConsentPrompt({ product, cart, action: actionData });
      
      const isApproved = consentResult === true || (consentResult && consentResult.approved === true) || (typeof consentResult === 'string' && consentResult.toLowerCase() === 'accept');
      
      if (!isApproved) {
        console.log('[AutoNavigation HITL] User rejected cart consent on localhost:6003.');
        if (hitlCallbacks.onTracingStep) {
          hitlCallbacks.onTracingStep({
            stage: 3,
            status: 'failed',
            errorReason: 'User clicked Deny on the Trusted Consent Surface Modal.'
          });
        }
        return { success: false, status: 'halted', reason: 'Cart authorization was rejected by user on Trusted Consent Surface.' };
      }

      console.log('[AutoNavigation HITL] User approved cart consent on localhost:6003! Creating and signing cryptographic Mandate (AP2)...');
      if (hitlCallbacks.onTracingStep) {
        hitlCallbacks.onTracingStep({
          stage: 3,
          status: 'completed',
          data: {
            decision: 'Approved',
            cartId: cart.cartId,
            totalAmount: cart.totalAmount,
            currency: cart.currency
          }
        });
        hitlCallbacks.onTracingStep({ stage: 4, status: 'current' });
      }

      // --- AP2 Mandate Generation & Cryptographic Signing ---
      let createdIntentMandate = null;
      let createdCartMandate = null;
      let createdPaymentMandate = null;
      try {
        const {
          createIntentMandate,
          createCartMandate,
          createPaymentMandate,
          verifyMandateChain
        } = require('../X402_GateWay/mandates');

        // 1. Create and sign Intent Mandate
        createdIntentMandate = createIntentMandate(
          { id: 'user_001' },
          { id: product.id, merchantId: 'merchant_acp_razorpay_001' },
          product.price
        );

        // 2. Create and sign Cart Mandate with validation
        createdCartMandate = createCartMandate(
          createdIntentMandate,
          [{ id: product.id, name: product.name, price: product.price, quantity: 1 }],
          'merchant_acp_razorpay_001'
        );

        if (hitlCallbacks.onTracingStep) {
          hitlCallbacks.onTracingStep({
            stage: 4,
            status: 'completed',
            data: {
              mandateType: 'cart_mandate',
              customerIntentMandate: createdIntentMandate,
              merchantCartMandate: createdCartMandate,
              mandateId: createdCartMandate.id,
              totalAmount: createdCartMandate.total_amount,
              currency: createdCartMandate.currency || 'INR',
              signature: createdCartMandate.signature
            }
          });
          hitlCallbacks.onTracingStep({ stage: 5, status: 'current' });
        }

        // 3. Create and sign Payment Mandate
        createdPaymentMandate = createPaymentMandate(createdCartMandate);

        // 4. Verify Mandate Chain
        verifyMandateChain(createdCartMandate, createdPaymentMandate);
        console.log(`[AutoNavigation AP2] ✅ Intent, Cart, & Payment Mandates successfully created, signed & verified! (Payment Mandate ID: ${createdPaymentMandate.id})`);

        // 5. Trigger X-402 Challenge on Gateway (Port 6004)
        console.log(`[AutoNavigation X-402] Sending checkout request with Mandates to X-402 Gateway (http://localhost:6004/checkout)...`);
        let x402Challenge = null;
        try {
          const x402Res = await fetch('http://localhost:6004/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cart-Mandate': Buffer.from(JSON.stringify(createdCartMandate)).toString('base64'),
              'Payment-Mandate': Buffer.from(JSON.stringify(createdPaymentMandate)).toString('base64')
            }
          });

          console.log(`[AutoNavigation X-402] Gateway returned Status: ${x402Res.status} (HTTP 402 Payment Required)`);
          const challengeHeader = x402Res.headers.get('payment-required');
          if (challengeHeader) {
            x402Challenge = JSON.parse(Buffer.from(challengeHeader, 'base64').toString('utf8'));
          } else {
            const data = await x402Res.json();
            x402Challenge = data.challenge;
          }

          if (hitlCallbacks.onTracingStep) {
            hitlCallbacks.onTracingStep({
              stage: 5,
              status: 'completed',
              data: {
                ap2PaymentMandate: createdPaymentMandate,
                x402Challenge: x402Challenge,
                paymentMandateId: createdPaymentMandate.id,
                httpStatus: 402,
                orderRef: x402Challenge?.order_ref,
                nonce: x402Challenge?.nonce,
                razorpayOrderId: x402Challenge?.razorpay_order_id,
                expiresAt: x402Challenge?.expires_at
              }
            });
            hitlCallbacks.onTracingStep({ stage: 6, status: 'current' });
          }

          if (hitlCallbacks.onX402Challenge) {
            console.log(`[AutoNavigation X-402] Presenting HTTP 402 Challenge on localhost:6003:`, x402Challenge);
            await hitlCallbacks.onX402Challenge({
              challenge: x402Challenge,
              cartMandate: createdCartMandate,
              paymentMandate: createdPaymentMandate,
              product: product
            });
          }
        } catch (x402Err) {
          console.warn('[AutoNavigation X-402] Gateway call error:', x402Err.message);
          if (hitlCallbacks.onTracingStep) {
            hitlCallbacks.onTracingStep({
              stage: 5,
              status: 'failed',
              errorReason: `X-402 Gateway Error: ${x402Err.message}`
            });
          }
        }
      } catch (mandateErr) {
        console.warn('[AutoNavigation AP2] Warning during mandate creation:', mandateErr.message);
        if (hitlCallbacks.onTracingStep) {
          hitlCallbacks.onTracingStep({
            stage: 4,
            status: 'failed',
            errorReason: `AP2 Mandate Error: ${mandateErr.message}`
          });
        }
        return { success: false, status: 'halted', reason: `AP2 Mandate Error: ${mandateErr.message}` };
      }
    }

    // --- HITL: OTP / Human Prompt / Option Select ---
    const otpAction = actionsList.find(a => a.action === 'otp_prompt');
    const humanAction = actionsList.find(a => a.action === 'human_prompt');
    const optionAction = actionsList.find(a => a.action === 'option_select_prompt');

    if (otpAction || humanAction) {
      const targetAction = otpAction || humanAction;
      const isOtp = !!otpAction;
      const label = isOtp ? 'OTP Verification Code' : targetAction.name;
      console.log(`[AutoNavigation HITL] ${isOtp ? 'OTP' : 'Human'} input required for: "${label}"`);

      let userValue = null;
      if (isOtp && hitlCallbacks.onOtpPrompt) {
        userValue = await hitlCallbacks.onOtpPrompt(targetAction);
      } else if (!isOtp && hitlCallbacks.onHumanPrompt) {
        userValue = await hitlCallbacks.onHumanPrompt(targetAction);
      }

      if (!userValue || String(userValue).trim() === '') {
        return { success: false, error: 'HITL: User cancelled OTP/human input.' };
      }

      const rawVal = String(userValue).trim();
      const numericValue = /^\d+$/.test(rawVal) ? parseInt(rawVal, 10) : rawVal;
      actionData = { index: targetAction.index, value: numericValue };
    } else if (optionAction) {
      console.log(`[AutoNavigation HITL] Option selection required`);
      let selectedIndex = null;
      if (hitlCallbacks.onOptionSelect) {
        selectedIndex = await hitlCallbacks.onOptionSelect(optionAction);
      }
      if (selectedIndex === null || selectedIndex === undefined) {
        return { success: false, error: 'HITL: User cancelled option selection.' };
      }
      actionData = { index: selectedIndex, action: 'click' };
    }

    // Execute action on backend DOM executor
    console.log(`[AutoNavigation Step] Executing action: ${JSON.stringify(actionData)}`);
    const runResponse = await fetch(`${BACKEND_URL}/api/dom-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'runClickOrFill',
        params: actionData
      })
    });
    
    const runResult = await runResponse.json();
    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to execute DOM action');
    }

    return { success: true, status: 'step_executed', action: actionData, message: runResult.result?.message };
  } catch (error) {
    console.error('[AutoNavigation Step] Error during step execution:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run the full auto-navigation loop.
 * @param {string} query - The user goal
 * @param {object} hitlCallbacks - HITL callbacks (see runAutoNavigationStep)
 * @param {function} onStepLog - Optional: called after each step with step info
 */
async function runAutoNavigationLoop(query, hitlCallbacks = {}, onStepLog = null) {
  console.log(`[AutoNavigation Loop] Starting loop for query: "${query}"`);
  let stepsLog = [];
  let done = false;
  let stepsCount = 0;
  let lastActionStr = '';

  const isSingleActionQuery = /^(click|tap|press|select|choose|buy|book|purchase|order)\b/i.test(query.trim());

  while (!done && stepsCount < 10) {
    stepsCount++;
    console.log(`[AutoNavigation Loop] Executing step ${stepsCount}`);
    
    const result = await runAutoNavigationStep(query, hitlCallbacks);
    const logEntry = { step: stepsCount, ...result };
    stepsLog.push(logEntry);

    if (onStepLog) onStepLog(logEntry);

    if (!result.success) {
      done = true;
      break;
    }

    if (result.status === 'completed' || result.status === 'halted') {
      done = true;
      break;
    }

    const currentActionStr = JSON.stringify(result.action || {});
    if (currentActionStr === lastActionStr) {
      console.log(`[AutoNavigation Loop] Action already executed on previous step. Marking complete.`);
      logEntry.status = 'completed';
      done = true;
      break;
    }
    lastActionStr = currentActionStr;

    // If query is a direct single click action and it succeeded, finish
    if (isSingleActionQuery && result.status === 'step_executed') {
      console.log(`[AutoNavigation Loop] Single-action query executed successfully. Marking complete.`);
      logEntry.status = 'completed';
      done = true;
      break;
    }

    // Delay 1.5s between steps to let browser stabilize
    await new Promise(r => setTimeout(r, 1500));
  }

  const finalSuccess = stepsLog.length > 0 && stepsLog[stepsLog.length - 1].success;
  return {
    success: finalSuccess,
    status: finalSuccess ? 'completed' : 'failed',
    log: stepsLog
  };
}

module.exports = {
  runAutoNavigationStep,
  runAutoNavigationLoop
};

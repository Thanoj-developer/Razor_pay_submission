/**
 * RouterLogic.js
 * ---------------------------------------------------------------------------
 * Smart Query Router & Intent Navigator:
 *
 * Classifies an incoming query (text or voice-transcribed) and routes it
 * to the correct execution mode:
 *
 *  1. ORCHESTRATION MODE  (runOrchestrator)
 *     -> "Open amazon" / "Go to youtube" / "Launch localhost:5173" / "Search flipkart for shoes"
 *     -> Top-level navigation, tab management, and multi-step workflow launch
 *
 *  2. AUTO-NAVIGATION MODE (runAutoNavigationLoop)
 *     -> "Book this product" / "Click buy now for Converse" / "Add to cart" / "Fill shipping address"
 *     -> In-page DOM actions on the currently open browser page with HITL support
 *
 *  Classification uses a fast zero-temperature Llama 3.1 LLM call with a zero-latency
 *  keyword heuristic fallback so routing never blocks.
 * ---------------------------------------------------------------------------
 */

const { runOrchestrator } = require('./orcastrator');
const { runAutoNavigationLoop } = require('./AutoNavigation');

// ── Constants ─────────────────────────────────────────────────────────────────

const INBOX = {
  ORCHESTRATION:   'ORCHESTRATION',
  AUTO_NAVIGATION: 'AUTO_NAVIGATION',
  UNKNOWN:         'UNKNOWN',
};

// Keywords that strongly suggest ORCHESTRATION (initial navigation / opening) intent
const ORCHESTRATION_KEYWORDS = [
  'open', 'launch', 'go to', 'navigate to', 'visit', 'load',
  'start', 'show me', 'take me to', 'search for', 'find',
];

// Keywords that strongly suggest AUTO-NAVIGATION (in-page action / booking / payment) intent
const AUTO_NAV_KEYWORDS = [
  'click', 'book', 'buy', 'add to cart', 'select', 'fill',
  'type', 'scroll', 'submit', 'checkout', 'purchase', 'tap',
  'press', 'enter', 'choose', 'pick', 'order', 'apply', 'pay',
  'proceed', 'continue', 'verify', 'confirm',
];

const FALLBACK_NVIDIA_API_KEY =
  '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';

// ── LLM Classifier (Native Fetch - Zero Dependency) ──────────────────────────

/**
 * Ask the LLM to classify the intent.
 * Returns 'ORCHESTRATION' | 'AUTO_NAVIGATION' | 'UNKNOWN'
 */
async function classifyWithLLM(query) {
  try {
    const apiKey = process.env.NVIDIA_API_KEY || FALLBACK_NVIDIA_API_KEY;
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'meta/llama-3.2-11b-vision-instruct',
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier and smart router for an autonomous browser automation system.
Classify the user's command into exactly ONE category:

ORCHESTRATION   -> User wants to navigate to a new website, launch a URL, search across tabs, or start a new workflow.
                   Examples: "open amazon", "go to youtube", "launch http://localhost:5173/", "search flipkart for headphones"

AUTO_NAVIGATION -> User wants to interact with elements on the currently active webpage.
                   Examples: "book this product", "click buy now", "click on buy now for Converse Street Sneaker", "add to cart", "scroll down", "fill search box with laptops", "checkout", "pay now", "enter otp 1234"

Reply with ONLY ONE WORD: either ORCHESTRATION or AUTO_NAVIGATION.
No explanation. No punctuation.`
          },
          { role: 'user', content: query }
        ],
        temperature: 0.0,
        max_tokens: 10
      })
    });

    if (!response.ok) {
      throw new Error(`NIM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim().toUpperCase();

    if (raw.includes('ORCHESTRATION')) return INBOX.ORCHESTRATION;
    if (raw.includes('AUTO_NAVIGATION') || raw.includes('AUTO')) return INBOX.AUTO_NAVIGATION;
    return INBOX.UNKNOWN;
  } catch (err) {
    console.error('[RouterLogic] LLM classification failed:', err.message);
    return INBOX.UNKNOWN;
  }
}

// ── Keyword Heuristic (fast fallback) ─────────────────────────────────────────

/**
 * Check if a query contains a keyword phrase with proper word boundaries.
 */
function queryContainsKeyword(lower, kw) {
  if (lower.startsWith(kw + ' ') || lower === kw) return true;
  if (lower.includes(' ' + kw + ' ')) return true;
  if (lower.endsWith(' ' + kw)) return true;
  return false;
}

/**
 * Lightning-fast keyword-based classification.
 */
function classifyWithKeywords(query) {
  const lower = query.toLowerCase().trim();

  // Check AUTO_NAV first — action keywords take priority over opening
  for (const kw of AUTO_NAV_KEYWORDS) {
    if (queryContainsKeyword(lower, kw)) {
      console.log(`[RouterLogic] Keyword match (AUTO_NAV): "${kw}" in "${lower}"`);
      return INBOX.AUTO_NAVIGATION;
    }
  }

  for (const kw of ORCHESTRATION_KEYWORDS) {
    if (queryContainsKeyword(lower, kw)) {
      console.log(`[RouterLogic] Keyword match (ORCHESTRATION): "${kw}" in "${lower}"`);
      return INBOX.ORCHESTRATION;
    }
  }

  // Default: orchestration (opening a URL is safer than clicking something unknown)
  console.log(`[RouterLogic] No keyword matched — defaulting to ORCHESTRATION`);
  return INBOX.ORCHESTRATION;
}

// ── Classify Only (no execution) ──────────────────────────────────────────────

/**
 * Classify a query without executing anything.
 *
 * @param {string}  query
 * @param {boolean} [useLLM=true]
 * @returns {Promise<{ inbox: string, confidence: 'llm' | 'keyword' | 'none' }>}
 */
async function classifyQuery(query, useLLM = true) {
  if (!query || !query.trim()) return { inbox: INBOX.UNKNOWN, confidence: 'none' };

  let inbox;
  let confidence;

  if (useLLM) {
    inbox = await classifyWithLLM(query);
    if (inbox === INBOX.UNKNOWN) {
      inbox = classifyWithKeywords(query);
      confidence = 'keyword';
    } else {
      confidence = 'llm';
    }
  } else {
    inbox = classifyWithKeywords(query);
    confidence = 'keyword';
  }

  return { inbox, confidence };
}

// ── Main Router & Execution Dispatcher ────────────────────────────────────────

/**
 * Route a text or voice query to the correct inbox and execute it.
 *
 * @param {string} query                      - The command string
 * @param {object} [options]
 * @param {object}   [options.hitlCallbacks]  - HITL callbacks forwarded to AutoNavigation
 * @param {function} [options.onStepLog]      - Step log callback for AutoNavigation SSE
 * @param {boolean}  [options.useLLM=true]    - Set false to skip LLM and use keywords only
 * @returns {Promise<{ inbox: string, query: string, result: object }>}
 */
async function routeQuery(query, options = {}) {
  const { hitlCallbacks = {}, onStepLog = null, useLLM = true } = options;

  if (!query || !query.trim()) {
    return { inbox: INBOX.UNKNOWN, query, result: { success: false, error: 'Empty query' } };
  }

  const divider = '-'.repeat(60);
  console.log(`\n${divider}`);
  console.log(`[RouterLogic] Incoming query: "${query}"`);

  // ── Step 1: Classify ─────────────────────────────────────────────────────────
  let inbox;

  if (useLLM) {
    console.log('[RouterLogic] Classifying with LLM...');
    inbox = await classifyWithLLM(query);

    if (inbox === INBOX.UNKNOWN) {
      console.log('[RouterLogic] LLM returned UNKNOWN — falling back to keyword heuristic...');
      inbox = classifyWithKeywords(query);
    }
  } else {
    inbox = classifyWithKeywords(query);
  }

  console.log(`[RouterLogic] ✅ Routed to -> ${inbox} MODE`);

  // ── Step 2: Dispatch ──────────────────────────────────────────────────────────
  let result;

  if (inbox === INBOX.ORCHESTRATION) {
    console.log(`[RouterLogic] [ORCHESTRATION MODE] Executing: "${query}"`);
    result = await runOrchestrator(query);
    console.log(`[RouterLogic] Orchestration ${result.success ? 'SUCCESS' : 'FAILED'}`);

  } else if (inbox === INBOX.AUTO_NAVIGATION) {
    console.log(`[RouterLogic] [AUTO-NAVIGATION MODE] Executing: "${query}"`);
    result = await runAutoNavigationLoop(query, hitlCallbacks, onStepLog);
    console.log(`[RouterLogic] AutoNav finished with status: ${result.status}`);

  } else {
    console.log(`[RouterLogic] ⚠️ Unknown inbox — defaulting to ORCHESTRATION`);
    inbox = INBOX.ORCHESTRATION;
    result = await runOrchestrator(query);
  }

  console.log(`${divider}\n`);
  return { inbox, query, result };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  routeQuery,
  routeVoiceQuery: routeQuery, // Alias for backward compatibility
  classifyQuery,
  INBOX,
  classifyWithLLM,
  classifyWithKeywords
};

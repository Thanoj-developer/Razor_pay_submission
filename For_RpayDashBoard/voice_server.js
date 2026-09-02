const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getLlmResponse } = require('./LLM_FOR_VOICE');
const { runOrchestrator } = require('./orcastrator');
const { runAutoNavigationLoop } = require('./AutoNavigation');
const { routeQuery, classifyQuery, INBOX } = require('./RouterLogic');
const { getAllStoredMandates } = require('../MANDATE(AP2)/Mandate');

// Load environment variables from .env files
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', 'Controlled_By_LLM', '.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const index = trimmed.indexOf('=');
            if (index !== -1) {
              const key = trimmed.substring(0, index).trim();
              const val = trimmed.substring(index + 1).trim();
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Failed to load env file from ${envPath}:`, err);
      }
    }
  }
}
loadEnv();

const app = express();
const PORT = process.env.VOICE_PORT || 6003;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:6001';

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Root route: Modern Search-Based Smart Query Router Dashboard
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Query Router & Automation Hub</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <!-- Official Razorpay Standard Checkout SDK -->
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <style>
        :root {
            --bg-primary: #0a0c10;
            --bg-card: rgba(18, 22, 31, 0.75);
            --border-color: rgba(255, 255, 255, 0.08);
            --border-glow: rgba(99, 102, 241, 0.25);
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --accent-orch: #f59e0b;
            --accent-orch-bg: rgba(245, 158, 11, 0.12);
            --accent-orch-border: rgba(245, 158, 11, 0.35);
            --accent-autonav: #06b6d4;
            --accent-autonav-bg: rgba(6, 182, 212, 0.12);
            --accent-autonav-border: rgba(6, 182, 212, 0.35);
            --accent-primary: #6366f1;
            --accent-primary-gradient: linear-gradient(135deg, #6366f1, #8b5cf6);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-primary);
            background-image: 
                radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15), transparent 45%),
                radial-gradient(circle at 10% 80%, rgba(6, 182, 212, 0.08), transparent 35%),
                radial-gradient(circle at 90% 80%, rgba(245, 158, 11, 0.08), transparent 35%);
            min-height: 100vh;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: var(--text-main);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 32px 20px;
        }

        .container {
            width: 100%;
            max-width: 860px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        /* ── Header ── */
        .header {
            text-align: center;
            margin-bottom: 8px;
        }
        .header-title {
            font-size: 1.85rem;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .header-subtitle {
            font-size: 0.88rem;
            color: var(--text-muted);
            margin-top: 6px;
        }
        .port-badge {
            display: inline-block;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 8px;
            background: rgba(99, 102, 241, 0.2);
            color: #a5b4fc;
            border: 1px solid rgba(99, 102, 241, 0.4);
            border-radius: 6px;
            margin-left: 8px;
            vertical-align: middle;
        }

        /* ── Search Bar Hero ── */
        .search-hero-card {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 18px;
            padding: 24px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }
        .search-hero-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, #6366f1, #06b6d4, #f59e0b, transparent);
            opacity: 0.8;
        }

        /* Active Mode Banner inside Hero */
        .mode-banner-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        .router-label {
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: var(--text-muted);
        }
        .mode-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.5px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #9ca3af;
            transition: all 0.3s ease;
        }
        .mode-indicator.orch {
            background: var(--accent-orch-bg);
            border-color: var(--accent-orch-border);
            color: var(--accent-orch);
            box-shadow: 0 0 16px rgba(245, 158, 11, 0.25);
        }
        .mode-indicator.autonav {
            background: var(--accent-autonav-bg);
            border-color: var(--accent-autonav-border);
            color: var(--accent-autonav);
            box-shadow: 0 0 16px rgba(6, 182, 212, 0.25);
        }
        .mode-indicator.classifying {
            background: rgba(99, 102, 241, 0.15);
            border-color: rgba(99, 102, 241, 0.4);
            color: #a5b4fc;
            box-shadow: 0 0 16px rgba(99, 102, 241, 0.3);
        }

        /* Search Input Box */
        .search-input-wrapper {
            display: flex;
            align-items: center;
            background: rgba(10, 12, 16, 0.85);
            border: 1.5px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            padding: 6px 8px 6px 16px;
            gap: 12px;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
            transition: all 0.25s ease;
        }
        .search-input-wrapper:focus-within {
            border-color: #6366f1;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25), inset 0 2px 4px rgba(0, 0, 0, 0.4);
        }
        .search-icon {
            font-size: 1.2rem;
            color: #6366f1;
            user-select: none;
        }
        .search-input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: #ffffff;
            font-size: 1rem;
            font-family: inherit;
            padding: 8px 0;
        }
        .search-input::placeholder {
            color: #4b5563;
        }
        .search-btn {
            background: var(--accent-primary-gradient);
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 10px 18px;
            font-weight: 700;
            font-size: 0.88rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
            white-space: nowrap;
        }
        .search-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(99, 102, 241, 0.45);
        }
        .search-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .classify-only-btn {
            background: rgba(255, 255, 255, 0.06);
            color: #e5e7eb;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 10px 14px;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
        }
        .classify-only-btn:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.12);
        }

        /* ── Assistant Chat / Response Box ── */
        .chat-box {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 16px 20px;
            min-height: 80px;
            max-height: 180px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .chat-msg {
            font-size: 0.92rem;
            line-height: 1.45;
            animation: fadeIn 0.3s ease-out;
        }
        .chat-msg.user {
            color: #93c5fd;
            font-weight: 500;
        }
        .chat-msg.assistant {
            color: #fde68a;
        }
        .chat-msg.routing {
            display: inline-block;
            align-self: flex-start;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 12px;
            letter-spacing: 0.5px;
        }
        .chat-msg.routing.orch {
            background: var(--accent-orch-bg);
            border: 1px solid var(--accent-orch-border);
            color: var(--accent-orch);
        }
        .chat-msg.routing.autonav {
            background: var(--accent-autonav-bg);
            border: 1px solid var(--accent-autonav-border);
            color: var(--accent-autonav);
        }

        /* ── Dual Column Control & Log Layout ── */
        .grid-2col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        @media (max-width: 768px) {
            .grid-2col {
                grid-template-columns: 1fr;
            }
        }

        .card {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .card-title {
            font-size: 0.85rem;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #e5e7eb;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Terminal Log Area */
        .terminal-box {
            width: 100%;
            height: 180px;
            background: #08090d;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 10px 12px;
            color: #38bdf8;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.78rem;
            line-height: 1.45;
            resize: none;
            outline: none;
            box-sizing: border-box;
            white-space: pre-wrap;
            overflow-y: auto;
        }

        /* Active Tabs & Mandates List */
        .tabs-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-height: 140px;
            overflow-y: auto;
        }
        .tab-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 8px;
            padding: 8px 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .tab-item:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(99, 102, 241, 0.3);
        }
        .tab-item.active {
            background: rgba(99, 102, 241, 0.12);
            border-color: #6366f1;
        }
        .tab-title {
            font-size: 0.8rem;
            font-weight: 600;
            color: #ffffff;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .tab-url {
            font-size: 0.7rem;
            color: #9ca3af;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-top: 2px;
        }

        /* Mandate Item in DB Card */
        .mandate-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .mandate-badge {
            display: inline-block;
            align-self: flex-start;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .mandate-badge.intent {
            background: rgba(99, 102, 241, 0.2);
            color: #a5b4fc;
            border: 1px solid rgba(99, 102, 241, 0.4);
        }
        .mandate-badge.cart {
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.4);
        }
        .mandate-badge.payment {
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.4);
        }

        /* Modals */
        .modal-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.82);
            backdrop-filter: blur(10px);
            z-index: 9999;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .modal-card {
            background: #11141c;
            border: 1px solid rgba(99, 102, 241, 0.35);
            border-radius: 16px;
            padding: 28px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 0 50px rgba(99, 102, 241, 0.25);
            color: #ffffff;
            animation: fadeIn 0.25s ease-out;
        }

        /* Trusted Consent Modal Style */
        .consent-modal-card {
            background: #0e121a;
            border: 1.5px solid rgba(99, 102, 241, 0.5);
            border-radius: 18px;
            padding: 24px;
            width: 100%;
            max-width: 460px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.3);
            color: #ffffff;
            animation: fadeIn 0.25s ease-out;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-title">
                ⚡ SMART QUERY ROUTER &amp; AUTOMATION HUB
                <span class="port-badge">PORT 6003</span>
            </div>
            <div class="header-subtitle">
                Autonomous Intent Classification &bull; AP2 Mandate Authorization &bull; Auto-Navigation Mode
            </div>
        </div>

        <!-- Central Search Bar & Smart Router Hero -->
        <div class="search-hero-card">
            <div class="mode-banner-row">
                <span class="router-label">🧠 Intent Router</span>
                <div class="mode-indicator" id="modeBadge">
                    <span id="modeDot" style="width: 8px; height: 8px; border-radius: 50%; background: #6b7280; display: inline-block;"></span>
                    <span id="modeText">STANDBY</span>
                </div>
            </div>

            <!-- Search Input Box -->
            <div class="search-input-wrapper">
                <span class="search-icon">🔍</span>
                <input 
                    type="text" 
                    id="smartQueryInput" 
                    class="search-input" 
                    placeholder="Type command e.g. 'Click on buy now for Converse' or 'Launch http://localhost:5173/'..."
                    autofocus
                >
                <button id="classifyOnlyBtn" class="classify-only-btn" title="Classify intent without running">
                    🧠 Classify
                </button>
                <button id="executeBtn" class="search-btn">
                    🚀 Execute
                </button>
            </div>
        </div>

        <!-- Assistant Chat & Confirmation -->
        <div class="chat-box" id="chatBox">
            <div style="color: #6b7280; font-size: 0.85rem; font-style: italic; text-align: center;">
                Type any query above and press <strong>Execute</strong> (or hit <strong>Enter</strong>) to classify and automate.
            </div>
        </div>

        <!-- Lower Grid: Tabs & Automation Terminal Logs -->
        <div class="grid-2col">
            <!-- Active Tabs Card -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">🌐 Active Browser Tabs</span>
                    <button id="refreshTabsBtn" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #a5b4fc; padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; cursor: pointer;">
                        🔄 Refresh
                    </button>
                </div>
                <div class="tabs-list" id="tabsListContainer">
                    <div style="color: #6b7280; font-size: 0.78rem; text-align: center; padding: 12px;">Loading tabs...</div>
                </div>
            </div>

            <!-- Automation Logs Card -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📋 Execution Terminal Logs</span>
                    <button onclick="document.getElementById('automationLogs').value = ''" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #9ca3af; padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; cursor: pointer;">
                        Clear
                    </button>
                </div>
                <textarea id="automationLogs" class="terminal-box" readonly placeholder="Real-time execution logs will stream here..."></textarea>
            </div>
        </div>

        <!-- AP2 Stored Mandates Card -->
        <div class="card">
            <div class="card-header">
                <span class="card-title">📜 AP2 Generated Mandates Database (MANDATES_DATABASE/)</span>
                <button id="refreshMandatesBtn" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #a5b4fc; padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; cursor: pointer;">
                    🔄 Refresh Mandates
                </button>
            </div>
            <div id="mandatesListContainer" style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto;">
                <div style="color: #6b7280; font-size: 0.78rem; text-align: center; padding: 10px;">Loading stored mandates...</div>
            </div>
        </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- TRUSTED CONSENT SURFACE MODAL (AP2 Protocol on Port 6003)            -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div id="cartConsentModal" class="modal-overlay">
        <div class="consent-modal-card">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                <div>
                    <div style="font-size: 1.05rem; font-weight: 800; color: #a5b4fc; display: flex; align-items: center; gap: 8px;">
                        🛡️ TRUSTED CONSENT SURFACE
                    </div>
                    <div style="font-size: 0.76rem; color: #9ca3af; margin-top: 2px;">
                        Cart Assembly Review &amp; Human Authorization (AP2 Protocol)
                    </div>
                </div>
                <span id="consentCloseBtn" style="color: #6b7280; font-size: 1.2rem; cursor: pointer;">&times;</span>
            </div>

            <!-- Assembled Product Card -->
            <div style="display: flex; gap: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 12px; align-items: center;">
                <img id="consentProductImg" src="" alt="Product Photo" style="width: 88px; height: 88px; object-fit: contain; background: #ffffff; border-radius: 8px; padding: 4px; flex-shrink: 0;">
                <div style="display: flex; flex-direction: column; gap: 3px;">
                    <div id="consentProductName" style="font-size: 0.95rem; font-weight: 700; color: #ffffff;">Product Name</div>
                    <div id="consentProductSku" style="font-size: 0.75rem; color: #9ca3af;">SKU: shoe_007</div>
                    <div id="consentMerchantName" style="font-size: 0.75rem; color: #818cf8; font-weight: 600;">Merchant: Razorpay ACP Store</div>
                    <div id="consentProductPrice" style="font-size: 1.15rem; font-weight: 800; color: #34d399; margin-top: 2px;">₹1299 INR</div>
                </div>
            </div>

            <!-- Security & Protocol Notice -->
            <div style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 8px; padding: 10px 12px; font-size: 0.78rem; color: #c7d2fe; line-height: 1.4;">
                🔒 <strong>Cart Assembly Verified:</strong> By approving, you grant explicit consent for this transaction. The cryptographic Checkout Mandate will be signed in the next step.
            </div>

            <!-- Action Buttons: Reject vs Accept -->
            <div style="display: flex; gap: 10px; margin-top: 4px;">
                <button id="consentRejectBtn" style="flex: 1; padding: 11px 16px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer;">
                    ❌ Reject
                </button>
                <button id="consentAcceptBtn" style="flex: 2; padding: 11px 16px; background: linear-gradient(135deg, #10b981, #059669); border: none; color: #ffffff; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
                    ✅ Accept &amp; Authorize Cart
                </button>
            </div>
        </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- X-402 PAYMENT REQUIRED CHALLENGE MODAL (Port 6003)                   -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div id="x402Modal" class="modal-overlay">
        <div class="consent-modal-card" style="border-color: rgba(245, 158, 11, 0.6); box-shadow: 0 0 45px rgba(245, 158, 11, 0.25);">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                <div>
                    <div style="font-size: 1.1rem; font-weight: 800; color: #fbbf24; display: flex; align-items: center; gap: 8px;">
                        🛡️ HTTP 402 PAYMENT REQUIRED
                    </div>
                    <div style="font-size: 0.76rem; color: #9ca3af; margin-top: 2px;">
                        X-402 Autonomous Payment Challenge Issued by Gateway
                    </div>
                </div>
                <span id="x402CloseBtn" style="color: #6b7280; font-size: 1.2rem; cursor: pointer;">&times;</span>
            </div>

            <!-- Challenge Details Card -->
            <div style="background: rgba(0,0,0,0.5); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; font-family: monospace;">
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #9ca3af;">Protocol Status:</span>
                    <span style="color: #fbbf24; font-weight: 700;">HTTP 402 Payment Required</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #9ca3af;">Order Ref:</span>
                    <span id="x402OrderRef" style="color: #38bdf8; font-weight: 600;">order_ref_...</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #9ca3af;">Amount Due:</span>
                    <span id="x402Amount" style="color: #34d399; font-weight: 700; font-size: 0.95rem;">₹1299 INR</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #9ca3af;">Challenge Nonce:</span>
                    <span id="x402Nonce" style="color: #e5e7eb; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">1c16ad41...</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #9ca3af;">Razorpay Order ID:</span>
                    <span id="x402RzpOrderId" style="color: #a5b4fc;">order_rzp_...</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #9ca3af;">Settlement Rail:</span>
                    <span style="color: #38bdf8;">Razorpay (Test Mode)</span>
                </div>
            </div>

            <!-- Notice -->
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 10px 12px; font-size: 0.78rem; color: #fde68a; line-height: 1.45;">
                ℹ️ <strong>X-402 Challenge Active:</strong> No funds have been deducted yet. The merchant requires a cryptographically signed settlement proof (Razorpay Test Mode signature) to finalize this transaction.
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                <div style="display: flex; gap: 8px;">
                    <button id="x402CheckoutUiBtn" style="flex: 1.2; padding: 11px 16px; background: linear-gradient(135deg, #6366f1, #4f46e5); border: none; color: #ffffff; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35); display: flex; align-items: center; justify-content: center; gap: 6px;">
                        💳 Pay with Razorpay UI
                    </button>
                    <button id="x402SettleBtn" style="flex: 1; padding: 11px 16px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: #ffffff; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);">
                        ⚡ 1-Click Settle
                    </button>
                </div>
                <button id="x402DismissBtn" style="width: 100%; padding: 8px 14px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); color: #9ca3af; border-radius: 8px; font-weight: 500; font-size: 0.8rem; cursor: pointer;">
                    🔍 Keep Unsettled (Protocol Inspection)
                </button>
            </div>
        </div>
    </div>

    <!-- OTP Modal (HITL) -->
    <div id="otpModal" class="modal-overlay">
        <div class="modal-card">
            <div style="font-size: 1.3rem; font-weight: 700; margin-bottom: 8px;">🔑 OTP / 2FA Verification</div>
            <div id="otpModalDesc" style="color: #9ca3af; font-size: 0.82rem; margin-bottom: 16px;">Please enter the verification code to proceed.</div>
            <input id="otpModalInput" type="text" placeholder="Enter OTP code..." style="width: 100%; padding: 10px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(99,102,241,0.4); border-radius: 8px; color: #fff; font-size: 1rem; outline: none; margin-bottom: 16px;">
            <div style="display: flex; gap: 10px;">
                <button id="otpModalCancel" style="flex: 1; padding: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #9ca3af; cursor: pointer;">Cancel</button>
                <button id="otpModalSubmit" style="flex: 2; padding: 10px; background: var(--accent-primary-gradient); border: none; border-radius: 8px; color: #fff; font-weight: 700; cursor: pointer;">Submit OTP</button>
            </div>
        </div>
    </div>

    <!-- Option Select Modal (HITL) -->
    <div id="optionModal" class="modal-overlay">
        <div class="modal-card">
            <div style="font-size: 1.3rem; font-weight: 700; margin-bottom: 8px;">📝 Select Option</div>
            <div id="optionModalDesc" style="color: #9ca3af; font-size: 0.82rem; margin-bottom: 16px;">Select one of the options below:</div>
            <div id="optionModalList" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;"></div>
            <button id="optionModalCancel" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #9ca3af; cursor: pointer;">Cancel</button>
        </div>
    </div>

    <!-- Success Modal -->
    <div id="successModal" class="modal-overlay">
        <div class="modal-card" style="text-align: center; max-width: 480px;">
            <div style="font-size: 2.8rem; margin-bottom: 10px;">🎉</div>
            <div id="successModalTitle" style="color: #38bdf8; font-size: 1.15rem; font-weight: 700; margin-bottom: 6px;">Order &amp; Mandate Complete!</div>
            <div id="successModalMsg" style="color: #e5e7eb; font-size: 0.88rem; line-height: 1.5; margin-bottom: 18px;">Payment details and settlement receipt will appear here.</div>
            <button id="successModalClose" style="padding: 9px 24px; background: var(--accent-primary-gradient); border: none; border-radius: 8px; color: #fff; font-weight: 700; cursor: pointer;">Close</button>
        </div>
    </div>

    <script>
        const smartQueryInput = document.getElementById('smartQueryInput');
        const executeBtn = document.getElementById('executeBtn');
        const classifyOnlyBtn = document.getElementById('classifyOnlyBtn');
        const modeBadge = document.getElementById('modeBadge');
        const modeDot = document.getElementById('modeDot');
        const modeText = document.getElementById('modeText');
        const chatBox = document.getElementById('chatBox');
        const automationLogs = document.getElementById('automationLogs');
        const tabsListContainer = document.getElementById('tabsListContainer');
        const refreshTabsBtn = document.getElementById('refreshTabsBtn');
        const mandatesListContainer = document.getElementById('mandatesListContainer');
        const refreshMandatesBtn = document.getElementById('refreshMandatesBtn');

        let currentEventSource = null;
        let currentSessionId = null;

        function setQuery(text) {
            smartQueryInput.value = text;
            smartQueryInput.focus();
        }

        function log(msg, type = 'info') {
            const time = new Date().toLocaleTimeString();
            const prefix = type === 'error' ? '❌' : (type === 'success' ? '✅' : 'ℹ️');
            automationLogs.value += '[' + time + '] ' + prefix + ' ' + msg + '\\n';
            automationLogs.scrollTop = automationLogs.scrollHeight;
        }

        function updateModeBadge(mode, status) {
            modeBadge.className = 'mode-indicator';
            if (status === 'classifying') {
                modeBadge.classList.add('classifying');
                modeDot.style.background = '#818cf8';
                modeText.textContent = 'CLASSIFYING INTENT...';
            } else if (mode === 'ORCHESTRATION') {
                modeBadge.classList.add('orch');
                modeDot.style.background = '#f59e0b';
                modeText.textContent = '🔮 ORCHESTRATION MODE';
            } else if (mode === 'AUTO_NAVIGATION') {
                modeBadge.classList.add('autonav');
                modeDot.style.background = '#06b6d4';
                modeText.textContent = '🧭 AUTO NAVIGATION MODE';
            } else {
                modeDot.style.background = '#6b7280';
                modeText.textContent = 'STANDBY';
            }
        }

        function addChatMessage(role, text, routingMode = null) {
            const msgEl = document.createElement('div');
            msgEl.className = 'chat-msg ' + role;
            msgEl.textContent = (role === 'user' ? '🧑 ' : '🤖 ') + text;
            chatBox.appendChild(msgEl);

            if (routingMode) {
                const chip = document.createElement('div');
                chip.className = 'chat-msg routing ' + (routingMode === 'ORCHESTRATION' ? 'orch' : 'autonav');
                chip.textContent = routingMode === 'ORCHESTRATION' ? '🔮 ROUTED TO ORCHESTRATION' : '🧭 ROUTED TO AUTO-NAVIGATION';
                chatBox.appendChild(chip);
            }

            chatBox.scrollTop = chatBox.scrollHeight;
        }

        // ── Classify Only Handler ──
        classifyOnlyBtn.addEventListener('click', async () => {
            const query = smartQueryInput.value.trim();
            if (!query) return;

            updateModeBadge(null, 'classifying');
            log('Classifying query: "' + query + '"...', 'info');

            try {
                const res = await fetch('/api/classify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                const data = await res.json();
                updateModeBadge(data.inbox);
                log('Result: ' + data.inbox + ' (Confidence: ' + data.confidence + ')', 'success');
                addChatMessage('user', query);
                addChatMessage('assistant', 'Intent classified as ' + data.inbox + ' (' + data.confidence + ' confidence).', data.inbox);
            } catch (err) {
                log('Classification error: ' + err.message, 'error');
                updateModeBadge(null);
            }
        });

        // ── Execute Query via SSE Stream ──
        executeBtn.addEventListener('click', () => {
            const query = smartQueryInput.value.trim();
            if (!query) return;
            executeCommand(query);
        });

        smartQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = smartQueryInput.value.trim();
                if (!query) return;
                executeCommand(query);
            }
        });

        function executeCommand(query) {
            if (currentEventSource) {
                currentEventSource.close();
                currentEventSource = null;
            }

            executeBtn.disabled = true;
            classifyOnlyBtn.disabled = true;
            executeBtn.innerHTML = '⏳ Executing...';
            updateModeBadge(null, 'classifying');

            addChatMessage('user', query);
            log('Starting Smart Router execution for: "' + query + '"', 'info');

            currentSessionId = Date.now().toString();
            const sseUrl = '/api/voice-route/stream?query=' + encodeURIComponent(query) + '&sessionId=' + currentSessionId;
            const es = new EventSource(sseUrl);
            currentEventSource = es;

            es.addEventListener('classified', (e) => {
                const d = JSON.parse(e.data);
                updateModeBadge(d.inbox);
                log('Classified as: ' + d.inbox + ' (' + d.confidence + ')', 'info');
                addChatMessage('assistant', 'Routing query to ' + (d.inbox === 'ORCHESTRATION' ? 'Orchestration Mode' : 'Auto-Navigation Mode') + '...', d.inbox);
            });

            es.addEventListener('log', (e) => {
                const d = JSON.parse(e.data);
                log(d.message, d.type || 'info');
            });

            es.addEventListener('step', (e) => {
                const d = JSON.parse(e.data);
                const detail = d.action ? JSON.stringify(d.action) : (d.error || d.reason || d.status);
                log('Step ' + d.step + ': ' + d.status + ' -> ' + detail, d.success !== false ? 'success' : 'error');
            });

            // ── Cart Consent / Trusted Surface Popup (Port 6003) ──
            es.addEventListener('cart_consent_prompt', async (e) => {
                const d = JSON.parse(e.data);
                log('[HITL] 🛡️ Trusted Consent Surface opened for: "' + (d.product?.name || 'Item') + '" (₹' + (d.product?.price || '') + ')', 'info');
                const approved = await showCartConsentModal(d.product, d.cart, d.sessionId);
                log('[HITL] User ' + (approved ? 'APPROVED' : 'REJECTED') + ' Cart Authorization.', approved ? 'success' : 'error');
                await sendHitlResponse(d.sessionId, { approved, cart: d.cart });
            });

            es.addEventListener('otp_prompt', async (e) => {
                const d = JSON.parse(e.data);
                log('[HITL] OTP verification code requested.', 'info');
                const val = await showOtpModal('OTP required for: "' + (d.name || '') + '"', d.sessionId);
                await sendHitlResponse(d.sessionId, val || '');
            });

            es.addEventListener('human_prompt', async (e) => {
                const d = JSON.parse(e.data);
                log('[HITL] User input requested.', 'info');
                const val = await showOtpModal('Input required for: "' + (d.name || '') + '"', d.sessionId);
                await sendHitlResponse(d.sessionId, val || '');
            });

            es.addEventListener('option_select_prompt', async (e) => {
                const d = JSON.parse(e.data);
                log('[HITL] Option selection required.', 'info');
                const idx = await showOptionModal(d.options || [], d.sessionId);
                await sendHitlResponse(d.sessionId, idx);
            });

            // ── X-402 Challenge Prompt (Port 6003) ──
            es.addEventListener('x402_challenge', async (e) => {
                const d = JSON.parse(e.data);
                log('[X-402] 🛡️ HTTP 402 Payment Required Challenge received from Gateway!', 'info');
                log('[X-402] Order Ref: ' + (d.challenge?.order_ref || '') + ' | Nonce: ' + (d.challenge?.nonce || ''), 'info');
                showX402Modal(d.challenge, d.cartMandate, d.paymentMandate);
            });

            es.addEventListener('done', (e) => {
                const d = JSON.parse(e.data);
                es.close();
                currentEventSource = null;
                executeBtn.disabled = false;
                classifyOnlyBtn.disabled = false;
                executeBtn.innerHTML = '🚀 Execute';
                log('Execution finished! (' + (d.result?.status || d.inbox) + ')', 'success');

                if (d.response) {
                    addChatMessage('assistant', d.response);
                }

                if (d.inbox === 'AUTO_NAVIGATION' && (d.result?.status === 'completed' || d.result?.success)) {
                    showSuccessModal(d.response || 'Purchase completed successfully! Mandate ready.');
                }

                loadActiveTabs();
                loadMandatesList();
                smartQueryInput.value = '';
            });

            es.addEventListener('error', (e) => {
                let msg = 'Execution stream error';
                try { const d = JSON.parse(e.data); msg = d.error || msg; } catch(_) {}
                log(msg, 'error');
                es.close();
                currentEventSource = null;
                executeBtn.disabled = false;
                classifyOnlyBtn.disabled = false;
                executeBtn.innerHTML = '🚀 Execute';
                updateModeBadge(null);
            });

            es.onerror = () => {
                if (es.readyState === EventSource.CLOSED) {
                    executeBtn.disabled = false;
                    classifyOnlyBtn.disabled = false;
                    executeBtn.innerHTML = '🚀 Execute';
                }
            };
        }

        // ── Active Tabs ──
        async function loadActiveTabs() {
            try {
                const res = await fetch('/api/list-tabs', { method: 'POST' });
                const data = await res.json();
                tabsListContainer.innerHTML = '';

                if (data.success && Array.isArray(data.tabs) && data.tabs.length > 0) {
                    data.tabs.forEach(t => {
                        const div = document.createElement('div');
                        div.className = 'tab-item ' + (t.isActive ? 'active' : '');
                        div.innerHTML = '<div class="tab-title">' + (t.title || 'Untitled Tab') + '</div><div class="tab-url">' + (t.url || '') + '</div>';
                        div.onclick = async () => {
                            await fetch('/api/switch-tab', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tabIndex: t.index })
                            });
                            loadActiveTabs();
                        };
                        tabsListContainer.appendChild(div);
                    });
                } else {
                    tabsListContainer.innerHTML = '<div style="color:#6b7280; font-size:0.75rem; text-align:center; padding:10px;">No open tabs</div>';
                }
            } catch (err) {
                tabsListContainer.innerHTML = '<div style="color:#ef4444; font-size:0.75rem; text-align:center; padding:10px;">Failed to load tabs</div>';
            }
        }
        refreshTabsBtn.addEventListener('click', loadActiveTabs);
        loadActiveTabs();

        // ── Mandates Database List ──
        async function loadMandatesList() {
            try {
                const res = await fetch('/api/mandates');
                const list = await res.json();
                mandatesListContainer.innerHTML = '';

                if (Array.isArray(list) && list.length > 0) {
                    list.forEach(m => {
                        const div = document.createElement('div');
                        div.className = 'mandate-item';
                        const typeLower = (m.type || '').toLowerCase();
                        const badgeClass = typeLower.includes('payment') ? 'payment' : (typeLower.includes('intent') ? 'intent' : 'cart');
                        div.innerHTML = 
                            '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                                '<span class="mandate-badge ' + badgeClass + '">' + (m.type || 'Mandate') + '</span>' +
                                '<span style="font-size:0.75rem; color:#34d399; font-weight:700;">₹' + (m.amount || '') + ' ' + (m.currency || '') + '</span>' +
                            '</div>' +
                            '<div style="font-size:0.8rem; font-weight:600; color:#ffffff; margin-top:2px;">' + (m.item || 'General Product') + '</div>' +
                            '<div style="font-size:0.68rem; color:#9ca3af; font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + (m.filename || '') + '</div>';
                        mandatesListContainer.appendChild(div);
                    });
                } else {
                    mandatesListContainer.innerHTML = '<div style="color:#6b7280; font-size:0.78rem; text-align:center; padding:10px;">No mandates created yet.</div>';
                }
            } catch (err) {
                mandatesListContainer.innerHTML = '<div style="color:#ef4444; font-size:0.78rem; text-align:center; padding:10px;">Failed to load mandates database.</div>';
            }
        }
        refreshMandatesBtn.addEventListener('click', loadMandatesList);
        loadMandatesList();

        // ── Trusted Consent Surface Modal Logic (Port 6003) ──
        function showCartConsentModal(product, cart, sessionId) {
            return new Promise((resolve) => {
                const modal = document.getElementById('cartConsentModal');
                const img = document.getElementById('consentProductImg');
                const name = document.getElementById('consentProductName');
                const sku = document.getElementById('consentProductSku');
                const merchant = document.getElementById('consentMerchantName');
                const price = document.getElementById('consentProductPrice');
                const acceptBtn = document.getElementById('consentAcceptBtn');
                const rejectBtn = document.getElementById('consentRejectBtn');
                const closeBtn = document.getElementById('consentCloseBtn');

                img.src = product.image || 'http://localhost:5173/images/green_sneaker.png';
                name.textContent = product.name || 'Product';
                sku.textContent = 'SKU: ' + (product.id || 'sku_001') + ' • ' + (product.category || 'General');
                merchant.textContent = 'Merchant: ' + (product.merchantName || 'Razorpay ACP Store');
                price.textContent = '₹' + (product.price || cart?.totalAmount || '0') + ' ' + (product.currency || 'INR');

                modal.style.display = 'flex';

                function cleanup() {
                    modal.style.display = 'none';
                    acceptBtn.onclick = null;
                    rejectBtn.onclick = null;
                    closeBtn.onclick = null;
                }

                acceptBtn.onclick = () => {
                    cleanup();
                    resolve(true);
                };
                rejectBtn.onclick = () => {
                    cleanup();
                    resolve(false);
                };
                closeBtn.onclick = () => {
                    cleanup();
                    resolve(false);
                };
            });
        }

        // ── HITL Modals ──
        function showOtpModal(desc, sessionId) {
            return new Promise((resolve) => {
                const modal = document.getElementById('otpModal');
                const descEl = document.getElementById('otpModalDesc');
                const input = document.getElementById('otpModalInput');
                const submit = document.getElementById('otpModalSubmit');
                const cancel = document.getElementById('otpModalCancel');

                descEl.textContent = desc;
                input.value = '';
                modal.style.display = 'flex';
                input.focus();

                function cleanup() {
                    modal.style.display = 'none';
                    submit.onclick = null;
                    cancel.onclick = null;
                }

                submit.onclick = () => {
                    const val = input.value.trim();
                    cleanup();
                    resolve(val);
                };
                cancel.onclick = () => {
                    cleanup();
                    resolve(null);
                };
            });
        }

        function showOptionModal(options, sessionId) {
            return new Promise((resolve) => {
                const modal = document.getElementById('optionModal');
                const list = document.getElementById('optionModalList');
                const cancel = document.getElementById('optionModalCancel');

                list.innerHTML = '';
                options.forEach((opt, idx) => {
                    const btn = document.createElement('button');
                    btn.style.cssText = 'padding:10px; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); border-radius:8px; color:#fff; cursor:pointer; text-align:left; font-size:0.85rem; font-weight:600;';
                    btn.textContent = (idx + 1) + '. ' + (opt.label || opt.text || opt.name || opt);
                    btn.onclick = () => {
                        modal.style.display = 'none';
                        resolve(opt.index !== undefined ? opt.index : idx);
                    };
                    list.appendChild(btn);
                });

                modal.style.display = 'flex';
                cancel.onclick = () => {
                    modal.style.display = 'none';
                    resolve(null);
                };
            });
        }

        async function sendHitlResponse(sessionId, value) {
            await fetch('/api/voice-autonavigate/hitl-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, value })
            });
        }

        // ── X-402 Challenge Modal Logic (Port 6003) ──
        function showX402Modal(challenge, cartMandate, paymentMandate) {
            const modal = document.getElementById('x402Modal');
            const orderRefEl = document.getElementById('x402OrderRef');
            const amountEl = document.getElementById('x402Amount');
            const nonceEl = document.getElementById('x402Nonce');
            const rzpOrderEl = document.getElementById('x402RzpOrderId');
            const checkoutUiBtn = document.getElementById('x402CheckoutUiBtn');
            const settleBtn = document.getElementById('x402SettleBtn');
            const dismissBtn = document.getElementById('x402DismissBtn');
            const closeBtn = document.getElementById('x402CloseBtn');

            orderRefEl.textContent = challenge?.order_ref || 'order_ref_pending';
            amountEl.textContent = '₹' + (challenge?.amount || '1299') + ' ' + (challenge?.currency || 'INR');
            nonceEl.textContent = challenge?.nonce || 'nonce_active';
            rzpOrderEl.textContent = challenge?.razorpay_order_id || 'order_rzp_mock';

            modal.style.display = 'flex';

            function cleanup() {
                modal.style.display = 'none';
                if (checkoutUiBtn) checkoutUiBtn.onclick = null;
                settleBtn.onclick = null;
                dismissBtn.onclick = null;
                closeBtn.onclick = null;
            }

            dismissBtn.onclick = () => {
                cleanup();
                log('[X-402] User kept challenge in unsettled status for protocol inspection.', 'info');
            };
            closeBtn.onclick = () => {
                cleanup();
            };

            // Option 1: Official Razorpay Standard Checkout UI Modal
            if (checkoutUiBtn) {
                checkoutUiBtn.onclick = () => {
                    if (typeof Razorpay === 'undefined') {
                        alert('Razorpay Checkout SDK is still loading. Please try again in 2 seconds.');
                        return;
                    }

                    log('[Razorpay Checkout] 🚀 Opening official Razorpay payment modal for Order: ' + challenge.razorpay_order_id, 'info');

                    const options = {
                        key: challenge.razorpay_key_id || 'rzp_test_TX3JklSxdGOmx0',
                        amount: Number(challenge.amount) * 100,
                        currency: challenge.currency || 'INR',
                        name: 'Razorpay ACP Store',
                        description: 'AP2 / X-402 Mandate Settlement',
                        image: 'http://localhost:5173/images/green_sneaker.png',
                        order_id: challenge.razorpay_order_id,
                        handler: async function(response) {
                            log('[Razorpay Checkout] ✅ Payment captured on Razorpay! Payment ID: ' + response.razorpay_payment_id, 'success');
                            log('[Razorpay Checkout] 🔐 Submitting signature proof to X-402 Gateway...', 'info');

                            try {
                                const res = await fetch('/api/x402-settle-signature', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        order_ref: challenge.order_ref,
                                        razorpay_order_id: response.razorpay_order_id,
                                        razorpay_payment_id: response.razorpay_payment_id,
                                        razorpay_signature: response.razorpay_signature,
                                        cartMandate: cartMandate,
                                        paymentMandate: paymentMandate
                                    })
                                });
                                const receipt = await res.json();
                                cleanup();

                                if (receipt.success && receipt.status === 'confirmed') {
                                    log('[X-402] 🏆 Settlement 100% CONFIRMED by Gateway! Payment ID: ' + receipt.payment_id, 'success');
                                    showSuccessModal(
                                        '🎉 Payment Settlement Successful!',
                                        '<div style="text-align:left; background:rgba(0,0,0,0.5); padding:12px; border-radius:10px; font-family:monospace; font-size:0.8rem; display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">' +
                                        '<div><strong style="color:#a5b4fc;">Status:</strong> <span style="color:#34d399;">HTTP 200 OK (CONFIRMED)</span></div>' +
                                        '<div><strong style="color:#a5b4fc;">Order Ref:</strong> ' + receipt.order_ref + '</div>' +
                                        '<div><strong style="color:#a5b4fc;">Razorpay Order ID:</strong> ' + response.razorpay_order_id + '</div>' +
                                        '<div><strong style="color:#a5b4fc;">Razorpay Payment ID:</strong> <span style="color:#fbbf24;">' + receipt.payment_id + '</span></div>' +
                                        '<div><strong style="color:#a5b4fc;">Amount Paid:</strong> ₹' + receipt.amount + ' ' + receipt.currency + '</div>' +
                                        '<div><strong style="color:#a5b4fc;">Settlement Rail:</strong> Razorpay (Test Mode Live)</div>' +
                                        '</div>' +
                                        '<div style="color:#c7d2fe; font-size:0.82rem;">AP2 Mandate Chain cryptographically verified and captured on gateway.</div>'
                                    );
                                } else {
                                    alert('Settlement failed: ' + (receipt.error || 'Unknown error'));
                                }
                            } catch (err) {
                                log('[Razorpay Checkout] Error: ' + err.message, 'error');
                            }
                        },
                        prefill: {
                            name: 'Agent Test User',
                            email: 'agent.user@example.com',
                            contact: '9999999999'
                        },
                        theme: {
                            color: '#6366f1'
                        }
                    };

                    const rzp = new Razorpay(options);
                    rzp.open();
                };
            }

            // Option 2: 1-Click Auto Settle (Agent Simulation)
            settleBtn.onclick = async () => {
                settleBtn.disabled = true;
                settleBtn.innerHTML = '⏳ Settling with Razorpay Test Mode...';
                log('[X-402] Sending Payment-Signature settlement request to Gateway...', 'info');

                try {
                    const res = await fetch('/api/x402-settle', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            order_ref: challenge.order_ref,
                            razorpay_order_id: challenge.razorpay_order_id,
                            cartMandate: cartMandate,
                            paymentMandate: paymentMandate
                        })
                    });
                    const receipt = await res.json();
                    cleanup();

                    if (receipt.success && receipt.status === 'confirmed') {
                        log('[X-402] ✅ Settlement CONFIRMED! Payment ID: ' + receipt.payment_id, 'success');
                        showSuccessModal(
                            '🎉 Payment Settlement Successful!',
                            '<div style="text-align:left; background:rgba(0,0,0,0.5); padding:12px; border-radius:10px; font-family:monospace; font-size:0.8rem; display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">' +
                            '<div><strong style="color:#a5b4fc;">Status:</strong> <span style="color:#34d399;">HTTP 200 OK (CONFIRMED)</span></div>' +
                            '<div><strong style="color:#a5b4fc;">Order Ref:</strong> ' + receipt.order_ref + '</div>' +
                            '<div><strong style="color:#a5b4fc;">Razorpay Order ID:</strong> ' + challenge.razorpay_order_id + '</div>' +
                            '<div><strong style="color:#a5b4fc;">Payment ID:</strong> <span style="color:#fbbf24;">' + receipt.payment_id + '</span></div>' +
                            '<div><strong style="color:#a5b4fc;">Amount Paid:</strong> ₹' + receipt.amount + ' ' + receipt.currency + '</div>' +
                            '<div><strong style="color:#a5b4fc;">Settlement Rail:</strong> Razorpay (Test Mode)</div>' +
                            '</div>' +
                            '<div style="color:#c7d2fe; font-size:0.82rem;">AP2 Mandate Chain cryptographically verified and captured on gateway.</div>'
                        );
                    } else {
                        log('[X-402] ❌ Settlement failed: ' + (receipt.error || 'Unknown error'), 'error');
                        alert('Settlement failed: ' + (receipt.error || 'Unknown'));
                    }
                } catch (err) {
                    cleanup();
                    log('[X-402] ❌ Settlement network error: ' + err.message, 'error');
                }
            };
        }

        function showSuccessModal(title, msgHtml) {
            const modal = document.getElementById('successModal');
            document.getElementById('successModalTitle').innerHTML = title || 'Task Completed!';
            document.getElementById('successModalMsg').innerHTML = msgHtml || 'Operation finished.';
            modal.style.display = 'flex';
            document.getElementById('successModalClose').onclick = () => {
                modal.style.display = 'none';
            };
        }
    </script>
</body>
</html>`);
});

// Endpoint: List All Generated Mandates in Database
app.get('/api/mandates', (req, res) => {
  try {
    const list = getAllStoredMandates();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Classify Query (no execution)
app.post('/api/classify', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  try {
    const { inbox, confidence } = await classifyQuery(query, true);
    res.json({ success: true, query, inbox, confidence });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Direct Route Query (JSON response)
app.post('/api/route', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  try {
    const result = await routeQuery(query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// HITL state: pending promise resolvers keyed by session ID
const hitlPending = new Map();

// Endpoint: Real-time SSE Router Stream (Classifies + Streams Execution)
app.get('/api/voice-route/stream', async (req, res) => {
  const query = req.query.query;
  const sessionId = req.query.sessionId || Date.now().toString();
  const useLLM = req.query.useLLM !== 'false';

  if (!query) {
    return res.status(400).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  function sendEvent(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  console.log(`[Smart Router] SSE route started. Session: ${sessionId}, Query: "${query}"`);
  sendEvent('log', { message: `Classifying command: "${query}"`, type: 'info' });

  let inbox;
  try {
    const { inbox: classified, confidence } = await classifyQuery(query, useLLM);
    inbox = classified;
    sendEvent('classified', { inbox, confidence, query });
    console.log(`[Smart Router] SSE classified: ${inbox} (${confidence})`);
  } catch (err) {
    inbox = INBOX.ORCHESTRATION;
    sendEvent('classified', { inbox, confidence: 'default', query });
  }

  const hitlCallbacks = {
    onCartConsentPrompt: (cartPayload) => new Promise((resolve) => {
      console.log(`[Smart Router HITL] Cart consent requested on localhost:6003 for: ${cartPayload.product?.name}`);
      sendEvent('cart_consent_prompt', { ...cartPayload, sessionId });
      hitlPending.set(sessionId + '_hitl', resolve);
    }),
    onOtpPrompt: (action) => new Promise((resolve) => {
      sendEvent('otp_prompt', { index: action.index, name: action.name, sessionId });
      hitlPending.set(sessionId + '_hitl', resolve);
    }),
    onHumanPrompt: (action) => new Promise((resolve) => {
      sendEvent('human_prompt', { index: action.index, name: action.name, sessionId });
      hitlPending.set(sessionId + '_hitl', resolve);
    }),
    onOptionSelect: (action) => new Promise((resolve) => {
      sendEvent('option_select_prompt', { index: action.index, options: action.options, sessionId });
      hitlPending.set(sessionId + '_hitl', resolve);
    }),
    onX402Challenge: (payload) => new Promise((resolve) => {
      console.log(`[Smart Router HITL] Broadcasting X-402 Challenge on port 6003 for session ${sessionId}`);
      sendEvent('x402_challenge', { ...payload, sessionId });
      resolve(true);
    }),
  };

  try {
    const { result } = await routeQuery(query, {
      useLLM: false,
      hitlCallbacks,
      onStepLog: (logEntry) => sendEvent('step', logEntry),
    });

    let llmResponse = "";
    try {
      if (result && (result.status === 'completed' || result.success)) {
        const confirmPrompt = `The user asked to perform: "${query}". This action was completed successfully. Write a 1-sentence natural confirmation response back to the user letting them know it's done. Keep it under 15 words.`;
        llmResponse = await getLlmResponse(confirmPrompt);
      } else {
        const failPrompt = `The user asked to perform: "${query}". This action stopped with reason: "${result?.reason || result?.error || 'rejected'}". Write a 1-sentence natural response back to the user explaining that it stopped. Keep it under 15 words.`;
        llmResponse = await getLlmResponse(failPrompt);
      }
    } catch (llmErr) {
      console.error('[Smart Router] LLM confirmation error:', llmErr.message);
    }

    sendEvent('done', { inbox, query, result, response: llmResponse });
  } catch (err) {
    console.error('[Smart Router] SSE route error:', err.message);
    sendEvent('error', { error: err.message });
  } finally {
    hitlPending.delete(sessionId + '_hitl');
    res.end();
  }
});

// Endpoint: Orchestrate Direct
app.post('/api/voice-orchestrate', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }
  
  try {
    const result = await runOrchestrator(query);
    let llmResponse = "";
    try {
      if (result.success) {
        const confirmPrompt = `The user asked to: "${query}". This action was executed successfully. Write a 1-sentence natural confirmation response back to the user. Keep it under 15 words.`;
        llmResponse = await getLlmResponse(confirmPrompt);
      }
    } catch (_) {}
    res.json({ ...result, response: llmResponse });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Auto-Navigate Direct
app.post('/api/voice-autonavigate', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }
  try {
    const result = await runAutoNavigationLoop(query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Proxy list-tabs to backend
app.post('/api/list-tabs', async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/list-tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Proxy switch-tab to backend
app.post('/api/switch-tab', async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/switch-tab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Receive HITL response (supports boolean, object, or string)
app.post('/api/voice-autonavigate/hitl-response', (req, res) => {
  const { sessionId, value } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId required' });

  const resolve = hitlPending.get(sessionId + '_hitl');
  if (resolve) {
    hitlPending.delete(sessionId + '_hitl');
    resolve(value);
    console.log(`[Smart Router HITL] Received response for session ${sessionId}:`, typeof value === 'object' ? JSON.stringify(value) : value);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'No pending HITL for this session' });
  }
});

// Endpoint: Execute Razorpay Test Settlement for an X-402 Challenge
app.post('/api/x402-settle', async (req, res) => {
  try {
    const { order_ref, razorpay_order_id, cartMandate, paymentMandate } = req.body;
    if (!order_ref || !razorpay_order_id) {
      return res.status(400).json({ success: false, error: 'order_ref and razorpay_order_id are required' });
    }

    console.log(`[Smart Router] Settling X-402 Challenge for order: ${order_ref}...`);

    // 1. Simulate user completing Razorpay payment and obtaining HMAC signature
    const simRes = await fetch('http://localhost:6004/api/simulate-razorpay-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id })
    });
    const paymentProof = await simRes.json();

    // 2. Submit Payment-Signature to finalize settlement on X-402 Gateway
    const paymentSigHeader = {
      order_ref: order_ref,
      razorpay_order_id: paymentProof.razorpay_order_id,
      razorpay_payment_id: paymentProof.razorpay_payment_id,
      razorpay_signature: paymentProof.razorpay_signature
    };

    const settleRes = await fetch('http://localhost:6004/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cart-Mandate': Buffer.from(JSON.stringify(cartMandate)).toString('base64'),
        'Payment-Mandate': Buffer.from(JSON.stringify(paymentMandate)).toString('base64'),
        'Payment-Signature': Buffer.from(JSON.stringify(paymentSigHeader)).toString('base64')
      }
    });

    const receipt = await settleRes.json();
    console.log(`[Smart Router] Settlement completed! Gateway Status: ${settleRes.status}`);
    res.status(settleRes.status).json(receipt);
  } catch (err) {
    console.error('[Smart Router] Settlement error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Settle X-402 with genuine Razorpay Checkout Signature
app.post('/api/x402-settle-signature', async (req, res) => {
  try {
    const { order_ref, razorpay_order_id, razorpay_payment_id, razorpay_signature, cartMandate, paymentMandate } = req.body;
    if (!order_ref || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'order_ref, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required' });
    }

    console.log(`[Smart Router] Settling X-402 with live Razorpay signature for order: ${order_ref}...`);

    const paymentSigHeader = {
      order_ref: order_ref,
      razorpay_order_id: razorpay_order_id,
      razorpay_payment_id: razorpay_payment_id,
      razorpay_signature: razorpay_signature
    };

    const settleRes = await fetch('http://localhost:6004/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cart-Mandate': Buffer.from(JSON.stringify(cartMandate)).toString('base64'),
        'Payment-Mandate': Buffer.from(JSON.stringify(paymentMandate)).toString('base64'),
        'Payment-Signature': Buffer.from(JSON.stringify(paymentSigHeader)).toString('base64')
      }
    });

    const receipt = await settleRes.json();
    console.log(`[Smart Router] Live Razorpay Settlement Status: ${settleRes.status}`);
    res.status(settleRes.status).json(receipt);
  } catch (err) {
    console.error('[Smart Router] Settle signature error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Smart Query Router Dashboard running at http://localhost:${PORT}`);
});

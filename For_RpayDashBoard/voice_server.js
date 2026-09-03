const path = require('path');
module.paths.push(
  path.join(__dirname, '..', 'my-react-app', 'node_modules'),
  path.join(__dirname, '..', 'Playwright_Razorpay', 'node_modules')
);

const express = require('express');
const cors = require('cors');
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
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Tracing UI Route
app.get('/tracing', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Tracing', 'demo.html'));
});

// Root route: Modern Search-Based Smart Query Router Dashboard
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Razorpay Agentic &amp; Autonomous Commerce</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <!-- Official Razorpay Standard Checkout SDK -->
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <style>
        :root {
            --bg-primary: #f8fafc;
            --bg-card: #ffffff;
            --border-color: #e2e8f0;
            --border-glow: rgba(99, 102, 241, 0.2);
            --text-main: #0f172a;
            --text-muted: #64748b;
            --accent-orch: #d97706;
            --accent-orch-bg: #fef3c7;
            --accent-orch-border: #fcd34d;
            --accent-autonav: #0891b2;
            --accent-autonav-bg: #cffafe;
            --accent-autonav-border: #67e8f9;
            --accent-primary: #4f46e5;
            --accent-primary-gradient: linear-gradient(135deg, #4f46e5, #6366f1);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-primary);
            background-image: 
                radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.08), transparent 50%),
                radial-gradient(circle at 10% 80%, rgba(8, 145, 178, 0.05), transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(217, 119, 6, 0.05), transparent 40%);
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
            background: linear-gradient(135deg, #0f172a 30%, #4338ca 100%);
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
            background: #eef2ff;
            color: #4f46e5;
            border: 1px solid #c7d2fe;
            border-radius: 6px;
            margin-left: 8px;
            vertical-align: middle;
        }

        /* ── Search Bar Hero ── */
        .search-hero-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 18px;
            padding: 24px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
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
            height: 3px;
            background: linear-gradient(90deg, #4f46e5, #0891b2, #d97706);
            opacity: 0.9;
        }

        /* Active Mode Banner inside Hero */
        .mode-banner-row {
            display: none !important;
        }
        .router-label {
            display: none !important;
        }
        .mode-indicator {
            display: none !important;
        }

        /* Search Input Box */
        .search-input-wrapper {
            display: flex;
            align-items: center;
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-radius: 12px;
            padding: 6px 8px 6px 16px;
            gap: 12px;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.03);
            transition: all 0.25s ease;
        }
        .search-input-wrapper:focus-within {
            border-color: #4f46e5;
            background: #ffffff;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15), inset 0 1px 2px rgba(0, 0, 0, 0.03);
        }
        .search-icon {
            display: none !important;
        }
        .search-input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: #0f172a;
            font-size: 1rem;
            font-family: inherit;
            padding: 8px 4px;
        }
        .search-input::placeholder {
            color: #94a3b8;
        }
        .search-btn {
            background: var(--accent-primary-gradient);
            color: #ffffff;
            border: none;
            border-radius: 10px;
            width: 38px;
            height: 38px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);
            flex-shrink: 0;
        }
        .search-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
        }
        .search-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .classify-only-btn {
            display: none !important;
        }

        /* ── Assistant Chat / Response Box ── */
        .chat-box {
            display: none !important;
        }
        .chat-msg {
            font-size: 0.92rem;
            line-height: 1.45;
            animation: fadeIn 0.3s ease-out;
        }
        .chat-msg.user {
            color: #2563eb;
            font-weight: 600;
        }
        .chat-msg.assistant {
            color: #0f172a;
            font-weight: 500;
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
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
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
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Terminal Log Area */
        .terminal-box {
            width: 100%;
            height: 180px;
            background: #0f172a;
            border: 1px solid #1e293b;
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
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .tab-item:hover {
            background: #f1f5f9;
            border-color: #c7d2fe;
        }
        .tab-item.active {
            background: #eef2ff;
            border-color: #6366f1;
        }
        .tab-title {
            font-size: 0.8rem;
            font-weight: 600;
            color: #0f172a;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .tab-url {
            font-size: 0.7rem;
            color: #64748b;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-top: 2px;
        }

        /* Mandate Item in DB Card */
        .mandate-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
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
            background: #eef2ff;
            color: #4338ca;
            border: 1px solid #c7d2fe;
        }
        .mandate-badge.cart {
            background: #ecfdf5;
            color: #065f46;
            border: 1px solid #a7f3d0;
        }
        .mandate-badge.payment {
            background: #fffbeb;
            color: #92400e;
            border: 1px solid #fde68a;
        }

        /* Modals */
        .modal-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(8px);
            z-index: 9999;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .modal-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 28px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
            color: #0f172a;
            animation: fadeIn 0.25s ease-out;
        }

        /* Trusted Consent Modal Style */
        .consent-modal-card {
            background: #ffffff;
            border: 1.5px solid #c7d2fe;
            border-radius: 18px;
            padding: 24px;
            width: 100%;
            max-width: 460px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2);
            color: #0f172a;
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
                ⚡ Razorpay Agentic &amp; Autonomous Commerce
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
                <button id="executeBtn" class="search-btn" title="Send / Execute">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
            </div>
        </div>

        <!-- Assistant Chat & Confirmation -->
        <div class="chat-box" id="chatBox" style="display: none;"></div>

        <!-- ⚡ REAL-TIME 7-STAGE EXECUTION TRACER WIDGET -->
        <div class="card" style="margin-bottom: 20px; background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); border: 1px solid #334155;">
            <div class="card-header" style="border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 14px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.15rem;">⚡</span>
                    <span class="card-title" style="color: #f8fafc; font-weight: 700;">AP2 / X-402 Live Execution Tracer</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span id="dashTracerStatus" style="font-size: 0.72rem; padding: 2px 8px; border-radius: 12px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 600;">
                        Stage 1 of 7 (Ready)
                    </span>
                    <a href="/tracing" target="_blank" style="background: #2563eb; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                        ↗ Open Full Visualizer
                    </a>
                </div>
            </div>

            <!-- 7-Stage Horizontal Step Bar -->
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; position: relative;">
                <div id="dash-step-1" class="dash-step-item" style="background: rgba(255,255,255,0.03); border: 1px solid #334155; border-radius: 8px; padding: 8px 6px; text-align: center; transition: all 0.3s;">
                    <div class="dash-step-circle" style="width: 22px; height: 22px; border-radius: 50%; background: #1e293b; border: 1.5px solid #475569; color: #94a3b8; font-size: 0.65rem; font-weight: 700; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center;">1</div>
                    <div style="font-size: 0.68rem; font-weight: 600; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Query Asked</div>
                </div>

                <div id="dash-step-2" class="dash-step-item" style="background: rgba(255,255,255,0.03); border: 1px solid #334155; border-radius: 8px; padding: 8px 6px; text-align: center; transition: all 0.3s;">
                    <div class="dash-step-circle" style="width: 22px; height: 22px; border-radius: 50%; background: #1e293b; border: 1.5px solid #475569; color: #94a3b8; font-size: 0.65rem; font-weight: 700; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center;">2</div>
                    <div style="font-size: 0.68rem; font-weight: 600; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Discovery</div>
                </div>

                <div id="dash-step-3" class="dash-step-item" style="background: rgba(255,255,255,0.03); border: 1px solid #334155; border-radius: 8px; padding: 8px 6px; text-align: center; transition: all 0.3s;">
                    <div class="dash-step-circle" style="width: 22px; height: 22px; border-radius: 50%; background: #1e293b; border: 1.5px solid #475569; color: #94a3b8; font-size: 0.65rem; font-weight: 700; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center;">3</div>
                    <div style="font-size: 0.68rem; font-weight: 600; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Consent</div>
                </div>

                <div id="dash-step-4" class="dash-step-item" style="background: rgba(255,255,255,0.03); border: 1px solid #334155; border-radius: 8px; padding: 8px 6px; text-align: center; transition: all 0.3s;">
                    <div class="dash-step-circle" style="width: 22px; height: 22px; border-radius: 50%; background: #1e293b; border: 1.5px solid #475569; color: #94a3b8; font-size: 0.65rem; font-weight: 700; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center;">4</div>
                    <div style="font-size: 0.68rem; font-weight: 600; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">ACP Mandate</div>
                </div>

                <div id="dash-step-5" class="dash-step-item" style="background: rgba(255,255,255,0.03); border: 1px solid #334155; border-radius: 8px; padding: 8px 6px; text-align: center; transition: all 0.3s;">
                    <div class="dash-step-circle" style="width: 22px; height: 22px; border-radius: 50%; background: #1e293b; border: 1.5px solid #475569; color: #94a3b8; font-size: 0.65rem; font-weight: 700; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center;">5</div>
                    <div style="font-size: 0.68rem; font-weight: 600; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">AP2 & X-402</div>
                </div>

                <div id="dash-step-6" class="dash-step-item" style="background: rgba(255,255,255,0.03); border: 1px solid #334155; border-radius: 8px; padding: 8px 6px; text-align: center; transition: all 0.3s;">
                    <div class="dash-step-circle" style="width: 22px; height: 22px; border-radius: 50%; background: #1e293b; border: 1.5px solid #475569; color: #94a3b8; font-size: 0.65rem; font-weight: 700; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center;">6</div>
                    <div style="font-size: 0.68rem; font-weight: 600; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Razorpay</div>
                </div>

                <div id="dash-step-7" class="dash-step-item" style="background: rgba(255,255,255,0.03); border: 1px solid #334155; border-radius: 8px; padding: 8px 6px; text-align: center; transition: all 0.3s;">
                    <div class="dash-step-circle" style="width: 22px; height: 22px; border-radius: 50%; background: #1e293b; border: 1.5px solid #475569; color: #94a3b8; font-size: 0.65rem; font-weight: 700; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center;">7</div>
                    <div style="font-size: 0.68rem; font-weight: 600; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Confirmed</div>
                </div>
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
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
                <div>
                    <div style="font-size: 1.05rem; font-weight: 800; color: #4338ca; display: flex; align-items: center; gap: 8px;">
                        🛡️ TRUSTED CONSENT SURFACE
                    </div>
                    <div style="font-size: 0.76rem; color: #64748b; margin-top: 2px;">
                        Cart Assembly Review &amp; Human Authorization (AP2 Protocol)
                    </div>
                </div>
                <span id="consentCloseBtn" style="color: #94a3b8; font-size: 1.2rem; cursor: pointer;">&times;</span>
            </div>

            <!-- Assembled Product Card -->
            <div style="display: flex; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; align-items: center;">
                <img id="consentProductImg" src="" alt="Product Photo" style="width: 88px; height: 88px; object-fit: contain; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px; flex-shrink: 0;">
                <div style="display: flex; flex-direction: column; gap: 3px;">
                    <div id="consentProductName" style="font-size: 0.95rem; font-weight: 700; color: #0f172a;">Product Name</div>
                    <div id="consentProductSku" style="font-size: 0.75rem; color: #64748b;">SKU: shoe_007</div>
                    <div id="consentMerchantName" style="font-size: 0.75rem; color: #4f46e5; font-weight: 600;">Merchant: Razorpay ACP Store</div>
                    <div id="consentProductPrice" style="font-size: 1.15rem; font-weight: 800; color: #059669; margin-top: 2px;">₹1299 INR</div>
                </div>
            </div>

            <!-- Security & Protocol Notice -->
            <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 10px 12px; font-size: 0.78rem; color: #3730a3; line-height: 1.4;">
                🔒 <strong>Cart Assembly Verified:</strong> By approving, you grant explicit consent for this transaction. The cryptographic Checkout Mandate will be signed in the next step.
            </div>

            <!-- Action Buttons: Reject vs Accept -->
            <div style="display: flex; gap: 10px; margin-top: 4px;">
                <button id="consentRejectBtn" style="flex: 1; padding: 11px 16px; background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer;">
                    ❌ Reject
                </button>
                <button id="consentAcceptBtn" style="flex: 2; padding: 11px 16px; background: linear-gradient(135deg, #059669, #10b981); border: none; color: #ffffff; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
                    ✅ Accept &amp; Authorize Cart
                </button>
            </div>
        </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- X-402 PAYMENT REQUIRED CHALLENGE MODAL (Port 6003)                   -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div id="x402Modal" class="modal-overlay">
        <div class="consent-modal-card" style="border-color: #fcd34d; box-shadow: 0 20px 45px rgba(217, 119, 6, 0.15);">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
                <div>
                    <div style="font-size: 1.1rem; font-weight: 800; color: #d97706; display: flex; align-items: center; gap: 8px;">
                        🛡️ HTTP 402 PAYMENT REQUIRED
                    </div>
                    <div style="font-size: 0.76rem; color: #64748b; margin-top: 2px;">
                        X-402 Autonomous Payment Challenge Issued by Gateway
                    </div>
                </div>
                <span id="x402CloseBtn" style="color: #94a3b8; font-size: 1.2rem; cursor: pointer;">&times;</span>
            </div>

            <!-- Challenge Details Card -->
            <div style="background: #f8fafc; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; font-family: monospace;">
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #64748b;">Protocol Status:</span>
                    <span style="color: #d97706; font-weight: 700;">HTTP 402 Payment Required</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #64748b;">Order Ref:</span>
                    <span id="x402OrderRef" style="color: #2563eb; font-weight: 600;">order_ref_...</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #64748b;">Amount Due:</span>
                    <span id="x402Amount" style="color: #059669; font-weight: 700; font-size: 0.95rem;">₹1299 INR</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #64748b;">Challenge Nonce:</span>
                    <span id="x402Nonce" style="color: #334155; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">1c16ad41...</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #64748b;">Razorpay Order ID:</span>
                    <span id="x402RzpOrderId" style="color: #4f46e5;">order_rzp_...</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                    <span style="color: #64748b;">Settlement Rail:</span>
                    <span style="color: #0891b2; font-weight: 600;">Razorpay (Test Mode)</span>
                </div>
            </div>

            <!-- Notice -->
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; font-size: 0.78rem; color: #92400e; line-height: 1.45;">
                ℹ️ <strong>X-402 Challenge Active:</strong> No funds have been deducted yet. The merchant requires a cryptographically signed settlement proof (Razorpay Test Mode signature) to finalize this transaction.
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                <div style="display: flex; gap: 8px;">
                    <button id="x402CheckoutUiBtn" style="flex: 1.2; padding: 11px 16px; background: linear-gradient(135deg, #4f46e5, #6366f1); border: none; color: #ffffff; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); display: flex; align-items: center; justify-content: center; gap: 6px;">
                        💳 Pay with Razorpay UI
                    </button>
                    <button id="x402SettleBtn" style="flex: 1; padding: 11px 16px; background: linear-gradient(135deg, #d97706, #f59e0b); border: none; color: #ffffff; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.35);">
                        ⚡ 1-Click Settle
                    </button>
                </div>
                <button id="x402DismissBtn" style="width: 100%; padding: 8px 14px; background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer;">
                    🔍 Keep Unsettled (Protocol Inspection)
                </button>
            </div>
        </div>
    </div>

    <!-- OTP Modal (HITL) -->
    <div id="otpModal" class="modal-overlay">
        <div class="modal-card">
            <div style="font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-bottom: 8px;">🔑 OTP / 2FA Verification</div>
            <div id="otpModalDesc" style="color: #64748b; font-size: 0.82rem; margin-bottom: 16px;">Please enter the verification code to proceed.</div>
            <input id="otpModalInput" type="text" placeholder="Enter OTP code..." style="width: 100%; padding: 10px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-size: 1rem; outline: none; margin-bottom: 16px;">
            <div style="display: flex; gap: 10px;">
                <button id="otpModalCancel" style="flex: 1; padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; color: #64748b; cursor: pointer;">Cancel</button>
                <button id="otpModalSubmit" style="flex: 2; padding: 10px; background: var(--accent-primary-gradient); border: none; border-radius: 8px; color: #fff; font-weight: 700; cursor: pointer;">Submit OTP</button>
            </div>
        </div>
    </div>

    <!-- Option Select Modal (HITL) -->
    <div id="optionModal" class="modal-overlay">
        <div class="modal-card">
            <div style="font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-bottom: 8px;">📝 Select Option</div>
            <div id="optionModalDesc" style="color: #64748b; font-size: 0.82rem; margin-bottom: 16px;">Select one of the options below:</div>
            <div id="optionModalList" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;"></div>
            <button id="optionModalCancel" style="width: 100%; padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; color: #64748b; cursor: pointer;">Cancel</button>
        </div>
    </div>

    <!-- Success Modal -->
    <div id="successModal" class="modal-overlay">
        <div class="modal-card" style="text-align: center; max-width: 480px;">
            <div style="font-size: 2.8rem; margin-bottom: 10px;">🎉</div>
            <div id="successModalTitle" style="color: #4f46e5; font-size: 1.15rem; font-weight: 700; margin-bottom: 6px;">Order &amp; Mandate Complete!</div>
            <div id="successModalMsg" style="color: #334155; font-size: 0.88rem; line-height: 1.5; margin-bottom: 18px;">Payment details and settlement receipt will appear here.</div>
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

        const ARROW_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
        const SPINNER_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>';

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
            executeBtn.innerHTML = SPINNER_SVG;
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

            // ── Real-time Tracing Step Update ──
            es.addEventListener('tracing_step', (e) => {
                try {
                    const d = JSON.parse(e.data);
                    if (d.stage) {
                        updateDashboardTracer(d.stage, d.status, d.data, d.errorReason);
                    }
                } catch (_) {}
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
                executeBtn.innerHTML = ARROW_SVG;
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
                executeBtn.innerHTML = ARROW_SVG;
                updateModeBadge(null);
            });

            es.onerror = () => {
                if (es.readyState === EventSource.CLOSED) {
                    executeBtn.disabled = false;
                    classifyOnlyBtn.disabled = false;
                    executeBtn.innerHTML = ARROW_SVG;
                }
            };
        }

        // ── Real-time Tracer DOM Synchronization ──
        function updateDashboardTracer(stageNum, status, data, errorReason) {
            const stepEl = document.getElementById('dash-step-' + stageNum);
            const statusBadge = document.getElementById('dashTracerStatus');
            if (!stepEl) return;
            const circle = stepEl.querySelector('.dash-step-circle');

            if (status === 'completed') {
                stepEl.style.background = 'rgba(16, 185, 129, 0.12)';
                stepEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                circle.style.background = '#10b981';
                circle.style.borderColor = '#059669';
                circle.style.color = '#ffffff';
                circle.innerHTML = '✓';
            } else if (status === 'current') {
                stepEl.style.background = 'rgba(37, 99, 235, 0.15)';
                stepEl.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                circle.style.background = '#2563eb';
                circle.style.borderColor = '#60a5fa';
                circle.style.color = '#ffffff';
                circle.innerHTML = '⚙';
            } else if (status === 'failed') {
                stepEl.style.background = 'rgba(239, 68, 68, 0.15)';
                stepEl.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                circle.style.background = '#ef4444';
                circle.style.borderColor = '#dc2626';
                circle.style.color = '#ffffff';
                circle.innerHTML = '✕';
            }

            if (statusBadge) {
                if (status === 'failed') {
                    statusBadge.innerText = '⚠️ Exception at Stage ' + stageNum;
                    statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
                    statusBadge.style.color = '#ef4444';
                    statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                } else if (stageNum === 7 && status === 'completed') {
                    statusBadge.innerText = '✅ Payment Completed (7/7)';
                    statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                    statusBadge.style.color = '#10b981';
                    statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                } else {
                    statusBadge.innerText = 'Stage ' + stageNum + ' of 7 (' + (status === 'completed' ? 'Done' : 'Active') + ')';
                    statusBadge.style.background = 'rgba(59, 130, 246, 0.15)';
                    statusBadge.style.color = '#60a5fa';
                    statusBadge.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }
            }
        }

        function resetDashboardTracer() {
            for (let i = 1; i <= 7; i++) {
                const stepEl = document.getElementById('dash-step-' + i);
                if (stepEl) {
                    stepEl.style.background = 'rgba(255,255,255,0.03)';
                    stepEl.style.borderColor = '#334155';
                    const circle = stepEl.querySelector('.dash-step-circle');
                    if (circle) {
                        circle.style.background = '#1e293b';
                        circle.style.borderColor = '#475569';
                        circle.style.color = '#94a3b8';
                        circle.innerHTML = i;
                    }
                }
            }
            const statusBadge = document.getElementById('dashTracerStatus');
            if (statusBadge) {
                statusBadge.innerText = 'Stage 1 of 7 (Ready)';
                statusBadge.style.background = 'rgba(59, 130, 246, 0.15)';
                statusBadge.style.color = '#60a5fa';
            }
        }

        // Connect persistent tracer SSE stream
        try {
            const globalTraceEs = new EventSource('/api/tracing/stream');
            globalTraceEs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'reset') resetDashboardTracer();
                    else if (data.stage) updateDashboardTracer(data.stage, data.status, data.data, data.errorReason);
                } catch(_) {}
            };
        } catch(_) {}

        // ── Active Tabs Auto-Sync ──
        async function loadActiveTabs() {
            try {
                const res = await fetch('/api/list-tabs', { method: 'POST' });
                const data = await res.json();
                tabsListContainer.innerHTML = '';

                if (data.success && Array.isArray(data.tabs) && data.tabs.length > 0) {
                    data.tabs.forEach(t => {
                        const div = document.createElement('div');
                        div.className = 'tab-item ' + (t.isActive ? 'active' : '');
                        div.style.cursor = 'pointer';
                        div.title = 'Click to focus this tab in the headed browser';
                        div.innerHTML = 
                            '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                                '<div class="tab-title" style="font-weight:600; color:#f8fafc;">' + (t.title || 'Browser Tab') + '</div>' +
                                (t.isActive ? '<span style="font-size:0.65rem; background:#065f46; color:#34d399; padding:2px 6px; border-radius:4px; font-weight:700;">ACTIVE</span>' : '') +
                            '</div>' +
                            '<div class="tab-url" style="font-size:0.72rem; color:#94a3b8; font-family:monospace; margin-top:2px;">' + (t.url || '') + '</div>';
                        div.onclick = async () => {
                            await fetch('/api/switch-tab', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ index: t.index, tabIndex: t.index })
                            });
                            loadActiveTabs();
                        };
                        tabsListContainer.appendChild(div);
                    });
                } else {
                    tabsListContainer.innerHTML = 
                        '<div style="color:#6b7280; font-size:0.75rem; text-align:center; padding:10px;">' +
                            'No tabs detected. ' +
                            '<button onclick="openStoreInBrowser()" style="margin-top:6px; background:#4f46e5; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:0.72rem; cursor:pointer;">Open Store (5173)</button>' +
                        '</div>';
                }
            } catch (err) {
                tabsListContainer.innerHTML = '<div style="color:#ef4444; font-size:0.75rem; text-align:center; padding:10px;">Connecting to browser on Port 5000...</div>';
            }
        }

        async function openStoreInBrowser() {
            try {
                await fetch('/api/open-tab', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: 'http://localhost:5173' })
                });
                setTimeout(loadActiveTabs, 800);
            } catch (e) {
                console.error('Failed to open tab:', e);
            }
        }

        refreshTabsBtn.addEventListener('click', loadActiveTabs);
        loadActiveTabs();
        // Auto-poll active tabs every 2.5 seconds to keep dashboard live
        setInterval(loadActiveTabs, 2500);

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

// Tracing SSE Broadcaster (real-time synchronization for /tracing and dashboard)
const tracingClients = new Set();

function broadcastTracingEvent(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of tracingClients) {
    try {
      client.write(payload);
    } catch (_) {
      tracingClients.delete(client);
    }
  }
}

// Endpoint: Tracing Real-Time SSE Stream
app.get('/api/tracing/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  tracingClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Tracing real-time stream active' })}\n\n`);

  req.on('close', () => {
    tracingClients.delete(res);
  });
});

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
  sendEvent('log', { message: `Starting Smart Router execution for: "${query}"`, type: 'info' });

  // Reset & broadcast Stage 1 start to tracer
  broadcastTracingEvent({ type: 'reset' });
  broadcastTracingEvent({
    stage: 1,
    status: 'current',
    data: { query, startedAt: new Date().toLocaleTimeString() }
  });

  let inbox;
  try {
    const { inbox: classified, confidence } = await classifyQuery(query, useLLM);
    inbox = classified;
    sendEvent('classified', { inbox, confidence, query });
    console.log(`[Smart Router] SSE classified: ${inbox} (${confidence})`);

    // Broadcast Stage 1 completed
    broadcastTracingEvent({
      stage: 1,
      status: 'completed',
      data: { query, intent: inbox, confidence: String(confidence) }
    });
    broadcastTracingEvent({ stage: 2, status: 'current' });
  } catch (err) {
    inbox = INBOX.ORCHESTRATION;
    sendEvent('classified', { inbox, confidence: 'default', query });
    broadcastTracingEvent({
      stage: 1,
      status: 'completed',
      data: { query, intent: inbox, confidence: 'heuristic' }
    });
  }

  const hitlCallbacks = {
    onTracingStep: (traceData) => {
      broadcastTracingEvent(traceData);
      sendEvent('tracing_step', traceData);
    },
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
app.all('/api/list-tabs', async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/list-tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    try {
      const fallback = await fetch(`${BACKEND_URL}/api/list-tabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const resFallback = await fallback.json();
      return res.json(resFallback);
    } catch (fbErr) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Endpoint: Proxy switch-tab to backend
app.all('/api/switch-tab', async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/switch-tab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    try {
      const fallback = await fetch(`${BACKEND_URL}/api/switch-tab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {})
      });
      const resFallback = await fallback.json();
      return res.json(resFallback);
    } catch (fbErr) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Endpoint: Proxy open URL in new tab on Playwright browser
app.post('/api/open-tab', async (req, res) => {
  try {
    const { url } = req.body;
    const targetUrl = url || 'http://localhost:5173';
    const executePayload = {
      code: `await page.goto("${targetUrl}");`
    };
    const response = await fetch(`${BACKEND_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(executePayload)
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

    if (settleRes.status === 200 && receipt.success) {
      broadcastTracingEvent({
        stage: 6,
        status: 'completed',
        data: {
          paymentStatus: 'Payment Done (Verified)',
          paymentId: paymentProof.razorpay_payment_id,
          razorpayOrderId: paymentProof.razorpay_order_id,
          razorpaySignature: paymentProof.razorpay_signature
        }
      });
      broadcastTracingEvent({
        stage: 7,
        status: 'completed',
        data: {
          status: 'confirmed',
          orderRef: receipt.order_ref,
          amount: receipt.amount,
          currency: receipt.currency,
          nonce_consumed: true,
          confirmedAt: receipt.confirmed_at || new Date().toISOString()
        }
      });
    } else {
      broadcastTracingEvent({
        stage: 6,
        status: 'failed',
        errorReason: receipt.error || 'Gateway payment settlement failed.'
      });
    }

    res.status(settleRes.status).json(receipt);
  } catch (err) {
    console.error('[Smart Router] Settlement error:', err.message);
    broadcastTracingEvent({
      stage: 6,
      status: 'failed',
      errorReason: err.message
    });
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

    if (settleRes.status === 200 && receipt.success) {
      broadcastTracingEvent({
        stage: 6,
        status: 'completed',
        data: {
          paymentStatus: 'Payment Done (Live Razorpay)',
          paymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          razorpaySignature: razorpay_signature
        }
      });
      broadcastTracingEvent({
        stage: 7,
        status: 'completed',
        data: {
          status: 'confirmed',
          orderRef: receipt.order_ref,
          amount: receipt.amount,
          currency: receipt.currency,
          nonce_consumed: true,
          confirmedAt: receipt.confirmed_at || new Date().toISOString()
        }
      });
    } else {
      broadcastTracingEvent({
        stage: 6,
        status: 'failed',
        errorReason: receipt.error || 'Live Razorpay verification failed on Gateway.'
      });
    }

    res.status(settleRes.status).json(receipt);
  } catch (err) {
    console.error('[Smart Router] Settle signature error:', err.message);
    broadcastTracingEvent({
      stage: 6,
      status: 'failed',
      errorReason: err.message
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Smart Query Router Dashboard running at http://localhost:${PORT}`);
});

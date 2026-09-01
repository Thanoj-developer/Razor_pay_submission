const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getLlmResponse } = require('./LLM_FOR_VOICE');
const { runOrchestrator } = require('./orcastrator');
const { runAutoNavigationLoop } = require('./AutoNavigation');
const { routeQuery, classifyQuery, INBOX } = require('./RouterLogic');

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

        /* Active Tabs */
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

        /* Modals */
        .modal-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            z-index: 9999;
            align-items: center;
            justify-content: center;
        }
        .modal-card {
            background: #11141c;
            border: 1px solid rgba(99, 102, 241, 0.35);
            border-radius: 16px;
            padding: 28px;
            width: 360px;
            box-shadow: 0 0 50px rgba(99, 102, 241, 0.2);
            color: #ffffff;
            animation: fadeIn 0.25s ease-out;
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
                Autonomous Intent Classification &bull; Orchestration Mode &bull; Auto-Navigation Mode
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
                    placeholder="Type command e.g. 'Launch http://localhost:5173/' or 'Click on buy now for Converse'..."
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
        <div class="modal-card" style="text-align: center;">
            <div style="font-size: 2.8rem; margin-bottom: 10px;">🎉</div>
            <div id="successModalMsg" style="color: #38bdf8; font-size: 1rem; font-weight: 600; margin-bottom: 18px;">Task Completed!</div>
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
                    showSuccessModal(d.response || 'Purchase / action completed successfully!');
                }

                loadActiveTabs();
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

        function showSuccessModal(msg) {
            const modal = document.getElementById('successModal');
            document.getElementById('successModalMsg').textContent = msg;
            modal.style.display = 'flex';
            document.getElementById('successModalClose').onclick = () => {
                modal.style.display = 'none';
            };
        }
    </script>
</body>
</html>`);
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
        const failPrompt = `The user asked to perform: "${query}". This action stopped. Write a 1-sentence natural response back to the user explaining that it stopped. Keep it under 15 words.`;
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

// Endpoint: Receive HITL response
app.post('/api/voice-autonavigate/hitl-response', (req, res) => {
  const { sessionId, value } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId required' });

  const resolve = hitlPending.get(sessionId + '_hitl');
  if (resolve) {
    hitlPending.delete(sessionId + '_hitl');
    resolve(value);
    console.log(`[Smart Router HITL] Received response for session ${sessionId}: ${value}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'No pending HITL for this session' });
  }
});

app.listen(PORT, () => {
  console.log(`Smart Query Router Dashboard running at http://localhost:${PORT}`);
});

const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 5000;

// Helper to kill any stale process on target port on Windows before starting
try {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const stdout = execSync(`netstat -ano | findstr :${PORT}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(pid) && pid != process.pid && pid != '0') {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      console.log(`[Auto-Clean] Freeing port ${PORT} from old process (PID: ${pid})...`);
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } catch (_) {}
    }
  }
} catch (_) {
  // No process on port, continue
}

// Change working directory to Playwright_Razorpay directory
process.chdir(path.join(__dirname, 'Playwright_Razorpay'));

// Launch the headed Playwright server
require('./Playwright_Razorpay/server.js');

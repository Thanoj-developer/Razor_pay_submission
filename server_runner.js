const { spawn } = require('child_process');
const path = require('path');

const playwrightNodeModules = path.join(__dirname, 'Playwright_Razorpay', 'node_modules');
const reactNodeModules = path.join(__dirname, 'my-react-app', 'node_modules');
const nodePath = `${playwrightNodeModules};${reactNodeModules}`;

const services = [
  {
    name: 'React Frontend (Store)',
    cwd: path.join(__dirname, 'my-react-app'),
    command: 'npm.cmd',
    args: ['run', 'dev'],
    url: 'http://localhost:5173'
  },
  {
    name: 'X-402 Gateway (AP2 Payment)',
    cwd: path.join(__dirname, 'X402_GateWay'),
    command: 'node',
    args: ['checkout_server.js'],
    url: 'http://localhost:6004'
  },
  {
    name: 'Voice Agent Dashboard',
    cwd: path.join(__dirname, 'For_RpayDashBoard'),
    command: 'node',
    args: ['voice_server.js'],
    url: 'http://localhost:6003'
  },
  {
    name: 'Playwright Automation',
    cwd: path.join(__dirname, 'Playwright_Razorpay'),
    command: 'node',
    args: ['server.js'],
    url: 'http://localhost:5000'
  }
];

console.log('\n===================================================');
console.log('  🚀 Launching All Razorpay AP2 Stack Services');
console.log('===================================================\n');

services.forEach(svc => {
  console.log(`[STARTING] ${svc.name} -> Expected at ${svc.url}`);

  const env = Object.assign({}, process.env, {
    NODE_PATH: nodePath
  });

  const child = spawn(svc.command, svc.args, {
    cwd: svc.cwd,
    stdio: 'inherit',
    shell: true,
    env: env
  });

  child.on('error', (err) => {
    console.error(`[ERROR] ${svc.name}:`, err.message);
  });
});

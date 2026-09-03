@echo off
echo ===================================================
echo   Starting Razorpay AP2 / X-402 Full Application Stack
echo ===================================================

echo [1/4] Starting React Store Frontend...
start "React Store" cmd /k "cd my-react-app && npm run dev"

echo [2/4] Starting X-402 Payment Gateway...
start "X-402 Gateway" cmd /k "cd X402_GateWay && node checkout_server.js"

echo [3/4] Starting Voice Agent Dashboard...
start "Voice Agent Panel" cmd /k "cd For_RpayDashBoard && node voice_server.js"

echo [4/4] Starting Playwright Controller...
start "Playwright Server" cmd /k "cd Playwright_Razorpay && node server.js"

echo ===================================================
echo All services launched!
echo.
echo Links:
echo   - Store Frontend:     http://localhost:5173
echo   - Voice Dashboard:    http://localhost:6003
echo   - X-402 Gateway:      http://localhost:6004
echo   - Automation Server:  http://localhost:5000
echo ===================================================

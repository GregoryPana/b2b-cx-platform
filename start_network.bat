@echo off
echo 🌐 Starting CX B2B Platform for Network Access
echo ========================================
echo.

echo 📡 Getting local IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4.*Address"') do (
    set local_ip=%%a
    set local_ip=!local_ip: =!
)

if "%local_ip%"=="" (
    echo ⚠️  Could not detect IP, using localhost
    set local_ip=127.0.0.1
)

echo 🔍 Local IP: %local_ip%
echo.

echo 🚀 Starting Backend (accessible from network)...
cd /d "%~dp0backend"
python start_network.py

pause

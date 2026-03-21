@echo off
echo ========================================
echo Installing Redis in WSL (Ubuntu)
echo ========================================
echo.
echo This will:
echo 1. Update package list
echo 2. Install Redis
echo 3. Start Redis service
echo.
echo You'll be asked for your WSL password.
echo.
pause

echo.
echo Step 1: Updating packages...
wsl sudo apt update -y

echo.
echo Step 2: Installing Redis...
wsl sudo apt install -y redis-server

echo.
echo Step 3: Starting Redis...
wsl sudo service redis-server start

echo.
echo Step 4: Enabling Redis to start on boot...
wsl sudo systemctl enable redis-server

echo.
echo ========================================
echo Testing Redis connection...
echo ========================================
wsl redis-cli ping

echo.
echo ========================================
echo ✅ Redis Installation Complete!
echo ========================================
echo.
echo Redis is now running on localhost:6379
echo.
echo To start Redis in the future, run:
echo   wsl sudo service redis-server start
echo.
echo To stop Redis, run:
echo   wsl sudo service redis-server stop
echo.
echo You can now start your Node.js server!
echo.
pause


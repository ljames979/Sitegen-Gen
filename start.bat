@echo off
setlocal
cd /d "%~dp0"
title SiteGen

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the download page...
  echo Install the LTS version, then double-click start.bat again.
  start "" https://nodejs.org
  pause
  exit /b 1
)

echo Checking dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo npm install failed. See the messages above.
  pause
  exit /b 1
)

REM Newer npm versions block better-sqlite3's build step, so make sure it loads.
node -e "require('better-sqlite3')" >nul 2>nul
if errorlevel 1 (
  echo Building the database module...
  call npm rebuild better-sqlite3
)

REM Create .env with a random SESSION_SECRET if needed; prints the port.
set SGPORT=3000
for /f %%p in ('node scripts\setup-env.js') do set SGPORT=%%p

REM If an old SiteGen (node) is still holding the port, stop just that one.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%SGPORT% " ^| findstr LISTENING') do (
  tasklist /FI "PID eq %%a" 2^>nul | findstr /I "node.exe" >nul && (
    echo Stopping the old server on port %SGPORT%...
    taskkill /F /PID %%a >nul 2>nul
  )
)

echo.
echo Starting SiteGen at http://localhost:%SGPORT%
echo Leave this window open while you use it. Press Ctrl+C to stop.
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:%SGPORT%"
node server.js
echo.
echo The server has stopped.
pause

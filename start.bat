@echo off
REM LlamaHub start script for Windows.
REM Launches the proxy microservice and the Vite dev server from the project root.

SETLOCAL

SET "ROOT_DIR=%~dp0"
SET "PROXY_DIR=%ROOT_DIR%proxy-server"
SET "MCP_DIR=%ROOT_DIR%playwright-mcp"

echo ----------------------------------------
echo Starting LlamaHub services...
echo ----------------------------------------

IF NOT EXIST "%PROXY_DIR%" (
    echo [ERROR] proxy-server directory not found. Run this script from the LlamaHub project root.
    pause
    exit /b 1
)

cd /d "%PROXY_DIR%"
IF NOT EXIST "node_modules" (
    echo Installing proxy dependencies...
    call npm install
)

echo Starting Proxy Server...
start "LlamaHub Proxy" /B node index.js
echo Proxy server launched in background.
echo ----------------------------------------

IF EXIST "%MCP_DIR%" (
    echo Starting Playwright MCP Server...
    cd /d "%MCP_DIR%"
    IF NOT EXIST "node_modules" (
        echo Installing Playwright MCP dependencies...
        call npm install
    )
    IF NOT EXIST "node_modules\playwright\.local-browsers" (
        echo Installing Playwright browser...
        call npx playwright install chromium
    )
    start "LlamaHub Browser MCP" /B node index.js
    echo Playwright MCP server launched in background.
    echo ----------------------------------------
) ELSE (
    echo [INFO] Playwright MCP directory not found; skipping.
)

cd /d "%ROOT_DIR%"
IF NOT EXIST "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)

echo Launching Vite Dev Server...
echo Visit http://localhost:5173 in your browser.
echo ----------------------------------------

npm run dev

pause
#!/bin/bash

# LlamaHub start script for macOS & Linux.
# Launches the proxy microservice and the Vite dev server from the project root.

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_DIR="${ROOT_DIR}/proxy-server"
mcp_pid=""
MCP_DIR="${ROOT_DIR}/playwright-mcp"
proxy_pid=""

cleanup() {
    echo -e "\n${YELLOW}Shutting down LlamaHub services...${NC}"
    if [[ -n "${mcp_pid}" ]] && kill -0 "${mcp_pid}" 2>/dev/null; then
        echo "Stopping Playwright MCP server (PID: ${mcp_pid})"
        kill "${mcp_pid}" || true
        wait "${mcp_pid}" 2>/dev/null || true
    fi
    if [[ -n "${proxy_pid}" ]] && kill -0 "${proxy_pid}" 2>/dev/null; then
        echo "Stopping proxy server (PID: ${proxy_pid})"
        kill "${proxy_pid}" || true
        wait "${proxy_pid}" 2>/dev/null || true
    fi
    echo -e "${GREEN}Cleanup complete.${NC}"
}

trap cleanup EXIT INT TERM

echo -e "${GREEN}---> Starting proxy server...${NC}"
if [[ ! -d "${PROXY_DIR}" ]]; then
    echo -e "${YELLOW}Error: proxy-server directory not found. Run this script from the LlamaHub project root.${NC}"
    exit 1
fi

cd "${PROXY_DIR}"
if [[ ! -d node_modules ]]; then
    echo "Installing proxy dependencies..."
    npm install
fi

node index.js &
proxy_pid=$!
echo -e "Proxy server running with PID: ${GREEN}${proxy_pid}${NC}"
echo "----------------------------------------"

# Start Playwright MCP (Node) if present
if [[ -d "${MCP_DIR}" ]]; then
    echo -e "${GREEN}---> Starting Playwright MCP server...${NC}"
    cd "${MCP_DIR}"
    if [[ ! -d node_modules ]]; then
        echo "Installing Playwright MCP dependencies..."
        npm install
    fi
    if [[ ! -d node_modules/playwright/.local-browsers ]]; then
        echo "Installing Playwright browser (chromium)..."
        npx playwright install chromium
    fi
    node index.js &
    mcp_pid=$!
    echo -e "Playwright MCP server running with PID: ${GREEN}${mcp_pid}${NC}"
    echo "----------------------------------------"
else
    echo -e "${YELLOW}Playwright MCP directory not found; skipping MCP server startup.${NC}"
fi

cd "${ROOT_DIR}"
if [[ ! -d node_modules ]]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo -e "${GREEN}---> Launching Vite dev server...${NC}"
echo "Visit http://localhost:5173 in your browser (Ctrl+C to stop)."
echo "----------------------------------------"

npm run dev

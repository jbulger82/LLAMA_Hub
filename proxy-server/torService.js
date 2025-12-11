// proxy-server/torService.js
const { SocksProxyAgent } = require('socks-proxy-agent');
const net = require('net');

let state = { enabled: false, agent: undefined, url: undefined };

/**
 * Probes standard Tor SOCKS ports (9050, 9150) to find a running instance.
 * This version iterates ports sequentially for compatibility with older Node.js versions.
 * @returns {Promise<string|null>} A promise that resolves with the SOCKS URL or null if none is found.
 */
async function detectTorUrl() {
  const ports = [9050, 9150]; // 9050 for system tor, 9150 for Tor Browser
  const host = '127.0.0.1';

  const checkPort = (port) => new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500); // 500ms timeout for connection
    socket.on('connect', () => {
      socket.destroy();
      resolve(`socks5h://${host}:${port}`);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
    socket.on('error', (err) => {
      socket.destroy();
      resolve(null);
    });
    socket.connect(port, host);
  });
  
  for (const port of ports) {
    const result = await checkPort(port);
    if (result) {
      return result; // Found a working port, return immediately
    }
  }

  return null; // No ports were open
}

async function enableTor() {
  const url = await detectTorUrl();
  if (!url) {
    throw new Error('Tor connection failed. Could not find a local Tor SOCKS proxy on 127.0.0.1:9050 or :9150. Please ensure Tor is running.');
  }
  state.enabled = true;
  state.url = url;
  state.agent = new SocksProxyAgent(url);
  console.log(`[Tor Mode] Enabled. Routing traffic through ${url}`);
}

function disableTor() {
  state.enabled = false;
  state.url = undefined;
  state.agent = undefined;
  console.log('[Tor Mode] Disabled.');
}

function isEnabled() { return state.enabled; }
function getAgent() { return state.agent; }
function getUrl() { return state.url; }

module.exports = { 
    enableTor, 
    disableTor, 
    isEnabled, 
    getAgent, 
    getUrl 
};
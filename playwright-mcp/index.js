import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const DEFAULT_NAV_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || 45000);
const DEFAULT_ACTION_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_ACTION_TIMEOUT_MS || 20000);
const DEFAULT_SELECTOR_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_SELECTOR_TIMEOUT_MS || 20000);

const parseArgs = (args) => {
  if (args == null) return {};
  if (typeof args === 'string') {
    try {
      return JSON.parse(args);
    } catch {
      return { arg: args };
    }
  }
  if (typeof args === 'object') {
    const base = { ...args };
    if (base.arguments && typeof base.arguments === 'object') {
      Object.assign(base, base.arguments);
    }
    if (base.params && typeof base.params === 'object') {
      Object.assign(base, base.params);
    }
    return base;
  }
  return { arg: String(args) };
};

const pickArg = (args, fields) => {
  const merged = parseArgs(args);
  for (const field of fields) {
    const value = merged?.[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  }
  return '';
};

const normalizeUrl = (raw) => {
  const input = (raw || '').trim();
  if (!input) return { ok: false, error: 'URL is required.' };
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) ? input : `http://${input}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { ok: false, error: 'Only http(s) URLs are allowed.' };
    }
    return { ok: true, value: url.toString() };
  } catch (error) {
    return { ok: false, error: `Invalid URL: ${error.message}` };
  }
};

const errorResponse = (message, detail) => ({
  isError: true,
  content: [
    {
      type: 'text',
      text: detail ? `${message}\nDetails: ${detail}` : message,
    },
  ],
});

const imageContent = (data, altText) => ([
  { type: 'text', text: altText },
  { type: 'image', data, mimeType: 'image/png' },
]);

const logArgs = (tool, args) => {
  try {
    const preview = JSON.stringify(args)?.slice(0, 500);
    console.log(`[Playwright MCP] ${tool} args: ${preview}`);
  } catch {
    console.log(`[Playwright MCP] ${tool} args (unserializable)`);
  }
};

const createPage = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultNavigationTimeout(DEFAULT_NAV_TIMEOUT_MS);
  page.setDefaultTimeout(DEFAULT_ACTION_TIMEOUT_MS);
  return { browser, page };
};

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());

// MCP server
const server = new McpServer({
  name: 'Francine-Browser',
  version: '1.0.0',
});

// Tool: browse website (text)
server.tool(
  'browse_website',
  { url: z.string() },
  async (args) => {
    logArgs('browse_website', args);
    const rawUrl = pickArg(args, ['url', 'arg', 'query']);
    const normalized = normalizeUrl(rawUrl);
    if (!normalized.ok) return errorResponse('Error: invalid url.', normalized.error);

    let browser;
    let page;
    try {
      ({ browser, page } = await createPage());
      await page.goto(normalized.value, { waitUntil: 'domcontentloaded' });
      const title = await page.title();
      const content = await page.evaluate(() => document.body.innerText || '');
      return {
        content: [
          {
            type: 'text',
            text: `Page Title: ${title}\n\n${content.slice(0, 15000)}`,
          },
        ],
      };
    } catch (error) {
      return errorResponse('Navigation failed.', error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
);

// Tool: screenshot
server.tool(
  'take_screenshot',
  { url: z.string() },
  async (args) => {
    logArgs('take_screenshot', args);
    const rawUrl = pickArg(args, ['url', 'arg', 'query']);
    const normalized = normalizeUrl(rawUrl);
    if (!normalized.ok) return errorResponse('Error: invalid url.', normalized.error);

    let browser;
    let page;
    try {
      ({ browser, page } = await createPage());
      await page.goto(normalized.value, { waitUntil: 'networkidle' });
      const buffer = await page.screenshot({ fullPage: false });
      const base64Image = buffer.toString('base64');
      return {
        content: imageContent(base64Image, 'Screenshot captured successfully.'),
      };
    } catch (error) {
      return errorResponse('Screenshot failed.', error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
);

// Tool: Google search (visual)
server.tool(
  'google_search_visual',
  { query: z.string() },
  async (args) => {
    logArgs('google_search_visual', args);
    const query = pickArg(args, ['query', 'arg', 'url']);
    if (!query.trim()) {
      return errorResponse('Error: missing query.');
    }
    let browser;
    let page;
    try {
      ({ browser, page } = await createPage());
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, {
        waitUntil: 'domcontentloaded',
      });

      const results = await page.evaluate(() =>
        Array.from(document.querySelectorAll('h3'))
          .map(h => h.innerText)
          .filter(Boolean)
          .join('\\n')
      );

      return {
        content: [
          {
            type: 'text',
            text: results ? `Search results for "${query}":\n\n${results}` : `No results found for "${query}".`,
          },
        ],
      };
    } catch (error) {
      return errorResponse('Search failed.', error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
);

// Tool: full-page screenshot
server.tool(
  'full_page_screenshot',
  { url: z.string() },
  async (args) => {
    logArgs('full_page_screenshot', args);
    const rawUrl = pickArg(args, ['url', 'arg', 'query']);
    const normalized = normalizeUrl(rawUrl);
    if (!normalized.ok) return errorResponse('Error: invalid url.', normalized.error);
    let browser;
    let page;
    try {
      ({ browser, page } = await createPage());
      await page.goto(normalized.value, { waitUntil: 'networkidle' });
      const buffer = await page.screenshot({ fullPage: true });
      const base64Image = buffer.toString('base64');
      return {
        content: imageContent(base64Image, 'Full-page screenshot captured successfully.'),
      };
    } catch (error) {
      return errorResponse('Full-page screenshot failed.', error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
);

// Tool: save page as PDF
server.tool(
  'save_pdf',
  { url: z.string() },
  async (args) => {
    logArgs('save_pdf', args);
    const rawUrl = pickArg(args, ['url', 'arg', 'query']);
    const normalized = normalizeUrl(rawUrl);
    if (!normalized.ok) return errorResponse('Error: invalid url.', normalized.error);
    let browser;
    let page;
    try {
      ({ browser, page } = await createPage());
      await page.goto(normalized.value, { waitUntil: 'networkidle' });
      const pdfBuffer = await page.pdf({ format: 'A4' });
      const base64Pdf = pdfBuffer.toString('base64');
      return {
        content: [
          { type: 'text', text: 'PDF captured successfully (base64 below).' },
          { type: 'text', text: `data:application/pdf;base64,${base64Pdf}` },
        ],
      };
    } catch (error) {
      return errorResponse('PDF capture failed.', error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
);

// Tool: extract text by selector
server.tool(
  'extract_text',
  {
    url: z.string(),
    selector: z.string(),
  },
  async (args) => {
    logArgs('extract_text', args);
    const rawUrl = pickArg(args, ['url', 'arg', 'query']);
    const selector = pickArg(args, ['selector', 'path', 'field']);
    const normalized = normalizeUrl(rawUrl);
    if (!normalized.ok) return errorResponse('Error: invalid url.', normalized.error);
    if (!selector) return errorResponse('Error: missing selector.');
    let browser;
    let page;
    try {
      ({ browser, page } = await createPage());
      await page.goto(normalized.value, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(selector, { timeout: DEFAULT_SELECTOR_TIMEOUT_MS });
      const text = await page.$eval(selector, el => el.innerText || '');
      return {
        content: [{ type: 'text', text: text || `[${selector}] is empty` }],
      };
    } catch (error) {
      return errorResponse('Extraction failed.', error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
);

// Tool: extract HTML by selector
server.tool(
  'extract_html',
  {
    url: z.string(),
    selector: z.string(),
  },
  async (args) => {
    logArgs('extract_html', args);
    const rawUrl = pickArg(args, ['url', 'arg', 'query']);
    const selector = pickArg(args, ['selector', 'path', 'field']);
    const normalized = normalizeUrl(rawUrl);
    if (!normalized.ok) return errorResponse('Error: invalid url.', normalized.error);
    if (!selector) return errorResponse('Error: missing selector.');
    let browser;
    let page;
    try {
      ({ browser, page } = await createPage());
      await page.goto(normalized.value, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(selector, { timeout: DEFAULT_SELECTOR_TIMEOUT_MS });
      const html = await page.$eval(selector, el => el.outerHTML || '');
      return {
        content: [{ type: 'text', text: html || `[${selector}] has no HTML` }],
      };
    } catch (error) {
      return errorResponse('HTML extraction failed.', error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
);

// Tool: run simple step script
server.tool(
  'run_steps',
  {
    steps: z.any().optional(),
    arg: z.any().optional(),
  },
  async (args) => {
    logArgs('run_steps', args);
    const parsed = parseArgs(args);
    let steps = parsed.steps;
    if (!steps && typeof parsed.arg === 'string') {
      const parts = parsed.arg.split(';').map(s => s.trim()).filter(Boolean);
      steps = parts.map(p => {
        const lower = p.toLowerCase();
        if (lower.startsWith('goto ')) return { action: 'goto', url: p.slice(5).trim() };
        if (lower.startsWith('wait_for_selector ')) return { action: 'wait_for_selector', selector: p.split(/\s+/).slice(1).join(' ').trim() };
        if (lower.startsWith('click ')) return { action: 'click', selector: p.split(/\s+/).slice(1).join(' ').trim() };
        if (lower.startsWith('type ')) {
          const [, sel, ...rest] = p.split(/\s+/);
          return { action: 'type', selector: sel, text: rest.join(' ').trim() };
        }
        if (lower.startsWith('wait ')) return { action: 'wait', ms: parseInt(p.split(/\s+/)[1], 10) || 1000 };
        if (lower.includes('screenshot')) return { action: 'screenshot' };
        return { action: p };
      });
    }
    if (!Array.isArray(steps)) {
      return errorResponse('Error: steps must be an array.');
    }

    let browser;
    let page;
    const results = [];
    const screenshots = [];
    try {
      ({ browser, page } = await createPage());

      for (const [index, step] of steps.entries()) {
        const action = (step?.action || '').toLowerCase();
        const record = { index: index + 1, action: action || 'unknown', status: 'ok', detail: '' };
        try {
          switch (action) {
            case 'goto': {
              const normalized = normalizeUrl(step.url || step.arg || step.query || '');
              if (!normalized.ok) throw new Error(normalized.error);
              await page.goto(normalized.value, { waitUntil: 'domcontentloaded' });
              record.detail = `navigated to ${normalized.value}`;
              break;
            }
            case 'click':
              if (!step.selector) throw new Error('click requires selector');
              await page.click(step.selector, { timeout: DEFAULT_SELECTOR_TIMEOUT_MS });
              record.detail = `clicked ${step.selector}`;
              break;
            case 'type':
              if (!step.selector) throw new Error('type requires selector');
              await page.fill(step.selector, step.text || '', { timeout: DEFAULT_SELECTOR_TIMEOUT_MS });
              record.detail = `typed into ${step.selector}`;
              break;
            case 'wait_for_selector':
              if (!step.selector) throw new Error('wait_for_selector requires selector');
              await page.waitForSelector(step.selector, { timeout: DEFAULT_SELECTOR_TIMEOUT_MS });
              record.detail = `waited for ${step.selector}`;
              break;
            case 'wait':
              await page.waitForTimeout(step.ms || 1000);
              record.detail = `waited ${step.ms || 1000}ms`;
              break;
            case 'screenshot': {
              const buf = await page.screenshot({ fullPage: false });
              const base64 = buf.toString('base64');
              screenshots.push({ base64, index: record.index });
              record.detail = 'screenshot captured';
              break;
            }
            default:
              record.status = 'skip';
              record.detail = 'unknown action skipped';
              break;
          }
        } catch (stepError) {
          record.status = 'error';
          record.detail = stepError.message;
        }
        results.push(record);
      }

      const logLines = results.map(r => `${r.status === 'error' ? '✖' : r.status === 'skip' ? '…' : '✔'} [${r.index}] ${r.action}: ${r.detail || 'done'}`);
      const content = [{ type: 'text', text: logLines.join('\n') || 'No steps executed.' }];
      screenshots.forEach(({ base64, index }) => {
        content.push(...imageContent(base64, `Step ${index} screenshot.`));
      });

      const hadError = results.some(r => r.status === 'error');
      return { isError: hadError, content };
    } catch (error) {
      return errorResponse('Step runner failed.', error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
);

// SSE wiring (multi-session)
const transports = new Map();
let lastTransport = null;
const hostForLog = process.env.HOST || '0.0.0.0';

const resolveSessionId = (req) => {
  const headerId = req.headers['x-session-id'];
  const queryId = req.query.sessionId;
  return String(headerId || queryId || 'default');
};

app.get('/sse', async (req, res) => {
  const sessionId = resolveSessionId(req) || randomUUID();
  console.log(`[Playwright MCP] SSE connection established (session: ${sessionId})`);
  const transport = new SSEServerTransport('/messages', res);
  transports.set(sessionId, transport);
  lastTransport = transport;
  res.setHeader('x-session-id', sessionId);
  res.on('close', () => transports.delete(sessionId));
  await server.connect(transport);
});

app.post('/messages', express.raw({ type: 'application/json', limit: '10mb' }), async (req, res) => {
  let body = '';
  try {
    body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : '');
    console.log('[Playwright MCP] /messages body preview:', body.slice(0, 400));
  } catch {
    body = '';
    console.log('[Playwright MCP] /messages body preview: <unreadable>');
  }
  const sessionId = resolveSessionId(req);
  const transport = transports.get(sessionId) || (transports.size === 1 ? [...transports.values()][0] : lastTransport);
  if (!transport) {
    return res.status(404).send('Session not initialized');
  }
  await transport.handlePostMessage(req, res, body);
});

app.listen(PORT, () => {
  console.log(`✅ Playwright MCP running at http://${hostForLog}:${PORT}/sse`);
});

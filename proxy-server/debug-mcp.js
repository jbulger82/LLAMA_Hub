import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { EventSource } from 'eventsource';

// Polyfill EventSource for Node
global.EventSource = EventSource;

const TAVILY_URL = "https://mcp.tavily.com/mcp/?tavilyApiKey=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";

console.log("--- STARTING DEBUG ---");
console.log("Target URL:", TAVILY_URL.replace(/key=[^&]+/i, 'key=***'));

async function testConnection() {
    try {
        console.log("1. Initializing Client...");
        const client = new Client({ name: 'debug-client', version: '1.0.0' }, { capabilities: {} });

        console.log("2. Setting up Transport...");
        const transport = new SSEClientTransport(new URL(TAVILY_URL));

        console.log("3. Connecting (this is where it usually hangs)...");
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout after 10s")), 10000)
        );

        await Promise.race([
            client.connect(transport),
            timeoutPromise
        ]);

        console.log("4. CONNECTED! Fetching tools...");
        const tools = await client.listTools();
        console.log("\nSUCCESS! Found tools:");
        tools.tools.forEach(t => console.log(`- ${t.name}`));
        process.exit(0);
    } catch (error) {
        console.error("\nFAILED:", error.message);
        if (error.cause) console.error("Cause:", error.cause);
        process.exit(1);
    }
}

testConnection();

import { google } from 'googleapis';
import { Writable, Readable } from 'stream';

// =============================================================================
// 1. MCP Server Framework (Reconstructed for Node.js)
// =============================================================================

class StdioComms {
    constructor() {
        this.stdin = new Readable({ read() {} });
        this.stdout = new Writable({
            write(chunk, encoding, callback) {
                process.stdout.write(chunk, encoding);
                callback();
            }
        });

        process.stdin.on('data', (chunk) => {
            this.stdin.push(chunk);
        });

        process.stdin.on('end', () => {
            this.stdin.push(null);
        });
    }

    readMessage() {
        return new Promise((resolve) => {
            const onReadable = () => {
                let line = '';
                let chunk;
                while ((chunk = this.stdin.read()) !== null) {
                    const chunkStr = chunk.toString();
                    const newlineIndex = chunkStr.indexOf('\n');
                    if (newlineIndex !== -1) {
                        line += chunkStr.substring(0, newlineIndex);
                        this.stdin.unshift(chunkStr.substring(newlineIndex + 1));
                        break;
                    }
                    line += chunkStr;
                }

                if (line) {
                    this.stdin.removeListener('readable', onReadable);
                    try {
                        resolve(JSON.parse(line));
                    } catch (e) {
                        // In case of invalid JSON, log and wait for more data
                        console.error(`[Google-MCP] JSON Parse Error: ${e.message}`);
                        resolve(this.readMessage());
                    }
                }
            };
            this.stdin.on('readable', onReadable);
            // Initial call in case data is already buffered
            onReadable();
        });
    }

    writeMessage(message) {
        const serialized = JSON.stringify(message);
        this.stdout.write(serialized + '\n');
    }
}

class Tool {
    constructor(name, description, func, inputSchema = null) {
        this.name = name;
        this.description = description;
        this.func = func;
        this.inputSchema = inputSchema || { type: "object", properties: {} };
    }

    toDict() {
        return {
            name: this.name,
            description: this.description,
            inputSchema: this.inputSchema,
        };
    }
}

class Server {
    constructor() {
        this._comms = new StdioComms();
        this._tools = new Map();
    }

    registerTool(tool) {
        this._tools.set(tool.name, tool);
    }

    async serveForever() {
        while (true) {
            const request = await this._comms.readMessage();
            if (!request) break;
            this.handleRequest(request);
        }
    }

    async handleRequest(request) {
        const { id, method, params = {} } = request;
        const response = { jsonrpc: "2.0", id };

        try {
            if (method === 'initialize') {
                response.result = {
                    protocolVersion: "2025-06-18",
                    serverInfo: { name: "google-mcp-server", version: "1.0.0" },
                    capabilities: {}
                };
            } else if (method === 'tools/list') {
                const tools = Array.from(this._tools.values()).map(t => t.toDict());
                response.result = { tools };
            } else if (method === 'tools/call') {
                const tool = this._tools.get(params.name);
                if (!tool) throw new Error(`Tool '${params.name}' not found.`);
                
                const result_content = await tool.func(params.arguments || {});
                response.result = { content: result_content };
            } else {
                throw new Error(`Method '${method}' not found.`);
            }
        } catch (error) {
            response.error = { code: -32000, message: `Error executing method: ${error.message}` };
        }
        
        this._comms.writeMessage(response);
    }
}

// =============================================================================
// 2. Tool Implementations
// =============================================================================

function createOauthClient(accessToken) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return oauth2Client;
}

async function gmail_list_messages({accessToken, query, maxResults = 5}) {
    if (!accessToken) throw new Error("Google access token is required.");

    const gmail = google.gmail({ version: 'v1', auth: createOauthClient(accessToken) });
    
    const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
    });

    const messages = response.data.messages;
    if (!messages || messages.length === 0) {
        return [{ type: 'text', text: `No emails found for query: "${query}"` }];
    }

    const promises = messages.map(msg => gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
    }));

    const results = await Promise.all(promises);

    const formattedResults = results.map(res => {
        const headers = res.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        const formattedDate = date ? new Date(date).toLocaleString() : 'No Date';
        return `**From:** ${from}\n**Subject:** ${subject}\n**Date:** ${formattedDate}\n**ID:** \`${res.data.id}\`\n---`;
    }).join('\n');

    return [{ type: 'text', text: `Found ${results.length} email(s):\n\n---\n${formattedResults}` }];
}

async function calendar_list_events({accessToken, maxResults = 10}) {
    if (!accessToken) throw new Error("Google access token is required.");
    
    const calendar = google.calendar({ version: 'v3', auth: createOauthClient(accessToken) });

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        showDeleted: false,
        singleEvents: true,
        maxResults,
        orderBy: 'startTime'
    });

    const events = response.data.items;
    if (!events || events.length === 0) {
        return [{ type: 'text', text: 'No upcoming events found for the next 7 days.' }];
    }

    const eventList = events.map(event => {
        const start = event.start.dateTime || event.start.date;
        const startDate = new Date(start);
        const options = {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: event.start.dateTime ? 'numeric' : undefined,
            minute: event.start.dateTime ? '2-digit' : undefined,
            hour12: true,
        };
        const formattedDate = startDate.toLocaleString([], options);
        return `- **${event.summary}** on ${formattedDate}`;
    }).join('\n');

    return [{ type: 'text', text: `Upcoming events for the next 7 days:\n\n${eventList}` }];
}


// =============================================================================
// 3. Server Main Entrypoint
// =============================================================================

const server = new Server();

server.registerTool(new Tool(
    "gmail_list_messages",
    "Searches for and lists recent emails from the user's Gmail account.",
    gmail_list_messages,
    {
        type: "object",
        properties: {
            accessToken: { type: "string", description: "User's Google API access token." },
            query: { type: "string", description: "Search query (e.g., 'from:someone@example.com' or 'latest')." },
            maxResults: { type: "integer", description: "Maximum number of emails to return." }
        },
        required: ["accessToken", "query"]
    }
));

server.registerTool(new Tool(
    "calendar_list_events",
    "Lists upcoming events from the user's primary Google Calendar for the next 7 days.",
    calendar_list_events,
    {
        type: "object",
        properties: {
            accessToken: { type: "string", description: "User's Google API access token." },
            maxResults: { type: "integer", description: "Maximum number of events to return." }
        },
        required: ["accessToken"]
    }
));

server.serveForever();

import { type Settings } from './settings';

const LOCAL_PROXY_HINT = "Failed to reach the LlamaHub proxy server. Make sure ./start.sh (or start.bat) is running and the Proxy URL is correct.";

const buildRemoteProxyUrl = (base: string, targetUrl: string): string => {
    if (!base) {
        throw new Error("Remote/CORS proxy URL is not configured in settings.");
    }

    if (base.includes('{{RAW}}')) {
        return base.replace('{{RAW}}', targetUrl);
    }
    if (base.includes('{{URL}}')) {
        return base.replace('{{URL}}', encodeURIComponent(targetUrl));
    }

    const protocolMatches = base.match(/https?:\/\//g) || [];
    const appendRaw = protocolMatches.length > 1;
    if (appendRaw) {
        return `${base}${targetUrl}`;
    }
    return `${base}${encodeURIComponent(targetUrl)}`;
};

const fetchViaLocalProxy = async (url: string, userAgent: string, settings: Settings, asBlob: boolean, signal?: AbortSignal): Promise<string | Blob> => {
    if (!settings.proxyUrl) {
        throw new Error("LlamaHub Proxy URL is not configured in settings. Cannot perform local proxy requests.");
    }
    const localProxyUrl = `${settings.proxyUrl}/proxy/curl`;

    const response = await fetch(localProxyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, userAgent, asBlob }),
        signal, // Pass the signal here
    });

    if (!response.ok) {
        const raw = await response.text();
        let message = `Proxy server responded with status ${response.status}`;
        try {
            const parsed = JSON.parse(raw);
            message = parsed.message || message;
        } catch {
            if (raw) message = `${message}: ${raw.slice(0, 300)}…`;
        }
        throw new Error(message);
    }

    if (asBlob) {
        const { base64, mimeType } = await response.json();
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    return await response.text();
};

const fetchViaRemoteProxy = async (url: string, settings: Settings, asBlob: boolean, signal?: AbortSignal): Promise<string | Blob> => {
    const proxyUrl = buildRemoteProxyUrl(settings.corsProxyUrl, url);
    const response = await fetch(proxyUrl, { signal }); // Pass the signal here
    if (!response.ok) {
        const raw = await response.text().catch(() => '');
        throw new Error(`Remote proxy responded with status ${response.status}${raw ? `: ${raw.slice(0, 200)}…` : ''}`);
    }
    return asBlob ? await response.blob() : await response.text();
};

const fetchWithFallback = async (url: string, settings: Settings, userAgent: string, asBlob: boolean = false, signal?: AbortSignal): Promise<string | Blob> => {
    const errors: string[] = [];

    const tryLocal = settings.proxyMode !== 'remote';
    const tryRemote = settings.proxyMode !== 'local';

    if (tryLocal) {
        try {
            return await fetchViaLocalProxy(url, userAgent, settings, asBlob, signal); // Pass signal
        } catch (error: any) {
            errors.push(error?.message || LOCAL_PROXY_HINT);
        }
    }

    if (tryRemote) {
        try {
            return await fetchViaRemoteProxy(url, settings, asBlob, signal); // Pass signal
        } catch (error: any) {
            errors.push(error?.message || "Remote proxy request failed.");
        }
    }

    if (!errors.length) {
        throw new Error("No proxy mode enabled. Please configure either the local LlamaHub proxy or a remote/CORS proxy.");
    }

    throw new Error(errors.join(' | '));
};


const parseDuckDuckGoResults = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const results = Array.from(doc.querySelectorAll('.result, .nrn-react-div, .result--url-above-snippet'));
    
    if (results.length === 0) {
        return "No results found, or the page structure has changed.";
    }

    return results.slice(0, 6).map((result, index) => {
        const titleElement = 
            result.querySelector('h2 > a.result__a, a.result__a') ||
            result.querySelector('a[data-testid="result-title-a"]') ||
            result.querySelector('a[href]');

        const snippetElement = result.querySelector('.result__snippet');
        
        const title = titleElement?.textContent?.trim() || 'No title';
        const url = titleElement?.getAttribute('href') || '#';
        const snippet = snippetElement?.textContent?.trim() || 'No snippet';
        
        return `${index + 1}. **${title}** (${url})\n   - ${snippet}`;
    }).join('\n\n');
};

const parseGoogleSearchResults = (data: any): string => {
    if (!data.items || data.items.length === 0) {
        return "No results found on Google for this query.";
    }

    return data.items.slice(0, 6).map((item: any, index: number) => {
        const title = item.title || 'No title';
        const url = item.link || '#';
        const snippet = item.snippet || 'No snippet';

        return `${index + 1}. **${title}** (${url})\n   - ${snippet.replace(/\n/g, ' ')}`;
    }).join('\n\n');
};


export const search = async (query: string, settings: Settings, signal?: AbortSignal): Promise<string> => {
    let searchUrl = '';
    const encodedQuery = encodeURIComponent(query);

    switch (settings.searchEngine) {
        case "tavily": {
            const apiKey = settings.tavilyApiKey;
            if (!apiKey) return "Tavily Search is selected, but the API Key is missing. Please configure it in Settings > Networking.";
            
            try {
                const response = await fetch("https://api.tavily.com/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        api_key: apiKey,
                        query: query,
                        search_depth: "advanced",
                        include_answer: true,
                        max_results: 6
                    }),
                    signal: signal
                });

                if (!response.ok) {
                    const err = await response.text();
                    return `Error from Tavily API (${response.status}): ${err}`;
                }

                const data = await response.json();
                let output = "";

                // 1. Add the direct AI answer if available
                if (data.answer) {
                    output += `**Direct Answer:**\n${data.answer}\n\n---\n\n`;
                }

                // 2. Add the rich context snippets
                if (data.results && data.results.length > 0) {
                    output += "**Search Results (Deep Context):**\n\n";
                    output += data.results.slice(0, 6).map((r: any, idx: number) => 
                        `${idx + 1}. **${r.title}** (${r.url})\n   "${r.content.slice(0, 300)}..."`
                    ).join("\n\n");
                } else {
                    output += "No results found.";
                }

                return output;
            } catch (err: any) {
                return `Error performing Tavily search: ${err.message}`;
            }
        }
        case 'google': {
            const googleDevApiKey = (settings.developerMode && settings.dev_googleDeveloperApiKey)
                ? settings.dev_googleDeveloperApiKey
                : (process.env.GOOGLE_API_DEVELOPER_KEY || '');

            if (!googleDevApiKey || !settings.googleSearchCxId) {
                return 'Google Search is selected, but the Google Developer API Key or CX ID is missing. Please configure them in Settings > Networking.';
            }
            searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleDevApiKey}&cx=${settings.googleSearchCxId}&q=${encodedQuery}`;
            try {
                const response = await fetch(searchUrl, { signal }); // Pass signal
                const raw = await response.text();
                
                if (!response.ok) {
                    try {
                        const data = JSON.parse(raw);
                        return `Error from Google Search API: ${data.error?.message || 'Unknown error'}`;
                    } catch {
                        return `Error from Google Search API (${response.status}): ${raw.slice(0,300)}…`;
                    }
                }

                let data: any;
                try { 
                    data = JSON.parse(raw); 
                } catch { 
                    return `Google Search API returned non-JSON response.`; 
                }

                const parsedResults = parseGoogleSearchResults(data);
                return `Search results from Google for "${query}":\n\n${parsedResults}`;
            } catch (error: any) {
                 return `Error performing search with Google: ${error.message}`;
            }
        }
        case 'brave':
            // Brave search is heavily JS-driven and hard to scrape reliably without a full browser.
            // Returning a direct link is a more robust approach.
            searchUrl = `https://search.brave.com/search?q=${encodedQuery}`;
             return `Brave search results for "${query}" are available here: ${searchUrl}\n\n(Note: Direct scraping of Brave is unreliable; please visit the link.)`;
        case 'custom':
            searchUrl = settings.customSearchApiEndpoint.includes('{{QUERY}}') 
                ? settings.customSearchApiEndpoint.replace('{{QUERY}}', encodedQuery)
                : `${settings.customSearchApiEndpoint}${encodedQuery}`;
            // Custom endpoints are unpredictable, so we return the raw content.
            const customContent = await fetchWithFallback(searchUrl, settings, settings.curlUserAgent, false, signal); // Pass signal
            return `Raw content from custom search endpoint for "${query}":\n\n---\n${customContent as string}`;
        case 'duckduckgo':
        default: {
          const primary = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
          const backup  = `https://duckduckgo.com/html/?q=${encodedQuery}`;
          try {
            let resultsHtml = await fetchWithFallback(primary, settings, settings.curlUserAgent, false, signal) as string; // Pass signal
            if (!/class="result"/.test(resultsHtml)) {
              resultsHtml = await fetchWithFallback(backup, settings, settings.curlUserAgent, false, signal) as string; // Pass signal
            }
            const parsedResults = parseDuckDuckGoResults(resultsHtml);
            return `Search results from DuckDuckGo for "${query}":\n\n${parsedResults}`;
          } catch (error: any) {
            return `Error performing search with DuckDuckGo: ${error.message}`;
          }
        }
    }
};

export const curl = async (url: string, settings: Settings, signal?: AbortSignal): Promise<string> => {
    try {
        const content = await fetchWithFallback(url, settings, settings.curlUserAgent, false, signal);
        return content as string;
    } catch (error: any) {
        throw new Error(`Error curling ${url}: ${error.message}`);
    }
};

export const webscrape = async (url: string, settings: Settings, signal?: AbortSignal): Promise<string> => {
    // n = url, e = settings, i = signal
    
    // LEGACY: Scrapestack (Only runs if explicitly selected)
    if (settings.webScrapingProvider === 'scrapestack') {
        const apiKey = settings.scrapestackApiKey;
        if (!apiKey) return "Scrapestack API Key is not configured. Please check Settings > Networking.";
        const apiUrl = `http://api.scrapestack.com/scrape?access_key=${apiKey}&url=${encodeURIComponent(url)}`;
        try {
            const res = await fetch(apiUrl, { signal: signal });
            const text = await res.text();
            if (!res.ok) return `Scrapestack Error: ${res.status} ${res.statusText}`;
            try {
                const json = JSON.parse(text);
                if (json.success === false) return `Scrapestack Error: ${json.error.type}`;
            } catch {}
            return `Scraped content from ${url}:\n\n---\n\n${text}`;
        } catch (err: any) {
            return `Failed to scrape ${url} using Scrapestack. Error: ${err.message}`;
        }
    }

    // NEW: Auto Mode (Tavily -> Jina -> Raw Fallback)
    // 1. Try Tavily Extract (High Quality / Paid)
    if (settings.tavilyApiKey) {
        try {
            const res = await fetch("https://api.tavily.com/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ api_key: settings.tavilyApiKey, urls: [url] }),
                signal: signal
            });
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results[0] && data.results[0].raw_content) {
                    return `**Scraped Content (via Tavily):**\nURL: ${url}\n\n---\n\n${data.results[0].raw_content}`;
                }
            }
        } catch (err) {
            console.warn("Tavily extract failed, trying Jina...", err);
        }
    }

    // 2. Try Jina Reader (Free / Markdown Optimized)
    try {
        const jinaUrl = `https://r.jina.ai/${url}`;
        const res = await fetch(jinaUrl, {
            headers: { 'X-Return-Format': 'markdown' },
            signal: signal
        });
        if (res.ok) {
            const text = await res.text();
            if (!text.includes("Cloudflare") && text.length > 50) {
                return `**Scraped Content (via Jina):**\nURL: ${url}\n\n---\n\n${text}`;
            }
        }
    } catch (err) {
        console.warn("Jina reader failed, falling back to raw proxy...", err);
    }

    // 3. Fallback: Raw Proxy Curl (Existing Logic)
    try {
        const rawHtml = await fetchWithFallback(url, settings, settings.curlUserAgent, false, signal); // Uses existing curl helper
        // Basic cleanup to save tokens
        const cleaned = (rawHtml as string)
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return `**Scraped Content (Raw Fallback):**\nURL: ${url}\n\n---\n\n${cleaned.substring(0, 15000)}... [truncated]`;
    } catch (err: any) {
        return `Failed to scrape ${url}. All methods failed. Error: ${err.message}`;
    }
};

export const visitUrl = async (url: string, settings: Settings, signal?: AbortSignal): Promise<string> => {
    try {
        const content = await curl(url, settings, signal); // Pass signal
        return `Content retrieved from ${url}:\n\n---\n\n${content}`;
    } catch(error: any) {
        return error.message;
    }
};

export const downloadFile = async (url: string, settings: Settings, signal?: AbortSignal): Promise<{ message: string, imageUrl?: string }> => {
    try {
        const blob = await fetchWithFallback(url, settings, settings.curlUserAgent, true, signal) as Blob;
        
        const fileName = url.split('/').pop()?.split('?')[0] || 'downloaded_file';
        
        // Create a link element, hide it, and trigger a click to start the download
        const link = document.createElement('a');
        link.style.display = 'none';
        document.body.appendChild(link);
        
        const objectUrl = window.URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = fileName;
        link.click();
        
        // Clean up
        window.URL.revokeObjectURL(objectUrl);
        document.body.removeChild(link);

        const successMessage = `Successfully initiated download of "${fileName}". Please check your browser's downloads.`;
        
        // If it's an image, create a data URL for preview
        if (blob.type.startsWith('image/')) {
             const imageUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return { message: `${successMessage} An image preview is shown below.`, imageUrl };
        }

        return { message: successMessage };
    } catch (error: any) {
        console.error(`[WebAccessService] Download failed for ${url}:`, error);
        throw new Error(`Error downloading file: ${error.message}`);
    }
};

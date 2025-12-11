// services/utils.ts

export function getBaseUrl(userUrl: string): string {
    if (!userUrl) return '';
    let urlStr = userUrl.trim().replace(/\/+$/, ''); // trim trailing slashes
    // List of known endpoints to strip
    const endpoints = [
        '/v1/chat/completions',
        '/v1/completions',
        '/v1/embeddings',
        '/completion'
    ];
    for (const endpoint of endpoints) {
        if (urlStr.endsWith(endpoint)) {
            // Return the URL with the matched endpoint stripped off
            return urlStr.substring(0, urlStr.length - endpoint.length);
        }
    }
    // Return the original URL (trimmed) if no known endpoint is found at the end
    return urlStr;
}

export function parseHeaders(headersString?: string): Record<string, string> {
    if (!headersString) return {};
    try {
        const headers = JSON.parse(headersString);
        if (typeof headers === 'object' && headers !== null && !Array.isArray(headers)) {
            return headers;
        }
        return {};
    } catch (e) {
        console.error("Invalid custom headers JSON:", e);
        return {};
    }
}

export function normalizeFloatingPoint(value: any, precision: number = 6): any {
    if (typeof value === 'number') {
        return parseFloat(value.toFixed(precision));
    }
    return value;
}

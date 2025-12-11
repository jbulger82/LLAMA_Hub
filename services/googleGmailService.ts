declare const gapi: any;

/* global gapi, btoa, atob */

interface EmailData {
    to: string;
    subject: string;
    body: string;
}

function getErrorMessage(err: any): string {
    if (err?.result?.error?.message) {
        return err.result.error.message;
    }
     if (err.body) { // GAPI often wraps errors in a `body` property
        try {
            const errorDetails = JSON.parse(err.body);
            return errorDetails.error?.message || 'An unknown Gmail API error occurred.';
        } catch(e) { /* ignore json parse error */ }
    }
    return err.message || 'An unknown error occurred while communicating with Gmail.';
}

/** Decodes a base64url string. */
function base64UrlDecode(input: string): string {
    try {
        input = input.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(input);
        // The decoded string might not be valid UTF-8. We need to handle this.
        // This trick converts the byte string to a percent-encoded string, then decodes it.
        return decodeURIComponent(
            Array.prototype.map.call(decoded, (c) => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''),
        );
    } catch (e) {
        console.error("base64UrlDecode failed:", e);
        return "Error: Could not decode content.";
    }
}


/** Finds the plain text part from a message payload. */
function findPlainTextPart(parts: any[]): string {
    let body = '';
    for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
            body += base64UrlDecode(part.body.data);
        } else if (part.parts) {
            body += findPlainTextPart(part.parts);
        }
    }
    return body;
}


export async function searchEmails(query: string): Promise<string> {
    try {
        const isLatestQuery = query.trim().toLowerCase() === 'latest';

        const response = await gapi.client.gmail.users.messages.list({
            userId: 'me',
            q: isLatestQuery ? '' : query,
            maxResults: isLatestQuery ? 1 : 5,
        });

        const messages = response.result.messages;
        if (!messages || messages.length === 0) {
            return `No emails found for query: "${query}"`;
        }
        
        const promises = messages.map((msg: any) => gapi.client.gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date'],
        }));
        
        const results = await Promise.all(promises);
        
        const formattedResults = results.map((res: any) => {
            const headers = res.result.payload.headers;
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
            const date = headers.find((h: any) => h.name === 'Date')?.value || '';
            const formattedDate = date ? new Date(date).toLocaleString() : 'No Date';
            return `**From:** ${from}\n**Subject:** ${subject}\n**Date:** ${formattedDate}\n**ID:** \\\`${res.result.id}\\\`\n---`;
        }).join('\n');

        const prefix = isLatestQuery
            ? `Here is your latest email:\n\n---`
            : `Found ${results.length} email${results.length > 1 ? 's' : ''} matching your search:\n\n---`;

        return `${prefix}\n${formattedResults}`;

    } catch (err: any) {
        console.error("Gmail API error (searchEmails):", err);
        throw new Error(getErrorMessage(err));
    }
}


export async function readEmail(messageId: string): Promise<string> {
    try {
        const response = await gapi.client.gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
        });

        const message = response.result;
        const headers = message.payload.headers;
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const to = headers.find((h: any) => h.name === 'To')?.value || 'Unknown Recipient';
        const date = headers.find((h: any) => h.name === 'Date')?.value || '';
        const formattedDate = date ? new Date(date).toLocaleString() : 'No Date';

        let body = '';
        if (message.payload.parts) {
            body = findPlainTextPart(message.payload.parts);
        } else if (message.payload.body?.data) {
            body = base64UrlDecode(message.payload.body.data);
        }

        const snippet = message.snippet;
        const fullBody = body.trim() ? body : snippet;

        return `**From:** ${from}\n**To:** ${to}\n**Subject:** ${subject}\n**Date:** ${formattedDate}\n\n---\n\n${fullBody}`;

    } catch (err: any) {
        console.error("Gmail API error (readEmail):", err);
        throw new Error(getErrorMessage(err));
    }
}


export async function sendEmail(data: EmailData): Promise<string> {
    try {
        const emailLines = [];
        emailLines.push(`To: ${data.to}`);
        emailLines.push(`Subject: ${data.subject}`);
        emailLines.push('Content-Type: text/plain; charset="UTF-8"');
        emailLines.push('MIME-Version: 1.0');
        emailLines.push('');
        emailLines.push(data.body);

        const email = emailLines.join('\r\n');
        
        // Base64-url-safe encoding
        const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
            
        await gapi.client.gmail.users.messages.send({
            userId: 'me',
            resource: {
                raw: base64EncodedEmail
            }
        });

        return `Email successfully sent to ${data.to}.`;

    } catch (err: any) {
        console.error("Gmail API error (sendEmail):", err);
        throw new Error(getErrorMessage(err));
    }
}


export async function deleteEmail(messageId: string): Promise<string> {
    try {
        await gapi.client.gmail.users.messages.trash({
            userId: 'me',
            id: messageId,
        });
        return `Successfully moved email with ID ${messageId} to trash.`;
    } catch (err: any) {
        console.error("Gmail API error (deleteEmail):", err);
        throw new Error(getErrorMessage(err));
    }
}
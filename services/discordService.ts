
export interface DiscordMessageParams {
    botToken: string;
    channelId: string;
    content: string;
    proxyUrl: string;
}

export async function sendMessage(params: DiscordMessageParams, signal?: AbortSignal): Promise<string> {
    const { botToken, channelId, content, proxyUrl } = params;

    if (!botToken) {
        throw new Error("Discord Bot Token is not configured.");
    }
    if (!channelId) {
        throw new Error("Channel ID is missing.");
    }
    if (!content) {
        throw new Error("Message content is empty.");
    }
    if (!proxyUrl) {
        throw new Error("Proxy URL is not configured.");
    }

    const discordProxyEndpoint = `${proxyUrl}/proxy/discord`;

    try {
        const response = await fetch(discordProxyEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // The proxy server will handle adding the Bot token to the Authorization header
            body: JSON.stringify({
                botToken: botToken,
                channelId: channelId,
                content: content
            }),
            signal, // Pass the signal here
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Discord Proxy Error:', errorData);
            throw new Error(`Discord API Error (${response.status}): ${errorData.message || 'Failed to send message via proxy.'}`);
        }

        const result = await response.json();
        return result.message || `Successfully sent message to Discord channel #${params.channelId}.`;
        
    } catch (error) {
        console.error('Failed to send Discord message via proxy:', error);
        if (error instanceof TypeError) {
             throw new Error("Failed to connect to the LlamaHub proxy server. Is it running? Please use start.sh or start.bat to launch the application.");
        }
        throw error;
    }
}
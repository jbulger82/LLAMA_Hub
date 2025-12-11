import { encode } from 'gpt-tokenizer';

/**
 * Counts the number of tokens in a string using a real tokenizer.
 * @param text The string to analyze.
 * @returns The number of tokens.
 */
export function countTokens(text: string): number {
    if (!text) return 0;
    try {
        return encode(text).length;
    } catch (_err) {
        // If special tokens slip through, fall back to a rough estimate so UI doesn't crash.
        return Math.ceil(text.length / 4);
    }
}

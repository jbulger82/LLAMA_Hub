
import { countTokens } from './tokenUtils';

interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export function chunkText(text: string, options: ChunkingOptions): string[] {
    const { chunkSize, chunkOverlap } = options;
    const normalized = text.trim();
    if (!normalized) return [];

    const totalTokens = countTokens(normalized);
    if (totalTokens <= chunkSize) {
        return [normalized];
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let currentWords: string[] = [];

    const tokensOf = (w: string[]) => (w.length === 0 ? 0 : countTokens(w.join(' ')));

    for (const word of words) {
        const candidateWords = [...currentWords, word];
        if (tokensOf(candidateWords) > chunkSize) {
            if (currentWords.length > 0) {
                chunks.push(currentWords.join(' '));
            }
            // build overlap tail
            const overlapWords: string[] = [];
            for (let i = currentWords.length - 1; i >= 0; i--) {
                overlapWords.unshift(currentWords[i]);
                if (tokensOf(overlapWords) >= chunkOverlap) break;
            }
            currentWords = [...overlapWords, word];
            // If single word exceeds chunk, force split by characters
            if (tokensOf([word]) > chunkSize) {
                const hardSplit = word.match(new RegExp(`.{1,${Math.max(1, chunkSize * 4)}}`, 'g')) || [];
                if (hardSplit.length) {
                    const first = hardSplit.shift()!;
                    currentWords = [first];
                    chunks.push(currentWords.join(' '));
                    for (const piece of hardSplit) {
                        chunks.push(piece);
                    }
                    currentWords = [];
                }
            }
        } else {
            currentWords.push(word);
        }
    }

    if (currentWords.length > 0) {
        chunks.push(currentWords.join(' '));
    }

    // Merge tiny trailing chunk into previous to avoid very small fragments
    if (chunks.length > 1) {
        const last = chunks[chunks.length - 1];
        if (countTokens(last) < chunkSize / 4) {
            const prev = chunks[chunks.length - 2];
            chunks[chunks.length - 2] = `${prev} ${last}`.trim();
            chunks.pop();
        }
    }

    return chunks;
}

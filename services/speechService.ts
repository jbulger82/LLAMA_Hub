export interface SpeechConfig {
    enabled: boolean;
    readAloud: boolean;
    ttsProvider: 'browser' | 'piper' | 'systemPiper';
    ttsVoiceName: string;
    piperTtsUrl: string;
    sttProvider: 'browser' | 'vosk' | 'systemWhisper';
    voskSttUrl: string;
    enableSileroVad: boolean;
    enablePorcupineWakeWord: boolean;
    porcupineAccessKey: string;
    proxyUrl: string;
}

let config: SpeechConfig = {
    enabled: false,
    readAloud: false,
    ttsProvider: 'browser',
    ttsVoiceName: '',
    piperTtsUrl: '',
    sttProvider: 'browser',
    voskSttUrl: '',
    enableSileroVad: false,
    enablePorcupineWakeWord: false,
    porcupineAccessKey: '',
    proxyUrl: '',
};

let voices: SpeechSynthesisVoice[] = [];
let audioContext: AudioContext | null = null;

// --- Private Helper Functions ---

function populateVoiceList() {
    if (typeof speechSynthesis === 'undefined') {
        return;
    }
    voices = speechSynthesis.getVoices();
    if (voices.length > 0 && !config.ttsVoiceName) {
        // Find a default English voice if possible
        const defaultVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en')) || voices[0];
        if (defaultVoice) {
            config.ttsVoiceName = defaultVoice.name;
        }
    }
}

// Populate voices initially and when they change.
if (typeof speechSynthesis !== 'undefined') {
    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }
}

async function playPiper(text: string) {
    if (!config.piperTtsUrl) {
        console.error("Piper TTS URL is not configured.");
        return;
    }
    try {
        if (!audioContext) {
             audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
         // Resume context if it's suspended (e.g., due to browser auto-play policies)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const url = new URL(config.piperTtsUrl);
        url.searchParams.append('text', text);
        
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Piper server responded with status ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
    } catch (error) {
        console.error("Error playing audio from Piper TTS:", error);
    }
}

async function speakViaProxy(text: string) {
    if (!config.proxyUrl) {
        console.error("Proxy URL is not configured for Piper script playback.");
        return;
    }
    try {
        const response = await fetch(`${config.proxyUrl}/proxy/voice/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || `Proxy responded with ${response.status}`);
        }
    } catch (error) {
        console.error("Failed to run Piper script via proxy:", error);
    }
}


// --- Public API ---

export function configure(newConfig: Partial<SpeechConfig>) {
    config = { ...config, ...newConfig };
}

export function getVoices(): SpeechSynthesisVoice[] {
    if (voices.length === 0) {
       populateVoiceList();
    }
    return voices;
}

export function speak(text: string) {
    if (!config.enabled || !text) {
        return;
    }

    // Clean up markdown for a more natural speech flow
    const cleanText = text
        .replace(/```think[\s\S]*?```/g, 'Thinking...')
        .replace(/<llamahub_tool_call>[\s\S]*?<\/llamahub_tool_call>/g, '')
        .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
        .replace(/[\*#_~]/g, '');

    if (!cleanText.trim()) {
        return;
    }

    // Stop any currently playing audio, regardless of provider
    stop();

    if (config.ttsProvider === 'piper') {
        playPiper(cleanText);
    } else if (config.ttsProvider === 'systemPiper') {
        speakViaProxy(cleanText);
    } else { // Browser-native TTS
        if (typeof speechSynthesis === 'undefined') return;
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        if (voices.length === 0) populateVoiceList();
        const selectedVoice = voices.find(v => v.name === config.ttsVoiceName);
        
        utterance.voice = selectedVoice || null;
        utterance.volume = 1;
        utterance.rate = 1;
        utterance.pitch = 1;

        speechSynthesis.speak(utterance);
    }
}

export function stop() {
    if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.cancel();
    }
     if (audioContext) {
        // A simple way to stop is to disconnect and create a new context next time.
        // This stops any currently playing buffer sources.
        audioContext.close().then(() => {
            audioContext = null;
        });
    }
}

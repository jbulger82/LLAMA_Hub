import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { ToolsPopover } from './ToolsPopover';
import { useStore } from '../store';
import { countTokens } from '../services/tokenUtils';

// For Silero VAD, which is loaded from a CDN script in index.html
declare const vad: any;

interface ChatInputProps {
  onSendMessage?: (text: string, options?: { attachedFile?: File }) => void;
  isLoading?: boolean;
}

export interface ChatInputHandle {
  insertText: (text: string) => void;
  stageCommand: (tool: { title: string; command: string }) => void;
}

type VoiceState = 'IDLE' | 'LISTENING' | 'CONNECTING' | 'PROCESSING';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      } else {
        reject(new Error('Failed to convert Blob to base64.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read audio blob.'));
    reader.readAsDataURL(blob);
  });
};

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>((props, ref) => {
  const storeSendMessage = useStore(state => state.sendMessage);
  const storeIsLoading = useStore(state => state.isLoading);
  const researchJob = useStore(state => state.researchJob);
  const stopGeneration = useStore(state => state.stopGeneration);
  const settings = useStore(state => state.settings);
  const saveSettings = useStore(state => state.saveSettings);
  const chats = useStore(state => state.chats);
  const currentChatId = useStore(state => state.currentChatId);
  
  const [text, setText] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isToolsPopoverOpen, setIsToolsPopoverOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const micSessionRef = useRef<number>(0);
  
  // Refs for voice processing
  const recognitionRef = useRef<any>(null); // For browser speech recognition
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<any>(null);
  const whisperRecorderRef = useRef<MediaRecorder | null>(null);
  const whisperStreamRef = useRef<MediaStream | null>(null);
  const whisperChunksRef = useRef<Blob[]>([]);
  const whisperAbortRef = useRef(false);

  useImperativeHandle(ref, () => ({
    insertText: (command: string) => {
      setText(command);
      textareaRef.current?.focus();
    },
    stageCommand: (tool: { title: string; command: string }) => {
      if (tool.command) {
        setText(tool.command);
      }
      textareaRef.current?.focus();
    }
  }));

  const contextUsage = useMemo(() => {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return { used: 0, total: 0, percentage: 0 };

    const totalContextSize = settings.aiProvider === 'localLlm' 
      ? settings.contextLength 
      : 32768; // A reasonable default for modern cloud models

    const historyTokens = chat.messages.reduce((acc, msg) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
            return acc + countTokens(msg.content);
        }
        return acc;
    }, countTokens(settings.systemPrompt));

    const inputTokens = countTokens(text);
    const used = historyTokens + inputTokens;
    const percentage = totalContextSize > 0 ? (used / totalContextSize) * 100 : 0;
    
    return { used, total: totalContextSize, percentage };
  }, [chats, currentChatId, text, settings]);


  const handleSelectTool = (tool: { id: string, title: string, command: string }) => {
    if (tool.command) {
        setText(prev => (prev ? `${prev.trim()} ${tool.command}` : tool.command).trim());
    }
    setIsToolsPopoverOpen(false);
    textareaRef.current?.focus();
  };

  const cycleReasoningLevel = () => {
    const order: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
    const current = settings.reasoningLevel || 'medium';
    const next = order[(order.indexOf(current) + 1) % order.length];
    saveSettings({ ...settings, reasoningLevel: next });
  };

  const reasoningLabel =
    settings.reasoningLevel === 'high'
      ? 'High reasoning'
      : settings.reasoningLevel === 'low'
        ? 'Low reasoning'
        : 'Medium reasoning';
  const reasoningBadge =
    settings.reasoningLevel === 'high'
      ? 'H'
      : settings.reasoningLevel === 'low'
        ? 'L'
        : 'M';

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 208;
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [text]);

  const cleanupVoice = useCallback((invalidateSession: boolean = false) => {
    if (invalidateSession) {
        micSessionRef.current += 1; // invalidate any in-flight async setup
    }
    vadRef.current?.destroy();
    vadRef.current = null;

    wsRef.current?.close();
    wsRef.current = null;
    
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    whisperAbortRef.current = true;
    if (whisperRecorderRef.current && whisperRecorderRef.current.state !== 'inactive') {
        whisperRecorderRef.current.stop();
    }
    whisperRecorderRef.current = null;
    whisperStreamRef.current?.getTracks().forEach(track => track.stop());
    whisperStreamRef.current = null;
    whisperChunksRef.current = [];

    audioContextRef.current?.close();
    audioContextRef.current = null;

    recognitionRef.current?.abort();
    setVoiceState('IDLE');
  }, []);
  
  const startVoskListening = useCallback(async () => {
    if (!settings.voskSttUrl) {
      alert("Vosk Server WebSocket URL is not configured in settings.");
      return;
    }
    const sessionId = micSessionRef.current + 1;
    micSessionRef.current = sessionId;
    setVoiceState('CONNECTING');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (micSessionRef.current !== sessionId) {
        // Session was invalidated while awaiting permission
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);

      const ws = new WebSocket(settings.voskSttUrl);
      wsRef.current = ws;

      let jsonBuffer = '';

      ws.onopen = async () => {
        if (micSessionRef.current !== sessionId) {
            ws.close();
            return;
        }
        if (settings.enableSileroVad) {
            setVoiceState('LISTENING');
            vadRef.current = await vad.MicVAD.new({
                onSpeechEnd: () => {
                    if (wsRef.current?.readyState === WebSocket.OPEN && micSessionRef.current === sessionId) {
                        wsRef.current.send('{"eof" : 1}');
                    }
                },
                workletURL: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web/dist/vad.worklet.min.js",
                modelURL: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web/dist/silero_vad.onnx",
            });
            vadRef.current.start();
        } else {
             setVoiceState('LISTENING');
        }

        const processor = context.createScriptProcessor(1024, 1, 1);
        processor.onaudioprocess = (event) => {
            if (ws.readyState !== WebSocket.OPEN || micSessionRef.current !== sessionId) return;
            if (!settings.enableSileroVad || (vadRef.current && !vadRef.current.listening)) {
                 const inputData = event.inputBuffer.getChannelData(0);
                 ws.send(inputData.buffer);
            }
        };
        source.connect(processor);
        processor.connect(context.destination);
      };

      ws.onmessage = (event) => {
        if (micSessionRef.current !== sessionId) return;
        jsonBuffer += event.data;
        try {
            const result = JSON.parse(jsonBuffer);
            jsonBuffer = ''; 

            if (result.text) {
              setText(prev => (prev ? prev + ' ' : '') + result.text);
            }
            if (result.result) {
                cleanupVoice();
            }
        } catch (e) {
            if (jsonBuffer.length > 1 * 1024 * 1024) { 
                console.error("Vosk JSON buffer exceeded 1MB, clearing.");
                jsonBuffer = '';
            }
        }
      };
      
      ws.onerror = (error) => {
        console.error("Vosk WebSocket error:", error);
        alert("Could not connect to Vosk server. Is it running?");
        cleanupVoice();
      };

      ws.onclose = () => {
        cleanupVoice();
      };
    } catch (err) {
      console.error("Error starting Vosk listening:", err);
      alert("Could not start microphone. Please ensure permissions are granted.");
      cleanupVoice();
    }
  }, [settings, cleanupVoice]);
  
  const startBrowserListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser-native speech recognition is not supported in this browser.");
      return;
    }
    if (!recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.onstart = () => setVoiceState('LISTENING');
        recognition.onresult = (event: any) => setText(prev => prev ? `${prev.trim()} ${event.results[0][0].transcript}` : event.results[0][0].transcript);
        recognition.onerror = (event: any) => {
            if (event.error === 'not-allowed') alert("Microphone permission was denied.");
            else console.error('Speech recognition error:', event.error);
            cleanupVoice();
        };
        recognition.onend = () => cleanupVoice();
        recognitionRef.current = recognition;
    }
    try {
        recognitionRef.current.start();
    } catch (err) {
        console.error("Error starting speech recognition:", err);
    }
  }, [cleanupVoice]);
  
  const startWhisperScriptListening = useCallback(async () => {
    if (!settings.proxyUrl) {
        alert("Proxy URL is not configured. Update Networking settings first.");
        return;
    }
    try {
        setVoiceState('CONNECTING');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        whisperAbortRef.current = false;
        whisperStreamRef.current = stream;
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        whisperRecorderRef.current = recorder;
        whisperChunksRef.current = [];

        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                whisperChunksRef.current.push(event.data);
            }
        };

        recorder.onerror = (event) => {
            console.error("Whisper recorder error:", event);
            cleanupVoice();
        };

        recorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());
            whisperStreamRef.current = null;

            if (whisperAbortRef.current) {
                whisperAbortRef.current = false;
                whisperChunksRef.current = [];
                setVoiceState('IDLE');
                return;
            }

            setVoiceState('PROCESSING');
            try {
                const blob = new Blob(whisperChunksRef.current, { type: recorder.mimeType });
                whisperChunksRef.current = [];
                const base64 = await blobToBase64(blob);
                const response = await fetch(`${settings.proxyUrl}/proxy/voice/transcribe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audio: base64, mimeType: blob.type }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload.message || 'Transcription failed.');
                }
                const transcript = (payload.text || '').trim();
                if (transcript) {
                    setText(prev => prev ? `${prev.trim()} ${transcript}` : transcript);
                }
            } catch (error: any) {
                console.error("Failed to transcribe audio:", error);
                alert(error?.message || "Failed to transcribe audio via Whisper.");
            } finally {
                setVoiceState('IDLE');
            }
        };

        recorder.start();
        setVoiceState('LISTENING');
    } catch (error) {
        console.error("Unable to access microphone for Whisper script:", error);
        alert("Unable to access microphone. Please check browser permissions.");
        cleanupVoice();
    }
  }, [cleanupVoice, settings.proxyUrl]);

  const stopWhisperScriptListening = useCallback(() => {
    if (whisperRecorderRef.current && whisperRecorderRef.current.state === 'recording') {
        whisperRecorderRef.current.stop();
    } else {
        cleanupVoice(true);
    }
  }, [cleanupVoice]);


  const handleMicClick = () => {
    if (settings.sttProvider === 'systemWhisper') {
        if (voiceState === 'LISTENING') {
            stopWhisperScriptListening();
        } else if (voiceState === 'PROCESSING') {
            // Ignore clicks while processing to avoid interrupting transcription.
            return;
        } else {
            startWhisperScriptListening();
        }
        return;
    }

    if (voiceState !== 'IDLE') {
        cleanupVoice(true);
    } else {
        if (settings.sttProvider === 'vosk') {
            startVoskListening();
        } else {
            startBrowserListening();
        }
    }
  };
  
  const handleAddFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setAttachedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMessage = text.trim();

    if (finalMessage || attachedFile) {
      const sendMessageFunc = props.onSendMessage || storeSendMessage;
      sendMessageFunc(finalMessage, { attachedFile: attachedFile || undefined });
      setText('');
      setAttachedFile(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasteThreshold = settings.pasteLengthToFile;
    if (pasteThreshold && pasteThreshold > 0) {
        const pastedText = event.clipboardData.getData('text');
        if (pastedText && pastedText.length > pasteThreshold) {
            event.preventDefault();
            const blob = new Blob([pastedText], { type: 'text/plain' });
            const file = new File([blob], 'pasted.txt', { type: 'text/plain' });
            setAttachedFile(file);
        }
    }
  };
  
  const isLoading = props.isLoading !== undefined ? props.isLoading : storeIsLoading;
  const isInputLoading = isLoading || (!!researchJob && researchJob.status !== 'complete');
  const canSubmit = (!!text.trim() || !!attachedFile) && !isInputLoading;

  return (
    <div>
        <form onSubmit={handleSubmit} className="relative">
        <div className={`w-full flex flex-col rounded-2xl bg-base-200 border border-base-300 focus-within:border-primary transition-all p-1.5 gap-2 ${isInputLoading ? 'opacity-60' : ''}`}>
            {attachedFile && (
                <div className="flex items-center gap-2 p-2 bg-base-300 rounded-lg mx-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3.375 3.375 0 1 1 18.374 7.3l-8.47 8.47a.75.75 0 0 1-1.06-1.06l8.47-8.47a1.875 1.875 0 1 0-2.652-2.652L6.832 19.82a4.5 4.5 0 0 0 6.364 6.364l7.693-7.693a.75.75 0 0 1 1.06 1.06Z" /></svg>
                    <span className="text-sm truncate flex-1">{attachedFile.name}</span>
                    <button type="button" onClick={() => setAttachedFile(null)} className="p-1 rounded-full hover:bg-base-content/10">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
            <div className="flex items-start gap-2 px-1.5">
                <div className="flex items-center gap-1 flex-shrink-0 pt-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isInputLoading} accept="image/*,text/*,.pdf,.md,.docx" />
                    <button
                        type="button"
                        onClick={cycleReasoningLevel}
                        className="relative p-2 rounded-full hover:bg-base-300 transition-colors text-base-content/80 disabled:opacity-50"
                        disabled={isInputLoading}
                        title={reasoningLabel}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3 3" />
                            <circle cx="12" cy="12" r="8.25" />
                        </svg>
                        <span className="absolute -right-0.5 -bottom-0.5 text-[10px] font-semibold px-1 py-0.5 rounded-full bg-base-300 text-base-content/80 leading-none">
                            {reasoningBadge}
                        </span>
                    </button>
                    <button type="button" ref={toolsButtonRef} onClick={() => setIsToolsPopoverOpen(p => !p)} className="p-2 rounded-full hover:bg-base-300 transition-colors text-base-content/70 disabled:opacity-50" disabled={isInputLoading}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0h9.75m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg>
                    </button>
                </div>
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={isInputLoading ? "Please wait..." : "Ask anything..."}
                    rows={1}
                    className="flex-1 w-full bg-transparent resize-none focus:outline-none text-base-content placeholder:text-base-content/60 text-sm sm:text-base pt-2.5"
                    disabled={isInputLoading}
                />
                <div className="flex items-center gap-1 ml-2 flex-shrink-0 pt-2">
                    <button 
                        type="button" 
                        onClick={handleMicClick} 
                        className="p-2 rounded-full hover:bg-base-300 transition-colors text-base-content/70 disabled:opacity-50" 
                        disabled={isInputLoading || !settings.voiceEnabled || voiceState === 'PROCESSING'}
                        title={
                            voiceState === 'PROCESSING'
                                ? "Transcribing audio..."
                                : voiceState !== 'IDLE'
                                    ? "Stop listening"
                                    : "Use Microphone"
                        }
                    >
                        {voiceState === 'PROCESSING' ? (
                            <span className="loading loading-spinner loading-sm text-primary"></span>
                        ) : voiceState !== 'IDLE' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-500 animate-pulse">
                                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v.75a4.5 4.5 0 0 0 9 0v-.75a.75.75 0 0 1 1.5 0v.75a6 6 0 1 1-12 0v-.75a.75.75 0 0 1 .75-.75Z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                            </svg>
                        )}
                    </button>
                    {isLoading ? (
                        <button
                            type="button"
                            onClick={stopGeneration}
                            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors bg-base-300 text-base-content/70 hover:bg-error hover:text-error-content"
                            title="Stop generation"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M5.25 3A2.25 2.25 0 003 5.25v9.5A2.25 2.25 0 005.25 17h9.5A2.25 2.25 0 0017 14.75v-9.5A2.25 2.25 0 0014.75 3h-9.5z" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                                canSubmit ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content/50'
                            } disabled:cursor-not-allowed`}
                            title="Send message"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3l7.5 7.5" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
        <ToolsPopover 
            isOpen={isToolsPopoverOpen} 
            onClose={() => setIsToolsPopoverOpen(false)} 
            onSelectCommand={handleSelectTool} 
            anchorElement={toolsButtonRef.current}
            onAttachFile={handleAddFileClick}
        />
        </form>
        {currentChatId && (
            <div className="text-center text-xs text-base-content/60 mt-2 px-2 space-y-1">
                <progress 
                    className="progress progress-primary w-full h-1" 
                    value={contextUsage.percentage} 
                    max="100"
                ></progress>
                <div>
                    Context: {contextUsage.used.toLocaleString()} / {contextUsage.total.toLocaleString()} Tokens
                </div>
            </div>
        )}
    </div>
  );
});

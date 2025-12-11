import React, { useState, useEffect, useMemo } from 'react';
import { type Message, Role } from '../types';
import ReactMarkdown from 'https://esm.sh/react-markdown@8?bundle';
import remarkGfm from 'https://esm.sh/remark-gfm@3?bundle';
import * as speechService from '../services/speechService';
import { useStore } from '../store';
import { type Settings } from '../services/settings';
import { CodeBlock } from './CodeBlock';

// --- Icons ---

const ActionButton: React.FC<{ onClick: (e: React.MouseEvent) => void; children: React.ReactNode; title: string; disabled?: boolean; }> = ({ onClick, children, title, disabled }) => (
    <button onClick={onClick} title={title} disabled={disabled} className="p-1.5 rounded-md text-base-content/60 hover:text-base-content hover:bg-base-content/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {children}
    </button>
);

const SpeakerIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 8.243a1 1 0 0 1 .293 1.414l-3 3a1 1 0 0 1-1.414-1.414l3-3a1 1 0 0 1 1.121 0ZM12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    </svg>
);

const StopIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3-3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
    </svg>
);

const CopyIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a2.25 2.25 0 0 1-2.25 2.25h-1.5a2.25 2.25 0 0 1-2.25-2.25v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
);

const EditIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
);

const RegenerateIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 11.664 0l3.18-3.185m-3.18 3.185-3.18-3.185m0 0-3.18 3.183m3.18-3.185-3.18-3.185" />
    </svg>
);


// --- Sub-components for MessageItem ---

const ThinkingIndicator: React.FC = () => {
  const text = "Thinking...";
  return (
    <>
      <style>{`
        @keyframes letter-glow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
            color: hsl(var(--p)); /* Use primary color from theme */
          }
        }
        .animated-letter {
          display: inline-block;
          animation: letter-glow 1.8s infinite;
        }
      `}</style>
      <div className="flex items-center gap-1 text-sm text-base-content/80 font-semibold mb-2">
        {text.split('').map((char, index) => (
          <span
            key={index}
            className="animated-letter"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </div>
    </>
  );
};

const BrainIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5.25A3.75 3.75 0 0 1 18.75 9v3.75a4.5 4.5 0 0 1-4.5 4.5H13.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5.25A3.75 3.75 0 0 0 5.25 9v3.75a4.5 4.5 0 0 0 4.5 4.5H10.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15" />
    </svg>
);

const ToggleIcon: React.FC<{ open: boolean }> = ({ open }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
);

const ReasoningBlock: React.FC<{ content: string; isStreaming: boolean; hasFinalAnswer: boolean }> = ({ content, isStreaming, hasFinalAnswer }) => {
    const [isExpanded, setIsExpanded] = useState(!hasFinalAnswer);

    useEffect(() => {
        if (isStreaming) {
            setIsExpanded(true);
        }
    }, [isStreaming]);

    if (!content.trim()) {
        return null;
    }

    return (
        <div className="mb-3 border border-base-300 bg-base-200/60 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setIsExpanded(prev => !prev)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-base-content/80"
            >
                <span className="inline-flex items-center gap-2 uppercase tracking-wide">
                    <BrainIcon />
                    {isStreaming ? 'Reasoning…' : 'Reasoning'}
                </span>
                <ToggleIcon open={isExpanded} />
            </button>
            {isExpanded && (
                <pre className="px-3 pb-3 text-xs whitespace-pre-wrap font-mono text-base-content/80">
                    {content}
                </pre>
            )}
        </div>
    );
};


const MessageContent: React.FC<{ content: string }> = ({ content }) => {
    
    // Memoizing the components object is crucial for performance.
    // It prevents ReactMarkdown from re-creating components on every render,
    // which fixes the visual glitch when streaming code blocks.
    const memoizedComponents = useMemo(() => ({
        code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeText = String(children).replace(/\n$/, '');
            if (!inline && match) {
                const language = match[1];
                return <CodeBlock language={language} code={codeText} />;
            }
            return (
                <code className="bg-base-300/80 px-1.5 py-0.5 rounded-sm text-sm" {...props}>
                    {children}
                </code>
            );
        },
    }), []);

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={memoizedComponents}
        >
            {content}
        </ReactMarkdown>
    );
};


const MessageItem: React.FC<{ message: Message; settings: Settings; onEdit: (id: string, content: string) => void; onRegenerate: () => void; isLastMessage: boolean }> =
    ({ message, settings, onEdit, onRegenerate, isLastMessage }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [editText, setEditText] = useState(message.content);

        // The store now provides pre-parsed `thinking` and `content` fields.
        // This avoids expensive parsing on every render, fixing the performance bottleneck.
        const { thinking, content: finalContent } = useMemo(() => {
            if (message.role === Role.ASSISTANT) {
                // The `message.thinking` prop is the source of truth from the store.
                // We format it here for display, removing the initial /think command.
                const displayThinking = message.thinking
                    ? message.thinking.trim().replace(/^\/think\s*/i, '').trim()
                    : null;
                
                // We only want to display the thinking block if there's actual thought content left
                const finalThinking = (displayThinking && displayThinking.length > 0) ? displayThinking : null;
        
                return { thinking: finalThinking, content: message.content };
            }
            return { thinking: null, content: message.content };
        }, [message.content, message.thinking, message.role]);


        const handleCopy = () => navigator.clipboard.writeText(message.content);
        
        const handleSpeak = () => {
            // Reconstruct the full response text for the speech service.
            const thinkingText = thinking ? `\`\`\`think\n${thinking}\n\`\`\`` : '';
            const fullText = [thinkingText, finalContent].filter(Boolean).join('\n\n');
            speechService.speak(fullText);
        };

        const handleEditSubmit = () => {
            if (editText.trim() !== message.content) {
                onEdit(message.id, editText.trim());
            }
            setIsEditing(false);
        };

        if (message.type === 'status') {
            return (
                <div className="text-center text-xs text-base-content/60 py-2 px-4 italic">
                    {message.content}
                </div>
            );
        }

        const isUser = message.role === Role.USER;

        const densityClasses = {
            'cozy': 'py-4',
            'compact': 'py-2',
            'ultra-compact': 'py-1',
        };
        const paddingClass = densityClasses[settings.messageDensity] || 'py-4';


        return (
            <div className={`group w-full px-4 md:px-6 ${paddingClass}`}>
                <div className={`w-full max-w-4xl mx-auto flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Message Bubble */}
                    <div className={`flex-1 min-w-0 ${isUser ? 'flex justify-end' : ''}`}>
                         {isEditing ? (
                            <div className="w-full max-w-[85%]">
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }}}
                                    className="w-full p-2 rounded-md bg-base-200 border border-base-300 text-sm"
                                    autoFocus
                                />
                                <div className="flex gap-2 mt-2 justify-end">
                                    <button onClick={handleEditSubmit} className="btn btn-sm btn-primary">Save & Submit</button>
                                    <button onClick={() => setIsEditing(false)} className="btn btn-sm btn-ghost">Cancel</button>
                                </div>
                            </div>
                         ) : isUser ? (
                             (() => {
                                const hasCodeBlock = message.content.includes('```');
                                // If message contains code blocks, render without the bubble for a cleaner, multi-block look.
                                if (hasCodeBlock) {
                                    return (
                                        <div className="w-full max-w-[85%]">
                                            <div className="prose prose-sm dark:prose-invert max-w-none text-left">
                                                <MessageContent content={message.content} />
                                            </div>
                                        </div>
                                    );
                                }
                                // Otherwise, render as a standard chat bubble.
                                return (
                                    <div className="max-w-[85%] bg-neutral text-neutral-content rounded-xl px-4 py-2">
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-left">
                                            {message.content && <MessageContent content={message.content} />}
                                        </div>
                                    </div>
                                );
                            })()
                         ) : (
                            // Assistant Message Layout
                            <div className="flex-1 text-left">
                                {message.isThinking && !thinking && !finalContent && <ThinkingIndicator />}

                                {thinking && (
                                    <ReasoningBlock
                                        content={thinking}
                                        isStreaming={message.isThinking}
                                        hasFinalAnswer={Boolean(finalContent?.trim())}
                                    />
                                )}
                                
                                {message.toolInfo && (
                                    <div className="mb-2 border border-base-300 bg-base-200/50 rounded-lg overflow-hidden">
                                        <div className="px-3 py-1 bg-base-300/70 text-xs font-semibold text-base-content/80 tracking-wider">TOOL USED</div>
                                        <pre className="p-3 text-xs overflow-x-hidden whitespace-pre-wrap break-words font-mono bg-transparent !my-0 border-b border-base-300"><code>{message.toolInfo.command}</code></pre>
                                        <div className="px-3 pt-2 pb-1 text-xs font-bold uppercase text-base-content/70">OUTPUT</div>
                                        <pre className="p-3 pt-1 text-xs overflow-x-hidden whitespace-pre-wrap break-words font-mono bg-transparent !my-0"><code>{message.toolInfo.output}</code></pre>
                                    </div>
                                )}

                                {(finalContent || message.imageUrl) && (
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        {message.imageUrl && <img src={message.imageUrl} alt="Generated content" className="max-w-sm rounded-lg shadow-md my-2" />}
                                        {finalContent && <MessageContent content={finalContent} />}
                                    </div>
                                )}
                            </div>
                         )}
                    </div>

                    {/* Action Buttons: appear on hover, aligned with the message */}
                    <div className="flex-shrink-0 flex items-center self-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isUser && (thinking || finalContent) && <ActionButton onClick={handleSpeak} title="Read aloud"><SpeakerIcon /></ActionButton>}
                        {message.content && <ActionButton onClick={handleCopy} title="Copy"><CopyIcon /></ActionButton>}
                        {isUser && !isEditing && <ActionButton onClick={() => setIsEditing(true)} title="Edit & Resubmit"><EditIcon /></ActionButton>}
                        {isLastMessage && !isUser && finalContent && <ActionButton onClick={onRegenerate} title="Regenerate"><RegenerateIcon /></ActionButton>}
                    </div>
                </div>
            </div>
        );
    };

interface MessageListProps {
  messages?: Message[];
  settings?: Settings;
  isLoading?: boolean;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateResponse?: (assistantMessageIndex: number) => void;
}

export const MessageList: React.FC<MessageListProps> = (props) => {
    const chat = useStore(state => state.chats.find(c => c.id === state.currentChatId));
    const storeSettings = useStore(state => state.settings);
    const storeIsLoading = useStore(state => state.isLoading);
    const storeEditMessage = useStore(state => state.editMessage);
    const storeRegenerateResponse = useStore(state => state.regenerateResponse);

    const messages = props.messages ?? chat?.messages ?? [];
    const settings = props.settings ?? storeSettings;
    const isLoading = props.isLoading ?? storeIsLoading;
    const editMessage = props.onEditMessage ?? storeEditMessage;
    const regenerateResponse = props.onRegenerateResponse ?? storeRegenerateResponse;
    
    const handleRegenerate = (index: number) => {
        if (!isLoading) {
            regenerateResponse(index);
        }
    };

    return (
        <div className="pt-4">
            {messages.map((message, index) => (
                <MessageItem 
                    key={message.id} 
                    message={message} 
                    settings={settings}
                    onEdit={editMessage}
                    onRegenerate={() => handleRegenerate(index)}
                    isLastMessage={index === messages.length - 1}
                />
            ))}
            {isLoading && messages[messages.length - 1]?.role !== Role.ASSISTANT && (
                 <div className="px-4 md:px-6 py-4">
                    <div className="w-full max-w-4xl mx-auto flex gap-3">
                        <div className="flex items-center gap-2">
                             <span className="loading loading-dots loading-sm text-base-content/50"></span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

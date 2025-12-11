
import React, { useRef, useEffect, forwardRef, useCallback } from 'react';
import { type Message } from '../types';
import { ChatInput, type ChatInputHandle } from './ChatInput';
import { MessageList } from './MessageList';
import { WelcomeScreen } from './WelcomeScreen';
import { DeepResearchStatus } from './DeepResearchStatus';
import { useStore } from '../store';

interface ChatViewProps {
  // No props needed after refactoring
}

export const ChatView = forwardRef<ChatInputHandle, ChatViewProps>((_props, ref) => {
  const mainContentRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // FIX: Select state granularly to prevent infinite re-renders.
  // The original selector `state.chats.find(...)` derived a new object on each store update, causing a loop.
  // By selecting the array and the ID separately, the selectors are stable.
  const chats = useStore(state => state.chats);
  const currentChatId = useStore(state => state.currentChatId);
  const currentChat = chats.find(c => c.id === currentChatId);

  const messages = currentChat?.messages || [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    // This robust implementation uses a MutationObserver to scroll to the bottom
    // only *after* the DOM has been updated with new messages. This solves the
    // "race condition" where fast local models would render content faster than
    // a simple useEffect + setTimeout could catch, causing scrolling to fail.

    const mainEl = mainContentRef.current;
    if (!mainEl) return;
    
    // Initial scroll on chat load
    scrollToBottom();

    const observer = new MutationObserver((mutations) => {
        // We are only interested in mutations that change the scroll height.
        // A new message being added (childList) or content streaming in (characterData)
        // are the primary triggers.
        for (const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                scrollToBottom();
                break; // No need to check other mutations
            }
        }
    });

    observer.observe(mainEl, {
      childList: true, // Watch for direct children changes (e.g., adding a new message bubble)
      subtree: true,   // Watch for changes in all descendants (e.g., text streaming into a message)
      characterData: true, // Watch for changes to text nodes, which is how streaming content appears
    });

    return () => {
      observer.disconnect();
    };
  }, [currentChat?.id, scrollToBottom]);


  return (
    <div className="flex-1 flex flex-col bg-base-100 h-full transition-colors duration-300">
      <main ref={mainContentRef} className="flex-1 overflow-y-auto">
        <div className="relative h-full">
          {!currentChat || messages.length === 0 ? (
            <WelcomeScreen />
          ) : (
            <div>
                <MessageList />
                <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>
      <div className="w-full mx-auto md:max-w-3xl lg:max-w-4xl p-4">
        <DeepResearchStatus />
        <ChatInput ref={ref} />
      </div>
    </div>
  );
});

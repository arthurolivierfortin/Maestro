import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '../../hooks/useChat';
import type { ChatMessage as ChatMessageType } from '../../services/chatService';

interface ChatPanelProps {
  model?: string;
  systemPrompt?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ model, systemPrompt }) => {
  const { messages, isLoading, error, streamingContent, sendMessage, clearMessages, stopGeneration } =
    useChat({ model, systemPrompt });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="chat-panel">
      <div className="chat-panel__messages">
        {messages.length === 0 && !isLoading && (
          <div className="chat-panel__empty">
            <p>Send a message to start chatting.</p>
          </div>
        )}

        {messages.map((msg: ChatMessageType, i: number) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {streamingContent && (
          <ChatMessage
            message={{ role: 'assistant', content: streamingContent }}
            isStreaming
          />
        )}

        {error && (
          <div className="chat-panel__error">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-panel__footer">
        <ChatInput onSend={sendMessage} isLoading={isLoading} onStop={stopGeneration} />
        {messages.length > 0 && (
          <button className="chat-panel__clear" onClick={clearMessages}>
            Clear conversation
          </button>
        )}
      </div>
    </div>
  );
};

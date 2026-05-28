import { useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { colors, spacing } from '../theme/tokens';

export function ConsolePage() {
  const { messages, isLoading, error, streamingContent, sendMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${spacing.sm} 0`,
      }}>
        {messages.length === 0 && !streamingContent && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: colors.muted,
            fontSize: '14px',
          }}>
            Type a message to start a conversation.
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role as 'user' | 'assistant'} content={msg.content} />
        ))}
        {streamingContent && (
          <ChatMessage role="assistant" content={streamingContent} isStreaming />
        )}
        {error && (
          <div style={{
            padding: `${spacing.sm} ${spacing.md}`,
            color: colors.error,
            fontSize: '13px',
          }}>
            Error: {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}

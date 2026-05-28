import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { HelpOverlay } from '../components/HelpOverlay';
import { colors, spacing } from '../theme/tokens';

interface ConsolePageProps {
  showHelp?: boolean;
  onToggleHelp?: () => void;
}

export function ConsolePage({ showHelp: externalShowHelp, onToggleHelp }: ConsolePageProps = {}) {
  const { messages, isLoading, error, streamingContent, sendMessage, clearMessages, stopGeneration } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [internalShowHelp, setInternalShowHelp] = useState(false);

  const showHelp = externalShowHelp ?? internalShowHelp;
  const toggleHelp = useCallback(() => {
    if (onToggleHelp) {
      onToggleHelp();
    } else {
      setInternalShowHelp((prev) => !prev);
    }
  }, [onToggleHelp]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSlashCommand = useCallback(
    (command: string, _args: string) => {
      switch (command) {
        case 'help':
          toggleHelp();
          break;
        case 'clear':
        case 'new':
          clearMessages();
          break;
        case 'stop':
          stopGeneration();
          break;
        case 'quit':
          if (typeof window !== 'undefined' && window.close) {
            window.close();
          }
          break;
      }
    },
    [clearMessages, stopGeneration, toggleHelp]
  );

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
      <ChatInput onSend={sendMessage} onSlashCommand={handleSlashCommand} isLoading={isLoading} />
      {showHelp && <HelpOverlay onClose={toggleHelp} />}
    </div>
  );
}

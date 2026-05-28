import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { HelpOverlay } from '../components/HelpOverlay';

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
    <div className="col" style={{ height: '100%', minHeight: 0 }}>
      <div className="conv">
        {messages.length === 0 && !streamingContent && (
          <div className="line">
            <span className="body dim">Type a message to start a conversation.</span>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role as 'user' | 'assistant'} content={msg.content} />
        ))}
        {streamingContent && (
          <ChatMessage role="assistant" content={streamingContent} isStreaming />
        )}
        {error && (
          <div className="line err">
            <span className="body">Error: {error}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSend={sendMessage} onSlashCommand={handleSlashCommand} isLoading={isLoading} />
      {showHelp && <HelpOverlay onClose={toggleHelp} />}
    </div>
  );
}

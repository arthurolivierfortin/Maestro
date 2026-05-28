import { useState, useCallback, useRef } from 'react';
import {
  ChatMessage,
  sendChatCompletion,
  streamChatCompletion,
} from '../services/chatService';

interface UseChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (options.systemPrompt) {
      return [{ role: 'system', content: options.systemPrompt }];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef(false);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      const userMessage: ChatMessage = { role: 'user', content };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsLoading(true);
      setStreamingContent('');
      abortRef.current = false;

      try {
        let fullContent = '';
        await streamChatCompletion(
          newMessages,
          {
            model: options.model,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          },
          (chunk) => {
            if (abortRef.current) return;
            fullContent += chunk;
            setStreamingContent(fullContent);
          },
          () => {
            if (abortRef.current) return;
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: fullContent },
            ]);
            setStreamingContent('');
          },
          () => {
            // Fallback to non-streaming
            fallbackSend(newMessages, fullContent);
          }
        );
      } catch {
        await fallbackSend(newMessages, '');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, options.model, options.temperature, options.maxTokens]
  );

  const fallbackSend = async (msgs: ChatMessage[], _partial: string) => {
    try {
      const response = await sendChatCompletion(msgs, {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.content },
      ]);
      setStreamingContent('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to send message';
      setError(message);
      setStreamingContent('');
    }
  };

  const clearMessages = useCallback(() => {
    const initial: ChatMessage[] = options.systemPrompt
      ? [{ role: 'system', content: options.systemPrompt }]
      : [];
    setMessages(initial);
    setStreamingContent('');
    setError(null);
  }, [options.systemPrompt]);

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    setIsLoading(false);
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: streamingContent },
      ]);
      setStreamingContent('');
    }
  }, [streamingContent]);

  const displayMessages = messages.filter((m) => m.role !== 'system');

  return {
    messages: displayMessages,
    isLoading,
    error,
    streamingContent,
    sendMessage,
    clearMessages,
    stopGeneration,
  };
}

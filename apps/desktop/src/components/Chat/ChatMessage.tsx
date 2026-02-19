import React from 'react';
import type { ChatMessage as ChatMessageType } from '../../services/chatService';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__avatar">
        {isUser ? 'U' : 'A'}
      </div>
      <div className="chat-message__content">
        <div className="chat-message__role">
          {isUser ? 'You' : 'Assistant'}
        </div>
        <div className="chat-message__text">
          {message.content}
          {isStreaming && <span className="chat-message__cursor">|</span>}
        </div>
      </div>
    </div>
  );
};

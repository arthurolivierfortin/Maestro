interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const roleClass = role === 'user' ? 'user' : 'agent';

  return (
    <div className={'line ' + roleClass}>
      <span className="ts" />
      <span className="body">
        {role === 'user' && <span className="pre">❯</span>}
        {content}
        {isStreaming && <span className="caret" />}
      </span>
    </div>
  );
}

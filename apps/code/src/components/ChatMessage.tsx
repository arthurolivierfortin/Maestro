import { colors, spacing, fontFamily } from '../theme/tokens';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const label = role === 'user' ? '> you' : '> assistant';
  const labelColor = role === 'user' ? colors.accent : colors.success;

  return (
    <div style={{
      padding: `${spacing.sm} ${spacing.md}`,
      fontFamily,
      fontSize: '14px',
      lineHeight: '1.6',
    }}>
      <div style={{ color: labelColor, fontWeight: 700, marginBottom: spacing.xs }}>
        {label}
      </div>
      <div style={{ color: colors.fg, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {content}
        {isStreaming && <span className="streaming-cursor" />}
      </div>
    </div>
  );
}

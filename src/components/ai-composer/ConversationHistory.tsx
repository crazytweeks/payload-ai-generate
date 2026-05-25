import type { AIConversationMessage } from '../../ai-types';
import { getConversationMessageKey } from './utils';

/**
 * Shows recent user and assistant messages that shape follow-up generations.
 *
 * @param props.messages - Persisted prompt conversation history.
 */
export const ConversationHistory = ({ messages }: { messages: AIConversationMessage[] }) => {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: '0.5rem',
        maxHeight: '12rem',
        overflowY: 'auto',
      }}
    >
      {messages.slice(-6).map((message) => (
        <div
          key={getConversationMessageKey(message)}
          style={{
            background:
              message.role === 'user'
                ? 'color-mix(in srgb, var(--theme-success-500) 8%, transparent)'
                : 'var(--theme-bg)',
            border: '1px solid var(--theme-elevation-100)',
            borderRadius: '0.625rem',
            padding: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            {message.role === 'user' ? 'User' : 'Assistant'}
          </div>
          <div
            style={{
              fontFamily: message.role === 'assistant' ? 'monospace' : 'inherit',
              fontSize: '0.8125rem',
              overflowWrap: 'anywhere',
              whiteSpace: 'pre-wrap',
            }}
          >
            {message.content}
          </div>
        </div>
      ))}
    </div>
  );
};

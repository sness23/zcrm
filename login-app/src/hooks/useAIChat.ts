import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9600';

interface ChatMessage {
  id: string;
  text: string;
  author_name: string;
  timestamp: string;
  type?: 'user' | 'system' | 'ai';
}

interface UseAIChatOptions {
  channelType?: 'channel' | 'object';
  entityId?: string;
  entityType?: string;
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendAIMessage = useCallback(async (
    message: string,
    history: ChatMessage[],
    onChunk: (text: string) => void,
    onComplete: (tokens?: { input: number; output: number }) => void
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history,
          channelType: options.channelType,
          entityId: options.entityId,
          entityType: options.entityType,
        }),
      });

      if (!response.ok) {
        throw new Error('AI request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'chunk') {
              onChunk(data.text);
            } else if (data.type === 'done') {
              onComplete(data.tokens);
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get AI response');
      console.error('AI chat error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [options.channelType, options.entityId, options.entityType]);

  return {
    sendAIMessage,
    isLoading,
    error,
  };
}

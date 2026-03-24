export interface ChatMessage {
  id: string;
  text: string;
  author_name: string;
  timestamp: string;
  type?: 'user' | 'system' | 'ai';
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Limit chat history to approximately maxTokens
 * Takes messages from the end (most recent) until token limit is reached
 */
export function limitHistoryByTokens(messages: ChatMessage[], maxTokens: number = 1000): ChatMessage[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  const limitedMessages: ChatMessage[] = [];
  let totalTokens = 0;

  // Start from the most recent messages and work backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgText = `${new Date(msg.timestamp).toLocaleTimeString()} [${msg.author_name}]: ${msg.text}`;
    const msgTokens = estimateTokens(msgText);

    // Check if adding this message would exceed the limit
    if (totalTokens + msgTokens > maxTokens && limitedMessages.length > 0) {
      // We have at least one message and adding more would exceed limit
      break;
    }

    // Add message to the beginning (since we're iterating backwards)
    limitedMessages.unshift(msg);
    totalTokens += msgTokens;
  }

  return limitedMessages;
}

export function formatChatHistory(messages: ChatMessage[]): string {
  if (!messages || messages.length === 0) {
    return '';
  }

  const formatted = messages.map(msg => {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const type = msg.type === 'ai' ? '[AI]' : `[${msg.author_name}]`;
    return `${time} ${type}: ${msg.text}`;
  }).join('\n');

  return `
## Recent Conversation History

${formatted}

## Current Request
`;
}

export function buildSystemPrompt(
  channelType: 'channel' | 'object',
  entityInfo?: any,
  recentEvents?: any[]
): string {
  let prompt = `You are a helpful AI assistant. You can assist with any task - answering questions, brainstorming ideas, writing code, debugging, explaining concepts, or helping with general tasks.

`;

  if (channelType === 'object' && entityInfo) {
    prompt += `## Current Context
You are in a conversation about: ${entityInfo.type} "${entityInfo.name}"
- ID: ${entityInfo.id}
- Type: ${entityInfo.type}
`;

    if (entityInfo.owner) {
      prompt += `- Owner: ${entityInfo.owner}\n`;
    }

    if (recentEvents && recentEvents.length > 0) {
      prompt += `\n## Recent Activity for this ${entityInfo.type}:\n`;
      recentEvents.slice(0, 5).forEach((event: any) => {
        prompt += `- ${event.timestamp}: ${event.type} (${event.status})\n`;
      });
    }

    prompt += `
You have tools available to fetch data about this ${entityInfo.type} if needed.
`;
  }

  prompt += `
## Response Guidelines
- Be concise and helpful
- Format responses in markdown for readability
- Provide clear explanations and actionable advice
- When helping with code, provide complete, working examples
- If you're unsure about something, say so
`;

  return prompt;
}

/**
 * AI Command Detector
 *
 * Shared module for detecting AI commands in messages.
 * Used by both client-side (comms-app) and server-side (API) code.
 *
 * Supports:
 * - %co <query> - Ask Cohere AI
 * - %ask <query> - Alias for %co
 * - %explain <topic> - Request detailed explanation
 * - %summarize <text> - Request concise summary
 * - @c <query> - Legacy (deprecated)
 */

export type AICommandType = 'co' | 'ask' | 'explain' | 'summarize' | null;

export interface AICommand {
  /** Whether this message is an AI command */
  isAI: boolean;

  /** The extracted query (without the command prefix) */
  query: string;

  /** Whether this uses the legacy @c prefix */
  isLegacy: boolean;

  /** System prompt to prepend to the query (for specialized commands) */
  systemPrompt?: string;

  /** The command type that was detected */
  command: AICommandType;
}

/**
 * Command definitions with their prefixes and system prompts
 */
const AI_COMMANDS = [
  {
    prefix: '%co ',
    command: 'co' as const,
    systemPrompt: undefined
  },
  {
    prefix: '%ask ',
    command: 'ask' as const,
    systemPrompt: undefined
  },
  {
    prefix: '%explain ',
    command: 'explain' as const,
    systemPrompt: 'Provide a clear, detailed explanation of:'
  },
  {
    prefix: '%summarize ',
    command: 'summarize' as const,
    systemPrompt: 'Provide a concise summary of:'
  },
];

/**
 * Detect if a message is an AI command
 *
 * @param text - The message text to check
 * @returns AICommand object with detection results
 *
 * @example
 * ```typescript
 * const result = detectAICommand('%co what is this?');
 * if (result.isAI) {
 *   console.log(`Detected ${result.command} command: "${result.query}"`);
 *   // Output: Detected co command: "what is this?"
 * }
 * ```
 */
export function detectAICommand(text: string): AICommand {
  const trimmed = text.toLowerCase();

  // Check new AI command prefixes
  for (const cmd of AI_COMMANDS) {
    if (trimmed.startsWith(cmd.prefix)) {
      const query = text.slice(cmd.prefix.length).trim();
      return {
        isAI: true,
        query,
        isLegacy: false,
        systemPrompt: cmd.systemPrompt,
        command: cmd.command
      };
    }
  }

  // Check legacy @c prefix (deprecated)
  if (trimmed.startsWith('@c ')) {
    const query = text.slice(3).trim();
    return {
      isAI: true,
      query,
      isLegacy: true,
      systemPrompt: undefined,
      command: 'co'
    };
  }

  // Not an AI command
  return {
    isAI: false,
    query: '',
    isLegacy: false,
    command: null
  };
}

/**
 * Build the final query with system prompt if applicable
 *
 * @param aiCommand - The detected AI command
 * @returns The final query to send to the AI
 *
 * @example
 * ```typescript
 * const cmd = detectAICommand('%explain recursion');
 * const query = buildFinalQuery(cmd);
 * // Output: "Provide a clear, detailed explanation of: recursion"
 * ```
 */
export function buildFinalQuery(aiCommand: AICommand): string {
  if (!aiCommand.isAI) {
    return '';
  }

  if (aiCommand.systemPrompt) {
    return `${aiCommand.systemPrompt} ${aiCommand.query}`;
  }

  return aiCommand.query;
}

/**
 * Check if a message author should be allowed to trigger AI commands
 *
 * @param author - The message author (e.g., 'user', 'ai', 'discord')
 * @returns Whether this author can trigger AI commands
 */
export function canTriggerAI(author: string): boolean {
  // AI messages should never trigger more AI commands (loop prevention)
  if (author === 'ai') {
    return false;
  }

  // All other authors (user, discord, etc.) can trigger AI
  return true;
}

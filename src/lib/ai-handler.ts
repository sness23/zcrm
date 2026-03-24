/**
 * AI Command Handler
 *
 * Server-side handler for processing AI commands detected in channel messages.
 * Calls Cohere API, streams responses in real-time, and broadcasts to all connected clients.
 *
 * Features:
 * - Async processing (doesn't block message POST response)
 * - Real-time streaming (broadcasts chunks as they arrive from Cohere)
 * - Context-aware (includes channel history)
 * - Rate limiting (max 10 AI calls/min per channel)
 * - Error handling with user-friendly messages
 * - WebSocket broadcasting (ai_start, ai_chunk, ai_complete events)
 * - Discord integration (forwards complete responses)
 */

import { ulid } from 'ulidx';
import { cohere, AI_MODEL } from '../services/cohere.js';
import type { AICommand } from './ai-detector.js';
import { buildFinalQuery } from './ai-detector.js';

// Rate limiting
const AI_RATE_LIMIT = 10; // Max 10 AI calls per minute per channel
const rateLimitMap = new Map<string, number[]>(); // channelId -> timestamps[]

/**
 * Check if channel has exceeded AI rate limit
 */
function checkAIRateLimit(channelId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(channelId) || [];

  // Remove timestamps older than 1 minute
  const recent = timestamps.filter(ts => now - ts < 60000);

  if (recent.length >= AI_RATE_LIMIT) {
    console.warn(`[AI Handler] Rate limit exceeded for channel ${channelId} (${recent.length}/${AI_RATE_LIMIT})`);
    return false;
  }

  recent.push(now);
  rateLimitMap.set(channelId, recent);
  return true;
}

export interface AIHandlerDependencies {
  /** Database instance for channels */
  channelsDb: any;

  /** Function to log messages to markdown files */
  logChannelMessageToMarkdown: (channelId: string, channelName: string, message: any) => Promise<void>;

  /** Function to broadcast messages via WebSocket */
  broadcast: (message: any) => void;

  /** Discord service instance (optional) */
  discordService?: {
    isEnabled: () => boolean;
    formatMessage: (username: string, text: string) => any;
    sendMessage: (message: any, messageId: string) => Promise<any>;
  };
}

/**
 * Handle AI command detected in a channel message
 *
 * This function is called asynchronously after a message is saved,
 * so it doesn't block the POST response.
 *
 * @param aiCommand - The detected AI command
 * @param channelId - The channel ID where the command was sent
 * @param channelName - The channel name (for Discord integration)
 * @param userMessageAuthor - The author of the original message
 * @param deps - Dependencies (database, logging, broadcasting)
 */
export async function handleAICommand(
  aiCommand: AICommand,
  channelId: string,
  channelName: string,
  userMessageAuthor: string,
  deps: AIHandlerDependencies
): Promise<void> {
  const { channelsDb, logChannelMessageToMarkdown, broadcast, discordService } = deps;

  // Validate query
  if (!aiCommand.query) {
    console.warn('[AI Handler] Empty query, skipping');
    return;
  }

  // Check rate limit
  if (!checkAIRateLimit(channelId)) {
    // Send rate limit error message to channel
    const errorMessage = 'AI rate limit exceeded. Please wait before making another request.';
    await saveAndBroadcastMessage(
      channelId,
      channelName,
      'ai',
      'Cohere AI',
      errorMessage,
      deps
    );
    return;
  }

  try {
    console.log(`[AI Handler] Processing ${aiCommand.command} command in ${channelName}: "${aiCommand.query}"`);

    // Step 1: Fetch channel history for context
    const messages = channelsDb.prepare(`
      SELECT id, author, author_name, text, timestamp
      FROM messages
      WHERE channel_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(channelId, 20) as any[];

    // Reverse to chronological order
    messages.reverse();

    // Step 2: Build context for AI
    const chatHistory = messages.map(msg => {
      const role = msg.author === 'ai' ? 'assistant' : 'user';
      return `${msg.author_name}: ${msg.text}`;
    }).join('\n');

    // Step 3: Construct final query with system prompt if applicable
    const finalQuery = buildFinalQuery(aiCommand);

    console.log(`[AI Handler] Calling Cohere API...`);

    // Step 4: Generate AI message ID and broadcast initial empty message
    const messageId = `msg_${ulid()}`;
    const timestamp = new Date().toISOString();

    // Broadcast initial empty AI message (creates "Cohere AI is typing..." effect)
    broadcast({
      type: 'ai_start',
      channel_id: channelId,
      message: {
        id: messageId,
        channel_id: channelId,
        author: 'ai',
        author_name: 'Cohere AI',
        text: '',
        timestamp,
        streaming: true
      }
    });

    // Step 5: Call Cohere API (streaming)
    let fullResponse = '';
    let tokenUsage: { input: number; output: number } | undefined;

    const stream = await cohere.chatStream({
      model: AI_MODEL,
      messages: [
        {
          role: 'user',
          content: chatHistory ? `${chatHistory}\n\n${finalQuery}` : finalQuery
        }
      ]
    });

    // Step 6: Stream chunks to all clients in real-time
    for await (const chunk of stream) {
      if (chunk.type === 'content-delta') {
        const textChunk = chunk.delta?.message?.content?.text || '';
        if (textChunk) {
          fullResponse += textChunk;

          // 🚀 BROADCAST CHUNK IMMEDIATELY
          broadcast({
            type: 'ai_chunk',
            channel_id: channelId,
            message_id: messageId,
            chunk: textChunk,
            full_text: fullResponse // Include accumulated text for recovery
          });
        }
      } else if (chunk.type === 'message-end') {
        // Extract token usage
        const usage = chunk.delta?.usage;
        const tokens = usage?.tokens || usage?.billedUnits;

        if (tokens) {
          tokenUsage = {
            input: tokens.inputTokens || 0,
            output: tokens.outputTokens || 0
          };
        }
      }
    }

    console.log(`[AI Handler] AI response complete (${tokenUsage?.input || 0} in, ${tokenUsage?.output || 0} out)`);

    // Step 7: Handle empty response
    if (!fullResponse.trim()) {
      console.warn('[AI Handler] AI returned empty response');

      // Delete the empty streaming message
      broadcast({
        type: 'ai_error',
        channel_id: channelId,
        message_id: messageId
      });

      // Send error message
      await saveAndBroadcastMessage(
        channelId,
        channelName,
        'ai',
        'Cohere AI',
        'I apologize, but I was unable to generate a response. Please try rephrasing your question.',
        deps
      );
      return;
    }

    // Step 8: Save complete AI response to database and markdown
    await saveStreamedMessage(
      messageId,
      channelId,
      channelName,
      'ai',
      'Cohere AI',
      fullResponse,
      timestamp,
      deps,
      tokenUsage
    );

    // Step 9: Broadcast completion event
    broadcast({
      type: 'ai_complete',
      channel_id: channelId,
      message_id: messageId,
      tokens: tokenUsage
    });

    console.log(`[AI Handler] ✅ AI response saved and broadcast for channel ${channelId}`);
  } catch (error: any) {
    console.error('[AI Handler] Error processing AI command:', error);

    // Send error message to channel
    const errorMessage = 'Sorry, I encountered an error processing your request. Please try again later.';
    await saveAndBroadcastMessage(
      channelId,
      channelName,
      'ai',
      'Cohere AI',
      errorMessage,
      deps
    );
  }
}

/**
 * Save a streamed message to database and markdown (no WebSocket broadcast needed)
 *
 * Used for AI responses that were already streamed via ai_chunk messages.
 * Still forwards to Discord for external integration.
 */
async function saveStreamedMessage(
  messageId: string,
  channelId: string,
  channelName: string,
  author: string,
  authorName: string,
  text: string,
  timestamp: string,
  deps: AIHandlerDependencies,
  tokens?: { input: number; output: number }
): Promise<void> {
  const { channelsDb, logChannelMessageToMarkdown, discordService } = deps;

  // Save to database
  channelsDb.prepare(`
    INSERT INTO messages (id, channel_id, author, author_name, text, timestamp, tokens_input, tokens_output)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    messageId,
    channelId,
    author,
    authorName,
    text,
    timestamp,
    tokens?.input || null,
    tokens?.output || null
  );

  const message: any = {
    id: messageId,
    channel_id: channelId,
    author,
    author_name: authorName,
    text,
    timestamp
  };

  // Include tokens if provided
  if (tokens) {
    message.tokens_input = tokens.input;
    message.tokens_output = tokens.output;
  }

  // Log to markdown file
  await logChannelMessageToMarkdown(channelId, channelName, message);

  // Forward to Discord (if enabled and this is #general)
  if (channelName === 'general' && discordService?.isEnabled()) {
    const discordMessage = discordService.formatMessage(authorName, text);
    discordService.sendMessage(discordMessage, messageId).then(result => {
      if (result.success && result.discordMessageId) {
        console.log(`[AI Handler] Forwarded to Discord: ${result.discordMessageId}`);
      }
    }).catch(err => {
      console.error('[AI Handler] Error sending to Discord:', err);
    });
  }
}

/**
 * Save a message to database, markdown, broadcast via WebSocket, and forward to Discord
 *
 * Helper function to reduce duplication (used for error messages and rate limit messages)
 */
async function saveAndBroadcastMessage(
  channelId: string,
  channelName: string,
  author: string,
  authorName: string,
  text: string,
  deps: AIHandlerDependencies,
  tokens?: { input: number; output: number }
): Promise<void> {
  const { channelsDb, logChannelMessageToMarkdown, broadcast, discordService } = deps;

  const messageId = `msg_${ulid()}`;
  const timestamp = new Date().toISOString();

  // Save to database
  channelsDb.prepare(`
    INSERT INTO messages (id, channel_id, author, author_name, text, timestamp, tokens_input, tokens_output)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    messageId,
    channelId,
    author,
    authorName,
    text,
    timestamp,
    tokens?.input || null,
    tokens?.output || null
  );

  const message: any = {
    id: messageId,
    channel_id: channelId,
    author,
    author_name: authorName,
    text,
    timestamp
  };

  // Include tokens if provided
  if (tokens) {
    message.tokens_input = tokens.input;
    message.tokens_output = tokens.output;
  }

  // Log to markdown file
  await logChannelMessageToMarkdown(channelId, channelName, message);

  // Broadcast via WebSocket
  broadcast({
    type: 'channel_message',
    channel_id: channelId,
    message
  });

  // Forward to Discord (if enabled and this is #general)
  if (channelName === 'general' && discordService?.isEnabled()) {
    const discordMessage = discordService.formatMessage(authorName, text);
    discordService.sendMessage(discordMessage, messageId).then(result => {
      if (result.success && result.discordMessageId) {
        console.log(`[AI Handler] Forwarded to Discord: ${result.discordMessageId}`);
      }
    }).catch(err => {
      console.error('[AI Handler] Error sending to Discord:', err);
    });
  }
}

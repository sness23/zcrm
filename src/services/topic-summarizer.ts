import { cohere, AI_MODEL } from './cohere.js';

export interface ChatMessage {
  author_name: string;
  text: string;
  timestamp: string;
}

/**
 * Summarize a conversation into exactly 3 words using AI
 * @param messages Array of chat messages to summarize
 * @returns 3-word summary, or fallback if AI fails
 */
export async function summarizeToThreeWords(messages: ChatMessage[]): Promise<string> {
  if (!messages || messages.length === 0) {
    return generateFallbackSummary();
  }

  try {
    // Format conversation for AI
    const conversationText = messages
      .map(msg => `[${msg.author_name}]: ${msg.text}`)
      .join('\n');

    const prompt = `Summarize the following conversation in exactly 3 words.
The summary should be descriptive and capture the main topic.
Return only the 3 words, nothing else.
Do not use punctuation or quotes.
Just 3 words separated by spaces.

Conversation:
${conversationText}`;

    const response = await cohere.chat({
      model: AI_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract the summary from response
    const content = response.message?.content;
    let summary = '';

    if (content && Array.isArray(content)) {
      for (const item of content) {
        if ('text' in item && item.text) {
          summary = item.text.trim();
          break;
        }
      }
    }

    // Validate it's roughly 3 words
    const words = summary.split(/\s+/).filter((w: string) => w.length > 0);

    if (words.length >= 2 && words.length <= 4) {
      // Accept 2-4 words as valid
      return summary;
    }

    // If AI didn't follow instructions, use fallback
    console.warn('AI summarization did not return 3 words:', summary);
    return generateFallbackSummary();
  } catch (error) {
    console.error('Error summarizing conversation:', error);
    return generateFallbackSummary();
  }
}

/**
 * Generate fallback summary when AI fails
 * Format: "New topic {mmm}{dd}"
 */
function generateFallbackSummary(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const day = String(now.getDate()).padStart(2, '0');
  return `New topic ${month}${day}`;
}

/**
 * Convert a summary to a kebab-case slug for filenames
 * Example: "Fix login bug" -> "fix-login-bug"
 */
export function slugifySummary(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
}

/**
 * Format timestamp for topic filenames
 * Format: {mmm}{dd}{yy}_{hhmm}
 * Example: oct1525_0342 for October 15, 2025 at 3:42 AM
 */
export function formatTopicTimestamp(date: Date = new Date()): string {
  const month = date.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}${day}${year}_${hours}${minutes}`;
}

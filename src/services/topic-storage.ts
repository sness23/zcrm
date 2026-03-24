import fs from 'fs';
import path from 'path';
import { ulid } from 'ulidx';
import { formatTopicTimestamp, slugifySummary } from './topic-summarizer.js';

const VAULT = process.env.VAULT || './vault';
const TOPICS_DIR = path.join(VAULT, 'chats', 'topics');

export interface TopicMessage {
  id: string;
  channel_id: string;
  author: 'user' | 'ai';
  author_name: string;
  text: string;
  timestamp: string;
  tokens?: {
    input: number;
    output: number;
  };
}

export interface Topic {
  topicId: string;
  channelId: string;
  title: string;
  createdAt: string;
  messages: TopicMessage[];
}

export interface TopicMetadata {
  topicId: string;
  channelId: string;
  title: string;
  createdAt: string;
  messageCount: number;
  filename: string;
}

/**
 * Ensure topics directory exists
 */
export function ensureTopicsDirectory(): void {
  if (!fs.existsSync(TOPICS_DIR)) {
    fs.mkdirSync(TOPICS_DIR, { recursive: true });
  }
}

/**
 * Generate a new topic ID with topic_ prefix
 */
export function generateTopicId(): string {
  return `topic_${ulid()}`;
}

/**
 * Generate topic filename
 * Format: {channel}_{timestamp}_{slug}.json
 * Example: general_oct1525_0342_fix-login-bug.json
 */
export function generateTopicFilename(
  channelId: string,
  title: string,
  timestamp: Date = new Date()
): string {
  const timestampStr = formatTopicTimestamp(timestamp);
  const slug = slugifySummary(title);
  return `${channelId}_${timestampStr}_${slug}`;
}

/**
 * Create a new topic and save to disk
 */
export function createTopic(
  channelId: string,
  title: string,
  messages: TopicMessage[]
): TopicMetadata {
  ensureTopicsDirectory();

  const topicId = generateTopicId();
  const createdAt = new Date().toISOString();
  const filename = generateTopicFilename(channelId, title);

  const topic: Topic = {
    topicId,
    channelId,
    title,
    createdAt,
    messages,
  };

  // Save JSON file
  const jsonPath = path.join(TOPICS_DIR, `${filename}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(topic, null, 2), 'utf-8');

  // Save Markdown file
  const mdPath = path.join(TOPICS_DIR, `${filename}.md`);
  const mdContent = topicToMarkdown(topic);
  fs.writeFileSync(mdPath, mdContent, 'utf-8');

  return {
    topicId,
    channelId,
    title,
    createdAt,
    messageCount: messages.length,
    filename,
  };
}

/**
 * Convert topic to Markdown format
 */
function topicToMarkdown(topic: Topic): string {
  const { title, channelId, createdAt, topicId, messages } = topic;

  const createdDate = new Date(createdAt);
  const formattedDate = createdDate.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  let md = `# Topic: ${title}\n\n`;
  md += `**Channel:** ${channelId.startsWith('#') ? channelId : '#' + channelId}\n`;
  md += `**Created:** ${formattedDate}\n`;
  md += `**Topic ID:** ${topicId}\n\n`;
  md += `---\n\n`;

  for (const msg of messages) {
    const msgDate = new Date(msg.timestamp);
    const msgFormatted = msgDate.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    md += `## ${msg.author_name} (${msgFormatted})\n\n`;
    md += `${msg.text}\n\n`;

    if (msg.tokens) {
      md += `_Tokens: ${msg.tokens.input + msg.tokens.output}_\n\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

/**
 * Get all topics for a channel
 */
export function getTopicsForChannel(channelId: string): TopicMetadata[] {
  ensureTopicsDirectory();

  const files = fs.readdirSync(TOPICS_DIR);
  const topics: TopicMetadata[] = [];

  // Filter files that match this channel and are JSON files
  const channelFiles = files.filter(
    (f) => f.startsWith(`${channelId}_`) && f.endsWith('.json')
  );

  for (const file of channelFiles) {
    try {
      const filePath = path.join(TOPICS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const topic: Topic = JSON.parse(content);

      topics.push({
        topicId: topic.topicId,
        channelId: topic.channelId,
        title: topic.title,
        createdAt: topic.createdAt,
        messageCount: topic.messages.length,
        filename: file.replace('.json', ''),
      });
    } catch (error) {
      console.error(`Error reading topic file ${file}:`, error);
    }
  }

  // Sort by creation time (newest first)
  topics.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return topics;
}

/**
 * Get a topic by ID
 */
export function getTopicById(topicId: string): Topic | null {
  ensureTopicsDirectory();

  const files = fs.readdirSync(TOPICS_DIR);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    try {
      const filePath = path.join(TOPICS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const topic: Topic = JSON.parse(content);

      if (topic.topicId === topicId) {
        return topic;
      }
    } catch (error) {
      console.error(`Error reading topic file ${file}:`, error);
    }
  }

  return null;
}

/**
 * Add a message to an existing topic
 */
export function addMessageToTopic(topicId: string, message: TopicMessage): boolean {
  const topic = getTopicById(topicId);

  if (!topic) {
    return false;
  }

  // Add message to topic
  topic.messages.push(message);

  // Find the topic file
  const files = fs.readdirSync(TOPICS_DIR);
  const jsonFile = files.find(
    (f) => f.endsWith('.json') && fs.readFileSync(path.join(TOPICS_DIR, f), 'utf-8').includes(topicId)
  );

  if (!jsonFile) {
    return false;
  }

  const filename = jsonFile.replace('.json', '');

  // Update JSON file
  const jsonPath = path.join(TOPICS_DIR, `${filename}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(topic, null, 2), 'utf-8');

  // Update Markdown file
  const mdPath = path.join(TOPICS_DIR, `${filename}.md`);
  const mdContent = topicToMarkdown(topic);
  fs.writeFileSync(mdPath, mdContent, 'utf-8');

  return true;
}

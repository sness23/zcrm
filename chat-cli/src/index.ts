#!/usr/bin/env node

import * as readline from 'readline';
import WebSocket from 'ws';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:9600';
const WS_URL = 'ws://localhost:9600';
const CHANNEL_ID = 'ch_general';

interface Message {
  id: string;
  channel_id: string;
  author: string;
  author_name: string;
  text: string;
  timestamp: string;
}

interface ChatMessage {
  id: string;
  text: string;
  author_name: string;
  timestamp: string;
  type?: 'user' | 'system' | 'ai';
}

class ChatCLI {
  private ws: WebSocket | null = null;
  private rl: readline.Interface;
  private messageHistory: string[] = [];
  private aiStreaming: boolean = false;
  private currentAIMessage: string = '';

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '% ',
    });
  }

  async start() {
    console.log('🚀 Chat CLI - Connected to #general');
    console.log('Commands: .history, .help, .quit');
    console.log('AI Chat: @c <your question> for AI assistance');
    console.log('');

    // Connect to WebSocket for real-time messages
    this.connectWebSocket();

    // Set up readline handlers
    this.rl.on('line', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      // Handle commands (starting with .)
      if (trimmed.startsWith('.')) {
        await this.handleCommand(trimmed);
        this.rl.prompt();
        return;
      }

      // Send regular message
      await this.sendMessage(trimmed);
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\n👋 Goodbye!');
      if (this.ws) {
        this.ws.close();
      }
      process.exit(0);
    });

    // Show prompt
    this.rl.prompt();
  }

  private connectWebSocket() {
    this.ws = new WebSocket(WS_URL);

    this.ws.on('open', () => {
      // Connection established
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Only show messages for the #general channel
        if (message.type === 'channel_message' && message.channel_id === CHANNEL_ID) {
          const msg = message.message;

          // Clear current line and move cursor up
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);

          // Display the message
          const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          const emoji = msg.author === 'ai' ? '🤖' : msg.author === 'user' ? '👤' : '💬';
          console.log(`${emoji} ${msg.author_name} [${time}]: ${msg.text}`);

          // Redraw prompt
          this.rl.prompt(true);
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });

    this.ws.on('close', () => {
      // Attempt to reconnect after a delay
      setTimeout(() => {
        console.log('Reconnecting...');
        this.connectWebSocket();
      }, 3000);
    });
  }

  private async sendMessage(text: string) {
    try {
      // Check if this is an AI request (starts with @c)
      if (text.toLowerCase().startsWith('@c ')) {
        const aiQuery = text.slice(3).trim();
        if (!aiQuery) return;

        await this.handleAIRequest(text, aiQuery);
        return;
      }

      // Regular message flow
      const response = await fetch(`${API_BASE}/api/channels/${CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          author: 'user',
          author_name: 'CLI User',
        }),
      });

      if (!response.ok) {
        console.log('❌ Failed to send message');
      }
    } catch (error) {
      console.log('❌ Error sending message:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async handleAIRequest(fullText: string, aiQuery: string) {
    try {
      this.aiStreaming = true;
      this.currentAIMessage = '';

      // First, save the user's @c message to the channel
      await fetch(`${API_BASE}/api/channels/${CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: fullText,
          author: 'user',
          author_name: 'CLI User',
        }),
      });

      // Fetch channel history to build context
      const historyResponse = await fetch(`${API_BASE}/api/channels/${CHANNEL_ID}/messages`);
      const historyData = await historyResponse.json() as { messages: Message[] };
      const messages = historyData.messages || [];

      // Build chat history
      const history: ChatMessage[] = messages.map(msg => ({
        id: msg.id,
        text: msg.text,
        author_name: msg.author_name,
        timestamp: msg.timestamp,
        type: msg.author === 'ai' ? 'ai' as const : 'user' as const,
      }));

      // Add current message to history
      history.push({
        id: `temp_${Date.now()}`,
        text: fullText,
        author_name: 'CLI User',
        timestamp: new Date().toISOString(),
        type: 'user' as const,
      });

      // Clear current line and show AI is responding
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      console.log('🤖 AI Assistant: ');

      // Send to AI with streaming
      await this.sendAIMessage(aiQuery, history);

      // After streaming completes, save AI message to channel
      if (this.currentAIMessage) {
        await fetch(`${API_BASE}/api/channels/${CHANNEL_ID}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: this.currentAIMessage,
            author: 'ai',
            author_name: 'AI Assistant',
          }),
        });
      }
    } catch (error) {
      console.log('\n❌ Error getting AI response:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.aiStreaming = false;
      this.currentAIMessage = '';
    }
  }

  private async sendAIMessage(message: string, history: ChatMessage[]) {
    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
        channelType: 'channel',
      }),
    });

    if (!response.ok) {
      throw new Error('AI request failed');
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Read the streaming response - node-fetch returns Node.js Readable stream
    const decoder = new TextDecoder();
    let buffer = '';

    // Use async iterator for the body
    for await (const chunk of response.body as any) {
      buffer += decoder.decode(chunk, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'chunk') {
            // Stream the text to terminal
            process.stdout.write(data.text);
            this.currentAIMessage += data.text;
          } else if (data.type === 'done') {
            // Done streaming
            console.log('\n');
            if (data.tokens) {
              console.log(`[Tokens: ${data.tokens.input} in + ${data.tokens.output} out = ${data.tokens.input + data.tokens.output} total]`);
            }
          } else if (data.type === 'error') {
            throw new Error(data.error);
          }
        }
      }
    }
  }

  private async handleCommand(command: string) {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case '.help':
        console.log('');
        console.log('Available commands:');
        console.log('  .help       - Show this help message');
        console.log('  .history    - Show recent message history');
        console.log('  .quit       - Exit the chat');
        console.log('');
        console.log('AI Chat:');
        console.log('  @c <question> - Ask AI assistant (streams response)');
        console.log('');
        break;

      case '.history':
        await this.showHistory();
        break;

      case '.quit':
      case '.exit':
        this.rl.close();
        break;

      default:
        console.log(`Unknown command: ${cmd}`);
        console.log('Type .help for available commands');
        break;
    }
  }

  private async showHistory() {
    try {
      const response = await fetch(`${API_BASE}/api/channels/${CHANNEL_ID}/messages`);

      if (!response.ok) {
        console.log('❌ Failed to fetch history');
        return;
      }

      const data = await response.json() as { messages: Message[] };
      const messages = data.messages || [];

      if (messages.length === 0) {
        console.log('No message history available');
        return;
      }

      console.log('');
      console.log('=== Recent History ===');

      // Show last 20 messages
      const recent = messages.slice(-20);

      for (const msg of recent) {
        const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        const emoji = msg.author === 'ai' ? '🤖' : msg.author === 'user' ? '👤' : '💬';
        console.log(`${emoji} ${msg.author_name} [${time}]: ${msg.text}`);
      }

      console.log('');
    } catch (error) {
      console.log('❌ Error fetching history:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

// Start the CLI
const cli = new ChatCLI();
cli.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

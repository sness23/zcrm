# Chat CLI

A simple command-line interface for chatting in the #general Slack channel.

## Features

- Real-time message display via WebSocket
- Send messages with a simple REPL interface
- Commands prefixed with `.` for special operations
- Message history retrieval
- AI chat integration with `@c` prefix (streaming responses)

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
npm run dev
```

Or after building:

```bash
npm start
```

## Commands

- `.help` - Show help message
- `.history` - Show recent message history (last 20 messages)
- `.quit` or `.exit` - Exit the chat

## AI Chat

- `@c <your question>` - Ask AI assistant (powered by Cohere)
  - Example: `@c what is the capital of France?`
  - Streams the response in real-time
  - Saves conversation history for context

## How it works

- Type any text and press Enter to send a message to #general
- Messages from other users appear in real-time
- Use arrow keys for command history (readline feature)
- Commands starting with `.` are special commands (not sent as messages)

## Architecture

- Connects to API at `http://localhost:9600`
- WebSocket connection for real-time message updates
- Posts messages to `/api/channels/ch_general/messages`
- Fetches history from `/api/channels/ch_general/messages`

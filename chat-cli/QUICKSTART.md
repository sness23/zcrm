# Quick Start Guide

## Run the chat-cli

From the `/path/to/project/chat-cli` directory:

```bash
npm run dev
```

## What you'll see

```
🚀 Chat CLI - Connected to #general
Commands: .history, .help, .quit
AI Chat: @c <your question> for AI assistance

%
```

## Usage

### Send a message
Just type and press Enter:
```
% hello everyone!
```

### Ask AI Assistant
Use `@c` prefix for AI questions:
```
% @c what is the capital of France?
🤖 AI Assistant:
Paris is the capital of France...
[Tokens: 150 in + 25 out = 175 total]

%
```

The AI response streams in real-time, just like the web app!

### View history
```
% .history
```

### Get help
```
% .help
```

### Exit
```
% .quit
```

## Features

- **Real-time updates**: Messages from other users (including the Slack app) appear automatically
- **AI chat**: Use `@c` to ask questions - responses stream in real-time
- **Command history**: Use up/down arrows to navigate through your previous messages
- **Simple commands**: All commands start with `.` so they won't be sent as messages
- **Clean interface**: Messages show with emojis (👤 for users, 🤖 for AI)

## Testing

1. Start the chat-cli: `npm run dev`
2. In another terminal or the Slack app, send a message to #general
3. You should see it appear in the CLI instantly
4. Type a message in the CLI and it will appear in the Slack app

## Troubleshooting

If you get connection errors:
- Make sure the API server is running on port 9600
- Check: `curl http://localhost:9600/health`
- If not running, start it from the main project directory

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Config {
  ec2WebSocketUrl: string;
  pocketzToken: string;
  pocketzExtensionPath: string;
  pocketzServerUrl: string;
  reconnectDelay: number;
  downloadTimeout: number;
  chromeCdpUrl: string;
}

export const config: Config = {
  // WebSocket URL for EC2 server
  ec2WebSocketUrl: process.env.EC2_WEBSOCKET_URL || 'ws://localhost:9500',

  // Authentication token for Pocketz worker
  pocketzToken: process.env.POCKETZ_WORKER_TOKEN || 'your-secret-token-here',

  // Path to Pocketz chrome extension
  pocketzExtensionPath: path.resolve(__dirname, '../../pocketz/chrome-extension'),

  // Local Pocketz server URL
  pocketzServerUrl: process.env.POCKETZ_SERVER_URL || 'http://localhost:6767',

  // Reconnection delay in milliseconds
  reconnectDelay: parseInt(process.env.RECONNECT_DELAY || '5000', 10),

  // Download timeout in milliseconds (time to wait after triggering Pocketz)
  downloadTimeout: parseInt(process.env.DOWNLOAD_TIMEOUT || '15000', 10),

  // Chrome CDP URL (for connecting to existing Chrome instance)
  chromeCdpUrl: process.env.CHROME_CDP_URL || 'http://localhost:9222'
};

// Validate configuration
export function validateConfig(): void {
  if (config.pocketzToken === 'your-secret-token-here') {
    console.warn('⚠️  WARNING: Using default token. Set POCKETZ_WORKER_TOKEN environment variable for security.');
  }

  console.log('Configuration loaded:');
  console.log('  EC2 WebSocket URL:', config.ec2WebSocketUrl);
  console.log('  Chrome CDP URL:', config.chromeCdpUrl);
  console.log('  Pocketz Extension Path:', config.pocketzExtensionPath);
  console.log('  Pocketz Server URL:', config.pocketzServerUrl);
  console.log('  Reconnect Delay:', config.reconnectDelay, 'ms');
  console.log('  Download Timeout:', config.downloadTimeout, 'ms');
}

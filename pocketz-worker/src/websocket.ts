import WebSocket from 'ws';
import { config } from './config.js';
import type { ServerMessage, WorkerMessage, DownloadJob } from './types.js';

let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// Callback for handling download jobs
type JobHandler = (job: DownloadJob) => Promise<void>;
let jobHandler: JobHandler | null = null;

/**
 * Connect to EC2 WebSocket server with authentication
 */
export function connectWebSocket(handler: JobHandler): void {
  jobHandler = handler;

  if (ws) {
    console.log('[WebSocket] Already connected or connecting');
    return;
  }

  console.log('[WebSocket] Connecting to:', config.ec2WebSocketUrl);

  try {
    ws = new WebSocket(config.ec2WebSocketUrl, {
      headers: {
        'x-pocketz-token': config.pocketzToken
      }
    });

    ws.on('open', handleOpen);
    ws.on('message', handleMessage);
    ws.on('error', handleError);
    ws.on('close', handleClose);

  } catch (error) {
    console.error('[WebSocket] Failed to create connection:', error);
    scheduleReconnect();
  }
}

/**
 * Handle WebSocket connection opened
 */
function handleOpen(): void {
  console.log('[WebSocket] ✅ Connected to EC2 server');

  // Clear any pending reconnect
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

/**
 * Handle incoming messages from server
 */
async function handleMessage(data: WebSocket.Data): Promise<void> {
  try {
    const message: ServerMessage = JSON.parse(data.toString());

    console.log('[WebSocket] Received message:', message.type);

    if (message.type === 'download_job') {
      if (jobHandler) {
        await jobHandler(message);
      } else {
        console.error('[WebSocket] No job handler registered!');
      }
    } else {
      console.warn('[WebSocket] Unknown message type:', message);
    }

  } catch (error) {
    console.error('[WebSocket] Error parsing message:', error);
  }
}

/**
 * Handle WebSocket errors
 */
function handleError(error: Error): void {
  console.error('[WebSocket] Error:', error.message);
}

/**
 * Handle WebSocket connection closed
 */
function handleClose(code: number, reason: Buffer): void {
  console.log(`[WebSocket] Connection closed (code: ${code}, reason: ${reason.toString() || 'none'})`);

  ws = null;

  // Don't reconnect if we're shutting down
  if (!isShuttingDown) {
    scheduleReconnect();
  }
}

/**
 * Schedule reconnection attempt
 */
function scheduleReconnect(): void {
  if (reconnectTimeout) {
    return; // Already scheduled
  }

  console.log(`[WebSocket] Reconnecting in ${config.reconnectDelay}ms...`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    if (jobHandler) {
      connectWebSocket(jobHandler);
    }
  }, config.reconnectDelay);
}

/**
 * Send message to server
 */
export function sendMessage(message: WorkerMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('[WebSocket] Cannot send message: not connected');
    return;
  }

  try {
    ws.send(JSON.stringify(message));
    console.log('[WebSocket] Sent message:', message.type);
  } catch (error) {
    console.error('[WebSocket] Error sending message:', error);
  }
}

/**
 * Close WebSocket connection
 */
export function closeWebSocket(): void {
  isShuttingDown = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    console.log('[WebSocket] Closing connection...');
    ws.close();
    ws = null;
  }
}

/**
 * Check if WebSocket is connected
 */
export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

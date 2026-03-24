/**
 * Discord Integration Service with Bidirectional Sync
 * ⚠️  EXTREME CAUTION: Multiple layers of loop prevention ⚠️
 */
import { Client, GatewayIntentBits, Message, Events } from 'discord.js';
import {
  initializeDiscordSyncDb,
  wasMessageForwarded,
  wasContentSeenRecently,
  recordMessageForward,
  trackRecentMessage,
  hashContent,
  isEmergencyStopped,
  triggerEmergencyStop,
  cleanupRecentMessages,
  getSyncStats,
  incrementDuplicateCount
} from '../db/discord-sync.js';

export interface DiscordMessage {
  content: string;
  username?: string;
  avatar_url?: string;
}

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  layer?: string;
}

export class DiscordService {
  private webhookUrl: string | undefined;
  private botToken: string | undefined;
  private channelId: string | undefined;
  private client: Client | null = null;
  private initialized: boolean = false;
  private messageHandler: ((message: Message) => Promise<void>) | null = null;

  // Rate limiting
  private messagesSentLastMinute: number[] = [];
  private readonly MAX_MESSAGES_PER_MINUTE = 20;

  // Duplicate detection (in-memory fast check)
  private recentContentHashes = new Map<string, number>(); // hash -> timestamp

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.botToken = process.env.DISCORD_BOT_TOKEN;
    this.channelId = process.env.DISCORD_CHANNEL_ID;
  }

  /**
   * Initialize Discord bot and database
   */
  async initialize(vaultPath: string, onMessage?: (message: Message) => Promise<void>): Promise<void> {
    if (this.initialized) {
      console.log('[Discord] Already initialized');
      return;
    }

    // Initialize database
    initializeDiscordSyncDb(vaultPath);

    // Start cleanup task (every 5 minutes)
    setInterval(() => {
      const removed = cleanupRecentMessages(60);
      if (removed > 0) {
        console.log(`[Discord] Cleaned up ${removed} old message records`);
      }
    }, 5 * 60 * 1000);

    // Log stats every hour
    setInterval(() => {
      const stats = getSyncStats();
      console.log('[Discord] Sync stats:', stats);

      // Auto-trigger emergency stop if too many duplicates
      if (stats.highDuplicates > 50) {
        triggerEmergencyStop(`Too many high-duplicate messages: ${stats.highDuplicates}`);
      }
    }, 60 * 60 * 1000);

    if (!this.botToken || !this.channelId) {
      console.warn('[Discord] Bot token or channel ID not configured, bot features disabled');
      this.initialized = true;
      return;
    }

    if (onMessage) {
      this.messageHandler = onMessage;
    }

    try {
      // Create Discord client with minimal intents
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });

      // Handle incoming messages
      this.client.on(Events.MessageCreate, async (message) => {
        await this.handleDiscordMessage(message);
      });

      // Handle ready event
      this.client.once(Events.ClientReady, (client) => {
        console.log(`[Discord] Bot logged in as ${client.user?.tag}`);
      });

      // Login
      await this.client.login(this.botToken);
      this.initialized = true;
      console.log('[Discord] Bot initialized successfully');
    } catch (error) {
      console.error('[Discord] Failed to initialize bot:', error);
      throw error;
    }
  }

  /**
   * Handle incoming Discord message (FROM Discord TO comms-app)
   */
  private async handleDiscordMessage(message: Message): Promise<void> {
    try {
      // Ignore messages from other channels
      if (message.channelId !== this.channelId) {
        return;
      }

      // Ignore bot messages (CRITICAL: prevents bot talking to itself)
      if (message.author.bot) {
        console.log('[Discord] Ignoring bot message from', message.author.username);
        return;
      }

      // Run ALL safety checks (pass hasAttachments to allow empty text with file attachments)
      const safetyCheck = await this.runSafetyChecks(
        'discord',
        message.id,
        message.content,
        message.author.username,
        message.attachments.size > 0
      );

      if (!safetyCheck.safe) {
        console.warn(`[Discord] ⚠️  Message blocked: ${safetyCheck.reason} (${safetyCheck.layer})`);
        return;
      }

      // Call message handler
      if (this.messageHandler) {
        await this.messageHandler(message);
      }
    } catch (error) {
      console.error('[Discord] Error handling message:', error);
    }
  }

  /**
   * 🛡️ MULTI-LAYER SAFETY CHECKS 🛡️
   * Run ALL checks before forwarding ANY message
   */
  async runSafetyChecks(
    sourcePlatform: 'discord' | 'comms',
    messageId: string,
    content: string,
    author: string,
    hasAttachments: boolean = false
  ): Promise<SafetyCheckResult> {
    // Layer 1: Emergency stop check
    if (isEmergencyStopped()) {
      return {
        safe: false,
        reason: 'Emergency stop is active',
        layer: 'Layer 1: Emergency Stop'
      };
    }

    // Layer 2: Rate limiting check
    if (!this.checkRateLimit()) {
      triggerEmergencyStop('Rate limit exceeded - possible loop detected');
      return {
        safe: false,
        reason: 'Rate limit exceeded',
        layer: 'Layer 2: Rate Limit'
      };
    }

    // Layer 3: Database forward check (was this exact message already forwarded?)
    if (wasMessageForwarded(sourcePlatform, messageId)) {
      const dupCount = incrementDuplicateCount(sourcePlatform, messageId);
      console.warn(`[Discord] Layer 3: Message ${messageId} already forwarded (${dupCount} duplicates)`);

      if (dupCount >= 10) {
        triggerEmergencyStop(`Message ${messageId} forwarded ${dupCount} times - infinite loop detected!`);
      }

      return {
        safe: false,
        reason: `Message already forwarded (${dupCount} times)`,
        layer: 'Layer 3: Database Check'
      };
    }

    // Layer 4: Content hash check (was similar content seen recently?)
    // For empty content with attachments, use messageId to make hash unique
    const hashInput = (!content.trim() && hasAttachments) ? messageId : content.trim();
    const contentHash = hashContent(hashInput);
    const recentlySeen = wasContentSeenRecently(contentHash, 10);

    if (recentlySeen && recentlySeen.seenCount >= 3) {
      console.warn(`[Discord] Layer 4: Similar content seen ${recentlySeen.seenCount} times recently`);

      if (recentlySeen.seenCount >= 10) {
        triggerEmergencyStop(`Content hash ${contentHash} seen ${recentlySeen.seenCount} times - loop detected!`);
      }

      return {
        safe: false,
        reason: `Similar content seen ${recentlySeen.seenCount} times in 10s`,
        layer: 'Layer 4: Content Hash'
      };
    }

    // Layer 5: In-memory fast duplicate check
    const now = Date.now();
    const lastSeen = this.recentContentHashes.get(contentHash);
    if (lastSeen && (now - lastSeen) < 5000) { // 5 second window
      console.warn('[Discord] Layer 5: Content in memory cache (< 5s)');
      return {
        safe: false,
        reason: 'Duplicate in 5-second window',
        layer: 'Layer 5: Memory Cache'
      };
    }

    // Layer 6: Empty/suspicious content check (allow empty text if message has attachments)
    if (!content.trim() || content.trim().length < 1) {
      if (!hasAttachments) {
        return {
          safe: false,
          reason: 'Empty or too short content',
          layer: 'Layer 6: Content Validation'
        };
      }
      // Allow through - has attachments that will be processed
      console.log('[Discord] Allowing empty content message with attachments');
    }

    // Layer 7: Bot username check (additional safety)
    if (author.toLowerCase().includes('bot') || author.toLowerCase().includes('webhook')) {
      console.warn('[Discord] Layer 7: Suspicious username detected:', author);
      return {
        safe: false,
        reason: 'Message from bot-like username',
        layer: 'Layer 7: Username Filter'
      };
    }

    // ALL CHECKS PASSED ✅
    // Update tracking
    this.recentContentHashes.set(contentHash, now);
    trackRecentMessage(contentHash, sourcePlatform, messageId, author);

    return { safe: true };
  }

  /**
   * Check rate limit (prevents spam/loops)
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old timestamps
    this.messagesSentLastMinute = this.messagesSentLastMinute.filter(ts => ts > oneMinuteAgo);

    // Check limit
    if (this.messagesSentLastMinute.length >= this.MAX_MESSAGES_PER_MINUTE) {
      console.error(`[Discord] ⛔ Rate limit hit: ${this.messagesSentLastMinute.length} messages in last minute`);
      return false;
    }

    // Add current timestamp
    this.messagesSentLastMinute.push(now);
    return true;
  }

  /**
   * Send a message to Discord via webhook (FROM comms-app TO Discord)
   */
  async sendMessage(
    message: DiscordMessage,
    commsMessageId: string
  ): Promise<{ success: boolean; discordMessageId?: string }> {
    if (!this.webhookUrl) {
      console.warn('[Discord] Webhook URL not configured');
      return { success: false };
    }

    // Run safety checks
    const safetyCheck = await this.runSafetyChecks(
      'comms',
      commsMessageId,
      message.content,
      message.username || 'Unknown'
    );

    if (!safetyCheck.safe) {
      console.warn(`[Discord] ⚠️  Outgoing message blocked: ${safetyCheck.reason} (${safetyCheck.layer})`);
      return { success: false };
    }

    try {
      const response = await fetch(`${this.webhookUrl}?wait=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Discord] Failed to send message: ${response.status} ${errorText}`);
        return { success: false };
      }

      // Get Discord message ID from response
      const responseData = await response.json();
      const discordMessageId = responseData.id;

      // Record the forward in database
      const contentHash = hashContent(message.content.trim());
      recordMessageForward({
        source_platform: 'comms',
        source_message_id: commsMessageId,
        source_content_hash: contentHash,
        destination_platform: 'discord',
        destination_message_id: discordMessageId,
        author: message.username || 'Unknown',
        forwarded_at: new Date().toISOString()
      });

      console.log(`[Discord] ✅ Message sent: comms:${commsMessageId} -> discord:${discordMessageId}`);
      return { success: true, discordMessageId };
    } catch (error) {
      console.error('[Discord] Error sending message:', error);
      return { success: false };
    }
  }

  /**
   * Record a message forward from Discord to comms
   */
  recordIncomingForward(
    discordMessageId: string,
    content: string,
    author: string,
    commsMessageId: string
  ): void {
    const contentHash = hashContent(content.trim());
    recordMessageForward({
      source_platform: 'discord',
      source_message_id: discordMessageId,
      source_content_hash: contentHash,
      destination_platform: 'comms',
      destination_message_id: commsMessageId,
      author,
      forwarded_at: new Date().toISOString()
    });

    console.log(`[Discord] ✅ Recorded incoming: discord:${discordMessageId} -> comms:${commsMessageId}`);
  }

  /**
   * Format a comms-app message for Discord
   */
  formatMessage(username: string, text: string): DiscordMessage {
    return {
      content: text,
      username: username || 'Unknown User',
    };
  }

  /**
   * Check if Discord integration is enabled
   */
  isEnabled(): boolean {
    return !!this.webhookUrl;
  }

  /**
   * Check if bot is enabled
   */
  isBotEnabled(): boolean {
    return !!this.botToken && !!this.channelId;
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      console.log('[Discord] Bot shutdown');
    }
  }
}

// Export singleton instance
export const discordService = new DiscordService();

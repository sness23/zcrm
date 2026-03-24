#!/usr/bin/env node
import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import matter from "gray-matter";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { createTwoFilesPatch } from "diff";
import { EventLog, type Event, type EventType } from "./lib/event-log.js";
import { Validator } from "./lib/validation.js";
import { CRMDatabase } from "./lib/database.js";
import { QueryService } from "./lib/queries.js";
import { ImportExportService } from "./lib/import-export.js";
import { WebhookService } from "./lib/webhooks.js";
import { MetricsService } from "./lib/metrics.js";
import { initializeDatabase, getDatabase } from "./db/channels.js";
import { ulid } from "ulidx";
import { cohere, AI_MODEL, type Message } from "./services/cohere.js";
import { TOOLS, functionsMap } from "./services/cohere-tools.js";
import { formatChatHistory, buildSystemPrompt, limitHistoryByTokens } from "./services/chat-formatter.js";
import { searchDocuments as esSearch } from "./lib/elasticsearch.js";
import { RSSFeedService } from "./lib/rss-feeds.js";
import { discordService } from "./services/discord.js";
import { detectAICommand, canTriggerAI } from "./lib/ai-detector.js";
import { handleAICommand } from "./lib/ai-handler.js";
import { getGmailService } from "./lib/gmail.js";
import { marked } from "marked";
import { AuthService } from "./lib/auth.js";

const app = express();
const PORT = process.env.PORT || 9600;
const VAULT = path.join(process.cwd(), "vault");
const DB_PATH = path.join(VAULT, "crm.db");

// Command history tracking
const commandHistory: Array<{ command: string; timestamp: string; cwd: string }> = [];
const MAX_HISTORY = 100;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for bulk imports
app.use(express.text({ limit: '10mb', type: 'text/csv' })); // Support CSV uploads

// Track all API calls for metrics
app.use((req: Request, res: Response, next) => {
  // Track API call (fire and forget)
  metricsService.trackApiCall(req.path, req.method).catch(err => {
    console.error('[Metrics] Error tracking API call:', err);
  });
  next();
});

// Initialize services
const eventLog = new EventLog(VAULT);
const validator = new Validator(VAULT);
const database = new CRMDatabase(DB_PATH);
const queryService = new QueryService(database.getDb());
const importExportService = new ImportExportService(database.getDb());
const webhookService = new WebhookService(database.getDb());
const metricsService = new MetricsService();
const rssService = new RSSFeedService(database.getDb());
const authService = new AuthService(database.getDb());

// Seed demo users for development
authService.seedDemoUsers();

// Initialize channels database
const channelsDb = initializeDatabase();

// Helper to fetch text file content from Discord CDN
async function fetchTextFileContent(url: string, maxBytes: number = 50000): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const text = await response.text();
    // Limit size to prevent huge messages
    if (text.length > maxBytes) {
      return text.substring(0, maxBytes) + '\n... [truncated - file too large]';
    }
    return text;
  } catch (error) {
    console.error('[Discord] Failed to fetch attachment:', error);
    return null;
  }
}

// Initialize Discord bot with message handler
discordService.initialize(VAULT, async (discordMessage) => {
  try {
    // Get #general channel
    const channel = channelsDb.prepare('SELECT * FROM channels WHERE name = ?').get('general') as any;

    if (!channel) {
      console.error('[Discord] #general channel not found');
      return;
    }

    // Create message in comms-app from Discord
    const message_id = `msg_${ulid()}`;
    const timestamp = new Date().toISOString();
    const author_name = `${discordMessage.author.username} (via Discord)`;

    // Start with message content
    let text = discordMessage.content;

    // Process .txt file attachments - append file contents to message
    if (discordMessage.attachments.size > 0) {
      for (const [, attachment] of discordMessage.attachments) {
        const isTextFile = attachment.name?.endsWith('.txt') ||
                          attachment.contentType === 'text/plain' ||
                          attachment.contentType?.startsWith('text/');

        if (isTextFile && attachment.url) {
          console.log(`[Discord] Fetching text attachment: ${attachment.name} (${attachment.size} bytes)`);
          const content = await fetchTextFileContent(attachment.url);
          if (content) {
            text += `\n\n--- 📄 ${attachment.name} ---\n${content}\n--- end ---`;
          } else {
            text += `\n\n[Failed to load attachment: ${attachment.name}]`;
          }
        }
      }
    }

    // Insert message into database
    channelsDb.prepare(`
      INSERT INTO messages (id, channel_id, author, author_name, text, timestamp, tokens_input, tokens_output)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(message_id, channel.id, 'discord', author_name, text, timestamp, null, null);

    const message: any = {
      id: message_id,
      channel_id: channel.id,
      author: 'discord',
      author_name,
      text,
      timestamp
    };

    // Log to markdown file
    await logChannelMessageToMarkdown(channel.id, channel.name, message);

    // Record the forward in database
    discordService.recordIncomingForward(
      discordMessage.id,
      text,
      discordMessage.author.username,
      message_id
    );

    // Broadcast via WebSocket
    broadcast({
      type: 'channel_message',
      channel_id: channel.id,
      message
    });

    // 🤖 AI LISTENER: Check if this Discord message is an AI command
    const aiCommand = detectAICommand(text);
    if (aiCommand.isAI && canTriggerAI('discord')) {
      console.log(`[AI Listener] Detected %${aiCommand.command} command from Discord user ${discordMessage.author.username}`);

      // Launch AI request asynchronously
      handleAICommand(aiCommand, channel.id, channel.name, author_name, {
        channelsDb,
        logChannelMessageToMarkdown,
        broadcast,
        discordService
      }).catch(err => {
        console.error('[AI Listener] Error handling Discord AI command:', err);
      });
    }

    console.log(`[Discord] Message from ${discordMessage.author.username} forwarded to comms-app`);
  } catch (error) {
    console.error('[Discord] Error handling incoming message:', error);
  }
}).catch(err => {
  console.error('[Discord] Failed to initialize bot:', err);
});

// Track connected WebSocket clients and visitor sessions
const clients = new Set();
const visitorSessions = new Map(); // socketId -> session data

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/register
 * Register a new user
 */
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = authService.register(email, password, name);
    res.json({
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
    console.error("[Auth] Register error:", error);
    res.status(400).json({ error: error.message || "Registration failed" });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = authService.login(email, password);
    res.json({
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
    console.error("[Auth] Login error:", error);
    res.status(401).json({ error: error.message || "Login failed" });
  }
});

/**
 * POST /api/auth/logout
 * Logout (invalidate session)
 */
app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      authService.logout(token);
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Auth] Logout error:", error);
    res.status(500).json({ error: error.message || "Logout failed" });
  }
});

/**
 * GET /api/auth/me
 * Get current user from token
 */
app.get("/api/auth/me", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const user = authService.validateToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    res.json({ user });
  } catch (error: any) {
    console.error("[Auth] Me error:", error);
    res.status(500).json({ error: error.message || "Failed to get user" });
  }
});

/**
 * GET /api/metrics
 * Get current system metrics - REAL DATA from the running system
 */
app.get("/api/metrics", async (req: Request, res: Response) => {
  try {
    // Get real-time WebSocket connection counts
    const activeUsers = clients.size;

    // Get unique visitor sessions
    const visitorCount = visitorSessions.size;

    // Query database for messages in the last minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const messagesLastMinute = channelsDb.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE timestamp > ?
    `).get(oneMinuteAgo) as { count: number };

    // Query database for total messages today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const messagesToday = channelsDb.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE timestamp > ?
    `).get(startOfDay.toISOString()) as { count: number };

    const metrics = {
      activeUsers,
      visitorSessions: visitorCount,
      messagesPerMin: messagesLastMinute.count,
      messagesToday: messagesToday.count,
    };

    res.json(metrics);
  } catch (error: any) {
    console.error("Error getting metrics:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/events
 * Create a new event
 */
app.post("/api/events", async (req: Request, res: Response) => {
  try {
    const { type, entity_type, entity_id, data, changes, operations } = req.body;

    if (!type) {
      return res.status(400).json({ error: "type is required" });
    }

    // Validate the event first
    const tempEvent: Event = {
      id: "temp",
      timestamp: new Date().toISOString(),
      type: type as EventType,
      entity_type,
      entity_id,
      data,
      changes,
      operations,
      status: "pending",
    };

    const validation = await validator.validateEvent(tempEvent);

    if (!validation.valid) {
      return res.status(400).json({
        error: "Validation failed",
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // Create event in log
    const event = await eventLog.createEvent(type as EventType, {
      entity_type,
      entity_id,
      data,
      changes,
      operations,
    });

    res.status(201).json({
      event_id: event.id,
      status: "queued",
      timestamp: event.timestamp,
      warnings: validation.warnings,
    });
  } catch (error: any) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/events
 * List events
 */
app.get("/api/events", async (req: Request, res: Response) => {
  try {
    const { limit = "50", status, since, days = "7" } = req.query;

    let events: Event[];

    if (since) {
      // Get events since a specific timestamp
      const sinceDate = new Date(since as string);
      events = await eventLog.getRecentEvents(
        parseInt(days as string),
        status as any
      );
      events = events.filter((e) => new Date(e.timestamp) >= sinceDate);
    } else if (status) {
      // Filter by status
      events = await eventLog.getRecentEvents(
        parseInt(days as string),
        status as any
      );
    } else {
      // Get recent events
      events = await eventLog.getRecentEvents(parseInt(days as string));
    }

    // Apply limit
    const limitNum = parseInt(limit as string);
    events = events.slice(0, limitNum);

    res.json({
      events: events.map((e) => ({
        event_id: e.id,
        type: e.type,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        status: e.status,
        timestamp: e.timestamp,
        error: e.error,
        changes: e.changes,  // Include changes (with diff) for document events
        data: e.data,  // Include event data
      })),
      count: events.length,
    });
  } catch (error: any) {
    console.error("Error listing events:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/events/:event_id
 * Get event details
 */
app.get("/api/events/:event_id", async (req: Request, res: Response) => {
  try {
    const { event_id } = req.params;

    // Search across last 7 days
    const events = await eventLog.getRecentEvents(7);
    const event = events.find((e) => e.id === event_id);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(event);
  } catch (error: any) {
    console.error("Error getting event:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/messages
 * Create a new message for an entity
 */
app.post("/api/messages", async (req: Request, res: Response) => {
  try {
    const { entity_id, entity_type, text, author = "user", author_name = "User", tokens } = req.body;

    // Validate required fields
    if (!entity_id) {
      return res.status(400).json({ error: "entity_id is required" });
    }

    if (!entity_type) {
      return res.status(400).json({ error: "entity_type is required" });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "text is required and cannot be empty" });
    }

    // Trim text and enforce character limit
    const trimmedText = text.trim();
    if (trimmedText.length > 2000) {
      return res.status(400).json({ error: "text cannot exceed 2000 characters" });
    }

    // Build event data with token information if provided
    const eventData: any = {
      author,
      author_name,
      text: trimmedText,
      message_type: 'user_message'  // Distinguish from system events
    };

    // Include tokens in event data if provided
    if (tokens && (tokens.input || tokens.output)) {
      eventData.tokens = {
        input: tokens.input,
        output: tokens.output
      };
    }

    // Create message event
    const event = await eventLog.createEvent('update' as EventType, {
      entity_type,
      entity_id,
      data: eventData
    });

    // Build broadcast message
    const broadcastData: any = {
      author,
      author_name,
      text: trimmedText,
      message_type: 'user_message'
    };

    // Include tokens in broadcast if provided
    if (tokens && (tokens.input || tokens.output)) {
      broadcastData.tokens = {
        input: tokens.input,
        output: tokens.output
      };
    }

    // Broadcast to WebSocket clients for real-time updates
    broadcast({
      type: 'new_message',
      message: {
        event_id: event.id,
        type: 'update',
        entity_type,
        entity_id,
        status: event.status,
        timestamp: event.timestamp,
        data: broadcastData
      }
    });

    res.status(201).json({
      message_id: event.id,
      timestamp: event.timestamp,
      status: "applied"
    });
  } catch (error: any) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/validate
 * Validate an operation without committing it
 */
app.post("/api/validate", async (req: Request, res: Response) => {
  try {
    const { type, entity_type, entity_id, data, changes } = req.body;

    if (!type) {
      return res.status(400).json({ error: "type is required" });
    }

    const tempEvent: Event = {
      id: "temp",
      timestamp: new Date().toISOString(),
      type: type as EventType,
      entity_type,
      entity_id,
      data,
      changes,
      status: "pending",
    };

    const validation = await validator.validateEvent(tempEvent);

    res.json(validation);
  } catch (error: any) {
    console.error("Error validating:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/entities/:type
 * List entities of a given type
 */
app.get("/api/entities/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { limit = "100" } = req.query;

    const typeMap: Record<string, string> = {
      accounts: "accounts",
      contacts: "contacts",
      opportunities: "opportunities",
      activities: "activities",
      leads: "leads",
      tasks: "tasks",
      quotes: "quotes",
      products: "products",
      campaigns: "campaigns",
      events: "events",
      orders: "orders",
      contracts: "contracts",
      assets: "assets",
      cases: "cases",
      knowledge: "knowledge",
      // Party Model entities
      parties: "parties",
      individuals: "individuals",
      organizations: "organizations",
      households: "households",
      "party-identifications": "party-identifications",
      "account-contact-relationships": "account-contact-relationships",
      "contact-point-emails": "contact-point-emails",
      "contact-point-phones": "contact-point-phones",
      "contact-point-addresses": "contact-point-addresses",
      "contact-point-consents": "contact-point-consents",
      "data-use-purposes": "data-use-purposes",
      // Research Intelligence entities
      "researcher-profiles": "researcher-profiles",
      "organization-profiles": "organization-profiles",
      "party-sources": "party-sources",
      "party-engagements": "party-engagements",
    };

    const dir = typeMap[type.toLowerCase()];
    if (!dir) {
      return res.status(400).json({ error: "Unknown entity type" });
    }

    const dirPath = path.join(VAULT, dir);
    if (!fs.existsSync(dirPath)) {
      return res.json({ entities: [], count: 0 });
    }

    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith(".md"))
      .slice(0, parseInt(limit as string));

    const entities = files.map((file) => {
      const content = fs.readFileSync(path.join(dirPath, file), "utf8");
      const parsed = matter(content);
      return parsed.data;
    });

    res.json({ entities, count: entities.length });
  } catch (error: any) {
    console.error("Error listing entities:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/entities/:type/:id
 * Get a specific entity
 */
app.get("/api/entities/:type/:id", async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;

    const typeMap: Record<string, string> = {
      accounts: "accounts",
      contacts: "contacts",
      opportunities: "opportunities",
      activities: "activities",
      leads: "leads",
      tasks: "tasks",
      quotes: "quotes",
      products: "products",
      campaigns: "campaigns",
      events: "events",
      orders: "orders",
      contracts: "contracts",
      assets: "assets",
      cases: "cases",
      knowledge: "knowledge",
      // Party Model entities
      parties: "parties",
      individuals: "individuals",
      organizations: "organizations",
      households: "households",
      "party-identifications": "party-identifications",
      "account-contact-relationships": "account-contact-relationships",
      "contact-point-emails": "contact-point-emails",
      "contact-point-phones": "contact-point-phones",
      "contact-point-addresses": "contact-point-addresses",
      "contact-point-consents": "contact-point-consents",
      "data-use-purposes": "data-use-purposes",
      // Research Intelligence entities
      "researcher-profiles": "researcher-profiles",
      "organization-profiles": "organization-profiles",
      "party-sources": "party-sources",
      "party-engagements": "party-engagements",
    };

    const dir = typeMap[type.toLowerCase()];
    if (!dir) {
      return res.status(400).json({ error: "Unknown entity type" });
    }

    const dirPath = path.join(VAULT, dir);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: "Entity not found" });
    }

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), "utf8");
      const parsed = matter(content);

      if (parsed.data.id === id) {
        return res.json({
          ...parsed.data,
          content: parsed.content,
        });
      }
    }

    res.status(404).json({ error: "Entity not found" });
  } catch (error: any) {
    console.error("Error getting entity:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/entities/:type/:id
 * Update a specific field of an entity
 */
app.patch("/api/entities/:type/:id", async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const { field, value, author = 'user' } = req.body;

    if (!field) {
      return res.status(400).json({ error: "field is required" });
    }

    if (value === undefined) {
      return res.status(400).json({ error: "value is required" });
    }

    const typeMap: Record<string, string> = {
      accounts: "accounts",
      contacts: "contacts",
      opportunities: "opportunities",
      activities: "activities",
      leads: "leads",
      tasks: "tasks",
      quotes: "quotes",
      products: "products",
      campaigns: "campaigns",
      events: "events",
      orders: "orders",
      contracts: "contracts",
      assets: "assets",
      cases: "cases",
      knowledge: "knowledge",
      // Party Model entities
      parties: "parties",
      individuals: "individuals",
      organizations: "organizations",
      households: "households",
      "party-identifications": "party-identifications",
      "account-contact-relationships": "account-contact-relationships",
      "contact-point-emails": "contact-point-emails",
      "contact-point-phones": "contact-point-phones",
      "contact-point-addresses": "contact-point-addresses",
      "contact-point-consents": "contact-point-consents",
      "data-use-purposes": "data-use-purposes",
      // Research Intelligence entities
      "researcher-profiles": "researcher-profiles",
      "organization-profiles": "organization-profiles",
      "party-sources": "party-sources",
      "party-engagements": "party-engagements",
    };

    const dir = typeMap[type.toLowerCase()];
    if (!dir) {
      return res.status(400).json({ error: "Unknown entity type" });
    }

    const dirPath = path.join(VAULT, dir);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: "Entity not found" });
    }

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));

    // Find the file with matching ID
    let targetFile: string | null = null;
    let oldContent: string = '';
    let oldFrontmatter: any = null;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = matter(content);

      if (parsed.data.id === id) {
        targetFile = file;
        oldContent = content;
        oldFrontmatter = parsed.data;
        break;
      }
    }

    if (!targetFile || !oldFrontmatter) {
      return res.status(404).json({ error: "Entity not found" });
    }

    // Validate the field update
    const validation = validateFieldUpdate(type, field, value);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        field,
        message: validation.message
      });
    }

    // Update the frontmatter
    const oldValue = oldFrontmatter[field];
    oldFrontmatter[field] = value;

    // Parse content to preserve body
    const parsed = matter(oldContent);
    const body = parsed.content;

    // Write updated markdown file
    const updatedContent = matter.stringify(body, oldFrontmatter);
    const fullPath = path.join(dirPath, targetFile);
    fs.writeFileSync(fullPath, updatedContent, 'utf8');

    // Log to global event log
    await eventLog.createEvent('update', {
      entity_type: type,
      entity_id: id,
      data: {
        field,
        old_value: oldValue,
        new_value: value,
        author
      }
    });

    // Broadcast change via WebSocket
    broadcast({
      type: 'field_updated',
      entity_type: type,
      entity_id: id,
      field,
      value,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      record: oldFrontmatter,
      field,
      old_value: oldValue,
      new_value: value
    });

  } catch (error: any) {
    console.error('Error updating entity field:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Party API Endpoints
 */

/**
 * GET /api/parties
 * List all parties with optional filtering
 */
app.get("/api/parties", async (req: Request, res: Response) => {
  try {
    const { limit = "100", party_type } = req.query;

    const partiesDir = path.join(VAULT, 'parties');
    if (!fs.existsSync(partiesDir)) {
      return res.json([]);
    }

    const files = fs
      .readdirSync(partiesDir)
      .filter((f) => f.endsWith(".md"))
      .slice(0, parseInt(limit as string));

    const parties = files.map((file) => {
      const content = fs.readFileSync(path.join(partiesDir, file), "utf8");
      const parsed = matter(content);
      return parsed.data;
    });

    // Filter by party_type if specified
    const filtered = party_type
      ? parties.filter((p) => p.party_type === party_type)
      : parties;

    res.json(filtered);
  } catch (error: any) {
    console.error("Error listing parties:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parties/graph
 * Get all parties with their connections for graph visualization
 */
app.get("/api/parties/graph", async (req: Request, res: Response) => {
  try {
    // Fetch all parties with their basic info
    const parties = database.getDb().prepare(`
      SELECT
        p.id,
        p.name,
        p.canonical_name,
        p.party_type,
        rp.current_institution,
        rp.previous_institution,
        rp.current_position,
        rp.h_index,
        rp.total_citations,
        cpe.email_address as primary_email
      FROM parties p
      LEFT JOIN researcher_profiles rp ON p.id = rp.party_id
      LEFT JOIN contact_point_emails cpe ON p.id = cpe.party_id AND cpe.is_primary = 1
      WHERE p.party_type = 'Individual'
      LIMIT 500
    `).all();

    // Build connections and create university/institution nodes
    const connections: Array<{ source: string; target: string; relationship: string; strength: number }> = [];
    const additionalNodes: Array<any> = [];
    const institutionMap = new Map<string, string[]>();
    const universityMap = new Map<string, string[]>();

    // Group parties by current institution
    parties.forEach((party: any) => {
      if (party.current_institution) {
        if (!institutionMap.has(party.current_institution)) {
          institutionMap.set(party.current_institution, []);
        }
        institutionMap.get(party.current_institution)!.push(party.id);
      }
    });

    // Group parties by university (previous_institution)
    parties.forEach((party: any) => {
      if (party.previous_institution) {
        if (!universityMap.has(party.previous_institution)) {
          universityMap.set(party.previous_institution, []);
        }
        universityMap.get(party.previous_institution)!.push(party.id);
      }
    });

    // Create organization nodes and connect people to them for current institutions
    institutionMap.forEach((partyIds, institution) => {
      // Create a node for the organization
      const orgNodeId = `org_${institution.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      additionalNodes.push({
        id: orgNodeId,
        name: institution,
        type: 'Organization',
        nodeType: 'organization'
      });

      // Connect each person to the organization node
      partyIds.forEach((partyId) => {
        connections.push({
          source: partyId,
          target: orgNodeId,
          relationship: `Works at ${institution}`,
          strength: 2
        });
      });
    });

    // Create university nodes and connect people to them
    universityMap.forEach((partyIds, university) => {
      // Create a node for the university
      const universityNodeId = `university_${university.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      additionalNodes.push({
        id: universityNodeId,
        name: university,
        type: 'University',
        nodeType: 'university'
      });

      // Connect each person to the university node
      partyIds.forEach((partyId) => {
        connections.push({
          source: partyId,
          target: universityNodeId,
          relationship: `Studied at ${university}`,
          strength: 1
        });
      });
    });

    res.json({
      nodes: [
        ...parties.map((p: any) => ({
          id: p.id,
          name: p.name || p.canonical_name || 'Unknown',
          type: p.party_type,
          email: p.primary_email,
          title: p.current_position,
          organization: p.current_institution,
          h_index: p.h_index,
          citation_count: p.total_citations,
          nodeType: 'person'
        })),
        ...additionalNodes
      ],
      links: connections
    });
  } catch (error: any) {
    console.error("Error fetching parties graph:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parties/:id
 * Get a specific party by ID
 */
app.get("/api/parties/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const partiesDir = path.join(VAULT, 'parties');
    if (!fs.existsSync(partiesDir)) {
      return res.status(404).json({ error: "Party not found" });
    }

    // Find file by ID in frontmatter
    const files = fs.readdirSync(partiesDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(partiesDir, file), "utf8");
      const parsed = matter(content);
      if (parsed.data.id === id) {
        return res.json(parsed.data);
      }
    }

    res.status(404).json({ error: "Party not found" });
  } catch (error: any) {
    console.error("Error getting party:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parties/:id/history
 * Get unified history for a party
 */
app.get("/api/parties/:id/history", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: Implement unified history (chat + event log + activities)
    res.json([]);
  } catch (error: any) {
    console.error("Error getting party history:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parties/:id/contact-points/emails
 * Get email contact points for a party
 */
app.get("/api/parties/:id/contact-points/emails", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const emailsDir = path.join(VAULT, 'contact-point-emails');
    if (!fs.existsSync(emailsDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(emailsDir).filter((f) => f.endsWith(".md"));
    const emails = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(emailsDir, file), "utf8");
      const parsed = matter(content);
      if (parsed.data.party_id === id) {
        emails.push(parsed.data);
      }
    }

    res.json(emails);
  } catch (error: any) {
    console.error("Error getting party emails:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parties/:id/contact-points/phones
 * Get phone contact points for a party
 */
app.get("/api/parties/:id/contact-points/phones", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const phonesDir = path.join(VAULT, 'contact-point-phones');
    if (!fs.existsSync(phonesDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(phonesDir).filter((f) => f.endsWith(".md"));
    const phones = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(phonesDir, file), "utf8");
      const parsed = matter(content);
      if (parsed.data.party_id === id) {
        phones.push(parsed.data);
      }
    }

    res.json(phones);
  } catch (error: any) {
    console.error("Error getting party phones:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parties/:id/contact-points/addresses
 * Get address contact points for a party
 */
app.get("/api/parties/:id/contact-points/addresses", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const addressesDir = path.join(VAULT, 'contact-point-addresses');
    if (!fs.existsSync(addressesDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(addressesDir).filter((f) => f.endsWith(".md"));
    const addresses = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(addressesDir, file), "utf8");
      const parsed = matter(content);
      if (parsed.data.party_id === id) {
        addresses.push(parsed.data);
      }
    }

    res.json(addresses);
  } catch (error: any) {
    console.error("Error getting party addresses:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Scholar/Researcher API Endpoints
 */

/**
 * GET /api/researchers/search
 * Search for researchers by h-index, affiliation, or other criteria
 */
app.get("/api/researchers/search", async (req: Request, res: Response) => {
  try {
    const { min_h_index, affiliation, name } = req.query;

    const profilesDir = path.join(VAULT, 'researcher-profiles');
    if (!fs.existsSync(profilesDir)) {
      return res.json({ researchers: [] });
    }

    const files = fs.readdirSync(profilesDir).filter(f => f.endsWith('.md'));
    const researchers: any[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(profilesDir, file), 'utf8');
      const parsed = matter(content);
      const profile = parsed.data;

      // Apply filters
      if (min_h_index && (!profile.h_index || profile.h_index < parseInt(min_h_index as string))) {
        continue;
      }

      if (affiliation && profile.current_institution) {
        const affiliationStr = typeof profile.current_institution === 'string'
          ? profile.current_institution
          : '';
        if (!affiliationStr.toLowerCase().includes((affiliation as string).toLowerCase())) {
          continue;
        }
      }

      if (name) {
        // Get individual name
        const partyId = profile.party_id?.replace(/\[\[parties\/(.*)\]\]/, '$1');
        if (partyId) {
          const individualFile = path.join(VAULT, 'individuals', `${partyId}.md`);
          if (fs.existsSync(individualFile)) {
            const individualContent = fs.readFileSync(individualFile, 'utf8');
            const individualData = matter(individualContent).data;
            const fullName = `${individualData.first_name || ''} ${individualData.last_name || ''}`.trim();
            if (!fullName.toLowerCase().includes((name as string).toLowerCase())) {
              continue;
            }
          }
        }
      }

      researchers.push({
        ...profile,
        content: parsed.content
      });
    }

    // Sort by h-index descending
    researchers.sort((a, b) => (b.h_index || 0) - (a.h_index || 0));

    res.json({
      researchers,
      count: researchers.length
    });
  } catch (error: any) {
    console.error('Error searching researchers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/researchers/:party_id/profile
 * Get researcher profile for a specific party
 */
app.get("/api/researchers/:party_id/profile", async (req: Request, res: Response) => {
  try {
    const { party_id } = req.params;

    const profilesDir = path.join(VAULT, 'researcher-profiles');
    if (!fs.existsSync(profilesDir)) {
      return res.status(404).json({ error: 'Researcher profile not found' });
    }

    const files = fs.readdirSync(profilesDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(profilesDir, file), 'utf8');
      const parsed = matter(content);
      const profile = parsed.data;

      if (profile.party_id === `[[parties/${party_id}]]` || profile.party_id === party_id) {
        return res.json({
          ...profile,
          content: parsed.content
        });
      }
    }

    res.status(404).json({ error: 'Researcher profile not found' });
  } catch (error: any) {
    console.error('Error getting researcher profile:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/researchers/stats
 * Get aggregate statistics about researchers in the system
 */
app.get("/api/researchers/stats", async (req: Request, res: Response) => {
  try {
    const profilesDir = path.join(VAULT, 'researcher-profiles');
    if (!fs.existsSync(profilesDir)) {
      return res.json({
        total_researchers: 0,
        avg_h_index: 0,
        total_citations: 0,
        top_researchers: []
      });
    }

    const files = fs.readdirSync(profilesDir).filter(f => f.endsWith('.md'));
    let totalHIndex = 0;
    let totalCitations = 0;
    const researchers: any[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(profilesDir, file), 'utf8');
      const parsed = matter(content);
      const profile = parsed.data;

      totalHIndex += profile.h_index || 0;
      totalCitations += profile.total_citations || 0;
      researchers.push(profile);
    }

    // Get top 10 by h-index
    const topResearchers = researchers
      .sort((a, b) => (b.h_index || 0) - (a.h_index || 0))
      .slice(0, 10)
      .map(r => ({
        party_id: r.party_id,
        h_index: r.h_index,
        total_citations: r.total_citations
      }));

    res.json({
      total_researchers: files.length,
      avg_h_index: files.length > 0 ? Math.round(totalHIndex / files.length) : 0,
      total_citations: totalCitations,
      top_researchers: topResearchers
    });
  } catch (error: any) {
    console.error('Error getting researcher stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/researchers/:party_id/scholar-file
 * Get the full scholar markdown file from scholarmd directory
 */
app.get("/api/researchers/:party_id/scholar-file", async (req: Request, res: Response) => {
  try {
    const { party_id } = req.params;

    // 1. Find party identification for Google Scholar
    const idsDir = path.join(VAULT, 'party-identifications');
    if (!fs.existsSync(idsDir)) {
      return res.status(404).json({
        error: "No party identifications found"
      });
    }

    const files = fs.readdirSync(idsDir).filter(f => f.endsWith('.md'));
    let scholarId: string | null = null;

    for (const file of files) {
      const content = fs.readFileSync(path.join(idsDir, file), 'utf8');
      const parsed = matter(content);

      // Handle both wikilink and ULID formats for party_id
      const matchesParty =
        parsed.data.party_id === party_id ||
        parsed.data.party_id === `[[parties/${party_id}]]`;

      if (
        matchesParty &&
        parsed.data.party_identification_type === 'GoogleScholar'
      ) {
        scholarId = parsed.data.identification_number;
        break;
      }
    }

    if (!scholarId) {
      return res.status(404).json({
        error: "No Google Scholar ID found for this party"
      });
    }

    // 2. Validate scholar ID format (alphanumeric only for security)
    if (!/^[a-zA-Z0-9_-]+$/.test(scholarId)) {
      return res.status(400).json({
        error: "Invalid scholar ID format"
      });
    }

    // 3. Read scholar file (filenames are lowercase)
    const scholarPath = path.join(VAULT, 'scholarmd', 'scholars', `${scholarId.toLowerCase()}.md`);

    if (!fs.existsSync(scholarPath)) {
      return res.status(404).json({
        error: "Scholar file not found",
        scholar_id: scholarId,
        hint: "The scholarmd symlink may not be set up correctly"
      });
    }

    const content = fs.readFileSync(scholarPath, 'utf8');
    const parsed = matter(content);

    res.json({
      scholar_id: scholarId,
      frontmatter: parsed.data,
      body: parsed.content,
      file_path: scholarPath
    });

  } catch (error: any) {
    console.error("Error getting scholar file:", error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * File API Endpoints (for Quip markdown editor)
 */

/**
 * GET /api/files
 * Get file tree structure
 */
app.get("/api/files", (req: Request, res: Response) => {
  try {
    const fileTree: any[] = [];

    // Add documents directory first (non-entity markdown files)
    const documentsDir = path.join(VAULT, 'documents');
    if (fs.existsSync(documentsDir)) {
      const files = fs.readdirSync(documentsDir)
        .filter(f => f.endsWith('.md'))
        .map(f => ({
          name: f,
          path: `documents/${f}`,
          type: 'file'
        }));

      if (files.length > 0 || true) { // Always show documents folder even if empty
        fileTree.push({
          name: 'documents',
          path: 'documents',
          type: 'directory',
          children: files,
          isDocuments: true  // Flag to indicate this is the documents folder
        });
      }
    }

    // Build file tree from vault entity directories
    const entityDirs = [
      'accounts',
      'contacts',
      'opportunities',
      'activities',
      'leads',
      'tasks',
      'quotes',
      'products',
      'campaigns',
      'events',
      'orders',
      'contracts',
      'assets',
      'cases',
      'knowledge'
    ];

    for (const dir of entityDirs) {
      const dirPath = path.join(VAULT, dir);

      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath)
          .filter(f => f.endsWith('.md'))
          .map(f => ({
            name: f,
            path: `${dir}/${f}`,
            type: 'file'
          }));

        if (files.length > 0) {
          fileTree.push({
            name: dir,
            path: dir,
            type: 'directory',
            children: files
          });
        }
      }
    }

      res.json(fileTree);
  } catch (error: any) {
    console.error("Error getting file tree:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search
 * Search across all vault markdown files
 */
app.get("/api/search", (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "query parameter 'q' is required" });
    }

    const searchTerm = query.trim().toLowerCase();

    // Track search for metrics
    metricsService.trackSearch(searchTerm).catch(err => {
      console.error('[Metrics] Error tracking search:', err);
    });

    const results: any[] = [];

    // Entity directories to search
    const entityDirs = [
      { dir: 'accounts', type: 'Account' },
      { dir: 'contacts', type: 'Contact' },
      { dir: 'opportunities', type: 'Opportunity' },
      { dir: 'leads', type: 'Lead' },
      { dir: 'activities', type: 'Activity' },
      { dir: 'tasks', type: 'Task' },
      { dir: 'quotes', type: 'Quote' },
      { dir: 'products', type: 'Product' },
      { dir: 'campaigns', type: 'Campaign' },
      { dir: 'events', type: 'Event' },
      { dir: 'orders', type: 'Order' },
      { dir: 'contracts', type: 'Contract' },
      { dir: 'assets', type: 'Asset' },
      { dir: 'cases', type: 'Case' },
      { dir: 'knowledge', type: 'Knowledge' },
      { dir: 'documents', type: 'Document' }
    ];

    for (const { dir, type } of entityDirs) {
      const dirPath = path.join(VAULT, dir);

      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        let matchCount = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase();

          if (lowerLine.includes(searchTerm)) {
            matchCount++;

            // Get context (line before and after for snippet)
            const contextStart = Math.max(0, i - 1);
            const contextEnd = Math.min(lines.length - 1, i + 1);
            const snippet = lines.slice(contextStart, contextEnd + 1).join('\n');

            results.push({
              path: `${dir}/${file}`,
              type,
              snippet: snippet.trim(),
              lineNumber: i + 1,
              matchCount: 1 // Will be aggregated below
            });
          }
        }
      }
    }

    // Aggregate results by file (combine multiple matches from same file)
    const aggregated = results.reduce((acc: any[], result) => {
      const existing = acc.find(r => r.path === result.path);
      if (existing) {
        existing.matchCount++;
      } else {
        acc.push({ ...result });
      }
      return acc;
    }, []);

    // Sort by match count (most matches first)
    aggregated.sort((a, b) => b.matchCount - a.matchCount);

    res.json({ results: aggregated, total: aggregated.length });
  } catch (error: any) {
    console.error("Error searching vault:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/es
 * Search across vault using Elasticsearch
 */
app.get("/api/search/es", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "query parameter 'q' is required" });
    }

    // Track search for metrics
    metricsService.trackSearch(query.trim()).catch(err => {
      console.error('[Metrics] Error tracking search:', err);
    });

    const from = parseInt(req.query.from as string) || 0;
    const size = parseInt(req.query.size as string) || 50;

    const result = await esSearch(query.trim(), { from, size });

    // Transform results to match the frontend interface
    const transformedResults = result.results.map((r: any) => ({
      path: r.path,
      type: r.type,
      snippet: r.snippet,
      lineNumber: 1, // ES doesn't track line numbers by default
      matchCount: 1,
      score: r.score
    }));

    res.json({
      results: transformedResults,
      total: result.total
    });
  } catch (error: any) {
    console.error("Error searching Elasticsearch:", error);
    res.status(500).json({ error: error.message || "Elasticsearch search failed" });
  }
});

/**
 * POST /api/documents
 * Create a new document in the documents folder
 */
app.post("/api/documents", (req: Request, res: Response) => {
  try {
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }

    // Create slug from title (lowercase, hyphenated)
    const slug = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const filename = `${slug}.md`;
    const filePath = path.join(VAULT, 'documents', filename);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return res.status(409).json({
        error: "A document with this title already exists",
        path: `documents/${filename}`
      });
    }

    // Create document with minimal frontmatter
    const doc_id = `doc_${ulid()}`;
    const frontmatter = {
      id: doc_id,
      title: title.trim(),
      type: 'Document',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const content = matter.stringify('', frontmatter);

    // Ensure documents directory exists
    const documentsDir = path.join(VAULT, 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(filePath, content, 'utf8');

    // Broadcast file tree change
    broadcast({
      type: 'entity_changed',
      entityType: 'documents',
      filename,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      path: `documents/${filename}`,
      document: {
        id: doc_id,
        title: title.trim(),
        path: `documents/${filename}`
      }
    });
  } catch (error: any) {
    console.error("Error creating document:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files/*
 * Get specific file content
 */
app.get(/^\/api\/files\/(.+)$/, (req: Request, res: Response) => {
  try {
    // Get the path after /api/files/
    const filePath = req.params[0];

    if (!filePath) {
      return res.status(400).json({ error: "File path is required" });
    }

    const fullPath = path.join(VAULT, filePath);

    // Security check: ensure path is within vault
    const resolvedPath = path.resolve(fullPath);
    const resolvedVault = path.resolve(VAULT);
    if (!resolvedPath.startsWith(resolvedVault)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const parsed = matter(content);

    res.json({
      path: filePath,
      frontmatter: parsed.data,
      content: parsed.content
    });
  } catch (error: any) {
    console.error("Error getting file:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/files/*
 * Update file content
 */
app.put(/^\/api\/files\/(.+)$/, (req: Request, res: Response) => {
  try {
    // Get the path after /api/files/
    const filePath = req.params[0];

    if (!filePath) {
      return res.status(400).json({ error: "File path is required" });
    }

    const { content, frontmatter } = req.body;

    if (content === undefined) {
      return res.status(400).json({ error: "content is required" });
    }

    const fullPath = path.join(VAULT, filePath);

    // Security check: ensure path is within vault
    const resolvedPath = path.resolve(fullPath);
    const resolvedVault = path.resolve(VAULT);
    if (!resolvedPath.startsWith(resolvedVault)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Read old content for diff computation
    let oldContent = '';
    let entityId = filePath; // Fallback to file path
    let entityType = 'Document';

    if (fs.existsSync(fullPath)) {
      const oldFile = fs.readFileSync(fullPath, 'utf8');
      const oldParsed = matter(oldFile);
      oldContent = oldParsed.content;

      // Extract entity ID from old frontmatter
      if (oldParsed.data.id) {
        entityId = oldParsed.data.id;
      }
      if (oldParsed.data.type) {
        entityType = oldParsed.data.type;
      }
    }

    // If no old frontmatter but new frontmatter has ID, use that
    if (entityId === filePath && frontmatter && frontmatter.id) {
      entityId = frontmatter.id;
    }
    if (entityType === 'Document' && frontmatter && frontmatter.type) {
      entityType = frontmatter.type;
    }

    // Build the markdown file with frontmatter
    const fileContent = matter.stringify(content, frontmatter || {});

    // Ensure directory exists
    const dirPath = path.dirname(fullPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(fullPath, fileContent, 'utf8');

    // Only log event if content actually changed
    if (oldContent !== content) {
      // Compute unix diff between old and new content
      const diff = createTwoFilesPatch(
        filePath,
        filePath,
        oldContent,
        content,
        'before',
        'after'
      );

      // Log event asynchronously with diff and proper entity ID (non-blocking)
      eventLog.createEvent('update', {
        entity_type: entityType,
        entity_id: entityId,  // Use actual entity ID from frontmatter!
        data: {
          path: filePath,
          content_length: content.length,
          frontmatter: frontmatter || {}
        },
        changes: {
          diff: diff  // Unix diff format!
        }
      }).catch(err => console.error('Failed to log document edit event:', err));

      // Broadcast file change to WebSocket clients for real-time updates
      const filename = path.basename(filePath);
      const entityTypeDir = path.dirname(filePath);
      broadcast({
        type: 'entity_changed',
        entityType: entityTypeDir,
        filename,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      path: filePath,
      message: "File updated successfully"
    });
  } catch (error: any) {
    console.error("Error updating file:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/documents/by-entity/:entity_type/:entity_id
 * Get document associated with an entity
 */
app.get("/api/documents/by-entity/:entity_type/:entity_id", (req: Request, res: Response) => {
  try {
    const { entity_type, entity_id } = req.params;

    const typeMap: Record<string, string> = {
      accounts: "accounts",
      contacts: "contacts",
      opportunities: "opportunities",
      activities: "activities",
      leads: "leads",
      tasks: "tasks",
      quotes: "quotes",
      products: "products",
      campaigns: "campaigns",
      events: "events",
      orders: "orders",
      contracts: "contracts",
      assets: "assets",
      cases: "cases",
      knowledge: "knowledge",
      // Party Model entities
      parties: "parties",
      individuals: "individuals",
      organizations: "organizations",
      households: "households",
      "party-identifications": "party-identifications",
      "account-contact-relationships": "account-contact-relationships",
      "contact-point-emails": "contact-point-emails",
      "contact-point-phones": "contact-point-phones",
      "contact-point-addresses": "contact-point-addresses",
      "contact-point-consents": "contact-point-consents",
      "data-use-purposes": "data-use-purposes",
      // Research Intelligence entities
      "researcher-profiles": "researcher-profiles",
      "organization-profiles": "organization-profiles",
      "party-sources": "party-sources",
      "party-engagements": "party-engagements",
    };

    const dir = typeMap[entity_type.toLowerCase()];
    if (!dir) {
      return res.status(400).json({ error: "Unknown entity type" });
    }

    const dirPath = path.join(VAULT, dir);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: "No documents found for this entity type" });
    }

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = matter(content);

      if (parsed.data.id === entity_id) {
        const stats = fs.statSync(filePath);

        return res.json({
          path: `${dir}/${file}`,
          frontmatter: parsed.data,
          content: parsed.content,
          last_modified: stats.mtime.toISOString(),
          content_length: parsed.content.length
        });
      }
    }

    res.status(404).json({ error: "Document not found for this entity" });
  } catch (error: any) {
    console.error("Error getting document by entity:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Picklist Endpoints
 */

/**
 * GET /api/picklists
 * Get all picklist definitions
 */
app.get("/api/picklists", (req: Request, res: Response) => {
  try {
    const picklistsPath = path.join(VAULT, "_schemas", "picklists.json");

    if (!fs.existsSync(picklistsPath)) {
      return res.json({});
    }

    const picklists = JSON.parse(fs.readFileSync(picklistsPath, "utf8"));
    res.json(picklists);
  } catch (error: any) {
    console.error("Error loading picklists:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/picklists/:entity
 * Get picklists for a specific entity type
 */
app.get("/api/picklists/:entity", (req: Request, res: Response) => {
  try {
    const { entity } = req.params;
    const picklistsPath = path.join(VAULT, "_schemas", "picklists.json");

    if (!fs.existsSync(picklistsPath)) {
      return res.json({});
    }

    const picklists = JSON.parse(fs.readFileSync(picklistsPath, "utf8"));
    const entityPicklists = picklists[entity];

    if (!entityPicklists) {
      return res.status(404).json({ error: `No picklists found for entity: ${entity}` });
    }

    res.json(entityPicklists);
  } catch (error: any) {
    console.error("Error loading entity picklists:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/picklists/:entity/:field
 * Get picklist definition for a specific field
 */
app.get("/api/picklists/:entity/:field", (req: Request, res: Response) => {
  try {
    const { entity, field } = req.params;
    const picklistsPath = path.join(VAULT, "_schemas", "picklists.json");

    if (!fs.existsSync(picklistsPath)) {
      return res.status(404).json({ error: "Picklists not found" });
    }

    const picklists = JSON.parse(fs.readFileSync(picklistsPath, "utf8"));
    const fieldPicklist = picklists[entity]?.[field];

    if (!fieldPicklist) {
      return res.status(404).json({
        error: `No picklist found for ${entity}.${field}`
      });
    }

    res.json(fieldPicklist);
  } catch (error: any) {
    console.error("Error loading field picklist:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Analytics & Query Endpoints
 */

/**
 * GET /api/query/pipeline
 * Get pipeline value by stage
 */
app.get("/api/query/pipeline", (req: Request, res: Response) => {
  try {
    const pipeline = queryService.getPipelineValue();
    res.json({ pipeline, total_stages: pipeline.length });
  } catch (error: any) {
    console.error("Error getting pipeline:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/accounts-by-stage
 * Get account distribution by lifecycle stage
 */
app.get("/api/query/accounts-by-stage", (req: Request, res: Response) => {
  try {
    const accounts = queryService.getAccountsByStage();
    res.json({ accounts });
  } catch (error: any) {
    console.error("Error getting accounts by stage:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/recent-activities
 * Get recent activities
 */
app.get("/api/query/recent-activities", (req: Request, res: Response) => {
  try {
    const { days = "7" } = req.query;
    const activities = queryService.getRecentActivities(parseInt(days as string));
    res.json({ activities, count: activities.length });
  } catch (error: any) {
    console.error("Error getting recent activities:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/lead-conversion
 * Get lead conversion statistics
 */
app.get("/api/query/lead-conversion", (req: Request, res: Response) => {
  try {
    const conversion = queryService.getLeadConversion();
    res.json({ conversion });
  } catch (error: any) {
    console.error("Error getting lead conversion:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/top-accounts
 * Get top accounts by opportunity value
 */
app.get("/api/query/top-accounts", (req: Request, res: Response) => {
  try {
    const { limit = "10" } = req.query;
    const accounts = queryService.getTopAccounts(parseInt(limit as string));
    res.json({ accounts, count: accounts.length });
  } catch (error: any) {
    console.error("Error getting top accounts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/overdue-tasks
 * Get overdue tasks
 */
app.get("/api/query/overdue-tasks", (req: Request, res: Response) => {
  try {
    const tasks = queryService.getOverdueTasks();
    res.json({ tasks, count: tasks.length });
  } catch (error: any) {
    console.error("Error getting overdue tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/contact-activity
 * Get contact engagement metrics
 */
app.get("/api/query/contact-activity", (req: Request, res: Response) => {
  try {
    const { limit = "20" } = req.query;
    const contacts = queryService.getContactActivity(parseInt(limit as string));
    res.json({ contacts, count: contacts.length });
  } catch (error: any) {
    console.error("Error getting contact activity:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/revenue-forecast
 * Get revenue forecast by month
 */
app.get("/api/query/revenue-forecast", (req: Request, res: Response) => {
  try {
    const { months = "6" } = req.query;
    const forecast = queryService.getRevenueForecast(parseInt(months as string));
    res.json({ forecast, months: forecast.length });
  } catch (error: any) {
    console.error("Error getting revenue forecast:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/closed-won-summary
 * Get summary of closed won deals
 */
app.get("/api/query/closed-won-summary", (req: Request, res: Response) => {
  try {
    const summary = queryService.getClosedWonSummary();
    res.json(summary);
  } catch (error: any) {
    console.error("Error getting closed won summary:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/sales-velocity
 * Get average days to close
 */
app.get("/api/query/sales-velocity", (req: Request, res: Response) => {
  try {
    const velocity = queryService.getSalesVelocity();
    res.json(velocity);
  } catch (error: any) {
    console.error("Error getting sales velocity:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/query/win-rate
 * Get win rate statistics
 */
app.get("/api/query/win-rate", (req: Request, res: Response) => {
  try {
    const winRate = queryService.getWinRate();
    res.json(winRate);
  } catch (error: any) {
    console.error("Error getting win rate:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/query/custom
 * Execute custom SQL query (SELECT only)
 */
app.post("/api/query/custom", (req: Request, res: Response) => {
  try {
    const { sql } = req.body;

    if (!sql) {
      return res.status(400).json({ error: "sql query is required" });
    }

    const results = queryService.executeCustomQuery(sql);
    res.json({ results, count: results.length });
  } catch (error: any) {
    console.error("Error executing custom query:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Import/Export Endpoints
 */

/**
 * POST /api/import/accounts
 * Import accounts from CSV
 */
app.post("/api/import/accounts", (req: Request, res: Response) => {
  try {
    const csvData = req.body;

    if (typeof csvData !== 'string') {
      return res.status(400).json({ error: "CSV data expected as text/csv" });
    }

    const result = importExportService.importAccounts(csvData);
    res.json(result);
  } catch (error: any) {
    console.error("Error importing accounts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/contacts
 * Import contacts from CSV
 */
app.post("/api/import/contacts", (req: Request, res: Response) => {
  try {
    const csvData = req.body;

    if (typeof csvData !== 'string') {
      return res.status(400).json({ error: "CSV data expected as text/csv" });
    }

    const result = importExportService.importContacts(csvData);
    res.json(result);
  } catch (error: any) {
    console.error("Error importing contacts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/opportunities
 * Import opportunities from CSV
 */
app.post("/api/import/opportunities", (req: Request, res: Response) => {
  try {
    const csvData = req.body;

    if (typeof csvData !== 'string') {
      return res.status(400).json({ error: "CSV data expected as text/csv" });
    }

    const result = importExportService.importOpportunities(csvData);
    res.json(result);
  } catch (error: any) {
    console.error("Error importing opportunities:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/accounts
 * Export accounts to CSV
 */
app.get("/api/export/accounts", (req: Request, res: Response) => {
  try {
    const csv = importExportService.exportAccounts();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="accounts.csv"');
    res.send(csv);
  } catch (error: any) {
    console.error("Error exporting accounts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/contacts
 * Export contacts to CSV
 */
app.get("/api/export/contacts", (req: Request, res: Response) => {
  try {
    const csv = importExportService.exportContacts();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csv);
  } catch (error: any) {
    console.error("Error exporting contacts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/opportunities
 * Export opportunities to CSV
 */
app.get("/api/export/opportunities", (req: Request, res: Response) => {
  try {
    const csv = importExportService.exportOpportunities();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="opportunities.csv"');
    res.send(csv);
  } catch (error: any) {
    console.error("Error exporting opportunities:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/all
 * Export all data as JSON
 */
app.get("/api/export/all", (req: Request, res: Response) => {
  try {
    const data = importExportService.exportAllJSON();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="crm-export.json"');
    res.json(data);
  } catch (error: any) {
    console.error("Error exporting all data:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/import/stats
 * Get import statistics
 */
app.get("/api/import/stats", (req: Request, res: Response) => {
  try {
    const stats = importExportService.getImportStats();
    res.json(stats);
  } catch (error: any) {
    console.error("Error getting import stats:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Webhook Endpoints
 */

/**
 * POST /api/webhooks
 * Register a new webhook
 */
app.post("/api/webhooks", (req: Request, res: Response) => {
  try {
    const { url, events, secret } = req.body;

    if (!url) {
      return res.status(400).json({ error: "url is required" });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "events array is required" });
    }

    const webhook = webhookService.registerWebhook(url, events, secret);
    res.status(201).json(webhook);
  } catch (error: any) {
    console.error("Error registering webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/webhooks
 * List all webhooks
 */
app.get("/api/webhooks", (req: Request, res: Response) => {
  try {
    const { active } = req.query;
    const webhooks = webhookService.listWebhooks(active === "true");
    res.json({ webhooks, count: webhooks.length });
  } catch (error: any) {
    console.error("Error listing webhooks:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/webhooks/:id
 * Get webhook details
 */
app.get("/api/webhooks/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const webhook = webhookService.getWebhook(id);

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    res.json(webhook);
  } catch (error: any) {
    console.error("Error getting webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/webhooks/:id
 * Update webhook
 */
app.put("/api/webhooks/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { url, events, secret, active } = req.body;

    const updates: any = {};
    if (url !== undefined) updates.url = url;
    if (events !== undefined) updates.events = events;
    if (secret !== undefined) updates.secret = secret;
    if (active !== undefined) updates.active = active;

    const success = webhookService.updateWebhook(id, updates);

    if (!success) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    const webhook = webhookService.getWebhook(id);
    res.json(webhook);
  } catch (error: any) {
    console.error("Error updating webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete webhook
 */
app.delete("/api/webhooks/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = webhookService.deleteWebhook(id);

    if (!success) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    res.json({ success: true, message: "Webhook deleted" });
  } catch (error: any) {
    console.error("Error deleting webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Test webhook delivery
 */
app.post("/api/webhooks/:id/test", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const webhook = webhookService.getWebhook(id);

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    // Create a test delivery
    const testPayload = {
      event: "test",
      timestamp: new Date().toISOString(),
      message: "This is a test webhook delivery",
    };

    const delivery = webhookService.createDelivery(
      webhook.id,
      "test_event",
      "test",
      testPayload
    );

    // Deliver it
    await webhookService.deliverWebhook(webhook, delivery);

    // Get updated delivery status
    const deliveries = webhookService.getDeliveriesForWebhook(webhook.id, 1);
    const result = deliveries[0];

    res.json({
      success: result.status === "success",
      delivery: result,
    });
  } catch (error: any) {
    console.error("Error testing webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/webhooks/:id/deliveries
 * Get webhook delivery history
 */
app.get("/api/webhooks/:id/deliveries", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = "50" } = req.query;

    const webhook = webhookService.getWebhook(id);
    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    const deliveries = webhookService.getDeliveriesForWebhook(
      id,
      parseInt(limit as string)
    );

    res.json({ deliveries, count: deliveries.length });
  } catch (error: any) {
    console.error("Error getting webhook deliveries:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Visitor Session Endpoints (Live chat with contact-app visitors)
 */

/**
 * GET /api/visitor-sessions
 * List all visitor sessions from database (including offline/disconnected)
 * Merges with in-memory sessions to show real-time online status
 */
app.get("/api/visitor-sessions", (req: Request, res: Response) => {
  try {
    // Get all sessions from database (last 7 days, max 100)
    const dbSessions = database.getAllVisitorSessions(100, 7);
    console.log(`[API] 📋 Loaded ${dbSessions.length} visitor sessions from database`);

    // Create a map of session IDs to in-memory sessions
    const inMemoryMap = new Map();
    visitorSessions.forEach(session => {
      inMemoryMap.set(session.id, session);
    });
    console.log(`[API] 💾 ${inMemoryMap.size} sessions currently in memory (online)`);

    // Merge database sessions with in-memory sessions
    const sessions = dbSessions.map(dbSession => {
      const inMemory = inMemoryMap.get(dbSession.id);

      return {
        id: dbSession.id,
        name: dbSession.name,
        email: dbSession.email,
        phone: dbSession.phone,
        company: dbSession.company,
        message: dbSession.message,
        pageUrl: dbSession.page_url,
        userAgent: dbSession.user_agent,
        ipAddress: dbSession.ip_address,
        connectedAt: dbSession.connected_at,
        disconnectedAt: dbSession.disconnected_at,
        lastActivity: inMemory?.lastActivity || dbSession.last_activity,
        status: inMemory ? inMemory.status : (dbSession.status === 'active' ? 'offline' : dbSession.status),
        isOnline: !!inMemory, // True if session is in memory (connected)
        unreadCount: inMemory?.unreadCount || 0
      };
    });

    console.log(`[API] ✅ Returning ${sessions.length} total sessions (${sessions.filter(s => s.isOnline).length} online)`);
    res.json({ sessions });
  } catch (error: any) {
    console.error("Error listing visitor sessions:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visitor-sessions/:id/messages
 * Get messages for a specific visitor session
 */
app.get("/api/visitor-sessions/:id/messages", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find session by ID
    const session = Array.from(visitorSessions.values()).find(s => s.id === id);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({ messages: session.messages || [] });
  } catch (error: any) {
    console.error("Error getting visitor session messages:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/visitor-sessions/:id/messages
 * Send a message to a visitor (from admin)
 */
app.post("/api/visitor-sessions/:id/messages", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text, author_name = 'Admin' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    // Find session by ID
    const session = Array.from(visitorSessions.values()).find(s => s.id === id);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Create admin message
    const message = {
      id: `msg_${ulid()}`,
      author: 'admin',
      author_name,
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    // Store in session
    if (!session.messages) session.messages = [];
    session.messages.push(message);

    // Update session status to chatting
    if (session.status === 'browsing') {
      session.status = 'chatting';
    }

    // Find visitor's WebSocket connection
    const visitorWs = Array.from(clients).find(
      (client: any) => client.socketId === session.socketId
    );

    // Send to visitor via WebSocket
    if (visitorWs && (visitorWs as any).readyState === 1) { // OPEN state
      (visitorWs as any).send(JSON.stringify({
        type: 'admin:message',
        message
      }));
    }

    // Log event
    await eventLog.createEvent('create', {
      entity_type: 'contact-chat',
      entity_id: message.id,
      data: {
        id: message.id,
        type: 'contact-chat',
        session_id: session.id,
        author: 'admin',
        author_name,
        text: message.text,
        timestamp: message.timestamp,
        channel: 'web'
      }
    });

    res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error sending message to visitor:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * AI-App Session Endpoints (Molecular viewer + chat integration)
 */

// Track AI-App sessions (extends visitor sessions with structure info)
interface AIAppSession {
  id: string;              // vis_aiapp_<ulid>
  socketId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  pageUrl: string;
  userAgent: string;
  ipAddress: string;
  connectedAt: string;
  disconnectedAt: string | null;
  lastActivity: string;
  status: 'browsing' | 'chatting' | 'submitted' | 'disconnected' | 'offline';
  isOnline: boolean;
  currentStructure: {
    id: string;
    name: string;
    source: string;
    description: string;
  } | null;
  commandHistory: Array<{
    command: string;
    timestamp: string;
  }>;
  messages: any[];
  unreadCount: number;
}

const aiAppSessions = new Map<string, AIAppSession>(); // socketId -> session

/**
 * GET /api/aiapp-sessions
 * List all AI-App visitor sessions
 */
app.get("/api/aiapp-sessions", (req: Request, res: Response) => {
  try {
    const sessions = Array.from(aiAppSessions.values()).map(session => ({
      ...session,
      isOnline: true // If in memory, it's online
    }));

    console.log(`[API] ✅ Returning ${sessions.length} ai-app sessions`);
    res.json({ sessions });
  } catch (error: any) {
    console.error("Error listing ai-app sessions:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/aiapp-sessions/:id/messages
 * Get messages for a specific AI-App session
 */
app.get("/api/aiapp-sessions/:id/messages", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = Array.from(aiAppSessions.values()).find(s => s.id === id);

    if (!session) {
      return res.status(404).json({ error: "AI-App session not found" });
    }

    res.json({ messages: session.messages || [] });
  } catch (error: any) {
    console.error("Error getting ai-app session messages:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/aiapp-sessions/:id/messages
 * Send a message to an AI-App visitor (from admin)
 */
app.post("/api/aiapp-sessions/:id/messages", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text, author_name = 'Admin' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Message text is required" });
    }

    // Find session by ID
    const session = Array.from(aiAppSessions.values()).find(s => s.id === id);

    if (!session) {
      return res.status(404).json({ error: "AI-App session not found" });
    }

    // Create message
    const message = {
      id: `msg_${ulid().toLowerCase()}`,
      author: 'admin',
      author_name,
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    // Store message in session
    if (!session.messages) session.messages = [];
    session.messages.push(message);

    // Update session status
    session.lastActivity = message.timestamp;
    if (session.status === 'browsing') {
      session.status = 'chatting';
    }

    // Find visitor's WebSocket connection
    const visitorWs = Array.from(clients).find(
      (client: any) => client.socketId === session.socketId
    );

    // Send to visitor via WebSocket
    if (visitorWs && (visitorWs as any).readyState === 1) {
      (visitorWs as any).send(JSON.stringify({
        type: 'admin:message',
        message
      }));
      console.log(`[AI-App] ✓ Sent admin message to visitor ${session.id}`);
    } else {
      console.log(`[AI-App] ⚠ Visitor ${session.id} not connected, message stored for later`);
    }

    // Log event (optional, for audit trail)
    await eventLog.createEvent('create', {
      entity_type: 'aiapp-message',
      entity_id: message.id,
      data: {
        id: message.id,
        type: 'aiapp-chat',
        session_id: session.id,
        author: 'admin',
        author_name,
        text: message.text,
        timestamp: message.timestamp
      }
    }).catch(err => console.error('[AI-App] Error logging message event:', err));

    res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error sending message to ai-app visitor:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai-app/markdown-content
 * Fetch markdown content for PDB structures
 * Query params: path (e.g., "1erm" or "hemoglobin")
 */
app.get("/api/ai-app/markdown-content", async (req: Request, res: Response) => {
  try {
    const { path: urlPath } = req.query;

    if (!urlPath || typeof urlPath !== 'string') {
      return res.status(400).json({ error: "path query parameter is required" });
    }

    console.log(`[AI-App] Fetching markdown content for path: ${urlPath}`);

    // Try multiple locations for markdown files
    const locations = [
      path.join(VAULT, '_automation', 'ai-prompts', `${urlPath}.md`),
      path.join(VAULT, 'ai-app', `${urlPath}.md`),
      path.join(VAULT, 'documents', 'ai-app', `${urlPath}.md`),
    ];

    let markdownPath: string | null = null;
    for (const loc of locations) {
      if (fs.existsSync(loc)) {
        markdownPath = loc;
        break;
      }
    }

    if (!markdownPath) {
      console.log(`[AI-App] No markdown file found for ${urlPath}, returning default`);
      return res.json({
        content: `How can I help today? (try 'load ${urlPath}' to load a PDB structure)`,
        commands: []
      });
    }

    const fileContent = fs.readFileSync(markdownPath, 'utf8');
    const parsed = matter(fileContent);

    // Extract commands from frontmatter or body
    const commands: string[] = [];
    if (parsed.data.commands && Array.isArray(parsed.data.commands)) {
      commands.push(...parsed.data.commands);
    }

    // Parse commands from markdown (lines starting with `> ` or code blocks)
    const commandRegex = /^>\s*(.+)$/gm;
    let match;
    while ((match = commandRegex.exec(parsed.content)) !== null) {
      commands.push(match[1].trim());
    }

    res.json({
      content: parsed.content,
      commands,
      metadata: parsed.data
    });
  } catch (error: any) {
    console.error("[AI-App] Error fetching markdown content:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Molecular Viewer Endpoints (for c-app and ai-app)
 */

/**
 * GET /api/pdb/:pdbId
 * Serve PDB file for molecular viewers
 */
app.get("/api/pdb/:pdbId", (req: Request, res: Response) => {
  try {
    const { pdbId } = req.params;

    // Validate PDB ID format (4 characters, starts with digit)
    if (!pdbId || pdbId.length !== 4 || !/^\d/.test(pdbId)) {
      return res.status(400).json({ error: "Invalid PDB ID format" });
    }

    const dataDir = process.env.DATA_DIR || path.join(process.env.HOME || '/Users/sness', 'data');
    const pdbFilePath = path.join(dataDir, 'pdb/pdbheader', `pdb${pdbId.toLowerCase()}.smol.pdb`);

    console.log(`[PDB] Serving PDB file: ${pdbFilePath}`);

    if (!fs.existsSync(pdbFilePath)) {
      console.error(`[PDB] File not found: ${pdbFilePath}`);
      return res.status(404).json({ error: `PDB file not found for ${pdbId}` });
    }

    const pdbData = fs.readFileSync(pdbFilePath, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(pdbData);
  } catch (error: any) {
    console.error("[PDB] Error serving PDB file:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/markdown/:filename
 * Serve markdown file (for ci-app)
 */
app.get("/api/markdown/:filename", (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const { vault = 'c' } = req.query; // Support different vaults (c, ci, ai)

    // Sanitize filename
    const sanitizedFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

    // Prevent directory traversal
    if (sanitizedFilename.includes('..') || sanitizedFilename.includes('/') || sanitizedFilename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const dataDir = process.env.DATA_DIR || path.join(process.env.HOME || '/Users/sness', 'data');
    let markdownPath: string;

    // Support different vault locations
    if (vault === 'ai') {
      markdownPath = path.join(dataDir, 'doi/ai', sanitizedFilename);
    } else {
      markdownPath = path.join(dataDir, `vaults/${vault}`, sanitizedFilename);
    }

    console.log(`[Markdown] Serving markdown file: ${markdownPath}`);

    if (!fs.existsSync(markdownPath)) {
      console.error(`[Markdown] File not found: ${markdownPath}`);
      return res.status(404).json({ error: `Markdown file '${sanitizedFilename}' not found` });
    }

    const markdownContent = fs.readFileSync(markdownPath, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(markdownContent);
  } catch (error: any) {
    console.error("[Markdown] Error serving markdown file:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/markdown/:filename
 * Save markdown file (for ci-app)
 */
app.post("/api/markdown/:filename", express.text({ type: 'text/plain' }), (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const { vault = 'c' } = req.query;

    // Sanitize filename
    const sanitizedFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

    // Prevent directory traversal
    if (sanitizedFilename.includes('..') || sanitizedFilename.includes('/') || sanitizedFilename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const dataDir = process.env.DATA_DIR || path.join(process.env.HOME || '/Users/sness', 'data');
    const markdownPath = path.join(dataDir, `vaults/${vault}`, sanitizedFilename);

    console.log(`[Markdown] Saving markdown file: ${markdownPath}`);

    const content = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }

    // Ensure directory exists
    const dir = path.dirname(markdownPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(markdownPath, content, 'utf8');
    res.status(200).json({ message: 'Markdown content saved successfully' });
  } catch (error: any) {
    console.error("[Markdown] Error saving markdown file:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Channel Endpoints (Slack-like chat channels)
 */

/**
 * GET /api/channels
 * List all channels
 */
app.get("/api/channels", (req: Request, res: Response) => {
  try {
    const channels = channelsDb.prepare('SELECT * FROM channels ORDER BY name').all();
    res.json({ channels });
  } catch (error: any) {
    console.error("Error listing channels:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/channels
 * Create a new channel
 */
app.post("/api/channels", (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    // Force lowercase and remove spaces
    const channelName = name.trim().toLowerCase().replace(/\s+/g, '-');

    // Check if channel already exists
    const existing = channelsDb.prepare('SELECT id FROM channels WHERE name = ?').get(channelName);
    if (existing) {
      return res.status(409).json({ error: "Channel already exists" });
    }

    const id = `ch_${ulid()}`;
    const created_at = new Date().toISOString();

    channelsDb.prepare(`
      INSERT INTO channels (id, name, created_at, description)
      VALUES (?, ?, ?, ?)
    `).run(id, channelName, created_at, description || null);

    const channel = { id, name: channelName, created_at, description };
    res.status(201).json({ channel });
  } catch (error: any) {
    console.error("Error creating channel:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/channels/:id/messages
 * Get messages for a channel
 */
app.get("/api/channels/:id/messages", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = "100", before } = req.query;

    let query = `
      SELECT * FROM messages
      WHERE channel_id = ?
      ${before ? 'AND timestamp < ?' : ''}
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const params = before ? [id, before, parseInt(limit as string)] : [id, parseInt(limit as string)];
    const messages = channelsDb.prepare(query).all(...params);

    // Reverse to get chronological order (oldest first)
    res.json({ messages: messages.reverse() });
  } catch (error: any) {
    console.error("Error getting channel messages:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/channels/:id/messages
 * Send a message to a channel
 */
app.post("/api/channels/:id/messages", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text, author = 'user', author_name = 'User', timing, tokens } = req.body;

    // T1: API received request
    const t_api = performance.now();

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    // Verify channel exists and get name (except for special dm_cohere channel)
    let channel: any;
    if (id === 'dm_cohere') {
      // Special DM channel - doesn't need to exist in database
      channel = { id: 'dm_cohere', name: 'dm_cohere' };
    } else {
      channel = channelsDb.prepare('SELECT id, name FROM channels WHERE id = ?').get(id);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
    }

    const message_id = timing?.messageId || `msg_${ulid()}`;
    const timestamp = new Date().toISOString();
    const trimmedText = text.trim();

    // Store sender timing in map for E2E correlation
    if (timing?.t0) {
      senderTimingMap.set(message_id, {
        t0_send: timing.t0,
        channelId: id,
        text: trimmedText
      });
    }

    // T2: Database write starts
    const t_db_start = performance.now();

    channelsDb.prepare(`
      INSERT INTO messages (id, channel_id, author, author_name, text, timestamp, tokens_input, tokens_output)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(message_id, id, author, author_name, trimmedText, timestamp, tokens?.input || null, tokens?.output || null);

    // T3: Database write completes
    const t_db_end = performance.now();

    // Track message for metrics
    metricsService.trackMessage(id).catch(err => {
      console.error('[Metrics] Error tracking message:', err);
    });

    const message: any = {
      id: message_id,
      channel_id: id,
      author,
      author_name,
      text: trimmedText,
      timestamp
    };

    // Include tokens in message object if provided
    if (tokens && (tokens.input || tokens.output)) {
      message.tokens_input = tokens.input;
      message.tokens_output = tokens.output;
    }

    // T4: Markdown write starts
    const t_md_start = performance.now();

    // Log to markdown file
    await logChannelMessageToMarkdown(id, channel.name, message);

    // Log any links shared in the message
    await logLinksToMarkdown(id, channel.name, message);

    // Add links to download queue for Pocketz worker
    await addLinksToDownloadQueue(message, id, channel.name, author, author_name);

    // Send to Discord if this is #general channel
    if (channel.name === 'general' && discordService.isEnabled()) {
      const discordMessage = discordService.formatMessage(author_name, trimmedText);
      discordService.sendMessage(discordMessage, message_id).then(result => {
        if (result.success && result.discordMessageId) {
          console.log(`[Discord] ✅ Forwarded to Discord: ${result.discordMessageId}`);
        }
      }).catch(err => {
        console.error('[Discord] Error sending message:', err);
      });
    }

    // T5: Markdown write completes
    const t_md_end = performance.now();

    // T6: WebSocket broadcast
    const t_ws_broadcast = performance.now();

    // Get sender timing from map for E2E correlation
    const senderTiming = senderTimingMap.get(message_id);

    // Broadcast via WebSocket with timing data (including sender timing from map)
    broadcast({
      type: 'channel_message',
      channel_id: id,
      message,
      timing: {
        messageId: message_id,
        t0_send: senderTiming?.t0_send || t_api,  // Sender's click time (from map)
        t1_send: senderTiming?.t1_send,           // Sender's response received time (updated later)
        t_api,
        t_db_start,
        t_db_end,
        t_md_start,
        t_md_end,
        t_ws_broadcast
      }
    });

    // 🤖 AI LISTENER: Check if this is an AI command
    // Only process AI commands from non-AI authors (loop prevention)
    const aiCommand = detectAICommand(trimmedText);
    if (aiCommand.isAI && canTriggerAI(author) && channel.name === 'general') {
      console.log(`[AI Listener] Detected %${aiCommand.command} command in #${channel.name} from ${author_name}`);

      // Launch AI request asynchronously (don't block the response)
      handleAICommand(aiCommand, id, channel.name, author_name, {
        channelsDb,
        logChannelMessageToMarkdown,
        broadcast,
        discordService
      }).catch(err => {
        console.error('[AI Listener] Error handling AI command:', err);
      });
    }

    res.status(201).json({
      message,
      timing: {
        messageId: message_id,
        t_api,
        t_db_start,
        t_db_end,
        t_md_start,
        t_md_end,
        t_ws_broadcast,
        serverMetrics: {
          dbWrite: t_db_end - t_db_start,
          markdownWrite: t_md_end - t_md_start,
          totalServerTime: t_md_end - t_api
        }
      }
    });
  } catch (error: any) {
    console.error("Error sending channel message:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Topic Management Endpoints
 */

/**
 * POST /api/channels/:channelId/topics
 * Create a new topic from current conversation
 */
app.post("/api/channels/:channelId/topics", async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // Import topic services
    const { summarizeToThreeWords } = await import('./services/topic-summarizer.js');
    const { createTopic } = await import('./services/topic-storage.js');

    // Use AI to summarize conversation into 3 words
    const title = await summarizeToThreeWords(messages);

    // Create topic and save to disk
    const topicMeta = createTopic(channelId, title, messages);

    // Delete ALL messages from the channel now that they're in a topic
    const deleteResult = channelsDb.prepare(`DELETE FROM messages WHERE channel_id = ?`).run(channelId);
    console.log(`[Topic] Deleted ${deleteResult.changes} messages from channel ${channelId}`);

    // Broadcast new topic notification via WebSocket
    broadcast({
      type: 'new_topic',
      channelId,
      topic: topicMeta
    });

    res.status(201).json(topicMeta);
  } catch (error: any) {
    console.error("Error creating topic:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/channels/:channelId/topics
 * Get all topics for a channel
 */
app.get("/api/channels/:channelId/topics", async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;

    const { getTopicsForChannel } = await import('./services/topic-storage.js');
    const topics = getTopicsForChannel(channelId);

    res.json({ topics });
  } catch (error: any) {
    console.error("Error fetching topics:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/topics/:topicId
 * Get a specific topic with all messages
 */
app.get("/api/topics/:topicId", async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;

    const { getTopicById } = await import('./services/topic-storage.js');
    const topic = getTopicById(topicId);

    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }

    res.json(topic);
  } catch (error: any) {
    console.error("Error fetching topic:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/topics/:topicId/messages
 * Add a message to an existing topic
 */
app.post("/api/topics/:topicId/messages", async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;
    const { text, author = 'user', author_name = 'User', tokens } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    const { addMessageToTopic, getTopicById } = await import('./services/topic-storage.js');

    // Get the topic to find the channel ID
    const topic = getTopicById(topicId);
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }

    const message_id = `msg_${ulid()}`;
    const timestamp = new Date().toISOString();

    const message = {
      id: message_id,
      channel_id: topic.channelId,
      author,
      author_name,
      text: text.trim(),
      timestamp,
      tokens
    };

    const success = addMessageToTopic(topicId, message);

    if (!success) {
      return res.status(500).json({ error: "Failed to add message to topic" });
    }

    // Broadcast via WebSocket
    broadcast({
      type: 'topic_message',
      topicId,
      channelId: topic.channelId,
      message
    });

    res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error adding message to topic:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * E2E Latency Tracking Endpoints
 */

interface E2ELatencyRecord {
  messageId: string;
  channelId: string;
  text: string;
  t0_send: number;
  t1_send: number;
  t_api: number;
  t_db_start: number;
  t_db_end: number;
  t_md_start: number;
  t_md_end: number;
  t_ws_broadcast: number;
  t2_recv: number;
  t3_recv: number;
  t4_recv: number;
  metrics?: {
    senderToApiResponse: number;
    backendProcessing: number;
    broadcastLatency: number;
    receiverUIUpdate: number;
    totalEndToEnd: number;
  };
}

const e2eLatencyRecords: E2ELatencyRecord[] = [];
const MAX_E2E_RECORDS = 1000;

// Store sender timing temporarily for E2E correlation
const senderTimingMap = new Map<string, { t0_send: number; t1_send?: number; channelId: string; text: string }>();

/**
 * POST /api/latency/e2e/sender-timing
 * Update sender timing after response received (for E2E correlation)
 */
app.post("/api/latency/e2e/sender-timing", (req: Request, res: Response) => {
  try {
    const { messageId, t1_send, channelId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: "messageId is required" });
    }

    // Update the sender timing map with t1_send
    const existing = senderTimingMap.get(messageId);
    if (existing) {
      existing.t1_send = t1_send;

      console.log('[SENDER TIMING]', {
        messageId,
        senderLatency: existing.t1_send ? (existing.t1_send - existing.t0_send).toFixed(2) + 'ms' : 'pending'
      });

      // Re-broadcast the updated timing so receivers get t1_send
      // This is a timing update broadcast, not a new message
      broadcast({
        type: 'timing_update',
        messageId: messageId,
        timing: {
          t0_send: existing.t0_send,
          t1_send: existing.t1_send
        }
      });
    } else {
      console.warn('[SENDER TIMING] Message not found in map:', messageId);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error recording sender timing:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/latency/e2e/record
 * Record an E2E latency measurement
 */
app.post("/api/latency/e2e/record", (req: Request, res: Response) => {
  try {
    const record = req.body as E2ELatencyRecord;

    // Calculate metrics
    record.metrics = {
      senderToApiResponse: record.t1_send - record.t0_send,
      backendProcessing: record.t_md_end - record.t_api,
      broadcastLatency: record.t2_recv - record.t_ws_broadcast,
      receiverUIUpdate: record.t4_recv - record.t2_recv,
      totalEndToEnd: record.t4_recv - record.t0_send
    };

    e2eLatencyRecords.push(record);
    if (e2eLatencyRecords.length > MAX_E2E_RECORDS) {
      e2eLatencyRecords.shift();
    }

    console.log('[E2E LATENCY]', {
      messageId: record.messageId,
      totalEndToEnd: record.metrics.totalEndToEnd.toFixed(2) + 'ms',
      breakdown: {
        sender: record.metrics.senderToApiResponse.toFixed(2) + 'ms',
        backend: record.metrics.backendProcessing.toFixed(2) + 'ms',
        broadcast: record.metrics.broadcastLatency.toFixed(2) + 'ms',
        receiver: record.metrics.receiverUIUpdate.toFixed(2) + 'ms'
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error recording E2E latency:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/latency/e2e/stats
 * Get E2E latency statistics
 */
app.get("/api/latency/e2e/stats", (req: Request, res: Response) => {
  try {
    if (e2eLatencyRecords.length === 0) {
      return res.json({ message: 'No E2E latency data available', recordCount: 0 });
    }

    const calculateStats = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      return {
        count: sorted.length,
        min: Math.min(...sorted),
        max: Math.max(...sorted),
        mean: mean,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    };

    const stats = {
      recordCount: e2eLatencyRecords.length,
      totalEndToEnd: calculateStats(e2eLatencyRecords.map(r => r.metrics!.totalEndToEnd)),
      senderToApiResponse: calculateStats(e2eLatencyRecords.map(r => r.metrics!.senderToApiResponse)),
      backendProcessing: calculateStats(e2eLatencyRecords.map(r => r.metrics!.backendProcessing)),
      broadcastLatency: calculateStats(e2eLatencyRecords.map(r => r.metrics!.broadcastLatency)),
      receiverUIUpdate: calculateStats(e2eLatencyRecords.map(r => r.metrics!.receiverUIUpdate))
    };

    res.json(stats);
  } catch (error: any) {
    console.error("Error getting E2E latency stats:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/latency/e2e/reset
 * Reset E2E latency records
 */
app.post("/api/latency/e2e/reset", (req: Request, res: Response) => {
  try {
    const count = e2eLatencyRecords.length;
    e2eLatencyRecords.length = 0;
    res.json({ success: true, deletedCount: count });
  } catch (error: any) {
    console.error("Error resetting E2E latency:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Command Execution Endpoints
 */

// Store current working directory per session (simplified: single global cwd for now)
let currentWorkingDirectory = VAULT;

/**
 * POST /api/command/execute
 * Execute shell commands in vault directory (whitelisted commands only)
 */
app.post("/api/command/execute", async (req: Request, res: Response) => {
  try {
    const { command } = req.body;

    if (!command || !command.trim()) {
      return res.status(400).json({ error: "command is required" });
    }

    const trimmedCommand = command.trim();

    // Whitelist of safe commands
    const allowedCommands = ['ls', 'pwd', 'date', 'whoami', 'tree', 'cd', 'cat', 'help', 'history', 'h'];
    const commandParts = trimmedCommand.split(' ');
    const baseCommand = commandParts[0];

    if (!allowedCommands.includes(baseCommand)) {
      return res.status(403).json({
        error: `Command '${baseCommand}' is not allowed. Allowed commands: ${allowedCommands.join(', ')}`
      });
    }

    // Handle aliases - normalize to canonical command
    const canonicalCommand = baseCommand === 'h' ? 'history' : baseCommand;

    // Handle help command specially
    if (canonicalCommand === 'help') {
      // Track in history
      commandHistory.push({
        command: trimmedCommand,
        timestamp: new Date().toISOString(),
        cwd: currentWorkingDirectory
      });
      if (commandHistory.length > MAX_HISTORY) commandHistory.shift();

      // Easter egg: WarGames reference
      if (commandParts[1]?.toLowerCase() === 'games') {
        return res.json({
          success: true,
          command: trimmedCommand,
          output: `'GAMES' REFERS TO MODELS, SIMULATIONS AND GAMES WHICH HAVE TACTICAL AND STRATEGIC APPLICATIONS.`,
          cwd: currentWorkingDirectory
        });
      }

      const helpText = `╔══════════════════════════════════════╗
║                                      ║
║     ███████╗███████╗                 ║
║     ██╔════╝██╔════╝                 ║
║     █████╗  ███████╗                 ║
║     ██╔══╝  ╚════██║                 ║
║     ██║     ███████║                 ║
║     ╚═╝     ╚══════╝                 ║
║                                      ║
║  ██████╗██████╗ ███╗   ███╗          ║
║ ██╔════╝██╔══██╗████╗ ████║          ║
║ ██║     ██████╔╝██╔████╔██║          ║
║ ██║     ██╔══██╗██║╚██╔╝██║          ║
║ ╚██████╗██║  ██║██║ ╚═╝ ██║          ║
║  ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝          ║
║                                      ║
║   Filesystem-First CRM               ║
║   Obsidian Native                    ║
║                                      ║
╚══════════════════════════════════════╝

╭─ 📜 MOTD ──────────────────────────╮
│ Welcome to FS-CRM! Markdown files │
│ are the source of truth. Git is   │
│ your audit trail. Obsidian is UI.  │
╰────────────────────────────────────╯

🎯 Shell Commands:
  • ls       - List files
  • cat      - View file
  • pwd      - Current dir
  • cd       - Change dir
  • tree     - Dir structure
  • date     - Date/time
  • whoami   - Current user
  • history  - Command history
  • h        - Alias for history

🤖 AI Commands:
  • %co <query>       - Ask Cohere AI
  • %ask <query>      - Ask AI (alias)
  • %explain <topic>  - Request explanation
  • %summarize <text> - Request summary

  Example: %co what is this account?

💬 Chat Modes:
  • 💬 Chat  - Normal messages
  • 🤖 AI    - All to AI
  • ⌨️  Unix  - Shell mode

⌨️  Shortcuts:
  • Shift+Ctrl+S - Sidebar
  • Shift+Ctrl+Y - Header

✨ Tip: Use Unix mode for commands
    without the dot prefix!

──────────────────────────────────────
FS-CRM v1.0 | Type 'help' anytime
`;

      return res.json({
        success: true,
        command: trimmedCommand,
        output: helpText,
        cwd: currentWorkingDirectory
      });
    }

    // Handle history command specially
    if (canonicalCommand === 'history') {
      let count = 20; // Default to last 20 commands

      // Check if user specified a number
      if (commandParts[1]) {
        const parsedCount = parseInt(commandParts[1], 10);
        if (!isNaN(parsedCount) && parsedCount > 0) {
          count = Math.min(parsedCount, MAX_HISTORY); // Cap at max history
        }
      }

      // Track this history command in history
      commandHistory.push({
        command: trimmedCommand,
        timestamp: new Date().toISOString(),
        cwd: currentWorkingDirectory
      });
      if (commandHistory.length > MAX_HISTORY) commandHistory.shift();

      if (commandHistory.length === 1) {
        // Only the history command itself is in history
        return res.json({
          success: true,
          command: trimmedCommand,
          output: `     1  ${new Date().toLocaleTimeString()}  ${currentWorkingDirectory.replace(VAULT, '.')}  ${trimmedCommand}`,
          cwd: currentWorkingDirectory
        });
      }

      // Get the last N commands
      const recentHistory = commandHistory.slice(-count);

      // Format output with line numbers
      const startNum = Math.max(1, commandHistory.length - count + 1);
      const historyOutput = recentHistory
        .map((entry, idx) => {
          const num = startNum + idx;
          const date = new Date(entry.timestamp).toLocaleTimeString();
          const cwdDisplay = entry.cwd.replace(VAULT, '.');
          return `  ${num.toString().padStart(4)}  ${date}  ${cwdDisplay}  ${entry.command}`;
        })
        .join('\n');

      return res.json({
        success: true,
        command: trimmedCommand,
        output: historyOutput,
        cwd: currentWorkingDirectory
      });
    }

    // Handle cd command specially
    if (canonicalCommand === 'cd') {
      const targetDir = commandParts[1] || VAULT; // Default to VAULT if no arg

      // Resolve the target path relative to current working directory
      const { resolve } = await import('path');
      const newPath = resolve(currentWorkingDirectory, targetDir);

      // Security check: ensure path is within VAULT
      if (!newPath.startsWith(VAULT)) {
        return res.status(403).json({
          error: "Access denied: cannot navigate outside vault directory"
        });
      }

      // Check if directory exists
      const { existsSync } = await import('fs');
      if (!existsSync(newPath)) {
        return res.status(404).json({
          error: `Directory not found: ${targetDir}`
        });
      }

      // Check if it's actually a directory
      const { statSync } = await import('fs');
      try {
        const stats = statSync(newPath);
        if (!stats.isDirectory()) {
          return res.status(400).json({
            error: `Not a directory: ${targetDir}`
          });
        }
      } catch (err: any) {
        return res.status(404).json({
          error: `Cannot access: ${targetDir}`
        });
      }

      // Track in history before updating directory
      commandHistory.push({
        command: trimmedCommand,
        timestamp: new Date().toISOString(),
        cwd: currentWorkingDirectory
      });
      if (commandHistory.length > MAX_HISTORY) commandHistory.shift();

      // Update current working directory
      currentWorkingDirectory = newPath;

      return res.json({
        success: true,
        command: trimmedCommand,
        output: `Changed directory to: ${currentWorkingDirectory.replace(VAULT, '.')}`,
        cwd: currentWorkingDirectory
      });
    }

    // Track command in history (already tracked for help, history, and cd above)
    if (canonicalCommand !== 'help' && canonicalCommand !== 'history' && canonicalCommand !== 'cd') {
      commandHistory.push({
        command: trimmedCommand,
        timestamp: new Date().toISOString(),
        cwd: currentWorkingDirectory
      });

      // Keep history size limited
      if (commandHistory.length > MAX_HISTORY) {
        commandHistory.shift();
      }
    }

    // Execute command in current working directory
    const { execSync } = await import('child_process');
    let output: string;

    try {
      output = execSync(trimmedCommand, {
        cwd: currentWorkingDirectory,
        encoding: 'utf8',
        timeout: 5000, // 5 second timeout
        maxBuffer: 1024 * 1024 // 1MB max output
      });
    } catch (execError: any) {
      // Command failed or timed out
      return res.status(500).json({
        error: "Command execution failed",
        output: execError.stdout || execError.message
      });
    }

    res.json({
      success: true,
      command: trimmedCommand,
      output: output || '(no output)',
      cwd: currentWorkingDirectory
    });
  } catch (error: any) {
    console.error("Error executing command:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * AI Chat Endpoints
 */

/**
 * POST /api/ai/chat
 * Send a message to AI with streaming response
 */
app.post("/api/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message, history = [], channelType, entityId, entityType } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Build context - limit to ~1000 tokens for cost efficiency
    const limitedHistory = limitHistoryByTokens(history, 1000);
    const chatHistory = formatChatHistory(limitedHistory);

    // Get entity info if needed
    let entityInfo: any = null;
    let recentEvents: any[] = [];

    if (channelType === 'object' && entityId && entityType) {
      // Get entity details from vault
      const typeMap: Record<string, string> = {
        accounts: 'accounts',
        contacts: 'contacts',
        opportunities: 'opportunities'
      };

      const dir = typeMap[entityType.toLowerCase()];
      if (dir) {
        const dirPath = path.join(VAULT, dir);
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
          for (const file of files) {
            const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
            const parsed = matter(content);
            if (parsed.data.id === entityId) {
              entityInfo = {
                id: entityId,
                type: entityType,
                name: parsed.data.name || 'Unknown',
                owner: parsed.data.owner
              };
              break;
            }
          }
        }
      }

      // Get recent events for this entity
      const eventsDir = path.join(VAULT, '_logs/events');
      if (fs.existsSync(eventsDir)) {
        const eventFiles = fs.readdirSync(eventsDir).sort().reverse().slice(0, 10);
        for (const file of eventFiles) {
          const content = fs.readFileSync(path.join(eventsDir, file), 'utf8');
          const lines = content.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              if (event.entity_id === entityId) {
                recentEvents.push(event);
                if (recentEvents.length >= 5) break;
              }
            } catch {}
          }
          if (recentEvents.length >= 5) break;
        }
      }
    }

    const systemPrompt = buildSystemPrompt(channelType || 'channel', entityInfo, recentEvents);

    // Simple streaming without tools - just pass messages directly
    const stream = await cohere.chatStream({
      model: AI_MODEL,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${chatHistory}\n${message}`
        }
      ]
    });

    // Stream chunks to client
    for await (const chunk of stream) {
      if (chunk.type === 'content-delta') {
        const textChunk = chunk.delta?.message?.content?.text || '';
        if (textChunk) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: textChunk })}\n\n`);
        }
      } else if (chunk.type === 'message-end') {
        // Extract token usage from message-end event
        const usage = chunk.delta?.usage;
        const tokens = usage?.tokens || usage?.billedUnits;

        res.write(`data: ${JSON.stringify({
          type: 'done',
          tokens: tokens ? {
            input: tokens.inputTokens || 0,
            output: tokens.outputTokens || 0
          } : undefined
        })}\n\n`);
      }
    }

    res.end();
  } catch (error: any) {
    console.error("Error in AI chat:", error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server with proper origin handling
const wss = new WebSocketServer({
  server,
  verifyClient: (info: { origin: string; req: any }) => {
    // Allow connections from any localhost origin
    const origin = info.origin || info.req.headers.origin;
    console.log('🔍 WebSocket origin check:', { origin, headers: info.req.headers });

    if (!origin) {
      console.log('✓ No origin header, allowing connection');
      return true; // Allow connections without origin (e.g., from Node.js)
    }

    try {
      const url = new URL(origin);
      const allowed = url.hostname === 'localhost' ||
                     url.hostname === '127.0.0.1' ||
                     url.hostname.endsWith('.doi.bio');
      console.log(`${allowed ? '✓' : '✗'} Origin ${origin}: ${allowed ? 'ALLOWED' : 'REJECTED'}`);
      return allowed;
    } catch (error) {
      console.log('✗ Invalid origin URL:', origin, error);
      return false;
    }
  }
});

// Track Pocketz worker connection
let pocketzWorkerWs: any = null;

/**
 * Push download job to connected Pocketz worker
 */
function pushDownloadJob(jobId: string, url: string): void {
  if (!pocketzWorkerWs || pocketzWorkerWs.readyState !== 1) {
    console.log('[Pocketz] No worker connected, job queued in database');
    return;
  }

  try {
    pocketzWorkerWs.send(JSON.stringify({
      type: 'download_job',
      id: jobId,
      url: url,
      timestamp: new Date().toISOString()
    }));

    console.log(`[Pocketz] ✅ Pushed job ${jobId} to worker`);
  } catch (error) {
    console.error('[Pocketz] Error pushing job to worker:', error);
  }
}

/**
 * Handle messages from Pocketz worker
 */
function handleWorkerMessage(message: any): void {
  const db = getDatabase();

  console.log('[Pocketz] Received message from worker:', message.type);

  if (message.type === 'download_started') {
    try {
      db.prepare(`
        UPDATE download_queue
        SET status = 'downloading', started_at = ?
        WHERE id = ?
      `).run(message.timestamp, message.jobId);

      console.log(`[Pocketz] Job ${message.jobId} started`);
    } catch (error) {
      console.error('[Pocketz] Error updating job status to downloading:', error);
    }
  }

  else if (message.type === 'download_completed') {
    try {
      if (message.success) {
        db.prepare(`
          UPDATE download_queue
          SET status = 'completed', completed_at = ?, pocketz_directory_name = ?
          WHERE id = ?
        `).run(message.timestamp, message.pocketzDirectoryName || null, message.jobId);

        console.log(`[Pocketz] ✅ Job ${message.jobId} completed successfully`);
      } else {
        db.prepare(`
          UPDATE download_queue
          SET status = 'failed', completed_at = ?, error_message = ?
          WHERE id = ?
        `).run(message.timestamp, message.error || 'Unknown error', message.jobId);

        console.error(`[Pocketz] ❌ Job ${message.jobId} failed: ${message.error}`);
      }
    } catch (error) {
      console.error('[Pocketz] Error updating job completion status:', error);
    }
  }
}

wss.on('connection', (ws, req) => {
  // Check for Pocketz worker authentication
  const pocketzToken = req.headers['x-pocketz-token'];

  if (pocketzToken) {
    // This is a Pocketz worker connection
    const expectedToken = process.env.POCKETZ_WORKER_TOKEN;

    if (!expectedToken) {
      console.error('[Pocketz] POCKETZ_WORKER_TOKEN not set in environment');
      ws.close(1008, 'Server not configured for Pocketz worker');
      return;
    }

    if (pocketzToken !== expectedToken) {
      console.error('[Pocketz] Invalid worker token');
      ws.close(1008, 'Unauthorized');
      return;
    }

    console.log('[Pocketz] ✅ Worker authenticated and connected');
    pocketzWorkerWs = ws;

    // Handle worker messages
    ws.on('message', (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        handleWorkerMessage(message);
      } catch (error) {
        console.error('[Pocketz] Error parsing worker message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[Pocketz] Worker disconnected');
      pocketzWorkerWs = null;
    });

    // Send acknowledgment
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Pocketz worker authenticated'
    }));

    return; // Don't process as regular client
  }

  // Regular client connection
  console.log('📡 WebSocket client connected');

  // Generate unique socket ID
  const socketId = ulid();
  (ws as any).socketId = socketId;
  clients.add(ws);

  // Track connection for metrics
  metricsService.trackConnection(socketId).catch(err => {
    console.error('[Metrics] Error tracking connection:', err);
  });

  // Get connection metadata
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = req.socket.remoteAddress || '';
  const pageUrl = req.headers['referer'] || '';
  const origin = req.headers['origin'] || '';
  const url = req.url || '';

  // Check if this is a visitor (from contact-app) or ai-app visitor or admin (from comms-app or other)
  // Check URL query parameter, origin, and referer headers
  const isVisitor =
    url.includes('client=visitor') ||
    pageUrl.includes('contact.doi.bio') || pageUrl.includes('localhost:9007') || pageUrl.includes(':9007') ||
    origin.includes('contact.doi.bio') || origin.includes('localhost:9007') || origin.includes(':9007');

  const isAIAppVisitor =
    url.includes('client=aiapp') ||
    pageUrl.includes('ai.doi.bio') || pageUrl.includes('localhost:9200') || pageUrl.includes(':9200') ||
    origin.includes('ai.doi.bio') || origin.includes('localhost:9200') || origin.includes(':9200');

  console.log(`📡 Client connected - url: ${url}, origin: ${origin}, pageUrl: ${pageUrl}`);
  console.log(`   isVisitor: ${isVisitor}, isAIAppVisitor: ${isAIAppVisitor}`);

  // Only create visitor/ai-app session for actual visitors (not admin clients)
  if (!isVisitor && !isAIAppVisitor) {
    // Admin client - just add to clients set, don't create visitor session
    console.log('📡 Admin client connected (no visitor session created)');

    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connection',
      socketId: socketId,
      message: 'Connected to FS-CRM'
    }));

    // Continue to message handler below (skip visitor session creation)
  } else if (isAIAppVisitor) {
    // Create AI-App visitor session
    const now = new Date().toISOString();
    const sessionId = `vis_aiapp_${ulid().toLowerCase()}`;

    console.log(`🧬 AI-App visitor connected - creating session ${sessionId}`);

    // Store session data in memory for quick access
    const session: AIAppSession = {
      id: sessionId,
      socketId: socketId,
      name: null,
      email: null,
      phone: null,
      company: null,
      connectedAt: now,
      lastActivity: now,
      disconnectedAt: null,
      pageUrl: pageUrl,
      userAgent: userAgent,
      ipAddress: ipAddress,
      status: 'browsing',
      isOnline: true,
      currentStructure: null,
      commandHistory: [],
      messages: [],
      unreadCount: 0
    };
    aiAppSessions.set(socketId, session);

    // Create aiapp-session event in event log
    eventLog.createEvent('create', {
      entity_type: 'aiapp-session',
      entity_id: sessionId,
      data: {
        id: sessionId,
        type: 'aiapp-session',
        socket_id: socketId,
        connected_at: now,
        last_activity: now,
        page_url: pageUrl,
        user_agent: userAgent,
        ip_address: ipAddress,
        status: 'browsing'
      }
    }).catch(err => console.error('Error creating aiapp-session event:', err));

    // Send connection confirmation with socket ID
    ws.send(JSON.stringify({
      type: 'connection',
      socketId: socketId,
      sessionId: sessionId,
      message: 'Connected to AI-App'
    }));

    // Broadcast ai-app visitor connection to all admins
    broadcast({
      type: 'aiapp:connected',
      session: {
        id: session.id,
        name: session.name,
        email: session.email,
        phone: session.phone,
        company: session.company,
        pageUrl: session.pageUrl,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        connectedAt: session.connectedAt,
        lastActivity: session.lastActivity,
        status: session.status,
        currentStructure: session.currentStructure,
        unreadCount: session.unreadCount,
        isOnline: true
      }
    });
  } else if (isVisitor) {
    // Create regular visitor session (contact-app)
    const now = new Date().toISOString();
    const sessionId = `vis_${ulid().toLowerCase()}`;

    console.log(`👁️ Visitor connected - creating session ${sessionId}`);

    // Store session data in memory for quick access
    const session = {
      id: sessionId,
      socketId: socketId,
      name: null,
      email: null,
      phone: null,
      company: null,
      connectedAt: now,
      lastActivity: now,
      pageUrl: pageUrl,
      userAgent: userAgent,
      ipAddress: ipAddress,
      status: 'browsing',
      messages: [],
      unreadCount: 0
    };
    visitorSessions.set(socketId, session);

    // Create visitor-session event in event log
    eventLog.createEvent('create', {
      entity_type: 'visitor-session',
      entity_id: sessionId,
      data: {
        id: sessionId,
        type: 'visitor-session',
        socket_id: socketId,
        connected_at: now,
        last_activity: now,
        page_url: pageUrl,
        user_agent: userAgent,
        ip_address: ipAddress,
        status: 'active'
      }
    }).catch(err => console.error('Error creating visitor-session event:', err));

    // Send connection confirmation with socket ID
    ws.send(JSON.stringify({
      type: 'connection',
      socketId: socketId,
      sessionId: sessionId,
      message: 'Connected to FS-CRM'
    }));

    // Broadcast visitor connection to all admins
    broadcast({
      type: 'visitor:connected',
      session: {
        id: session.id,
        name: session.name,
        email: session.email,
        phone: session.phone,
        company: session.company,
        pageUrl: session.pageUrl,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        connectedAt: session.connectedAt,
        lastActivity: session.lastActivity,
        status: session.status,
        unreadCount: session.unreadCount
      }
    });
  } // End of visitor/ai-app session creation

  // Handle messages from client
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Handle viewer commands (don't require visitor session)
      if (message.type === 'viewer-command') {
        console.log(`[Viewer] Received command: ${JSON.stringify(message.command)}`);

        // Broadcast the viewer command to all connected clients
        broadcast({
          type: 'viewer-command',
          command: message.command,
          socketId: socketId,
          timestamp: new Date().toISOString()
        });

        return;
      }

      // Handle AI-App visitor messages
      const aiAppSession = aiAppSessions.get(socketId);
      if (aiAppSession) {
        // Update last activity
        aiAppSession.lastActivity = new Date().toISOString();

        switch (message.type) {
          case 'aiapp:connect':
            // Initial connection with optional data
            console.log(`[AI-App] Session ${aiAppSession.id} connected with data`);
            if (message.data) {
              Object.assign(aiAppSession, message.data);
            }
            break;

          case 'aiapp:load-structure':
            // User loaded a new PDB structure
            console.log(`[AI-App] Session ${aiAppSession.id} loaded structure:`, message.structure);
            aiAppSession.currentStructure = message.structure;

            // Log command
            aiAppSession.commandHistory.push({
              command: `load ${message.structure.id}`,
              timestamp: new Date().toISOString()
            });

            // Broadcast to admins
            broadcast({
              type: 'aiapp:structure-loaded',
              sessionId: aiAppSession.id,
              structure: message.structure
            });

            // Log event
            await eventLog.createEvent('update', {
              entity_type: 'aiapp-session',
              entity_id: aiAppSession.id,
              changes: {
                current_structure: message.structure
              }
            }).catch(err => console.error('[AI-App] Error logging structure load:', err));

            break;

          case 'aiapp:message':
            // Chat message from ai-app visitor
            const aiappChatMessageId = `msg_${ulid().toLowerCase()}`;
            const aiappVisitorMessage = {
              id: aiappChatMessageId,
              author: 'visitor',
              author_name: aiAppSession.name || 'Visitor',
              text: message.text,
              timestamp: new Date().toISOString()
            };

            // Store message in session
            if (!aiAppSession.messages) aiAppSession.messages = [];
            aiAppSession.messages.push(aiappVisitorMessage);

            // Update status to chatting if not already
            if (aiAppSession.status === 'browsing') {
              aiAppSession.status = 'chatting';
            }

            // Log event
            await eventLog.createEvent('create', {
              entity_type: 'aiapp-message',
              entity_id: aiappChatMessageId,
              data: {
                id: aiappChatMessageId,
                type: 'aiapp-chat',
                session_id: aiAppSession.id,
                author: 'visitor',
                author_name: aiAppSession.name || 'Visitor',
                text: message.text,
                timestamp: aiappVisitorMessage.timestamp,
                channel: 'aiapp'
              }
            }).catch(err => console.error('[AI-App] Error logging message:', err));

            // Broadcast to all admins
            broadcast({
              type: 'aiapp:message',
              sessionId: aiAppSession.id,
              message: aiappVisitorMessage
            });

            ws.send(JSON.stringify({ type: 'message:sent', messageId: aiappChatMessageId }));
            break;

          case 'aiapp:command':
            // User executed viewer command (color, style, etc.)
            console.log(`[AI-App] Session ${aiAppSession.id} executed command:`, message.command);

            // Log command
            aiAppSession.commandHistory.push({
              command: message.command,
              timestamp: new Date().toISOString()
            });

            // Broadcast to admins
            broadcast({
              type: 'aiapp:command',
              sessionId: aiAppSession.id,
              command: message.command,
              timestamp: new Date().toISOString()
            });

            break;

          case 'aiapp:update':
            // Update visitor info (name, email, etc.)
            const aiappUpdates = message.data || {};
            Object.assign(aiAppSession, aiappUpdates);

            // Log event
            await eventLog.createEvent('update', {
              entity_type: 'aiapp-session',
              entity_id: aiAppSession.id,
              changes: aiappUpdates
            }).catch(err => console.error('[AI-App] Error logging update:', err));

            // Broadcast update to all admins
            broadcast({
              type: 'aiapp:updated',
              sessionId: aiAppSession.id,
              updates: aiappUpdates
            });

            ws.send(JSON.stringify({ type: 'update:success', data: aiappUpdates }));
            break;

          default:
            console.log(`[AI-App] Unknown message type from session ${aiAppSession.id}:`, message.type);
        }

        return; // Done handling ai-app message
      }

      // For other message types, require regular visitor session
      const session = visitorSessions.get(socketId);

      if (!session) {
        console.log(`No visitor session for socket ${socketId}, message type: ${message.type}`);
        // Don't error - some clients (molecular viewers) don't have sessions
        return;
      }

      // Update last activity
      session.lastActivity = new Date().toISOString();

      switch (message.type) {
        case 'visitor:update':
          // Update visitor session with new data (phone, email, name, etc.)
          const updates = message.data || {};
          Object.assign(session, updates);

          // Update status if phone was submitted
          if (updates.phone && session.status === 'browsing') {
            session.status = 'submitted';
          }

          // Create update event
          await eventLog.createEvent('update', {
            entity_type: 'visitor-session',
            entity_id: session.id,
            changes: updates
          });

          // If phone number provided, trigger iMessage
          if (updates.phone && !session.imessageSent) {
            console.log(`📱 Phone number received for session ${session.id}: ${updates.phone}`);
            // TODO: Integrate with iMCP service on 'aum' device
            // For now, just mark as sent
            session.imessageSent = true;
            session.imessageSentAt = new Date().toISOString();
          }

          // Broadcast update to all admins
          broadcast({
            type: 'visitor:updated',
            sessionId: session.id,
            updates: {
              name: session.name,
              email: session.email,
              phone: session.phone,
              company: session.company,
              status: session.status,
              lastActivity: session.lastActivity
            }
          });

          ws.send(JSON.stringify({ type: 'update:success', data: updates }));
          break;

        case 'visitor:message':
          // Handle chat message from visitor
          const chatMessageId = `msg_${ulid().toLowerCase()}`;
          const visitorMessage = {
            id: chatMessageId,
            author: 'visitor',
            author_name: session.name || 'Visitor',
            text: message.text,
            timestamp: new Date().toISOString()
          };

          // Store message in session
          if (!session.messages) session.messages = [];
          session.messages.push(visitorMessage);

          // Update status to chatting if not already
          if (session.status === 'browsing') {
            session.status = 'chatting';
          }

          await eventLog.createEvent('create', {
            entity_type: 'contact-chat',
            entity_id: chatMessageId,
            data: {
              id: chatMessageId,
              type: 'contact-chat',
              session_id: session.id,
              author: 'visitor',
              author_name: session.name || 'Visitor',
              text: message.text,
              timestamp: visitorMessage.timestamp,
              channel: 'web'
            }
          });

          // Broadcast to all admins
          broadcast({
            type: 'visitor:message',
            sessionId: session.id,
            message: visitorMessage
          });

          ws.send(JSON.stringify({ type: 'message:sent', messageId: chatMessageId }));
          break;

        case 'visitor:activity':
          // Handle form field activity (user typing in fields)
          const activityMessageId = `msg_${ulid().toLowerCase()}`;
          const activityMessage = {
            id: activityMessageId,
            author: 'system',
            author_name: 'System',
            text: message.text,
            timestamp: new Date().toISOString()
          };

          // Store activity message in session
          if (!session.messages) session.messages = [];
          session.messages.push(activityMessage);

          // Broadcast activity to all admins
          broadcast({
            type: 'visitor:activity',
            sessionId: session.id,
            message: activityMessage,
            field: message.field,
            value: message.value
          });
          break;

        case 'visitor:typing':
          // Broadcast typing indicator to all admins
          broadcast({
            type: 'visitor:typing',
            sessionId: session.id,
            isTyping: message.isTyping
          });
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', async () => {
    console.log('📡 WebSocket client disconnected:', socketId);

    // Check for AI-App session
    const aiAppSession = aiAppSessions.get(socketId);
    if (aiAppSession) {
      const disconnectedAt = new Date().toISOString();

      // Update session with disconnection time
      await eventLog.createEvent('update', {
        entity_type: 'aiapp-session',
        entity_id: aiAppSession.id,
        changes: {
          disconnected_at: disconnectedAt,
          last_activity: disconnectedAt,
          is_online: false
        }
      }).catch(err => console.error('Error updating aiapp session on disconnect:', err));

      // Broadcast disconnection to all admins
      broadcast({
        type: 'aiapp:disconnected',
        sessionId: aiAppSession.id
      });

      aiAppSessions.delete(socketId);
      console.log(`[AI-App] Session ${aiAppSession.id} disconnected`);
    }

    // Check for regular visitor session
    const session = visitorSessions.get(socketId);
    if (session) {
      const disconnectedAt = new Date().toISOString();

      // Update session with disconnection time (keep original status)
      await eventLog.createEvent('update', {
        entity_type: 'visitor-session',
        entity_id: session.id,
        changes: {
          disconnected_at: disconnectedAt,
          last_activity: disconnectedAt
        }
      }).catch(err => console.error('Error updating visitor session on disconnect:', err));

      // Broadcast disconnection to all admins
      broadcast({
        type: 'visitor:disconnected',
        sessionId: session.id
      });

      visitorSessions.delete(socketId);
    }

    clients.delete(ws);

    // Track disconnection for metrics
    metricsService.trackDisconnection(socketId).catch(err => {
      console.error('[Metrics] Error tracking disconnection:', err);
    });
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);

    // Clean up AI-App session if exists
    const aiAppSession = aiAppSessions.get(socketId);
    if (aiAppSession) {
      aiAppSessions.delete(socketId);
    }

    // Clean up regular visitor session if exists
    const session = visitorSessions.get(socketId);
    if (session) {
      visitorSessions.delete(socketId);
    }

    clients.delete(ws);

    // Track disconnection for metrics
    metricsService.trackDisconnection(socketId).catch(err => {
      console.error('[Metrics] Error tracking disconnection:', err);
    });
  });
});

// Helper function to validate field updates
function validateFieldUpdate(entity_type: string, field: string, value: any): { valid: boolean; message?: string } {
  // Picklist validation
  try {
    const picklistsPath = path.join(VAULT, "_schemas", "picklists.json");
    if (fs.existsSync(picklistsPath)) {
      const picklists = JSON.parse(fs.readFileSync(picklistsPath, "utf8"));
      const fieldPicklist = picklists[entity_type]?.[field];

      if (fieldPicklist && fieldPicklist.restricted) {
        // Restricted picklist - value must be in the allowed values
        const validValues = fieldPicklist.values.map((v: any) => v.value);
        if (value && !validValues.includes(value)) {
          return {
            valid: false,
            message: `Invalid value "${value}" for ${field}. Must be one of: ${validValues.join(', ')}`
          };
        }
      }
    }
  } catch (error) {
    console.error('Error validating picklist:', error);
  }

  // Email validation
  if (field === 'email' || field === 'Email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      return { valid: false, message: 'Invalid email format' };
    }
  }

  // Date validation
  if (field.toLowerCase().includes('date')) {
    if (value && isNaN(Date.parse(value))) {
      return { valid: false, message: 'Invalid date format' };
    }
  }

  // Amount validation (for Opportunity amounts, etc.)
  if (field === 'amount' || field === 'Amount') {
    if (value !== null && value !== '' && isNaN(parseFloat(value))) {
      return { valid: false, message: 'Amount must be a number' };
    }
  }

  // Required field validation
  if (field === 'name' || field === 'Name') {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return { valid: false, message: 'Name is required' };
    }
  }

  return { valid: true };
}

// Log channel message to markdown
async function logChannelMessageToMarkdown(channelId: string, channelName: string, message: any) {
  try {
    // Create channel directory
    const channelDir = path.join(VAULT, '_logs', 'channels', channelName);
    if (!fs.existsSync(channelDir)) {
      await fs.promises.mkdir(channelDir, { recursive: true });
    }

    // Get today's log file path
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logPath = path.join(channelDir, `${date}.md`);

    // Create log file with header if it doesn't exist
    if (!fs.existsSync(logPath)) {
      const header = `# ${channelName} - ${date}\n\n`;
      await fs.promises.writeFile(logPath, header, 'utf8');
    }

    // Format message as markdown
    const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const messageMd = `**[${time}] ${message.author_name}:** ${message.text}\n\n`;

    // Append to log file
    await fs.promises.appendFile(logPath, messageMd, 'utf8');
  } catch (error) {
    console.error('Error logging channel message to markdown:', error);
  }
}

/**
 * Extract and log URLs from message text to markdown
 */
async function logLinksToMarkdown(channelId: string, channelName: string, message: any) {
  try {
    // Regex to detect URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.text.match(urlRegex);

    if (!urls || urls.length === 0) {
      return; // No URLs found
    }

    // Create links directory
    const linksDir = path.join(VAULT, '_logs', 'links');
    if (!fs.existsSync(linksDir)) {
      await fs.promises.mkdir(linksDir, { recursive: true });
    }

    // Get today's log file path
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logPath = path.join(linksDir, `${date}.md`);

    // Create log file with header if it doesn't exist
    if (!fs.existsSync(logPath)) {
      const header = `# Links - ${date}\n\nShared links from all channels.\n\n`;
      await fs.promises.writeFile(logPath, header, 'utf8');
    }

    // Format links as markdown
    const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Create markdown entry for each URL
    for (const url of urls) {
      const linkEntry = `## ${time} - [[channels/${channelName}|#${channelName}]]\n\n` +
        `**Shared by:** ${message.author_name}\n` +
        `**Link:** ${url}\n` +
        `**Context:** ${message.text}\n\n` +
        `---\n\n`;

      await fs.promises.appendFile(logPath, linkEntry, 'utf8');
    }

    console.log(`[Links] Logged ${urls.length} link(s) from #${channelName}`);
  } catch (error) {
    console.error('Error logging links to markdown:', error);
  }
}

/**
 * Add URLs from message to download queue for Pocketz worker
 */
async function addLinksToDownloadQueue(
  message: any,
  channelId: string,
  channelName: string,
  author: string,
  authorName: string
): Promise<void> {
  try {
    // Regex to detect URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.text.match(urlRegex);

    if (!urls || urls.length === 0) {
      return; // No URLs found
    }

    const db = getDatabase();

    // Add each URL to download queue
    for (const url of urls) {
      const queueId = `dlq_${ulid()}`;

      try {
        db.prepare(`
          INSERT INTO download_queue (
            id, url, message_id, channel_id, channel_name,
            shared_by, shared_by_name, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(
          queueId,
          url,
          message.id,
          channelId,
          channelName,
          author,
          authorName,
          new Date().toISOString()
        );

        console.log(`[Pocketz] Added URL to queue: ${queueId} - ${url}`);

        // Push job to worker if connected
        pushDownloadJob(queueId, url);

      } catch (error) {
        console.error(`[Pocketz] Error adding URL to queue: ${url}`, error);
      }
    }

    console.log(`[Pocketz] Queued ${urls.length} URL(s) for download from #${channelName}`);

  } catch (error) {
    console.error('[Pocketz] Error processing URLs for download queue:', error);
  }
}

// Broadcast function
function broadcast(message: any) {
  const data = JSON.stringify(message);
  clients.forEach((client: any) => {
    if (client.readyState === 1) { // OPEN state
      client.send(data);
    }
  });
}

// Watch vault entity directories for changes
const entityDirs = [
  'accounts',
  'contacts',
  'opportunities',
  'leads',
  'activities',
  'tasks',
  'quotes',
  'products',
  'campaigns',
  'events',
  'orders',
  'contracts',
  'assets',
  'cases',
  'knowledge'
];

// Set up file watchers for each entity directory
entityDirs.forEach((dir) => {
  const dirPath = path.join(VAULT, dir);

  if (fs.existsSync(dirPath)) {
    fs.watch(dirPath, { recursive: false }, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        console.log(`📡 Broadcasting change: ${dir}/${filename}`);
        broadcast({
          type: 'entity_changed',
          entityType: dir,
          filename,
          timestamp: new Date().toISOString()
        });
      }
    });
    console.log(`👀 Watching ${dir}/ for changes`);
  }
});

/**
 * GET /api/vault/files
 * Get full vault file tree for obsidian-app
 */
app.get("/api/vault/files", (req: Request, res: Response) => {
  try {
    const buildFileTree = (dirPath: string, relativePath: string = ''): any[] => {
      if (!fs.existsSync(dirPath)) return [];

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const result: any[] = [];

      for (const entry of entries) {
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dirPath, entry.name);
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const children = buildFileTree(fullPath, entryRelativePath);
          result.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'directory',
            children
          });
        } else {
          const stats = fs.statSync(fullPath);
          result.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'file',
            modified: stats.mtime.toISOString(),
            size: stats.size
          });
        }
      }

      // Sort: directories first, then files, alphabetically
      return result.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    };

    const fileTree = buildFileTree(VAULT);
    res.json(fileTree);
  } catch (error: any) {
    console.error("Error getting vault file tree:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vault/file
 * Get file content by path
 */
app.get("/api/vault/file", (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: "path query parameter is required" });
    }

    // Security: prevent directory traversal
    const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(VAULT, normalizedPath);

    // Ensure the path is within VAULT
    if (!fullPath.startsWith(VAULT)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    // Parse frontmatter if it's a markdown file
    if (filePath.endsWith('.md')) {
      const parsed = matter(content);
      res.json({
        content: parsed.content,
        frontmatter: parsed.data,
        raw: content
      });
    } else {
      res.json({ content, raw: content });
    }
  } catch (error: any) {
    console.error("Error reading vault file:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/vault/file
 * Save file content
 */
app.put("/api/vault/file", (req: Request, res: Response) => {
  try {
    const { path: filePath, content } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: "path is required" });
    }

    // Security: prevent directory traversal
    const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(VAULT, normalizedPath);

    // Ensure the path is within VAULT
    if (!fullPath.startsWith(VAULT)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Create parent directory if it doesn't exist
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ success: true, path: normalizedPath });
  } catch (error: any) {
    console.error("Error writing vault file:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/vault/chats/save
 * Save chat messages to vault
 */
app.post("/api/vault/chats/save", async (req: Request, res: Response) => {
  try {
    const { chatId, content, messagesJson } = req.body;

    if (!chatId || !content) {
      return res.status(400).json({ error: "chatId and content are required" });
    }

    // Create chats directory if it doesn't exist
    const chatsDir = path.join(VAULT, "chats");
    if (!fs.existsSync(chatsDir)) {
      fs.mkdirSync(chatsDir, { recursive: true });
    }

    // Check if this is a new chat
    const mdPath = path.join(chatsDir, `${chatId}.md`);
    const jsonPath = path.join(chatsDir, `${chatId}.json`);
    const isNewChat = !fs.existsSync(jsonPath);

    // Save markdown file
    fs.writeFileSync(mdPath, content, "utf-8");

    // Save JSON file for easy loading
    if (messagesJson) {
      fs.writeFileSync(jsonPath, JSON.stringify({ chatId, messages: messagesJson }, null, 2), "utf-8");
    }

    // Broadcast new chat notification via WebSocket if this is a new chat
    if (isNewChat && messagesJson && messagesJson.length > 0) {
      // Get title from first user message
      const firstUserMessage = messagesJson.find((m: any) => m.author === 'user');
      const title = firstUserMessage
        ? firstUserMessage.text.slice(0, 50) + (firstUserMessage.text.length > 50 ? '...' : '')
        : 'New chat';

      broadcast({
        type: 'new_chat',
        chat: {
          id: chatId,
          title,
          timestamp: messagesJson[0].timestamp || new Date().toISOString(),
          isPinned: chatId === 'dm_cohere'
        }
      });

      console.log(`📢 Broadcasting new chat: ${chatId} - "${title}"`);
    }

    res.json({ success: true, path: `vault/chats/${chatId}.md` });
  } catch (error: any) {
    console.error("Error saving chat to vault:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vault/chats
 * List all chats in vault
 */
app.get("/api/vault/chats", async (req: Request, res: Response) => {
  try {
    const chatsDir = path.join(VAULT, "chats");

    if (!fs.existsSync(chatsDir)) {
      return res.json({ chats: [] });
    }

    const files = fs.readdirSync(chatsDir);
    const chats = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const chatId = f.replace('.json', '');
        const jsonPath = path.join(chatsDir, f);

        try {
          const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
          const messages = data.messages || [];

          // Get title from first user message, or use default
          const firstUserMessage = messages.find((m: any) => m.author === 'user');
          const title = firstUserMessage
            ? firstUserMessage.text.slice(0, 50) + (firstUserMessage.text.length > 50 ? '...' : '')
            : 'New chat';

          // Get timestamp from first message
          const timestamp = messages.length > 0 ? messages[0].timestamp : new Date().toISOString();

          return {
            id: chatId,
            title,
            timestamp,
            isPinned: chatId === 'dm_cohere'
          };
        } catch (err) {
          console.error(`Error reading chat ${chatId}:`, err);
          return null;
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        // Sort by timestamp in descending order (newest first)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

    res.json({ chats });
  } catch (error: any) {
    console.error("Error listing chats from vault:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vault/chats/:chatId
 * Load chat messages from vault
 */
app.get("/api/vault/chats/:chatId", async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;

    // Try loading JSON file first
    const jsonPath = path.join(VAULT, "chats", `${chatId}.json`);
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      return res.json(data);
    }

    // Fallback to markdown file
    const mdPath = path.join(VAULT, "chats", `${chatId}.md`);
    if (fs.existsSync(mdPath)) {
      const content = fs.readFileSync(mdPath, "utf-8");
      return res.json({ chatId, content, messages: [] });
    }

    res.status(404).json({ error: "Chat not found" });
  } catch (error: any) {
    console.error("Error loading chat from vault:", error);
    res.status(500).json({ error: error.message });
  }
});

// List all videos from ~/vid directory
app.get("/api/videos", (req: Request, res: Response) => {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const videoDir = path.join(homeDir, "vid");

    if (!fs.existsSync(videoDir)) {
      return res.json({ videos: [] });
    }

    const files = fs.readdirSync(videoDir);
    const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));

    const videos = mp4Files.map((filename, index) => {
      const filePath = path.join(videoDir, filename);
      const stats = fs.statSync(filePath);

      // Extract date from filename if it matches pattern YYYY-MM-DD HH-MM-SS.mp4
      const dateMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2})-(\d{2})-(\d{2})\.mp4$/);
      let created = stats.birthtime.toISOString();
      let title = filename.replace('.mp4', '');

      if (dateMatch) {
        const [_, year, month, day, hour, minute, second] = dateMatch;
        created = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
        title = `Video ${month}/${day}/${year} ${hour}:${minute}`;
      }

      return {
        id: `vid_${index.toString().padStart(6, '0')}`,
        title,
        filename,
        created,
        tags: ['video']
      };
    });

    // Sort by creation date, newest first
    videos.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    res.json({ videos });
  } catch (error: any) {
    console.error("Error listing videos:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visitors/active
 * Get all active visitor sessions
 */
app.get("/api/visitors/active", async (req: Request, res: Response) => {
  try {
    const activeVisitors = database.getActiveVisitors();
    res.json({ visitors: activeVisitors, count: activeVisitors.length });
  } catch (error: any) {
    console.error("Error getting active visitors:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visitors/:sessionId
 * Get visitor session details
 */
app.get("/api/visitors/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = database.getVisitorSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Visitor session not found" });
    }

    res.json(session);
  } catch (error: any) {
    console.error("Error getting visitor session:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visitors/:sessionId/messages
 * Get chat messages for a visitor session
 */
app.get("/api/visitors/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const messages = database.getChatMessages(sessionId);

    res.json({ messages, count: messages.length });
  } catch (error: any) {
    console.error("Error getting chat messages:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// RSS Feed Endpoints
// ============================================================================

/**
 * GET /api/feeds
 * Get all feeds with unread counts
 */
app.get("/api/feeds", async (req: Request, res: Response) => {
  try {
    const feeds = rssService.getFeedsWithUnreadCounts();
    res.json(feeds);
  } catch (error: any) {
    console.error("Error getting feeds:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feeds/:feedId/articles
 * Get articles for a specific feed
 */
app.get("/api/feeds/:feedId/articles", async (req: Request, res: Response) => {
  try {
    const { feedId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const articles = rssService.getArticles(feedId, limit);
    res.json(articles);
  } catch (error: any) {
    console.error("Error getting articles:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feeds/refresh
 * Refresh all feeds (fetch new articles)
 */
app.post("/api/feeds/refresh", async (req: Request, res: Response) => {
  try {
    const results = await rssService.fetchAllFeeds();
    const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
    res.json({
      success: true,
      totalNewArticles: totalNew,
      results
    });
  } catch (error: any) {
    console.error("Error refreshing feeds:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/articles/:articleId/read
 * Mark an article as read
 */
app.post("/api/articles/:articleId/read", async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    rssService.markAsRead(articleId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking article as read:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feeds/:feedId/mark-all-read
 * Mark all articles in a feed as read
 */
app.post("/api/feeds/:feedId/mark-all-read", async (req: Request, res: Response) => {
  try {
    const { feedId } = req.params;
    rssService.markFeedAsRead(feedId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking feed as read:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/blog
 * Get all blog posts from vault/blog directory
 */
app.get("/api/blog", async (req: Request, res: Response) => {
  try {
    const blogDir = path.join(VAULT, "blog");

    if (!fs.existsSync(blogDir)) {
      fs.mkdirSync(blogDir, { recursive: true });
    }

    const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));
    const posts = files.map(file => {
      const filePath = path.join(blogDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: markdown } = matter(content);

      return {
        id: data.id || path.basename(file, '.md'),
        title: data.title || 'Untitled',
        content: markdown,
        pubDate: data.pubDate || new Date().toISOString(),
        author: data.author,
        sourceUrl: data.sourceUrl,
        sourceFeed: data.sourceFeed
      };
    });

    // Sort by publication date, newest first
    posts.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    res.json(posts);
  } catch (error: any) {
    console.error("Error getting blog posts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/blog/publish
 * Publish an article to the blog
 */
app.post("/api/blog/publish", async (req: Request, res: Response) => {
  try {
    const { articleId, title, content, pubDate, author, sourceUrl, sourceFeed } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const blogDir = path.join(VAULT, "blog");
    if (!fs.existsSync(blogDir)) {
      fs.mkdirSync(blogDir, { recursive: true });
    }

    // Create slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const filename = `${slug}.md`;
    const filePath = path.join(blogDir, filename);

    // Create frontmatter
    const frontmatter: any = {
      id: articleId || ulid(),
      title,
      pubDate: pubDate || new Date().toISOString(),
    };

    if (author) frontmatter.author = author;
    if (sourceUrl) frontmatter.sourceUrl = sourceUrl;
    if (sourceFeed) frontmatter.sourceFeed = sourceFeed;

    // Write markdown file with frontmatter
    const markdown = matter.stringify(content, frontmatter);
    fs.writeFileSync(filePath, markdown, 'utf-8');

    res.json({ success: true, id: frontmatter.id, filename });
  } catch (error: any) {
    console.error("Error publishing to blog:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PARTY API ENDPOINTS
// ============================================================================

// GET /api/parties - Get all parties
app.get("/api/parties", async (req, res) => {
  try {
    const { type, role, limit = 100, offset = 0 } = req.query;

    let query = "SELECT * FROM parties WHERE 1=1";
    const params: any[] = [];

    if (type) {
      query += " AND party_type = ?";
      params.push(type);
    }

    query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const parties = database.db.prepare(query).all(...params);

    // Transform database schema to frontend format
    const transformedParties = parties.map((p: any) => ({
      id: p.id,
      type: p.type,
      partyType: p.party_type,
      role: role || 'customer', // Default role
      name: p.name,
      displayName: p.canonical_name,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    res.json(transformedParties);
  } catch (error: any) {
    console.error("Error fetching parties:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/parties/graph - Get all parties with their connections for graph visualization
app.get("/api/parties/graph", async (req, res) => {
  try {
    // Fetch all parties with their basic info
    const parties = database.getDb().prepare(`
      SELECT
        p.id,
        p.name,
        p.canonical_name,
        p.party_type,
        rp.current_institution,
        rp.current_position,
        rp.h_index,
        rp.total_citations,
        cpe.email_address as primary_email
      FROM parties p
      LEFT JOIN researcher_profiles rp ON p.id = rp.party_id
      LEFT JOIN contact_point_emails cpe ON p.id = cpe.party_id AND cpe.is_primary = 1
      WHERE p.party_type = 'Individual'
      LIMIT 500
    `).all();

    // Build connections based on shared institutions
    const connections: Array<{ source: string; target: string; relationship: string; strength: number }> = [];
    const institutionMap = new Map<string, string[]>();

    // Group parties by institution
    parties.forEach((party: any) => {
      if (party.current_institution) {
        if (!institutionMap.has(party.current_institution)) {
          institutionMap.set(party.current_institution, []);
        }
        institutionMap.get(party.current_institution)!.push(party.id);
      }
    });

    // Create connections between people at the same institution
    institutionMap.forEach((partyIds, institution) => {
      for (let i = 0; i < partyIds.length; i++) {
        for (let j = i + 1; j < partyIds.length; j++) {
          connections.push({
            source: partyIds[i],
            target: partyIds[j],
            relationship: institution,
            strength: 1
          });
        }
      }
    });

    res.json({
      nodes: parties.map((p: any) => ({
        id: p.id,
        name: p.name || p.canonical_name || 'Unknown',
        type: p.party_type,
        email: p.primary_email,
        title: p.current_position,
        organization: p.current_institution,
        h_index: p.h_index,
        citation_count: p.total_citations
      })),
      links: connections
    });
  } catch (error: any) {
    console.error("Error fetching parties graph:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/parties/:id - Get party by ID
app.get("/api/parties/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const party: any = database.db.prepare("SELECT * FROM parties WHERE id = ?").get(id);

    if (!party) {
      return res.status(404).json({ error: "Party not found" });
    }

    // Get primary email and phone
    const primaryEmail: any = database.db.prepare(
      "SELECT email_address FROM contact_point_emails WHERE party_id = ? AND is_primary = 1 LIMIT 1"
    ).get(id);

    const primaryPhone: any = database.db.prepare(
      "SELECT phone_number FROM contact_point_phones WHERE party_id = ? AND is_primary = 1 LIMIT 1"
    ).get(id);

    // Transform to frontend format
    const transformed = {
      id: party.id,
      type: party.type,
      partyType: party.party_type,
      role: 'customer', // Default role
      name: party.name,
      displayName: party.canonical_name,
      email: primaryEmail?.email_address,
      phone: primaryPhone?.phone_number,
      createdAt: party.created_at,
      updatedAt: party.updated_at,
      tags: [],
    };

    res.json(transformed);
  } catch (error: any) {
    console.error("Error fetching party:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/parties - Create new party
app.post("/api/parties", async (req, res) => {
  try {
    const partyData = req.body;

    // Create event for party creation
    const event = await eventLog.createEvent("create", {
      entity_type: "party",
      entity_id: partyData.id || `pty_${ulid()}`,
      data: partyData,
    });

    res.status(201).json({ success: true, event });
  } catch (error: any) {
    console.error("Error creating party:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/parties/:id - Update party
app.put("/api/parties/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Create event for party update
    const event = await eventLog.createEvent("update", {
      entity_type: "party",
      entity_id: id,
      data: updates,
    });

    res.json({ success: true, event });
  } catch (error: any) {
    console.error("Error updating party:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/parties/:id - Delete party
app.delete("/api/parties/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Create event for party deletion
    const event = await eventLog.createEvent("delete", {
      entity_type: "party",
      entity_id: id,
      data: {},
    });

    res.json({ success: true, event });
  } catch (error: any) {
    console.error("Error deleting party:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/parties/:id/contact-points/emails - Get party emails
app.get("/api/parties/:id/contact-points/emails", async (req, res) => {
  try {
    const { id } = req.params;
    const emails = database.db.prepare(
      "SELECT * FROM contact_point_emails WHERE party_id = ? ORDER BY is_primary DESC, created_at DESC"
    ).all(id);

    // Transform to frontend format
    const transformed = emails.map((e: any) => ({
      id: e.id,
      partyId: e.party_id,
      email: e.email_address,
      type: e.email_type || 'Work',
      isPrimary: e.is_primary === 1,
      verified: e.is_verified === 1,
      createdAt: e.created_at,
    }));

    res.json(transformed);
  } catch (error: any) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/parties/:id/contact-points/phones - Get party phones
app.get("/api/parties/:id/contact-points/phones", async (req, res) => {
  try {
    const { id } = req.params;
    const phones = database.db.prepare(
      "SELECT * FROM contact_point_phones WHERE party_id = ? ORDER BY is_primary DESC, created_at DESC"
    ).all(id);

    // Transform to frontend format
    const transformed = phones.map((p: any) => ({
      id: p.id,
      partyId: p.party_id,
      number: p.phone_number,
      type: p.phone_type || 'Mobile',
      isPrimary: p.is_primary === 1,
      createdAt: p.created_at,
    }));

    res.json(transformed);
  } catch (error: any) {
    console.error("Error fetching phones:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/parties/:id/contact-points/addresses - Get party addresses
app.get("/api/parties/:id/contact-points/addresses", async (req, res) => {
  try {
    const { id } = req.params;
    const addresses = database.db.prepare(
      "SELECT * FROM contact_point_addresses WHERE party_id = ? ORDER BY is_primary DESC, created_at DESC"
    ).all(id);

    // Transform to frontend format
    const transformed = addresses.map((a: any) => ({
      id: a.id,
      partyId: a.party_id,
      street: a.street_address,
      city: a.city,
      state: a.state_province,
      postalCode: a.postal_code,
      country: a.country,
      type: a.address_type || 'Mailing',
      isPrimary: a.is_primary === 1,
      createdAt: a.created_at,
    }));

    res.json(transformed);
  } catch (error: any) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/parties/:id/contact-points/emails - Add email
app.post("/api/parties/:id/contact-points/emails", async (req, res) => {
  try {
    const { id } = req.params;
    const emailData = { ...req.body, partyId: id, id: `cpe_${ulid()}` };

    const event = await eventLog.createEvent("create", {
      entity_type: "contact_point_email",
      entity_id: emailData.id,
      data: emailData,
    });

    res.status(201).json({ success: true, event });
  } catch (error: any) {
    console.error("Error adding email:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/parties/:id/contact-points/phones - Add phone
app.post("/api/parties/:id/contact-points/phones", async (req, res) => {
  try {
    const { id } = req.params;
    const phoneData = { ...req.body, partyId: id, id: `cpp_${ulid()}` };

    const event = await eventLog.createEvent("create", {
      entity_type: "contact_point_phone",
      entity_id: phoneData.id,
      data: phoneData,
    });

    res.status(201).json({ success: true, event });
  } catch (error: any) {
    console.error("Error adding phone:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/parties/:id/contact-points/addresses - Add address
app.post("/api/parties/:id/contact-points/addresses", async (req, res) => {
  try {
    const { id } = req.params;
    const addressData = { ...req.body, partyId: id, id: `cpa_${ulid()}` };

    const event = await eventLog.createEvent("create", {
      entity_type: "contact_point_address",
      entity_id: addressData.id,
      data: addressData,
    });

    res.status(201).json({ success: true, event });
  } catch (error: any) {
    console.error("Error adding address:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/parties/:id/contact-points/emails/:emailId - Update email
app.put("/api/parties/:id/contact-points/emails/:emailId", async (req, res) => {
  try {
    const { emailId } = req.params;
    const updates = req.body;

    const event = await eventLog.createEvent("update", {
      entity_type: "contact_point_email",
      entity_id: emailId,
      data: updates,
    });

    res.json({ success: true, event });
  } catch (error: any) {
    console.error("Error updating email:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/parties/:id/contact-points/phones/:phoneId - Update phone
app.put("/api/parties/:id/contact-points/phones/:phoneId", async (req, res) => {
  try {
    const { phoneId } = req.params;
    const updates = req.body;

    const event = await eventLog.createEvent("update", {
      entity_type: "contact_point_phone",
      entity_id: phoneId,
      data: updates,
    });

    res.json({ success: true, event });
  } catch (error: any) {
    console.error("Error updating phone:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/parties/:id/contact-points/addresses/:addressId - Update address
app.put("/api/parties/:id/contact-points/addresses/:addressId", async (req, res) => {
  try {
    const { addressId } = req.params;
    const updates = req.body;

    const event = await eventLog.createEvent("update", {
      entity_type: "contact_point_address",
      entity_id: addressId,
      data: updates,
    });

    res.json({ success: true, event });
  } catch (error: any) {
    console.error("Error updating address:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/parties/:id/contact-points/emails/:emailId - Delete email
app.delete("/api/parties/:id/contact-points/emails/:emailId", async (req, res) => {
  try {
    const { emailId } = req.params;

    const event = await eventLog.createEvent("delete", {
      entity_type: "contact_point_email",
      entity_id: emailId,
      data: {},
    });

    res.json({ success: true, event });
  } catch (error: any) {
    console.error("Error deleting email:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/parties/:id/contact-points/phones/:phoneId - Delete phone
app.delete("/api/parties/:id/contact-points/phones/:phoneId", async (req, res) => {
  try {
    const { phoneId } = req.params;

    const event = await eventLog.createEvent("delete", {
      entity_type: "contact_point_phone",
      entity_id: phoneId,
      data: {},
    });

    res.json({ success: true, event });
  } catch (error: any) {
    console.error("Error deleting phone:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/parties/:id/contact-points/addresses/:addressId - Delete address
app.delete("/api/parties/:id/contact-points/addresses/:addressId", async (req, res) => {
  try {
    const { addressId } = req.params;

    const event = await eventLog.createEvent("delete", {
      entity_type: "contact_point_address",
      entity_id: addressId,
      data: {},
    });

    res.json({ success: true, event });
  } catch (error: any) {
    console.error("Error deleting address:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/parties/:id/history - Get party history
app.get("/api/parties/:id/history", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT * FROM events
      WHERE entity_id = ?
      OR (entity_type IN ('contact_point_email', 'contact_point_phone', 'contact_point_address')
          AND json_extract(data, '$.partyId') = ?)
    `;
    const params: any[] = [id, id];

    if (type) {
      query += " AND entity_type = ?";
      params.push(type);
    }

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const history = database.db.prepare(query).all(...params);
    res.json(history);
  } catch (error: any) {
    console.error("Error fetching party history:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// Graph API Endpoints
// =============================================================================

// Get graph data with all nodes and links
app.get("/api/graph/data", async (req: Request, res: Response) => {
  try {
    console.log("[Graph] Loading graph data from vault");

    // Parse all markdown files to extract nodes and links
    const nodes: any[] = [];
    const links: any[] = [];
    const nodeMap = new Map<string, any>();

    // Entity directories to scan (all vault directories with entities)
    const entityDirs = [
      'accounts', 'contacts', 'opportunities', 'activities', 'leads',
      'tasks', 'quotes', 'products', 'campaigns', 'line-items',
      'quote-lines', 'events', 'orders', 'contracts', 'assets',
      'cases', 'knowledge', 'parties', 'individuals', 'organizations',
      'researcher-profiles', 'contact-point-emails', 'contact-point-phones',
      'contact-point-addresses', 'households', 'party-sources',
      'party-identifications', 'party-engagements', 'organization-profiles',
      'account-contact-relationships', 'data-use-purposes', 'contact-point-consents'
    ];

    // First pass: collect all nodes
    for (const dir of entityDirs) {
      const dirPath = path.join(VAULT, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(content);

        if (parsed.data && parsed.data.id) {
          const slug = file.replace('.md', '');
          const node = {
            id: parsed.data.id,
            name: parsed.data.name || parsed.data.title || slug,
            type: dir.replace(/-/g, '_').slice(0, -1), // Remove plural 's'
            value: parsed.data.amount || parsed.data.value || parsed.data.revenue || 0,
            metadata: { ...parsed.data, dir, slug }
          };

          nodes.push(node);
          nodeMap.set(node.id, node);
          // Also map by directory/slug for wiki-link resolution
          nodeMap.set(`${dir}/${slug}`, node);
        }
      }
    }

    // Second pass: extract links from frontmatter and content
    for (const dir of entityDirs) {
      const dirPath = path.join(VAULT, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(content);

        const sourceId = parsed.data.id;
        if (!sourceId) continue;

        // Helper function to find a node by wiki-link path (Obsidian-style flexible matching)
        const findNodeByWikiLink = (linkText: string): any | null => {
          // Handle alias syntax: [[path|alias]] -> extract just the path
          const pathPart = linkText.split('|')[0].trim();

          // First try direct lookup in nodeMap (most efficient)
          if (nodeMap.has(pathPart)) {
            return nodeMap.get(pathPart);
          }

          const parts = pathPart.split('/');
          const targetSlug = parts[parts.length - 1]; // Always get the last part (the slug)

          if (parts.length === 2) {
            const targetDir = parts[0];

            // Try direct lookup with the path
            if (nodeMap.has(`${targetDir}/${targetSlug}`)) {
              return nodeMap.get(`${targetDir}/${targetSlug}`);
            }
          }

          // Obsidian-style flexible matching: Try to find by slug in ANY directory
          // This handles cases like [[contacts/demis-hassabis]] when the file is actually in parties/
          const slugMatch = nodes.find((n: any) => n.metadata?.slug === targetSlug);
          if (slugMatch) return slugMatch;

          // Try matching by name (case-insensitive, with slug conversion)
          const slugifiedTarget = targetSlug.toLowerCase();
          const nameMatch = nodes.find((n: any) => {
            const slugifiedName = n.name.toLowerCase().replace(/\s+/g, '-');
            return slugifiedName === slugifiedTarget;
          });
          if (nameMatch) return nameMatch;

          // Try partial name match for flexibility
          const partialMatch = nodes.find((n: any) => {
            const slugifiedName = n.name.toLowerCase().replace(/\s+/g, '-');
            return slugifiedName.includes(slugifiedTarget) || slugifiedTarget.includes(slugifiedName);
          });

          return partialMatch || null;
        };

        // Extract ALL wiki-links from the entire file content (frontmatter + body)
        const fullContent = content; // Original content includes frontmatter
        const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        const seenLinks = new Set<string>(); // Avoid duplicate links

        while ((match = wikiLinkRegex.exec(fullContent)) !== null) {
          const linkText = match[1];
          const targetNode = findNodeByWikiLink(linkText);

          if (targetNode && targetNode.id !== sourceId) {
            const linkKey = `${sourceId}->${targetNode.id}`;
            if (!seenLinks.has(linkKey)) {
              seenLinks.add(linkKey);
              links.push({
                source: sourceId,
                target: targetNode.id,
                type: 'references'
              });
            }
          }
        }

        // Also check frontmatter fields that might contain IDs directly (not wiki-links)
        const idFields = ['account_id', 'contact_id', 'opportunity_id', 'party_id', 'individual_id', 'lead_id'];
        for (const field of idFields) {
          if (parsed.data[field] && typeof parsed.data[field] === 'string' && !parsed.data[field].includes('[[')) {
            const targetId = parsed.data[field];
            if (nodeMap.has(targetId) && targetId !== sourceId) {
              const linkKey = `${sourceId}->${targetId}`;
              if (!seenLinks.has(linkKey)) {
                seenLinks.add(linkKey);
                links.push({
                  source: sourceId,
                  target: targetId,
                  type: field.replace('_id', '')
                });
              }
            }
          }
        }
      }
    }

    // Calculate node values based on relationships if not set
    const connectionCounts = new Map<string, number>();
    links.forEach(link => {
      connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1);
      connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1);
    });

    nodes.forEach(node => {
      if (!node.value) {
        node.value = connectionCounts.get(node.id) || 1;
      }
    });

    res.json({
      nodes,
      links,
      timestamp: new Date().toISOString(),
      layout: 'force'
    });
  } catch (error: any) {
    console.error("[Graph] Error loading graph data:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get details for a specific node
app.get("/api/graph/node/:nodeId", async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    console.log(`[Graph] Loading details for node: ${nodeId}`);

    // Find the node's file
    const entityDirs = [
      'accounts', 'contacts', 'opportunities', 'activities', 'leads',
      'tasks', 'quotes', 'products', 'campaigns', 'line-items',
      'quote-lines', 'events', 'orders', 'contracts', 'assets',
      'cases', 'knowledge'
    ];

    let nodeData: any = null;
    let nodeFile: string | null = null;

    for (const dir of entityDirs) {
      const dirPath = path.join(VAULT, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(content);

        if (parsed.data.id === nodeId) {
          nodeData = parsed;
          nodeFile = filePath;
          break;
        }
      }

      if (nodeData) break;
    }

    if (!nodeData) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Extract incoming and outgoing links
    const allLinks: any[] = [];

    // Scan all files for links to this node
    for (const dir of entityDirs) {
      const dirPath = path.join(VAULT, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(content);

        if (parsed.data.id === nodeId) continue; // Skip self

        // Check frontmatter links
        const linkFields = ['account', 'contact', 'opportunity', 'parent', 'related_to'];
        for (const field of linkFields) {
          if (parsed.data[field] === nodeId) {
            allLinks.push({
              source: parsed.data.id,
              target: nodeId,
              type: field,
              direction: 'incoming'
            });
          } else if (parsed.data.id && nodeData.data[field] === parsed.data.id) {
            allLinks.push({
              source: nodeId,
              target: parsed.data.id,
              type: field,
              direction: 'outgoing'
            });
          }
        }
      }
    }

    const incoming = allLinks.filter(l => l.direction === 'incoming');
    const outgoing = allLinks.filter(l => l.direction === 'outgoing');

    res.json({
      id: nodeId,
      name: nodeData.data.name || nodeData.data.title || 'Unknown',
      type: nodeFile ? path.basename(path.dirname(nodeFile)).slice(0, -1) : 'unknown',
      frontmatter: nodeData.data,
      body: nodeData.content,
      links: {
        incoming,
        outgoing
      },
      stats: {
        totalConnections: incoming.length + outgoing.length,
        value: nodeData.data.amount || nodeData.data.value || nodeData.data.revenue,
        created: nodeData.data.created_at,
        modified: nodeData.data.updated_at
      }
    });
  } catch (error: any) {
    console.error("[Graph] Error loading node details:", error);
    res.status(500).json({ error: error.message });
  }
});

// Pre-compute graph layout on server (for performance)
app.post("/api/graph/compute-layout", async (req: Request, res: Response) => {
  try {
    const { nodes, links, layout = 'force' } = req.body;

    console.log(`[Graph] Computing ${layout} layout for ${nodes.length} nodes`);

    // For now, return the nodes as-is
    // In production, you'd use a graph layout library here
    // like d3-force running in Node.js or a specialized service

    // Simple placeholder: arrange nodes in a circle
    if (layout === 'circular') {
      const angleStep = (2 * Math.PI) / nodes.length;
      const radius = Math.min(1000, nodes.length * 10);

      nodes.forEach((node: any, i: number) => {
        const angle = i * angleStep;
        node.x = radius * Math.cos(angle);
        node.y = radius * Math.sin(angle);
        node.fx = node.x; // Fix position
        node.fy = node.y;
      });
    }

    res.json({
      nodes,
      links,
      layout,
      computed: true,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Graph] Error computing layout:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Gmail API Endpoints
// ============================================================

// Get Gmail OAuth authorization URL
app.get("/api/gmail/auth", (req: Request, res: Response) => {
  try {
    const gmailService = getGmailService();
    const authUrl = gmailService.getAuthUrl();
    res.json({ authUrl });
  } catch (error: any) {
    console.error("[Gmail] Error generating auth URL:", error);
    res.status(500).json({ error: error.message });
  }
});

// Handle Gmail OAuth callback
app.get("/api/gmail/callback", async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    const gmailService = getGmailService();
    const tokens = await gmailService.getTokensFromCode(code);

    // Set credentials and get user email
    gmailService.setCredentials(tokens);
    const profile = await gmailService.getProfile();

    // Save tokens to database
    database.saveOAuthToken("gmail", tokens, profile.emailAddress);

    // Redirect to email app with success
    res.redirect("http://localhost:9111/?gmail=connected");
  } catch (error: any) {
    console.error("[Gmail] OAuth callback error:", error);
    res.redirect("http://localhost:9111/?gmail=error&message=" + encodeURIComponent(error.message));
  }
});

// Check Gmail connection status
app.get("/api/gmail/status", async (req: Request, res: Response) => {
  try {
    const tokenData = database.getOAuthToken("gmail");
    if (!tokenData) {
      return res.json({ connected: false });
    }

    const gmailService = getGmailService();

    // Try to refresh tokens if needed
    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: tokenData.expiry_date,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
    };

    const refreshedTokens = await gmailService.refreshTokensIfNeeded(tokens);

    // Update tokens if refreshed
    if (refreshedTokens.access_token !== tokens.access_token) {
      database.saveOAuthToken("gmail", refreshedTokens, tokenData.user_email);
    }

    gmailService.setCredentials(refreshedTokens);
    const profile = await gmailService.getProfile();

    res.json({
      connected: true,
      email: profile.emailAddress,
    });
  } catch (error: any) {
    console.error("[Gmail] Status check error:", error);
    // Token might be invalid, clear it
    database.deleteOAuthToken("gmail");
    res.json({ connected: false, error: error.message });
  }
});

// Disconnect Gmail
app.delete("/api/gmail/disconnect", (req: Request, res: Response) => {
  try {
    database.deleteOAuthToken("gmail");
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Gmail] Disconnect error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a draft email in Gmail
app.post("/api/gmail/drafts", async (req: Request, res: Response) => {
  try {
    const { to, toName, subject, body, templateId, contactId, partyId } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields: to, subject, body" });
    }

    // Get tokens
    const tokenData = database.getOAuthToken("gmail");
    if (!tokenData) {
      return res.status(401).json({ error: "Gmail not connected" });
    }

    const gmailService = getGmailService();

    // Refresh tokens if needed
    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: tokenData.expiry_date,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
    };

    const refreshedTokens = await gmailService.refreshTokensIfNeeded(tokens);
    if (refreshedTokens.access_token !== tokens.access_token) {
      database.saveOAuthToken("gmail", refreshedTokens, tokenData.user_email);
    }

    gmailService.setCredentials(refreshedTokens);

    // Convert markdown to HTML if body looks like markdown
    let htmlBody = body;
    if (body.includes("**") || body.includes("##") || body.includes("- ")) {
      htmlBody = await marked(body);
    }

    // Create draft in Gmail
    const draft = await gmailService.createDraft({
      to,
      toName,
      from: tokenData.user_email,
      subject,
      body: htmlBody,
      isHtml: true,
    });

    // Create email_draft record via event
    const now = new Date().toISOString();
    const draftId = `emd_${ulid()}`;

    const event = await eventLog.createEvent("create", {
      entity_type: "EmailDraft",
      entity_id: draftId,
      data: {
        id: draftId,
        type: "EmailDraft",
        name: `Draft to ${toName || to}`,
        template_id: templateId || null,
        contact_id: contactId || null,
        party_id: partyId || null,
        to_email: to,
        to_name: toName || null,
        subject,
        body_md: body,
        body_html: htmlBody,
        gmail_draft_id: draft.id,
        status: "created",
        created_at: now,
        updated_at: now,
      },
    });

    res.json({
      success: true,
      draftId,
      gmailDraftId: draft.id,
      gmailMessageId: draft.message.id,
    });
  } catch (error: any) {
    console.error("[Gmail] Create draft error:", error);
    res.status(500).json({ error: error.message });
  }
});

// List Gmail drafts
app.get("/api/gmail/drafts", async (req: Request, res: Response) => {
  try {
    const tokenData = database.getOAuthToken("gmail");
    if (!tokenData) {
      return res.status(401).json({ error: "Gmail not connected" });
    }

    const gmailService = getGmailService();

    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: tokenData.expiry_date,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
    };

    const refreshedTokens = await gmailService.refreshTokensIfNeeded(tokens);
    if (refreshedTokens.access_token !== tokens.access_token) {
      database.saveOAuthToken("gmail", refreshedTokens, tokenData.user_email);
    }

    gmailService.setCredentials(refreshedTokens);
    const drafts = await gmailService.listDrafts();

    res.json({ drafts });
  } catch (error: any) {
    console.error("[Gmail] List drafts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get email templates
app.get("/api/email/templates", (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const templates = database.getEmailTemplates(status as string);
    res.json({ templates });
  } catch (error: any) {
    console.error("[Email] Get templates error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get single email template
app.get("/api/email/templates/:id", (req: Request, res: Response) => {
  try {
    const template = database.getEmailTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json({ template });
  } catch (error: any) {
    console.error("[Email] Get template error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create email template
app.post("/api/email/templates", async (req: Request, res: Response) => {
  try {
    const { name, subject, body, fromName, fromEmail, category, mergeFields } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields: name, subject, body" });
    }

    const now = new Date().toISOString();
    const templateId = `emt_${ulid()}`;

    const event = await eventLog.createEvent("create", {
      entity_type: "EmailTemplate",
      entity_id: templateId,
      data: {
        id: templateId,
        type: "EmailTemplate",
        name,
        subject,
        body_md: body,
        from_name: fromName || null,
        from_email: fromEmail || null,
        category: category || "general",
        merge_fields: JSON.stringify(mergeFields || []),
        status: "active",
        created_at: now,
        updated_at: now,
      },
    });

    res.json({
      success: true,
      templateId,
      event_id: event.id,
    });
  } catch (error: any) {
    console.error("[Email] Create template error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get email drafts from database
app.get("/api/email/drafts", (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const drafts = database.getEmailDrafts(status as string);
    res.json({ drafts });
  } catch (error: any) {
    console.error("[Email] Get drafts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Render template with merge fields
app.post("/api/email/render", (req: Request, res: Response) => {
  try {
    const { templateId, mergeData } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: "Missing templateId" });
    }

    const template = database.getEmailTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Simple merge field replacement
    let renderedSubject = template.subject;
    let renderedBody = template.body_md;

    if (mergeData) {
      for (const [key, value] of Object.entries(mergeData)) {
        const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
        renderedSubject = renderedSubject.replace(pattern, String(value));
        renderedBody = renderedBody.replace(pattern, String(value));
      }
    }

    res.json({
      subject: renderedSubject,
      body: renderedBody,
      template: {
        id: template.id,
        name: template.name,
      },
    });
  } catch (error: any) {
    console.error("[Email] Render template error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start server only if this file is run directly (not imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, () => {
    console.log(`✓ API server running on http://localhost:${PORT}`);
    console.log(`✓ WebSocket server running on ws://localhost:${PORT}`);
    console.log(`✓ Vault path: ${VAULT}`);
    console.log(`✓ Event log: ${VAULT}/_logs/`);
    console.log(`✓ Database: ${DB_PATH}`);

    // Start metrics update background job
    const metricsInterval = setInterval(async () => {
      try {
        await metricsService.updateMetrics();
      } catch (error) {
        console.error('[Metrics] Error updating metrics:', error);
      }
    }, 5000); // Update every 5 seconds

    console.log(`✓ Metrics service running (updating every 5s)`);

    // Cleanup on server shutdown
    process.on('SIGINT', async () => {
      console.log('\n⏹ Shutting down gracefully...');
      clearInterval(metricsInterval);
      await metricsService.close();
      process.exit(0);
    });
  });
}

export default app;

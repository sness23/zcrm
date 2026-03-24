import Redis from 'ioredis';

export interface Metrics {
  activeUsers: number;
  messagesPerMin: number;
  apiCallsPerMin: number;
  searchQueries: number;
}

/**
 * MetricsService handles real-time metrics tracking using Redis
 *
 * Architecture:
 * - Tracks events in Redis sorted sets with timestamps
 * - Periodically aggregates metrics from recent events
 * - Provides queryable metrics for the analytics dashboard
 */
export class MetricsService {
  private redis: Redis;
  private readonly TTL = 300; // 5 minutes retention for raw events

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');

    this.redis.on('error', (err) => {
      console.error('[Metrics] Redis error:', err);
    });

    this.redis.on('connect', () => {
      console.log('[Metrics] Connected to Redis');
    });
  }

  /**
   * Track a WebSocket connection
   */
  async trackConnection(socketId: string): Promise<void> {
    const now = Date.now();
    await this.redis.zadd('metrics:connections', now, `${socketId}:${now}`);
  }

  /**
   * Track a WebSocket disconnection
   */
  async trackDisconnection(socketId: string): Promise<void> {
    // Remove all entries for this socket
    const members = await this.redis.zrange('metrics:connections', 0, -1);
    const toRemove = members.filter(m => m.startsWith(`${socketId}:`));
    if (toRemove.length > 0) {
      await this.redis.zrem('metrics:connections', ...toRemove);
    }
  }

  /**
   * Track a channel message
   */
  async trackMessage(channelId: string): Promise<void> {
    const now = Date.now();
    await this.redis.zadd('metrics:messages', now, `${channelId}:${now}`);
  }

  /**
   * Track an API call
   */
  async trackApiCall(endpoint: string, method: string): Promise<void> {
    const now = Date.now();
    await this.redis.zadd('metrics:api_calls', now, `${method}:${endpoint}:${now}`);
  }

  /**
   * Track a search query
   */
  async trackSearch(query: string): Promise<void> {
    const now = Date.now();
    await this.redis.zadd('metrics:searches', now, `${query}:${now}`);
  }

  /**
   * Calculate and cache current metrics
   * Should be called periodically (every 5 seconds)
   */
  async updateMetrics(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Clean up old entries (older than 5 minutes)
    await Promise.all([
      this.redis.zremrangebyscore('metrics:connections', 0, fiveMinutesAgo),
      this.redis.zremrangebyscore('metrics:messages', 0, fiveMinutesAgo),
      this.redis.zremrangebyscore('metrics:api_calls', 0, fiveMinutesAgo),
      this.redis.zremrangebyscore('metrics:searches', 0, fiveMinutesAgo),
    ]);

    // Calculate metrics
    const [
      activeConnections,
      recentMessages,
      recentApiCalls,
      recentSearches
    ] = await Promise.all([
      this.redis.zcount('metrics:connections', fiveMinutesAgo, now),
      this.redis.zcount('metrics:messages', oneMinuteAgo, now),
      this.redis.zcount('metrics:api_calls', oneMinuteAgo, now),
      this.redis.zcount('metrics:searches', oneMinuteAgo, now),
    ]);

    // Store aggregated metrics
    const metrics: Metrics = {
      activeUsers: activeConnections,
      messagesPerMin: recentMessages,
      apiCallsPerMin: recentApiCalls,
      searchQueries: recentSearches,
    };

    await this.redis.set('metrics:current', JSON.stringify(metrics), 'EX', 60);
  }

  /**
   * Get current metrics
   */
  async getMetrics(): Promise<Metrics> {
    const cached = await this.redis.get('metrics:current');

    if (cached) {
      return JSON.parse(cached);
    }

    // If no cached metrics, return zeros
    return {
      activeUsers: 0,
      messagesPerMin: 0,
      apiCallsPerMin: 0,
      searchQueries: 0,
    };
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

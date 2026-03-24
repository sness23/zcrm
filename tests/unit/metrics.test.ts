import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsService } from '../../src/lib/metrics.js';

describe('MetricsService', () => {
  let metricsService: MetricsService;
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  beforeEach(async () => {
    metricsService = new MetricsService(REDIS_URL);

    // Wait for Redis connection
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clean up any existing test data
    const redis = (metricsService as any).redis;
    await redis.del('metrics:connections');
    await redis.del('metrics:messages');
    await redis.del('metrics:api_calls');
    await redis.del('metrics:searches');
    await redis.del('metrics:current');
  });

  afterEach(async () => {
    if (metricsService) {
      await metricsService.close();
    }
  });

  describe('Connection Tracking', () => {
    it('should track WebSocket connection', async () => {
      const socketId = 'socket-123';
      await metricsService.trackConnection(socketId);

      const redis = (metricsService as any).redis;
      const connections = await redis.zrange('metrics:connections', 0, -1);

      expect(connections.length).toBe(1);
      expect(connections[0]).toContain(socketId);
    });

    it('should track multiple connections', async () => {
      await metricsService.trackConnection('socket-1');
      await metricsService.trackConnection('socket-2');
      await metricsService.trackConnection('socket-3');

      const redis = (metricsService as any).redis;
      const connections = await redis.zrange('metrics:connections', 0, -1);

      expect(connections.length).toBe(3);
    });

    it('should track disconnection', async () => {
      const socketId = 'socket-123';
      await metricsService.trackConnection(socketId);
      await metricsService.trackDisconnection(socketId);

      const redis = (metricsService as any).redis;
      const connections = await redis.zrange('metrics:connections', 0, -1);

      expect(connections.length).toBe(0);
    });

    it('should handle disconnection of non-existent socket', async () => {
      await metricsService.trackDisconnection('nonexistent-socket');

      const redis = (metricsService as any).redis;
      const connections = await redis.zrange('metrics:connections', 0, -1);

      expect(connections.length).toBe(0);
    });

    it('should remove only specific socket on disconnection', async () => {
      await metricsService.trackConnection('socket-1');
      await metricsService.trackConnection('socket-2');
      await metricsService.trackConnection('socket-3');

      await metricsService.trackDisconnection('socket-2');

      const redis = (metricsService as any).redis;
      const connections = await redis.zrange('metrics:connections', 0, -1);

      expect(connections.length).toBe(2);
      expect(connections.some(c => c.startsWith('socket-1'))).toBe(true);
      expect(connections.some(c => c.startsWith('socket-2'))).toBe(false);
      expect(connections.some(c => c.startsWith('socket-3'))).toBe(true);
    });
  });

  describe('Message Tracking', () => {
    it('should track channel message', async () => {
      const channelId = 'channel-123';
      await metricsService.trackMessage(channelId);

      const redis = (metricsService as any).redis;
      const messages = await redis.zrange('metrics:messages', 0, -1);

      expect(messages.length).toBe(1);
      expect(messages[0]).toContain(channelId);
    });

    it('should track multiple messages', async () => {
      await metricsService.trackMessage('channel-1');
      await metricsService.trackMessage('channel-2');
      await metricsService.trackMessage('channel-1');

      const redis = (metricsService as any).redis;
      const messages = await redis.zrange('metrics:messages', 0, -1);

      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('API Call Tracking', () => {
    it('should track API call', async () => {
      await metricsService.trackApiCall('/api/accounts', 'GET');

      const redis = (metricsService as any).redis;
      const apiCalls = await redis.zrange('metrics:api_calls', 0, -1);

      expect(apiCalls.length).toBe(1);
      expect(apiCalls[0]).toContain('GET');
      expect(apiCalls[0]).toContain('/api/accounts');
    });

    it('should track multiple API calls', async () => {
      await metricsService.trackApiCall('/api/accounts', 'GET');
      await metricsService.trackApiCall('/api/contacts', 'POST');
      await metricsService.trackApiCall('/api/opportunities', 'GET');

      const redis = (metricsService as any).redis;
      const apiCalls = await redis.zrange('metrics:api_calls', 0, -1);

      expect(apiCalls.length).toBe(3);
    });

    it('should differentiate between HTTP methods', async () => {
      // Ensure clean state
      const redis = (metricsService as any).redis;
      await redis.del('metrics:api_calls');

      await metricsService.trackApiCall('/api/accounts', 'GET');
      await metricsService.trackApiCall('/api/accounts', 'POST');

      const apiCalls = await redis.zrange('metrics:api_calls', 0, -1);

      expect(apiCalls.length).toBe(2);
      expect(apiCalls.some(c => c.includes('GET'))).toBe(true);
      expect(apiCalls.some(c => c.includes('POST'))).toBe(true);
    });
  });

  describe('Search Tracking', () => {
    it('should track search query', async () => {
      await metricsService.trackSearch('test query');

      const redis = (metricsService as any).redis;
      const searches = await redis.zrange('metrics:searches', 0, -1);

      expect(searches.length).toBe(1);
      expect(searches[0]).toContain('test query');
    });

    it('should track multiple search queries', async () => {
      await metricsService.trackSearch('query 1');
      await metricsService.trackSearch('query 2');
      await metricsService.trackSearch('query 3');

      const redis = (metricsService as any).redis;
      const searches = await redis.zrange('metrics:searches', 0, -1);

      expect(searches.length).toBe(3);
    });
  });

  describe('Metrics Aggregation', () => {
    it('should update and aggregate metrics', async () => {
      // Track some activity
      await metricsService.trackConnection('socket-1');
      await metricsService.trackConnection('socket-2');
      await metricsService.trackMessage('channel-1');
      await metricsService.trackApiCall('/api/test', 'GET');
      await metricsService.trackSearch('test');

      // Update metrics
      await metricsService.updateMetrics();

      // Get metrics
      const metrics = await metricsService.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.activeUsers).toBe(2);
      expect(metrics.messagesPerMin).toBe(1);
      expect(metrics.apiCallsPerMin).toBe(1);
      expect(metrics.searchQueries).toBe(1);
    });

    it('should return zeros when no metrics cached', async () => {
      const metrics = await metricsService.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.activeUsers).toBe(0);
      expect(metrics.messagesPerMin).toBe(0);
      expect(metrics.apiCallsPerMin).toBe(0);
      expect(metrics.searchQueries).toBe(0);
    });

    it('should cache metrics for 60 seconds', async () => {
      await metricsService.trackConnection('socket-1');
      await metricsService.updateMetrics();

      // Get cached metrics
      const metrics1 = await metricsService.getMetrics();
      expect(metrics1.activeUsers).toBe(1);

      // Add more activity
      await metricsService.trackConnection('socket-2');

      // Should still get cached metrics (not updated)
      const metrics2 = await metricsService.getMetrics();
      expect(metrics2.activeUsers).toBe(1); // Still cached value
    });

    it('should clean up old entries (older than 5 minutes)', async () => {
      const redis = (metricsService as any).redis;
      const now = Date.now();
      const sixMinutesAgo = now - 6 * 60 * 1000;

      // Add old entry
      await redis.zadd('metrics:connections', sixMinutesAgo, `socket-old:${sixMinutesAgo}`);

      // Add recent entry
      await metricsService.trackConnection('socket-new');

      // Update metrics (should clean up old entries)
      await metricsService.updateMetrics();

      const connections = await redis.zrange('metrics:connections', 0, -1);

      expect(connections.length).toBe(1);
      expect(connections[0]).toContain('socket-new');
      expect(connections[0]).not.toContain('socket-old');
    });

    it('should count only recent messages (within 1 minute)', async () => {
      const redis = (metricsService as any).redis;
      const now = Date.now();
      const twoMinutesAgo = now - 2 * 60 * 1000;

      // Add old message
      await redis.zadd('metrics:messages', twoMinutesAgo, `channel-old:${twoMinutesAgo}`);

      // Add recent message
      await metricsService.trackMessage('channel-new');

      // Update metrics
      await metricsService.updateMetrics();

      const metrics = await metricsService.getMetrics();

      expect(metrics.messagesPerMin).toBe(1); // Only recent message
    });
  });

  describe('Redis Connection Management', () => {
    it('should close Redis connection gracefully', async () => {
      const service = new MetricsService(REDIS_URL);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw when closing
      await expect(service.close()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Create service with invalid Redis URL
      const service = new MetricsService('redis://invalid-host:6379');

      // Should not throw, just log error
      await new Promise(resolve => setTimeout(resolve, 200));

      await service.close();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent tracking operations', async () => {
      const promises = [];

      // Track 10 connections concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(metricsService.trackConnection(`socket-${i}`));
      }

      await Promise.all(promises);

      const redis = (metricsService as any).redis;
      const connections = await redis.zrange('metrics:connections', 0, -1);

      expect(connections.length).toBe(10);
    });

    it('should handle concurrent metric updates', async () => {
      await metricsService.trackConnection('socket-1');

      // Update metrics concurrently
      const promises = [
        metricsService.updateMetrics(),
        metricsService.updateMetrics(),
        metricsService.updateMetrics()
      ];

      await Promise.all(promises);

      const metrics = await metricsService.getMetrics();
      expect(metrics.activeUsers).toBe(1);
    });
  });
});

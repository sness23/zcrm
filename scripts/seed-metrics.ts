#!/usr/bin/env tsx
import { MetricsService } from '../src/lib/metrics.js';
import { ulid } from 'ulidx';

/**
 * Seed Redis with realistic metrics data for testing the analytics dashboard
 */
async function seedMetrics() {
  const metrics = new MetricsService();

  console.log('🌱 Seeding Redis with realistic metrics data...\n');

  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  // Simulate 25-50 active connections (users) over the last 5 minutes
  console.log('👥 Adding active user connections...');
  const numUsers = Math.floor(Math.random() * 25) + 25; // 25-50 users
  for (let i = 0; i < numUsers; i++) {
    const socketId = ulid();
    const connectedAt = fiveMinutesAgo + Math.floor(Math.random() * (now - fiveMinutesAgo));
    await metrics.trackConnection(socketId);
  }
  console.log(`   ✓ Added ${numUsers} active connections\n`);

  // Simulate 80-150 messages in the last minute
  console.log('💬 Adding recent messages...');
  const numMessages = Math.floor(Math.random() * 70) + 80; // 80-150 messages
  const channels = ['ch_general', 'ch_sales', 'ch_support', 'ch_engineering', 'dm_cohere'];
  for (let i = 0; i < numMessages; i++) {
    const channel = channels[Math.floor(Math.random() * channels.length)];
    await metrics.trackMessage(channel);
  }
  console.log(`   ✓ Added ${numMessages} messages in the last minute\n`);

  // Simulate 100-200 API calls in the last minute
  console.log('⚡ Adding API call history...');
  const numApiCalls = Math.floor(Math.random() * 100) + 100; // 100-200 calls
  const endpoints = [
    '/api/events',
    '/api/entities/account',
    '/api/entities/contact',
    '/api/channels/ch_general/messages',
    '/api/search',
    '/api/metrics',
    '/api/visitor-sessions',
    '/api/entities/lead',
    '/api/entities/opportunity'
  ];
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];

  for (let i = 0; i < numApiCalls; i++) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const method = methods[Math.floor(Math.random() * methods.length)];
    await metrics.trackApiCall(endpoint, method);
  }
  console.log(`   ✓ Added ${numApiCalls} API calls in the last minute\n`);

  // Simulate 15-40 search queries in the last minute
  console.log('🔍 Adding search queries...');
  const numSearches = Math.floor(Math.random() * 25) + 15; // 15-40 searches
  const searchTerms = [
    'acme corp',
    'john doe',
    'opportunity',
    'sales pipeline',
    'contact email',
    'revenue forecast',
    'customer support',
    'product demo',
    'quarterly review',
    'contract renewal'
  ];

  for (let i = 0; i < numSearches; i++) {
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    await metrics.trackSearch(term);
  }
  console.log(`   ✓ Added ${numSearches} search queries in the last minute\n`);

  // Update aggregated metrics
  console.log('📊 Calculating aggregated metrics...');
  await metrics.updateMetrics();

  // Display current metrics
  const currentMetrics = await metrics.getMetrics();
  console.log('\n✅ Current metrics in Redis:');
  console.log(`   👥 Active Users:      ${currentMetrics.activeUsers}`);
  console.log(`   💬 Messages/min:      ${currentMetrics.messagesPerMin}`);
  console.log(`   ⚡ API Calls/min:     ${currentMetrics.apiCallsPerMin}`);
  console.log(`   🔍 Search Queries:    ${currentMetrics.searchQueries}\n`);

  await metrics.close();
  console.log('🎉 Metrics seeding complete!\n');
}

seedMetrics().catch(err => {
  console.error('Error seeding metrics:', err);
  process.exit(1);
});

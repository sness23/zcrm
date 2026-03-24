#!/usr/bin/env tsx
/**
 * Reset script for FS-CRM
 * Clears all data: entity markdown files, database, logs
 */

import fs from 'fs';
import path from 'path';

const VAULT = path.join(process.cwd(), 'vault');
const DB_PATH = path.join(VAULT, 'crm.db');
const CHANGES_LOG = path.join(VAULT, 'changes.log');
const LOGS_DIR = path.join(VAULT, '_logs');
const CHATS_DIR = path.join(VAULT, 'chats');
const TOPICS_DIR = path.join(CHATS_DIR, 'topics');
const CHANNEL_LOGS_DIR = path.join(LOGS_DIR, 'channels');

const ENTITY_DIRS = [
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
  'knowledge',
  // Party Model entities
  'parties',
  'individuals',
  'organizations',
  'households',
  'party-identifications',
  'account-contact-relationships',
  'contact-point-emails',
  'contact-point-phones',
  'contact-point-addresses',
  'contact-point-consents',
  'data-use-purposes',
  // Research Intelligence entities
  'researcher-profiles',
  'organization-profiles',
  'party-sources',
  'party-engagements'
];

function clearDirectory(dir: string) {
  const fullPath = path.join(VAULT, dir);

  if (!fs.existsSync(fullPath)) {
    console.log(`⏭️  Skipping ${dir}/ (doesn't exist)`);
    return;
  }

  const files = fs.readdirSync(fullPath);
  let count = 0;

  for (const file of files) {
    if (file.endsWith('.md')) {
      fs.unlinkSync(path.join(fullPath, file));
      count++;
    }
  }

  console.log(`🗑️  Cleared ${count} files from ${dir}/`);
}

async function main() {
  console.log('🧹 Resetting FS-CRM data...\n');

  // Clear entity markdown files
  console.log('📁 Clearing entity directories:');
  for (const dir of ENTITY_DIRS) {
    clearDirectory(dir);
  }

  // Clear database and WAL files
  let dbDeleted = false;
  const dbFiles = [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`];
  for (const dbFile of dbFiles) {
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
      dbDeleted = true;
    }
  }
  if (dbDeleted) {
    console.log('\n🗄️  Deleted database: vault/crm.db (including WAL/SHM files)');
  } else {
    console.log('\n⏭️  No database to delete');
  }

  // Clear changes.log
  if (fs.existsSync(CHANGES_LOG)) {
    fs.unlinkSync(CHANGES_LOG);
    console.log('📝 Deleted changes.log');
  } else {
    console.log('⏭️  No changes.log to delete');
  }

  // Clear event logs
  if (fs.existsSync(LOGS_DIR)) {
    const logFiles = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('events-') && f.endsWith('.md'));
    for (const file of logFiles) {
      fs.unlinkSync(path.join(LOGS_DIR, file));
    }
    if (logFiles.length > 0) {
      console.log(`📋 Deleted ${logFiles.length} event log(s)`);
    }
  }

  // Clear channel databases (Slack/Quip messages)
  const CHANNELS_DB = path.join(LOGS_DIR, 'channels.db');
  let channelsDeleted = false;
  const channelFiles = [CHANNELS_DB, `${CHANNELS_DB}-wal`, `${CHANNELS_DB}-shm`];
  for (const channelFile of channelFiles) {
    if (fs.existsSync(channelFile)) {
      fs.unlinkSync(channelFile);
      channelsDeleted = true;
    }
  }
  if (channelsDeleted) {
    console.log('💬 Deleted channels database (chat messages)');
  }

  // Clear channel message logs (_logs/channels/)
  if (fs.existsSync(CHANNEL_LOGS_DIR)) {
    const channelDirs = fs.readdirSync(CHANNEL_LOGS_DIR);
    let totalMessagesCleared = 0;

    for (const channelDir of channelDirs) {
      const channelPath = path.join(CHANNEL_LOGS_DIR, channelDir);
      if (fs.statSync(channelPath).isDirectory()) {
        const messageFiles = fs.readdirSync(channelPath).filter(f => f.endsWith('.md'));
        for (const file of messageFiles) {
          fs.unlinkSync(path.join(channelPath, file));
          totalMessagesCleared++;
        }
      }
    }

    if (totalMessagesCleared > 0) {
      console.log(`💬 Deleted ${totalMessagesCleared} channel message log(s) from _logs/channels/`);
    }
  }

  // Clear topics
  if (fs.existsSync(TOPICS_DIR)) {
    const topicFiles = fs.readdirSync(TOPICS_DIR).filter(f => f.endsWith('.json') || f.endsWith('.md'));
    for (const file of topicFiles) {
      fs.unlinkSync(path.join(TOPICS_DIR, file));
    }
    if (topicFiles.length > 0) {
      console.log(`🧵 Deleted ${topicFiles.length} topic file(s) from chats/topics/`);
    }
  }

  // Clear chat files
  if (fs.existsSync(CHATS_DIR)) {
    const chatFiles = fs.readdirSync(CHATS_DIR).filter(f =>
      (f.endsWith('.json') || f.endsWith('.md')) && f.startsWith('chat_')
    );
    for (const file of chatFiles) {
      fs.unlinkSync(path.join(CHATS_DIR, file));
    }
    if (chatFiles.length > 0) {
      console.log(`💬 Deleted ${chatFiles.length} chat file(s) from chats/`);
    }
  }

  console.log('\n✨ Reset complete! Ready for fresh seeding.');
}

main();

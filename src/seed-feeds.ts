#!/usr/bin/env node
/**
 * Seed RSS feeds for biochemistry and structural biology
 */
import path from 'path';
import Database from 'better-sqlite3';
import { RSSFeedService } from './lib/rss-feeds.js';

const VAULT = path.join(process.cwd(), 'vault');
const DB_PATH = path.join(VAULT, 'crm.db');

// Initialize database and RSS service
const db = Database(DB_PATH);
const rssService = new RSSFeedService(db);

// Biochemistry and structural biology RSS feeds
const feeds = [
  {
    title: 'Nature Structural & Molecular Biology',
    url: 'https://www.nature.com/nsmb.rss',
    category: 'journal',
    description: 'Latest research in structural and molecular biology from Nature'
  },
  {
    title: 'Science Magazine - Biochemistry',
    url: 'https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=science',
    category: 'journal',
    description: 'Latest biochemistry and molecular biology research from Science'
  },
  {
    title: 'Acta Crystallographica D',
    url: 'https://journals.iucr.org/services/rss/d.xml',
    category: 'journal',
    description: 'Structural biology journal from the International Union of Crystallography'
  },
  {
    title: 'PLoS Biology',
    url: 'https://journals.plos.org/plosbiology/feed/atom',
    category: 'journal',
    description: 'Open access biological research including structural biology'
  },
  {
    title: 'eLife - Structural Biology',
    url: 'https://elifesciences.org/rss/recent.xml',
    category: 'journal',
    description: 'Open access research in structural biology and biochemistry'
  },
  {
    title: 'Nature',
    url: 'https://www.nature.com/nature.rss',
    category: 'journal',
    description: 'Latest research from Nature, including biochemistry and structural biology'
  },
  {
    title: 'Cell',
    url: 'https://www.cell.com/cell/current.rss',
    category: 'journal',
    description: 'Premier journal covering all areas of biology including structural biology'
  },
  {
    title: 'Protein Science',
    url: 'https://onlinelibrary.wiley.com/feed/1469896x/most-recent',
    category: 'journal',
    description: 'Journal dedicated to protein structure and function'
  },
  {
    title: 'Journal of Molecular Biology',
    url: 'https://rss.sciencedirect.com/publication/science/00222836',
    category: 'journal',
    description: 'Research on molecular structure, function, and dynamics'
  },
  {
    title: 'Structure',
    url: 'https://www.cell.com/structure/current.rss',
    category: 'journal',
    description: 'Dedicated to reporting structural biology findings'
  }
];

async function seedFeeds() {
  console.log('🌱 Seeding RSS feeds for biochemistry and structural biology...\n');

  for (const feedData of feeds) {
    try {
      console.log(`  Adding: ${feedData.title}`);
      console.log(`    URL: ${feedData.url}`);

      const feed = rssService.addFeed(
        feedData.title,
        feedData.url,
        feedData.category,
        feedData.description
      );

      console.log(`    ✓ Added with ID: ${feed.id}\n`);
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        console.log(`    ⊘ Feed already exists, skipping\n`);
      } else {
        console.error(`    ✗ Error: ${error.message}\n`);
      }
    }
  }

  console.log('📥 Fetching initial articles from all feeds...\n');

  try {
    const results = await rssService.fetchAllFeeds();

    console.log('\n📊 Summary:');
    console.log('================');

    let totalArticles = 0;
    for (const result of results) {
      const feed = rssService.getFeed(result.feedId);
      if (feed) {
        console.log(`  ${feed.title}: ${result.newArticles} articles`);
        totalArticles += result.newArticles;
      }
    }

    console.log('================');
    console.log(`  Total: ${totalArticles} articles fetched`);
    console.log('\n✓ Feed seeding complete!');
  } catch (error: any) {
    console.error('\n✗ Error fetching feeds:', error.message);
  }

  db.close();
}

seedFeeds().catch(console.error);

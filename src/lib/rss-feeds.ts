/**
 * RSS Feed Management Service
 */
import Parser from 'rss-parser';
import type Database from 'better-sqlite3';
import { ulid } from 'ulidx';

export interface Feed {
  id: string;
  title: string;
  url: string;
  category: string;
  description?: string;
  lastFetched?: string;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  pubDate: string;
  author?: string;
  content: string;
  excerpt: string;
  guid: string;
  read: boolean;
  created_at: string;
}

export class RSSFeedService {
  private parser: Parser;

  constructor(private db: Database.Database) {
    this.parser = new Parser({
      customFields: {
        item: ['content:encoded', 'description'],
      },
    });

    this.createTables();
  }

  /**
   * Create database tables for feeds and articles
   */
  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feeds (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        category TEXT,
        description TEXT,
        last_fetched TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        feed_id TEXT NOT NULL,
        title TEXT NOT NULL,
        link TEXT NOT NULL,
        pub_date TEXT NOT NULL,
        author TEXT,
        content TEXT,
        excerpt TEXT,
        guid TEXT NOT NULL UNIQUE,
        read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
      CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date DESC);
      CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(read);
    `);
  }

  /**
   * Add a new feed
   */
  addFeed(title: string, url: string, category: string = 'general', description?: string): Feed {
    const now = new Date().toISOString();
    const feed: Feed = {
      id: `feed_${ulid()}`,
      title,
      url,
      category,
      description,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO feeds (id, title, url, category, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(feed.id, feed.title, feed.url, feed.category, feed.description, feed.created_at, feed.updated_at);

    return feed;
  }

  /**
   * Get all feeds
   */
  getAllFeeds(): Feed[] {
    return this.db.prepare('SELECT * FROM feeds ORDER BY title').all() as Feed[];
  }

  /**
   * Get feeds with unread counts
   */
  getFeedsWithUnreadCounts(): Array<Feed & { unreadCount: number }> {
    const feeds = this.db
      .prepare(
        `
      SELECT f.*, COUNT(CASE WHEN a.read = 0 THEN 1 END) as unreadCount
      FROM feeds f
      LEFT JOIN articles a ON f.id = a.feed_id
      GROUP BY f.id
      ORDER BY f.title
    `
      )
      .all() as Array<Feed & { unreadCount: number }>;

    return feeds;
  }

  /**
   * Get a single feed by ID
   */
  getFeed(id: string): Feed | undefined {
    return this.db.prepare('SELECT * FROM feeds WHERE id = ?').get(id) as Feed | undefined;
  }

  /**
   * Fetch and store articles from a feed
   */
  async fetchFeed(feedId: string): Promise<number> {
    const feed = this.getFeed(feedId);
    if (!feed) throw new Error('Feed not found');

    try {
      const rssFeed = await this.parser.parseURL(feed.url);
      let newArticles = 0;

      for (const item of rssFeed.items) {
        if (!item.guid && !item.link) continue;

        const guid = item.guid || item.link!;
        const existing = this.db.prepare('SELECT id FROM articles WHERE guid = ?').get(guid);

        if (existing) continue;

        const content = (item as any)['content:encoded'] || item.content || item.description || '';
        const excerpt = this.createExcerpt(content);

        const article: Omit<Article, 'read'> = {
          id: `art_${ulid()}`,
          feedId: feed.id,
          title: item.title || 'Untitled',
          link: item.link || '',
          pubDate: item.pubDate || new Date().toISOString(),
          author: item.creator || item.author,
          content,
          excerpt,
          guid,
          created_at: new Date().toISOString(),
        };

        this.db
          .prepare(
            `INSERT INTO articles (id, feed_id, title, link, pub_date, author, content, excerpt, guid, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            article.id,
            article.feedId,
            article.title,
            article.link,
            article.pubDate,
            article.author,
            article.content,
            article.excerpt,
            article.guid,
            article.created_at
          );

        newArticles++;
      }

      // Update last_fetched timestamp
      this.db
        .prepare('UPDATE feeds SET last_fetched = ?, updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), new Date().toISOString(), feedId);

      return newArticles;
    } catch (error: any) {
      console.error(`Error fetching feed ${feed.title}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch all feeds
   */
  async fetchAllFeeds(): Promise<{ feedId: string; newArticles: number }[]> {
    const feeds = this.getAllFeeds();
    const results = [];

    for (const feed of feeds) {
      try {
        const newArticles = await this.fetchFeed(feed.id);
        results.push({ feedId: feed.id, newArticles });
      } catch (error) {
        console.error(`Failed to fetch feed ${feed.title}:`, error);
        results.push({ feedId: feed.id, newArticles: 0 });
      }
    }

    return results;
  }

  /**
   * Get articles for a feed
   */
  getArticles(feedId: string, limit: number = 50): Article[] {
    return this.db
      .prepare(
        `SELECT id, feed_id as feedId, title, link, pub_date as pubDate, author, content, excerpt, guid, read, created_at
         FROM articles
         WHERE feed_id = ?
         ORDER BY pub_date DESC
         LIMIT ?`
      )
      .all(feedId, limit) as Article[];
  }

  /**
   * Mark article as read
   */
  markAsRead(articleId: string): void {
    this.db.prepare('UPDATE articles SET read = 1 WHERE id = ?').run(articleId);
  }

  /**
   * Mark all articles in a feed as read
   */
  markFeedAsRead(feedId: string): void {
    this.db.prepare('UPDATE articles SET read = 1 WHERE feed_id = ?').run(feedId);
  }

  /**
   * Create a text excerpt from HTML/text content
   */
  private createExcerpt(content: string): string {
    // Strip HTML tags
    const text = content.replace(/<[^>]*>/g, ' ');
    // Replace multiple spaces with single space
    const cleaned = text.replace(/\s+/g, ' ').trim();
    // Return first 200 characters
    return cleaned.length > 200 ? cleaned.substring(0, 200) + '...' : cleaned;
  }

  /**
   * Delete a feed and its articles
   */
  deleteFeed(feedId: string): void {
    this.db.prepare('DELETE FROM feeds WHERE id = ?').run(feedId);
  }
}

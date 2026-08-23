import { env } from 'cloudflare:workers';
import { createFeedItemsIndex, createFeedItemsTable, createFeedsTable } from './schema';

export type SavedFeed = {
  id: string;
  source_url: string;
  title: string;
  max_items: number;
  include_descriptions: number;
  exclude_words: string;
  created_at: number;
  last_accessed_at: number;
};

function db(): D1Database {
  if (!env.DB) throw new Error('RSS 儲存服務目前不可用');
  return env.DB;
}

async function ensureSchema() {
  const database = db();
  await database.batch([
    database.prepare(createFeedsTable),
    database.prepare(createFeedItemsTable),
    database.prepare(createFeedItemsIndex),
  ]);
}

export async function saveFeed(input: Omit<SavedFeed, 'created_at' | 'last_accessed_at'>) {
  await ensureSchema();
  const now = Date.now();
  await db().prepare(`
    INSERT INTO feeds (id, source_url, title, max_items, include_descriptions, exclude_words, created_at, last_accessed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      max_items = excluded.max_items,
      include_descriptions = excluded.include_descriptions,
      exclude_words = excluded.exclude_words,
      last_accessed_at = excluded.last_accessed_at
  `).bind(input.id, input.source_url, input.title, input.max_items, input.include_descriptions, input.exclude_words, now, now).run();
}

export async function getFeed(id: string): Promise<SavedFeed | null> {
  await ensureSchema();
  return await db().prepare('SELECT * FROM feeds WHERE id = ? LIMIT 1').bind(id).first<SavedFeed>();
}

export async function touchFeed(id: string) {
  await db().prepare('UPDATE feeds SET last_accessed_at = ? WHERE id = ?').bind(Date.now(), id).run();
}

type FeedItemInput = { title: string; url: string; description?: string; date?: string };

export async function saveNewFeedItems(feedId: string, items: FeedItemInput[]): Promise<number> {
  await ensureSchema();
  const database = db();
  const firstSeenAt = Date.now();
  let inserted = 0;
  for (let offset = 0; offset < items.length; offset += 50) {
    const statements = items.slice(offset, offset + 50).map((item) => database.prepare(`
      INSERT OR IGNORE INTO feed_items
        (feed_id, item_url, title, description, published_at, first_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      feedId,
      item.url,
      item.title,
      item.description || '',
      item.date && !Number.isNaN(Date.parse(item.date)) ? Date.parse(item.date) : 0,
      firstSeenAt,
    ));
    const results = await database.batch(statements);
    inserted += results.reduce((total, result) => total + Number(result.meta.changes || 0), 0);
  }
  return inserted;
}

export async function listFeedItems(feedId: string): Promise<FeedItemInput[]> {
  await ensureSchema();
  const result = await db().prepare(`
    SELECT item_url, title, description, published_at
    FROM feed_items
    WHERE feed_id = ?
    ORDER BY CASE WHEN published_at > 0 THEN published_at ELSE first_seen_at END DESC,
             first_seen_at DESC
  `).bind(feedId).all<{ item_url: string; title: string; description: string; published_at: number }>();
  return result.results.map((item) => ({
    url: item.item_url,
    title: item.title,
    description: item.description,
    date: item.published_at > 0 ? new Date(item.published_at).toISOString() : undefined,
  }));
}

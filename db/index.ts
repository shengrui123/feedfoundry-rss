import { neon } from '@neondatabase/serverless';
import { createFeedItemsIndex, createFeedItemsTable, createFeedsTable, upgradeFeedsTable } from './schema';

export type SavedFeed = {
  id: string;
  source_url: string;
  title: string;
  max_items: number;
  include_descriptions: number;
  exclude_words: string;
  feed_kind: 'official' | 'search' | 'generated';
  feed_url: string;
  item_count: number;
  created_at: number;
  last_accessed_at: number;
};

function sql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('RSS 儲存服務尚未設定');
  return neon(connectionString);
}

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  schemaReady ??= (async () => {
    const database = sql();
    await database.query(createFeedsTable);
    for (const statement of upgradeFeedsTable) await database.query(statement);
    await database.query(createFeedItemsTable);
    await database.query(createFeedItemsIndex);
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  await schemaReady;
}

export async function saveFeed(input: Omit<SavedFeed, 'created_at' | 'last_accessed_at'>) {
  await ensureSchema();
  const now = Date.now();
  await sql().query(`
    INSERT INTO feeds (id, source_url, title, max_items, include_descriptions, exclude_words, feed_kind, feed_url, item_count, created_at, last_accessed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT(id) DO UPDATE SET
      title = EXCLUDED.title,
      max_items = EXCLUDED.max_items,
      include_descriptions = EXCLUDED.include_descriptions,
      exclude_words = EXCLUDED.exclude_words,
      feed_kind = EXCLUDED.feed_kind,
      feed_url = EXCLUDED.feed_url,
      item_count = EXCLUDED.item_count,
      last_accessed_at = EXCLUDED.last_accessed_at
  `, [input.id, input.source_url, input.title, input.max_items, input.include_descriptions, input.exclude_words, input.feed_kind, input.feed_url, input.item_count, now, now]);
}

export async function getFeed(id: string): Promise<SavedFeed | null> {
  await ensureSchema();
  const rows = await sql().query('SELECT * FROM feeds WHERE id = $1 LIMIT 1', [id]) as SavedFeed[];
  return rows[0] || null;
}

export async function touchFeed(id: string) {
  await sql().query('UPDATE feeds SET last_accessed_at = $1 WHERE id = $2', [Date.now(), id]);
}

export type FeedSummary = Pick<SavedFeed, 'id' | 'source_url' | 'title' | 'feed_kind' | 'feed_url' | 'created_at' | 'last_accessed_at'> & {
  item_count: number;
};

export async function listFeeds(): Promise<FeedSummary[]> {
  await ensureSchema();
  return await sql().query(`
    SELECT feeds.id, feeds.source_url, feeds.title, feeds.feed_kind, feeds.feed_url,
           feeds.created_at, feeds.last_accessed_at,
           CASE WHEN feeds.feed_kind = 'generated'
             THEN COUNT(feed_items.item_url)::INTEGER
             ELSE feeds.item_count
           END AS item_count
    FROM feeds
    LEFT JOIN feed_items ON feed_items.feed_id = feeds.id
    GROUP BY feeds.id
    ORDER BY feeds.last_accessed_at DESC, feeds.created_at DESC
  `) as FeedSummary[];
}

type FeedItemInput = { title: string; url: string; description?: string; date?: string };

export async function saveNewFeedItems(feedId: string, items: FeedItemInput[]): Promise<number> {
  await ensureSchema();
  if (!items.length) return 0;
  const firstSeenAt = Date.now();
  const payload = items.map((item) => ({
    item_url: item.url,
    title: item.title,
    description: item.description || '',
    published_at: item.date && !Number.isNaN(Date.parse(item.date)) ? Date.parse(item.date) : 0,
  }));
  const rows = await sql().query(`
    INSERT INTO feed_items (feed_id, item_url, title, description, published_at, first_seen_at)
    SELECT $1, item_url, title, description, published_at, $2
    FROM jsonb_to_recordset($3::jsonb)
      AS item(item_url TEXT, title TEXT, description TEXT, published_at BIGINT)
    ON CONFLICT (feed_id, item_url) DO NOTHING
    RETURNING item_url
  `, [feedId, firstSeenAt, JSON.stringify(payload)]);
  return rows.length;
}

export async function listFeedItems(feedId: string): Promise<FeedItemInput[]> {
  await ensureSchema();
  const rows = await sql().query(`
    SELECT item_url, title, description, published_at
    FROM feed_items
    WHERE feed_id = $1
    ORDER BY CASE WHEN published_at > 0 THEN published_at ELSE first_seen_at END DESC,
             first_seen_at DESC
  `, [feedId]) as Array<{ item_url: string; title: string; description: string; published_at: number }>;
  return rows.map((item) => ({
    url: item.item_url,
    title: item.title,
    description: item.description,
    date: Number(item.published_at) > 0 ? new Date(Number(item.published_at)).toISOString() : undefined,
  }));
}

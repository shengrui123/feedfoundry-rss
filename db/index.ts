import { env } from 'cloudflare:workers';
import { createFeedsTable } from './schema';

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
  await db().prepare(createFeedsTable).run();
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

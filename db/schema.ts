export const createFeedsTable = `
  CREATE TABLE IF NOT EXISTS feeds (
    id TEXT PRIMARY KEY NOT NULL,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    max_items INTEGER NOT NULL DEFAULT 25,
    include_descriptions INTEGER NOT NULL DEFAULT 1,
    exclude_words TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL
  )
`;

export const createFeedItemsTable = `
  CREATE TABLE IF NOT EXISTS feed_items (
    feed_id TEXT NOT NULL,
    item_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    published_at INTEGER NOT NULL DEFAULT 0,
    first_seen_at INTEGER NOT NULL,
    PRIMARY KEY (feed_id, item_url)
  )
`;

export const createFeedItemsIndex = `
  CREATE INDEX IF NOT EXISTS idx_feed_items_feed_seen
  ON feed_items (feed_id, first_seen_at DESC)
`;

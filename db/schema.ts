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

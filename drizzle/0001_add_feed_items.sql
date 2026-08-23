CREATE TABLE IF NOT EXISTS `feed_items` (
  `feed_id` text NOT NULL,
  `item_url` text NOT NULL,
  `title` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `published_at` integer DEFAULT 0 NOT NULL,
  `first_seen_at` integer NOT NULL,
  PRIMARY KEY (`feed_id`, `item_url`)
);

CREATE INDEX IF NOT EXISTS `idx_feed_items_feed_seen`
ON `feed_items` (`feed_id`, `first_seen_at` DESC);

PRAGMA optimize;

CREATE TABLE IF NOT EXISTS `feeds` (
  `id` text PRIMARY KEY NOT NULL,
  `source_url` text NOT NULL,
  `title` text NOT NULL,
  `max_items` integer DEFAULT 25 NOT NULL,
  `include_descriptions` integer DEFAULT 1 NOT NULL,
  `exclude_words` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL,
  `last_accessed_at` integer NOT NULL
);

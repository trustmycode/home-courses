-- 0002 создала раннюю схему media_progress. Перестраиваем её в актуальную
-- схему и переносим накопленные позиции без потери данных.
ALTER TABLE media_progress RENAME TO media_progress_legacy;

DROP INDEX IF EXISTS idx_media_progress_user_lesson;

CREATE TABLE media_progress (
  user_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL,
  completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id, asset_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id)
);

INSERT OR IGNORE INTO users (id)
SELECT DISTINCT user_email
FROM media_progress_legacy;

INSERT OR IGNORE INTO lessons (lesson_id, course_slug, lesson_slug, title)
SELECT DISTINCT
  course_slug || '/' || lesson_slug,
  course_slug,
  lesson_slug,
  lesson_slug
FROM media_progress_legacy;

INSERT INTO media_progress (
  user_id,
  lesson_id,
  asset_id,
  position_seconds,
  duration_seconds,
  completed,
  updated_at
)
SELECT
  user_email,
  course_slug || '/' || lesson_slug,
  asset_id,
  MAX(position_sec, 0),
  NULL,
  0,
  datetime(updated_at_ms / 1000, 'unixepoch')
FROM media_progress_legacy;

DROP TABLE media_progress_legacy;

CREATE INDEX idx_media_progress_lesson
  ON media_progress(user_id, lesson_id, updated_at DESC);

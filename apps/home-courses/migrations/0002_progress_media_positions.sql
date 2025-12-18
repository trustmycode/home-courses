-- Добавить время просмотра в progress
ALTER TABLE progress ADD COLUMN time_spent_sec INTEGER NOT NULL DEFAULT 0;

-- Таблица для позиций каждого медиа-ассета по assetId
CREATE TABLE IF NOT EXISTS media_progress (
  user_email   TEXT NOT NULL,
  course_slug  TEXT NOT NULL,
  lesson_slug  TEXT NOT NULL,
  asset_id     TEXT NOT NULL,
  asset_type   TEXT NOT NULL, -- 'video' | 'audio'
  position_sec INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (user_email, course_slug, lesson_slug, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_media_progress_user_lesson
  ON media_progress(user_email, course_slug, lesson_slug);

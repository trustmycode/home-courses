-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- user_id из JWT sub или email
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Таблица уроков (метаданные для прогресса)
CREATE TABLE IF NOT EXISTS lessons (
  lesson_id TEXT PRIMARY KEY,      -- составной: "courseSlug/lessonSlug"
  course_slug TEXT NOT NULL,
  lesson_slug TEXT NOT NULL,
  title TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(course_slug, lesson_slug)
);

-- Таблица прогресса по медиа-ассетам
CREATE TABLE IF NOT EXISTS media_progress (
  user_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,           -- из data-asset-id в HTML
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL,
  completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id, asset_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_media_progress_lesson
  ON media_progress(user_id, lesson_id, updated_at DESC);

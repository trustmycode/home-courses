CREATE TABLE IF NOT EXISTS progress (
  user_email TEXT NOT NULL,
  course_slug TEXT NOT NULL,
  lesson_slug TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  last_position_sec INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (user_email, course_slug, lesson_slug)
);

CREATE INDEX IF NOT EXISTS idx_progress_user_course
  ON progress(user_email, course_slug);


#!/usr/bin/env bash
set -euo pipefail

database_path="$(mktemp -t home-courses-migrations.XXXXXX)"
trap 'rm -f "$database_path"' EXIT

sqlite3 "$database_path" < apps/home-courses/migrations/0001_progress.sql
sqlite3 "$database_path" < apps/home-courses/migrations/0002_progress_media_positions.sql
sqlite3 "$database_path" <<'SQL'
INSERT INTO media_progress (
  user_email, course_slug, lesson_slug, asset_id, asset_type, position_sec, updated_at_ms
) VALUES (
  'migration@example.test', 'course', 'lesson', 'video-1', 'video', 42, 1700000000000
);
SQL
sqlite3 "$database_path" < apps/home-courses/migrations/0003_public_media_progress.sql
sqlite3 "$database_path" < apps/home-courses/migrations/0004_rebuild_media_progress.sql

columns="$(sqlite3 "$database_path" "SELECT group_concat(name, ',') FROM pragma_table_info('media_progress');")"
expected_columns="user_id,lesson_id,asset_id,position_seconds,duration_seconds,completed,updated_at"
if [[ "$columns" != "$expected_columns" ]]; then
  echo "Неожиданная схема media_progress: $columns" >&2
  exit 1
fi

migrated_position="$(sqlite3 "$database_path" "SELECT position_seconds FROM media_progress WHERE user_id='migration@example.test' AND lesson_id='course/lesson' AND asset_id='video-1';")"
if [[ "$migrated_position" != "42.0" && "$migrated_position" != "42" ]]; then
  echo "Проверочная запись не перенесена" >&2
  exit 1
fi

echo "Все миграции применились, проверочная запись сохранена."

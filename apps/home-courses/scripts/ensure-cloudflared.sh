#!/bin/bash
set -e

# Проверяем наличие cloudflared
if command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared уже установлен: $(which cloudflared)"
  exit 0
fi

echo "Установка cloudflared..."

# Определяем платформу и архитектуру
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Преобразуем архитектуру
if [ "$ARCH" = "x86_64" ]; then
  ARCH="amd64"
elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
  ARCH="arm64"
fi

# Путь для установки
CLOUDFLARED_PATH="/tmp/cloudflared"

# Скачиваем cloudflared
echo "Скачивание cloudflared для ${PLATFORM}-${ARCH}..."
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-${PLATFORM}-${ARCH}" -o "$CLOUDFLARED_PATH"
chmod +x "$CLOUDFLARED_PATH"

# Пытаемся создать симлинк в местах, которые обычно в PATH
for BIN_DIR in /usr/local/bin /usr/bin "$HOME/.local/bin"; do
  if [ -w "$BIN_DIR" ] 2>/dev/null || [ -w "$(dirname "$BIN_DIR")" ] 2>/dev/null; then
    ln -sf "$CLOUDFLARED_PATH" "$BIN_DIR/cloudflared" 2>/dev/null && {
      echo "✓ cloudflared установлен в $BIN_DIR/cloudflared"
      exit 0
    }
  fi
done

# Если не удалось создать симлинк, добавляем /tmp в PATH
echo "✓ cloudflared установлен в $CLOUDFLARED_PATH"
echo "Добавление /tmp в PATH..."
export PATH="/tmp:$PATH"

# Проверяем, что cloudflared доступен
if command -v cloudflared >/dev/null 2>&1; then
  echo "✓ cloudflared доступен: $(which cloudflared)"
  exit 0
else
  echo "✗ Ошибка: cloudflared не найден после установки"
  exit 1
fi

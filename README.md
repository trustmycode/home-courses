# Сайт с курсами

Репозиторий для закрытого сайта с курсами и уроками. Проект показывает список курсов, страницу курса, страницу урока, хранит прогресс просмотра и раздаёт медиафайлы через отдельный воркер Cloudflare.

Важно: тяжёлые исходные медиа по-прежнему лежат вне репозитория. Всё, что нужно для подготовки контента и документации, теперь перенесено внутрь этого репозитория.

## Что находится в репозитории

- `apps/home-courses` — основное приложение на `Next.js`, собираемое для `Cloudflare Workers` через `OpenNext`.
- `apps/home-courses-media` — отдельный воркер для выдачи медиа из `R2`, включая поддержку частичной загрузки.
- `content-src` — исходники курсов в `MDX` и `assets.json`.
- `tools/render-lesson.mjs` — преобразование урока в HTML с загрузкой результата в `R2`.
- `tools/process-and-upload-videos.mjs` — обработка видео через `ffmpeg` и загрузка в `R2`.
- `docs/SETUP_SIGNED_URLS.md` — памятка по настройке подписанных ссылок.
- `.gitignore` — правила игнорирования служебных файлов, сборки и крупных медиафайлов.

## Что находится рядом с репозиторием

Снаружи репозитория оставлены только внешние исходные медиа и вспомогательные рабочие артефакты:

- `../Анна Владимировна. Стоп Тревога` — исходные материалы курса.

## Как устроен проект

### Приложение

Пользовательская часть находится в `apps/home-courses/src/app` и построена на маршрутизации `App Router` в `Next.js`.

Основные маршруты:

- `/` — список курсов.
- `/course/[slug]` — страница курса с уроками и прогрессом.
- `/course/[slug]/lesson/[lessonSlug]` — страница конкретного урока.
- `/api/progress` — чтение и запись прогресса по уроку.
- `/api/progress/course` — агрегированный прогресс по курсу.
- `/api/whoami` — служебная проверка текущего пользователя.
- `/media/[...key]` — проксирование медиа через сервисную связку на отдельный воркер.

### Хранилища

Проект опирается на два облачных хранилища `Cloudflare`:

- `R2` с привязкой `COURSE_MEDIA` и именем корзины `course-media`.
- `D1` с привязкой `COURSE_DB` и именем базы `course-db`.

В `R2` приложение ожидает:

- индекс курсов по ключу `courses/index.json`;
- HTML уроков;
- описания медиафайлов уроков;
- сами медиафайлы.

В `D1` хранится прогресс. Актуальная схема описана в `apps/home-courses/migrations/0003_public_media_progress.sql`. Основные таблицы:

- `users`;
- `lessons`;
- `media_progress`.

### Доступ пользователей

В боевом окружении пользователь определяется через `Cloudflare Access`:

- по заголовку `Cf-Access-Authenticated-User-Email`;
- по куки `CF_Authorization`, из которой извлекается `sub`.

Для локальной разработки приложение умеет подставлять пользователя из переменной `DEV_USER_EMAIL`. Если она не задана, используется значение `developer@localhost`.

### Медиа

Медиа раздаются отдельным воркером `home-courses-media`. Он:

- читает файлы из той же корзины `R2`;
- поддерживает заголовок `Range` для видео и аудио;
- умеет проверять подпись ссылки по секрету `MEDIA_SIGNING_SECRET`;
- может работать и без проверки подписи, если секрет не настроен.

## Требования

Для работы с репозиторием понадобятся:

- `Node.js` 20 или новее;
- `pnpm`;
- `Wrangler`;
- доступ к ресурсам `Cloudflare Workers`, `R2`, `D1` и при необходимости `Cloudflare Access`;
- `ffmpeg`, если нужно подготавливать и загружать видео из внешней папки с медиа.

## Быстрый запуск

### 1. Установить зависимости

Для сайта:

```bash
cd apps/home-courses
pnpm install
```

Для медиа-воркера:

```bash
cd apps/home-courses-media
pnpm install
```

### 2. Подготовить ресурсы Cloudflare

Нужны как минимум:

- корзина `R2` с именем `course-media`;
- база `D1` с именем `course-db`;
- два воркера: `home-courses` и `home-courses-media`.

В `apps/home-courses/wrangler.jsonc` уже описаны:

- привязка `COURSE_DB`;
- привязка `COURSE_MEDIA`;
- сервисная связка `MEDIA` на воркер `home-courses-media`.

### 3. Применить схему базы данных

SQL-файлы лежат в `apps/home-courses/migrations`.

Минимум, который нужен для текущей логики прогресса:

- `0003_public_media_progress.sql`.

### 4. Заполнить `R2` данными курса

Приложение не сможет показать курсы, пока в `R2` нет индекса `courses/index.json` и файлов уроков.

Сейчас исходники курса и утилиты подготовки лежат рядом с репозиторием:

- `content-src/courses/01-anna-vladimirovna-stop-trevoga`;
- `tools/render-lesson.mjs`;
- `tools/process-and-upload-videos.mjs`.

Полной автоматической сборки всех курсов внутри этого репозитория пока нет.

### 5. Запустить части проекта локально

Медиа-воркер:

```bash
cd apps/home-courses-media
pnpm dev
```

Сайт:

```bash
cd apps/home-courses
DEV_USER_EMAIL=you@example.com pnpm dev
```

После этого сайт обычно доступен по адресу `http://localhost:3000`.

## Подготовка контента

Ожидаемая структура исходников курса:

```text
content-src/courses/<courseSlug>/<lessonSlug>/
  <lessonSlug>.mdx
  assets.json
```

Рендер урока:

```bash
node tools/render-lesson.mjs --course <courseSlug> --lesson <lessonSlug>
```

Обработка и загрузка видео:

```bash
node tools/process-and-upload-videos.mjs
```

Или через команды `pnpm` из корня репозитория:

```bash
pnpm render:lesson -- --course <courseSlug> --lesson <lessonSlug>
pnpm upload:videos
```

## Основные команды

### Сайт `apps/home-courses`

```bash
pnpm dev
pnpm build
pnpm start
pnpm preview
pnpm deploy
pnpm upload
pnpm cf-typegen
```

### Медиа-воркер `apps/home-courses-media`

```bash
pnpm dev
pnpm test
pnpm deploy
pnpm cf-typegen
```

## Публикация

Сначала медиа-воркер:

```bash
cd apps/home-courses-media
pnpm deploy
```

Потом сайт:

```bash
cd apps/home-courses
pnpm deploy
```

Если используются подписанные ссылки, одинаковый секрет `MEDIA_SIGNING_SECRET` должен быть задан и в сайте, и в медиа-воркере.

## Важные замечания

- Отслеживаемый `README.md` для `git` находится здесь, в корне репозитория.
- Значимая часть данных живёт вне `git` только в `Cloudflare R2`, `Cloudflare D1` и в папке с тяжёлыми исходными медиа.
- Внутренний `apps/home-courses/README.md` сейчас является стандартной заготовкой и не отражает реальное устройство проекта.

# Подготовка к собеседованию по `home-courses`

## Рассказ о проекте

`home-courses` — закрытая платформа курсов для Cloudflare. Next.js/OpenNext формирует каталог и уроки, R2 хранит индекс, HTML и тяжёлые материалы, D1 — позиции просмотра. Отдельный Worker выдаёт видео и аудио диапазонами, но доступен только через служебную привязку. После аудита я усилил защиту по принципу нескольких рубежей: приложение криптографически проверяет Cloudflare Access, медиа-служба требует внутренний секрет, HTML очищается разрешающим списком, а CSP ограничивает браузер. Я также исправил конфликт миграций, сделал прогресс монотонным при запоздалых запросах, сократил число запросов D1 и добавил GitHub Actions.

## 20 вероятных вопросов и краткие ответы

1. **Почему сайт и медиа разделены?** Сайт отвечает за HTML, авторизацию и прогресс, а отдельная служба оптимизирована для потокового R2 и Range; граница задана привязкой `MEDIA` ([`wrangler.jsonc`](../apps/home-courses/wrangler.jsonc#L13)).
2. **Почему медиа-служба не публична?** `workers_dev: false` убирает прямой адрес, а внутренний ключ схемы `Bearer` даёт второй рубеж ([`home-courses-media/wrangler.jsonc`](../apps/home-courses-media/wrangler.jsonc#L4), [`index.ts`](../apps/home-courses-media/src/index.ts#L91)).
3. **Как определяется пользователь?** Проверяется RS256-подпись утверждения Cloudflare Access, затем `iss`, `aud`, `exp`, `nbf`, `iat` и `sub` ([`access.ts`](../apps/home-courses/src/lib/access.ts#L92)).
4. **Откуда берутся ключи подписи?** Из `/cdn-cgi/access/certs` разрешённого домена Cloudflare Access; набор кэшируется пять минут ([`access.ts`](../apps/home-courses/src/lib/access.ts#L69)).
5. **Почему нельзя доверять заголовку электронной почты?** Его можно подделать вне корректно настроенного периметра; идентичность принимается только из проверенных утверждений ([`access.ts`](../apps/home-courses/src/lib/access.ts#L173)).
6. **Как защищён HTML урока?** `sanitize-html` пропускает только нужные теги, атрибуты и схемы ссылок, а CSP запрещает объекты и внешние источники ([`markdown.ts`](../apps/home-courses/src/lib/markdown.ts#L13), [`next.config.ts`](../apps/home-courses/next.config.ts#L3)).
7. **Как работает Range?** Заголовок разбирается и передаётся R2; ответ содержит 206, `Content-Range` и точную длину ([`index.ts`](../apps/home-courses-media/src/index.ts#L112), [`index.ts`](../apps/home-courses-media/src/index.ts#L142)).
8. **Что происходит без служебного секрета?** Обе стороны закрываются с 503; публичного запасного режима нет ([`index.ts`](../apps/home-courses-media/src/index.ts#L91), [`маршрут медиа`](../apps/home-courses/src/app/media/[...key]/route.ts#L46)).
9. **Как сохраняется прогресс?** Один пакет D1 создаёт пользователя, урок и делает `UPSERT` позиции материала ([`api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L109)).
10. **Что защищает от запоздалого запроса?** SQL берёт максимум старой и новой позиции/завершённости, поэтому состояние не откатывается ([`api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L122)).
11. **Как клиент переживает сетевой отказ?** Не удаляет запись из очереди до ответа `2xx`; параллельный сброс блокируется ([`LessonContent.tsx`](../apps/home-courses/src/components/lesson/LessonContent.tsx#L25), [`LessonContent.tsx`](../apps/home-courses/src/components/lesson/LessonContent.tsx#L67)).
12. **Как проверяется ввод?** Форматы курса/урока/материала ограничены регулярными выражениями, время — конечным неотрицательным числом до семи суток, источник PUT сверяется с доменом ([`api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L5), [`api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L69)).
13. **В чём был дефект миграций?** `0002` и `0003` ожидали разные столбцы таблицы с одним именем. `0004` переименовывает старую таблицу, создаёт новую и переносит данные ([`0004`](../apps/home-courses/migrations/0004_rebuild_media_progress.sql#L3)).
14. **Как проверяется миграция?** Скрипт применяет все файлы к временной SQLite-базе, заранее вставляет старую запись и проверяет схему и позицию после переноса ([`verify-migrations.sh`](../scripts/verify-migrations.sh#L7)).
15. **Как уменьшено число запросов D1?** Все строки курса выбираются одним запросом и группируются в памяти по `lesson_id` ([`api/progress/course/route.ts`](../apps/home-courses/src/app/api/progress/course/route.ts#L31)).
16. **Какие проверки выполняет GitHub?** Отдельные задания собирают сайт, запускают тесты медиа и проверяют миграции ([`ci.yml`](../.github/workflows/ci.yml#L11)).
17. **Почему сборка не зависит от Google Fonts?** Используются системные гарнитуры, поэтому компиляция не требует внешнего запроса ([`globals.css`](../apps/home-courses/src/app/globals.css#L168)).
18. **Как обрабатываются ошибки?** Клиент получает короткое сообщение без внутреннего текста исключения, а подробность остаётся в серверном журнале ([`api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L143)).
19. **Есть ли здесь AI/LLM?** Нет. `marked` — обычный детерминированный преобразователь Markdown в HTML ([`render-lesson.mjs`](../tools/render-lesson.mjs#L242)).
20. **Что бы вы сделали дальше?** Тесты JWT/очистки/API, один запрос прогресса для всего каталога, ограничение частоты, метрики и оповещения.

## Слабые места проекта

- Нет автоматических тестов проверки Access JWT и очистки опасного HTML.
- Нет сквозного браузерного сценария: вход → урок → Range → сохранение → восстановление позиции.
- Последний `keepalive`-запрос при закрытии вкладки всё равно может потеряться; нужна очередь повторов или серверная пакетная запись.
- Главная страница делает по одному обращению прогресса на курс ([`page.tsx`](../apps/home-courses/src/app/page.tsx#L14)).
- Расчёт прогресса дублируется в серверном помощнике и API.
- Ограничение частоты и оповещения настраиваются вне репозитория и должны быть подтверждены перед боевым запуском.
- Нужна отдельная юридическая проверка прав на текст курса.

## Файлы, которые нужно изучить

1. [`README.md`](../README.md#L1) — карта системы и запуск.
2. [`apps/home-courses/src/lib/access.ts`](../apps/home-courses/src/lib/access.ts#L1) — проверка идентичности и ключей.
3. [`apps/home-courses/src/lib/markdown.ts`](../apps/home-courses/src/lib/markdown.ts#L1) — граница доверия HTML.
4. [`apps/home-courses-media/src/index.ts`](../apps/home-courses-media/src/index.ts#L1) — внутренний секрет, Range и R2.
5. [`apps/home-courses/src/app/media/[...key]/route.ts`](../apps/home-courses/src/app/media/[...key]/route.ts#L1) — авторизованный прокси.
6. [`apps/home-courses/src/app/api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L1) — валидация, пакет D1 и монотонный UPSERT.
7. [`apps/home-courses/src/app/api/progress/course/route.ts`](../apps/home-courses/src/app/api/progress/course/route.ts#L1) — агрегирование одним запросом.
8. [`apps/home-courses/src/components/lesson/LessonContent.tsx`](../apps/home-courses/src/components/lesson/LessonContent.tsx#L1) — браузерская очередь прогресса.
9. [`apps/home-courses/migrations/0004_rebuild_media_progress.sql`](../apps/home-courses/migrations/0004_rebuild_media_progress.sql#L1) — перенос схемы.
10. [`apps/home-courses-media/test/index.spec.ts`](../apps/home-courses-media/test/index.spec.ts#L1) — проверки потоковой службы.
11. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml#L1) — обязательные проверки.
12. [`docs/SETUP_MEDIA_ACCESS.md`](SETUP_MEDIA_ACCESS.md#L1) — эксплуатационная настройка секретов и Access.

## Короткая формулировка для собеседования

«Я построил закрытую платформу курсов на Next.js и Cloudflare, разделив веб-часть, D1 и потоковую раздачу R2. После аудита усилил границы доверия: проверяю Access JWT криптографически, оставил медиа только за служебной привязкой и внутренним секретом, очищаю HTML, сделал прогресс устойчивым к запоздалым запросам и проверяю миграции с переносом данных в GitHub Actions. Следующий приоритет — расширить тесты границ безопасности и наблюдаемость».

# Технический аудит `home-courses`

Дата итоговой проверки: 17 июля 2026 года. Документ описывает состояние после устранения критических замечаний. Секреты и боевые данные при проверке не выводились.

## Итог и оценки

`home-courses` — закрытая платформа курсов на Next.js/OpenNext и Cloudflare Workers. R2 хранит индекс, HTML и материалы, D1 — пользовательский прогресс, отдельная служба поддерживает потоковую выдачу и диапазоны. Критические дефекты исходного состояния — обход защиты материалов, непроверенный токен Access, сырой HTML и несовместимые миграции — устранены.

| Область | Оценка |
|---|---:|
| Архитектура | 82/100 |
| Надёжность | 78/100 |
| Поддерживаемость | 76/100 |
| Тесты | 58/100 |
| Безопасность | 82/100 |
| Инфраструктура | 78/100 |
| Документация | 88/100 |
| **Средняя** | **77/100** |

Оценка тестов остаётся самой низкой: автоматизированы служба материалов и миграции, но нет модульных проверок Access, очистки HTML и маршрутов прогресса ([`index.spec.ts`](../apps/home-courses-media/test/index.spec.ts#L23), [`verify-migrations.sh`](../scripts/verify-migrations.sh#L7)).

## Исправленные критические замечания

1. Медиа-служба теперь закрывается при отсутствии секрета, требует ключ схемы `Bearer` и не публикуется на `workers.dev` ([`index.ts`](../apps/home-courses-media/src/index.ts#L86), [`wrangler.jsonc`](../apps/home-courses-media/wrangler.jsonc#L4)).
2. Cloudflare Access проверяется по RS256-подписи, разрешённому домену издателя, аудитории и срокам действия; простое декодирование JWT больше не считается авторизацией ([`access.ts`](../apps/home-courses/src/lib/access.ts#L43), [`access.ts`](../apps/home-courses/src/lib/access.ts#L92)).
3. HTML из R2 очищается разрешающим списком тегов, атрибутов и протоколов до передачи в компонент ([`markdown.ts`](../apps/home-courses/src/lib/markdown.ts#L4), [`markdown.ts`](../apps/home-courses/src/lib/markdown.ts#L39)). Дополнительно включены CSP и защитные заголовки ([`next.config.ts`](../apps/home-courses/next.config.ts#L3), [`next.config.ts`](../apps/home-courses/next.config.ts#L49)).
4. Миграция `0004` перестраивает раннюю таблицу `media_progress`, переносит пользователей, уроки и позиции, затем создаёт актуальный индекс ([`0004_rebuild_media_progress.sql`](../apps/home-courses/migrations/0004_rebuild_media_progress.sql#L3), [`0004_rebuild_media_progress.sql`](../apps/home-courses/migrations/0004_rebuild_media_progress.sql#L20)).
5. Запись прогресса проверяет формат и пределы входа, использует пакет D1 и монотонное обновление позиции/завершённости ([`route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L5), [`route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L109)).
6. Клиент не удаляет неподтверждённые обновления и не запускает параллельные сбросы одной очереди ([`LessonContent.tsx`](../apps/home-courses/src/components/lesson/LessonContent.tsx#L25), [`LessonContent.tsx`](../apps/home-courses/src/components/lesson/LessonContent.tsx#L67)).

## 1. Назначение и стек

Проект показывает каталог, курс и урок, восстанавливает позицию видео/аудио и хранит прогресс. Стек: Next.js 15, React 19, TypeScript, OpenNext, Cloudflare Workers, R2, D1, Wrangler, Vitest и SQLite-проверка миграций ([`package.json`](../apps/home-courses/package.json#L1), [`package.json`](../apps/home-courses-media/package.json#L1)). AI/LLM в рабочем потоке нет.

## 2. Точки входа и основные компоненты

- Каталог: [`src/app/page.tsx`](../apps/home-courses/src/app/page.tsx#L1).
- Страницы курса и урока: [`course/[slug]/page.tsx`](../apps/home-courses/src/app/course/[slug]/page.tsx#L1), [`lesson/[lessonSlug]/page.tsx`](../apps/home-courses/src/app/course/[slug]/lesson/[lessonSlug]/page.tsx#L1).
- Прогресс урока и курса: [`api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L14), [`api/progress/course/route.ts`](../apps/home-courses/src/app/api/progress/course/route.ts#L15).
- Прокси и служба материалов: [`media/[...key]/route.ts`](../apps/home-courses/src/app/media/[...key]/route.ts#L38), [`home-courses-media/src/index.ts`](../apps/home-courses-media/src/index.ts#L85).
- Подготовка HTML: [`tools/render-lesson.mjs`](../tools/render-lesson.mjs#L1).

## 3. Главный поток данных

Сервер читает индекс и метаданные из R2 с кэшем ([`content.ts`](../apps/home-courses/src/lib/content.ts#L42)). Страница урока получает очищенный HTML и прогресс D1, клиент слушает события медиа и периодически отправляет `PUT /api/progress` ([`LessonContent.tsx`](../apps/home-courses/src/components/lesson/LessonContent.tsx#L34)). Материал запрашивается с того же домена, проходит проверку пользователя, затем внутренняя привязка `MEDIA` передаёт запрос службе R2 с секретом ([`media/[...key]/route.ts`](../apps/home-courses/src/app/media/[...key]/route.ts#L42), [`media/[...key]/route.ts`](../apps/home-courses/src/app/media/[...key]/route.ts#L62)).

## 4. Архитектурные границы

Границы сайта, подготовки контента, D1 и потоковой службы выражены явно. Публичный адрес медиа-службы выключен, но защита не полагается только на сеть: внутренняя сторона тоже требует секрет ([`home-courses-media/wrangler.jsonc`](../apps/home-courses-media/wrangler.jsonc#L4), [`home-courses-media/src/index.ts`](../apps/home-courses-media/src/index.ts#L91)). Расчёт прогресса всё ещё частично дублируется между серверным помощником и маршрутом курса ([`progress-server.ts`](../apps/home-courses/src/lib/progress-server.ts#L13), [`api/progress/course/route.ts`](../apps/home-courses/src/app/api/progress/course/route.ts#L15)).

## 5. Обработка ошибок

Маршруты возвращают краткие русские сообщения и не раскрывают исходный текст исключения; подробность остаётся в серверном журнале ([`api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L143), [`api/progress/course/route.ts`](../apps/home-courses/src/app/api/progress/course/route.ts#L103)). Медиа различает 400, 401, 404, 405, 416 и 503 ([`home-courses-media/src/index.ts`](../apps/home-courses-media/src/index.ts#L86), [`home-courses-media/src/index.ts`](../apps/home-courses-media/src/index.ts#L112)). Нет единого идентификатора запроса и структурированного формата ошибок — это остаётся улучшением.

## 6. Асинхронность, фоновые задачи и гонки

Очередь позиций защищена флагом выполняющегося сброса; запись удаляется только после успешного ответа, а новый результат с другим значением сохраняется ([`LessonContent.tsx`](../apps/home-courses/src/components/lesson/LessonContent.tsx#L25), [`LessonContent.tsx`](../apps/home-courses/src/components/lesson/LessonContent.tsx#L76)). Сервер применяет `MAX` к позиции и завершённости, поэтому запоздалый запрос не откатывает состояние ([`api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L122)). Остаточный риск: `pagehide` и ограничения браузера не гарантируют доставку последнего сетевого запроса.

## 7. Транзакции и база данных

Все SQL-параметры связываются, а создание пользователя, урока и прогресса отправляется одним `D1 batch` ([`api/progress/route.ts`](../apps/home-courses/src/app/api/progress/route.ts#L109)). Агрегат курса получает все строки одним запросом вместо запроса на каждый урок ([`api/progress/course/route.ts`](../apps/home-courses/src/app/api/progress/course/route.ts#L31)). Последовательность миграций проверяется на временной SQLite-базе с контрольной записью ([`verify-migrations.sh`](../scripts/verify-migrations.sh#L7), [`verify-migrations.sh`](../scripts/verify-migrations.sh#L19)).

## 8. Безопасность и секреты

Явных действующих секретов в отслеживаемых файлах не найдено. `MEDIA_INTERNAL_TOKEN` хранится как секрет Cloudflare и при отсутствии приводит к закрытому отказу ([`SETUP_MEDIA_ACCESS.md`](SETUP_MEDIA_ACCESS.md#L5)). Токен Access извлекается только из стандартного заголовка или точного имени куки ([`access.ts`](../apps/home-courses/src/lib/access.ts#L149), [`access.ts`](../apps/home-courses/src/lib/access.ts#L158)). Остаются организационные меры: настроить ограничение частоты в Cloudflare, ротацию секретов и боевую политику Access.

## 9. Тесты и непокрытые сценарии

Пять тестов проверяют закрытый отказ, неверный ключ, полный ответ, Range, HEAD и ошибочные запросы ([`index.spec.ts`](../apps/home-courses-media/test/index.spec.ts#L30)). Миграции проверяются вместе с переносом старой позиции ([`verify-migrations.sh`](../scripts/verify-migrations.sh#L9)). Критично добавить проверки: поддельный/просроченный Access JWT, очистка опасного HTML, 400/403 маршрута прогресса, повтор и порядок конкурентных обновлений, сквозной сценарий браузера.

## 10. Производительность

Медиа передаётся потоком с диапазонами и без загрузки файла целиком ([`home-courses-media/src/index.ts`](../apps/home-courses-media/src/index.ts#L142)). Прогресс курса агрегируется одним запросом. Главная страница всё ещё вызывает серверный помощник для каждого курса, то есть число обращений D1 линейно числу курсов ([`page.tsx`](../apps/home-courses/src/app/page.tsx#L14)); при росте каталога нужен один запрос по всем курсам.

## 11. Логи и наблюдаемость

Наблюдаемость включена у обоих Worker ([`home-courses/wrangler.jsonc`](../apps/home-courses/wrangler.jsonc#L23), [`home-courses-media/wrangler.jsonc`](../apps/home-courses-media/wrangler.jsonc#L8)). Временные журналы и обращения к локальному отладчику удалены. Для промышленной эксплуатации не хватает метрик задержки D1/R2, доли 401/416/5xx и идентификатора запроса.

## 12. Docker, автоматизация и воспроизводимость

Контейнеры проекту не обязательны: целевая среда — Cloudflare Workers. GitHub Actions отдельно проверяет сайт, медиа и миграции, использует фиксированные Node/pnpm и файлы блокировки ([`ci.yml`](../.github/workflows/ci.yml#L11)). Сборка больше не скачивает шрифты из сети, а локальное окружение D1/R2 не помечено `remote: true` ([`layout.tsx`](../apps/home-courses/src/app/layout.tsx#L1), [`home-courses/wrangler.jsonc`](../apps/home-courses/wrangler.jsonc#L35)).

## 13. Документация

Корневой README описывает компоненты, хранилища, запуск и публикацию ([`README.md`](../README.md#L1)). Отдельная инструкция фиксирует секреты, Access и проверки ([`SETUP_MEDIA_ACCESS.md`](SETUP_MEDIA_ACCESS.md#L1)). Этот аудит и памятка к собеседованию соответствуют исправленному коду.

## 14. AI/LLM-часть

AI/LLM-части нет. `marked` детерминированно преобразует Markdown/MDX в HTML ([`render-lesson.mjs`](../tools/render-lesson.mjs#L242)). Проект следует представлять как облачное веб-приложение с потоковым медиа, а не как AI-систему.

## 15. Риски публичной публикации

Технические блокирующие риски сняты, но репозиторий содержит текст курса; до открытия нужно подтвердить авторские права и согласие автора ([`content-src/courses`](../content-src/courses/01-anna-vladimirovna-stop-trevoga/01-lesson/01-lesson.mdx)). Идентификатор D1 и имя R2 видны в конфигурации, что не является секретом, но раскрывает схему инфраструктуры ([`home-courses/wrangler.jsonc`](../apps/home-courses/wrangler.jsonc#L26)). Перед боевой публикацией обязательны реальные `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `MEDIA_INTERNAL_TOKEN`, ограничение частоты и проверка политики Access.

## Выполненные проверки

- `pnpm lint` — успешно, без предупреждений.
- `pnpm build` — успешно; все восемь маршрутов собраны.
- `npm test -- --run` — 5 из 5 тестов успешно.
- `npm exec tsc -- --noEmit -p tsconfig.json` — успешно.
- `bash scripts/verify-migrations.sh` — все миграции применены, контрольная запись перенесена.
- `npm install` медиа-службы — 0 известных уязвимостей по данным npm на дату проверки.

## Следующий разумный этап

1. Добавить модульные тесты Access и очистки HTML.
2. Добавить проверки маршрута прогресса с поддельными и запоздалыми запросами.
3. Настроить ограничение частоты, оповещения и сроки ротации секретов в Cloudflare.
4. Получить подтверждение прав на содержимое курса до открытия репозитория.

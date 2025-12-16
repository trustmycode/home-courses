# Как выполняются скрипты сборки и деплоя

## Цепочка выполнения скриптов

### 1. Lifecycle Hooks (автоматические)

**`postbuild`** — это lifecycle hook npm/pnpm, который автоматически выполняется после команды `build`.

```bash
# Когда вы выполняете:
pnpm run build

# На самом деле выполняется:
1. next build          # основная команда build
2. postbuild           # автоматически после build
   └─ node scripts/fix-standalone-path.mjs
```

### 2. Явные команды

**`build:opennext`** — явно вызывает `build`, затем OpenNext:

```bash
pnpm run build:opennext

# Выполняется:
1. pnpm run build
   ├─ next build
   └─ postbuild (автоматически)
      └─ node scripts/fix-standalone-path.mjs
2. opennextjs-cloudflare build --skipNextBuild
```

### 3. Команды деплоя

**`deploy`**, **`upload`**, **`preview`** — используют `build:opennext`:

```bash
pnpm run deploy

# Выполняется:
1. pnpm run build:opennext
   ├─ pnpm run build
   │  ├─ next build
   │  └─ postbuild (автоматически)
   │     └─ node scripts/fix-standalone-path.mjs
   └─ opennextjs-cloudflare build --skipNextBuild
2. wrangler deploy
```

## В CI/CD окружении (Cloudflare Pages)

В логах видно, что Cloudflare Pages выполняет:

```bash
pnpm run build        # ← это выполняется в CI/CD
```

Это запустит:
1. `next build`
2. `postbuild` (автоматически) → исправит путь
3. Затем CI/CD выполнит `pnpm run deploy`, который запустит `build:opennext`

**Важно:** В CI/CD может быть кэш сборки, поэтому `postbuild` может не выполниться, если `build` был закэширован. В этом случае нужно убедиться, что `postbuild` выполняется всегда.

## Альтернативный подход (более надежный)

Если нужно гарантировать выполнение `fix-standalone-path` перед OpenNext, можно изменить `build:opennext`:

```json
"build:opennext": "pnpm run build && node scripts/fix-standalone-path.mjs && opennextjs-cloudflare build --skipNextBuild"
```

Это гарантирует выполнение скрипта даже если `postbuild` не сработал.

## Проверка выполнения

Чтобы проверить, что скрипт выполнился:

```bash
# Проверить наличие симлинка/копии
ls -la .next/standalone/.next/server/pages-manifest.json

# Или проверить структуру
tree .next/standalone -L 3
```

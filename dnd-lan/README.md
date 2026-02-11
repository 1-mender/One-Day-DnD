# D&D LAN (v1.2)
Локальный сервер на ноутбуке DM + веб‑клиенты игроков по Wi‑Fi (без интернета).

**Основное**
- DM: `http://localhost:3000/dm`
- Игроки: ссылка или QR из DM Dashboard

## Требования
- Node.js `>=18.18`
- Windows PowerShell (команды ниже в формате PowerShell)

## Установка
```powershell
npm install
npm --prefix server install
npm --prefix client install
```

## Запуск (dev)
```powershell
npm run dev
```

## Продакшн (одна точка входа)
```powershell
npm run build
npm run start
```

## Скрипты
- `npm run dev` — сервер + клиент в dev-режиме
- `npm run build` — сборка клиента + копирование `client/dist` в `server/public`
- `npm run start` — запуск сервера с раздачей собранного клиента
- `npm run test` — серверные тесты
- `npm run lint` — линт client-кода
- `npm run verify` — быстрая проверка качества (`lint + test + build`)
- `npm run preflight` — быстрая проверка перед сессией (health/readyz/диск/минимальная запись)
- `npm --prefix server run chaos:presence` - presence chaos test (reconnect p95 + false-offline)
- `npm run e2e` - e2e smoke: temp server + DM setup/login + join/approve + inventory write/read
- `npm run images:opt` - convert UI textures to webp/avif (local)
- `npm run perf:report` - report JS bundle and image sizes from `client/dist/assets`

## Health / Readiness
- `GET /healthz` — liveness (процесс запущен)
- `GET /readyz` — readiness (доступны БД и uploads)

Пример:
```powershell
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

## Preflight (перед партией)
```powershell
npm run preflight
```

Опции:
- `--join-code <code>` — если включён join code
- `--skip-write` — пропустить проверку записи

Переменные:
- `PREFLIGHT_BASE_URL` (по умолчанию `http://127.0.0.1:3000`)
- `PREFLIGHT_JOIN_CODE`
- `PREFLIGHT_TIMEOUT_MS` (по умолчанию 3000)

## E2E smoke
```powershell
npm run e2e
```
Scenario: readyz p95, DM setup/login, join/approve, inventory create/read.

Env:
- `E2E_READY_TIMEOUT_MS` (default 15000)
- `E2E_READY_SAMPLES` (default 20)
- `E2E_READY_P95_MS` (default 300)
- `E2E_REQUEST_TIMEOUT_MS` (default 5000)
- `E2E_PORT` (optional fixed port)

## Performance Baseline (2026-02-11)
Repeatable command:
```powershell
npm run build
npm run perf:report
```

| Metric | Baseline (before texture path optimization) | Current | Target |
|---|---:|---:|---:|
| Total JS (`client/dist/assets/*.js`) | 862,663 bytes (842.4 KB) | 863,933 bytes (843.7 KB) | <= 850 KB |
| Largest JS chunk | 440,140 bytes (`vendor-react`) | 440,140 bytes (`vendor-react`) | <= 440 KB |
| Total images (`client/dist/assets/*.{png,jpg,jpeg,webp,avif,gif,svg}`) | 7,918,188 bytes (7.55 MB) | 751,600 bytes (734.0 KB) | <= 2 MB |
| Largest image asset | 1,902,461 bytes (`Back.png`) | 77,456 bytes (`book.webp`) | <= 900 KB |

`perf:report` is the source of truth for this table and should be rerun after any asset or bundling change.


## Очистка uploads (безопасный dry-run)
По умолчанию ничего не удаляет. Показывает кандидатов на удаление и причины.
```powershell
npm --prefix server run cleanup:uploads
```

Реальное удаление только с флагом `--apply`:
```powershell
npm --prefix server run cleanup:uploads -- --apply
```

Полезные параметры:
- `--grace-hours=72`
- `--allow-subdirs=assets,bestiary,monsters`
- `--allow-exts=.png,.jpg,.webp`
- `--uploads-dir=...`

## Backup / Restore (ops)
Auto backups go to `DND_LAN_BACKUP_DIR` (default `<data_dir>/backups`).

Export/Import (DM auth):
- `GET /api/backup/export` - zip with `app.db` + `uploads/`
- `POST /api/backup/import` (multipart `zip`) - restore DB and uploads

Secret rotation:
- changing `JWT_SECRET` invalidates DM sessions (re-login required).

## Переменные окружения
См. `server/.env.example`. Важные:
- `PORT` (по умолчанию 3000)
- `JWT_SECRET` (секрет для DM-сессий)
- `DM_COOKIE` (имя cookie для DM)
- `PLAYER_TOKEN_TTL_DAYS`
- `DND_LAN_DATA_DIR` (куда складывать базу)
- `DND_LAN_UPLOADS_DIR` (куда складывать uploads)
- `DND_LAN_BACKUP_DIR` (куда складывать авто-бэкапы)
- `BACKUP_EVERY_MS` (интервал авто-бэкапов, по умолчанию 10 мин)
- `BACKUP_RETAIN` (сколько последних бэкапов хранить, по умолчанию 20)
- `READINESS_CHECK_EVERY_MS` (частота проверки readiness, по умолчанию 10 сек)
- `PRESENCE_GRACE_MS` (grace-offline для сокетов, по умолчанию 4000)
- `INFO_UPLOAD_MAX_BYTES` (лимит загрузки в infoUploads, по умолчанию 5 MB)
- `INFO_UPLOAD_ALLOWED_MIMES` (список MIME через запятую)
- `INFO_ASSET_MAX_BYTES` (лимит upload для infoBlocks, по умолчанию 5 MB)
- `INFO_ASSET_ALLOWED_MIMES` (список MIME через запятую)
- `BESTIARY_IMAGE_MAX_COUNT` (лимит изображений на монстра, по умолчанию 20)
- `BESTIARY_PAGE_LIMIT`
- `INVENTORY_WEIGHT_LIMIT` (базовый лимит веса; если не задан — 50, если `<= 0` — лимит отключён)

Итоговый лимит веса: **base + бонус расы**.
Раса берётся из `stats.race` в профиле персонажа (если не задана — используется `human`).

## Гайд для партий без упора на бои
Если у вас больше ролеплей/сюжет, чем тактика, используйте фокус на:
1. **Info Blocks** — сцены, слухи, заметки NPC, тайные подсказки.
2. **Profile Requests** — игроки предлагают изменения персонажа по сюжету, DM подтверждает.
3. **Events** — журнал ключевых решений группы и последствий.
4. **Tickets/Quests** — награды за социальные/сюжетные достижения, а не только за мини-игры.

### Мини-чеклист DM перед сессией
1. Проверить `GET /readyz`.
2. Сделать backup / убедиться в актуальности экспортов.
3. Подготовить Info Blocks по сценам.
4. Проверить список игроков и доступность клиентских ссылок.

## Горячие клавиши
- `Ctrl+Shift+U` — переключение вариантов UI (`v1`/`v2`/`v3`)
- Можно также задать через URL: `?ui=v1|v2|v3`

## User Guide: аркада и билеты
- Аркада открывается в клиенте игрока (раздел Fish).
- Каждый запуск игры тратит билеты (если цена входа > 0).
- Победы дают награду в диапазоне, который задаёт мастер.
- Дневные лимиты и штрафы показываются на карточках игр.

## Admin/DM Guide: настройка аркады
- В `DM Settings` можно включать/выключать аркаду целиком и каждую игру.
- Настройки игр:
  - `entryCost` — цена входа.
  - `rewardMin/rewardMax` — диапазон награды.
  - `lossPenalty` — штраф за проигрыш.
  - `dailyLimit` — лимит попыток в день.
- Настройки серии побед:
  - `streak.max` — максимум серии.
  - `streak.step` — множитель за серию.
  - `streak.flatBonus` — фиксированный бонус.
- Автобаланс (опционально):
  - `autoBalance.enabled` — включает авто-регуляцию наград/штрафов.
  - `autoBalance.windowDays` — окно статистики.
  - `autoBalance.targetWinRate` — целевая доля побед.

## Troubleshooting
- **Игры недоступны**: проверьте, что аркада включена и у игрока хватает билетов.
- **Награды не начисляются**: убедитесь, что сервер доступен, а `/api/tickets/play` не блокируется.
- **Проблемы с UI**: попробуйте `Ctrl+Shift+U` для смены темы.



Гайд по запуску и dev‑циклу
Минимальные требования:

Node.js >=18.18.0
Запуск в дев‑режиме:
cd dnd-lan
npm install
npm run dev
npm run dev поднимет и сервер, и клиент одновременно (см. dev.js).

Полезные команды:
npm run build   # сборка клиента и копирование в server/public
npm run start   # старт сервера (prod)
npm run test    # тесты сервера
npm run lint    # eslint (клиент)
npm run verify  # lint + test + build

Где смотреть логи/порт:

По умолчанию сервер на http://localhost:3000
Клиент Vite на http://localhost:5173

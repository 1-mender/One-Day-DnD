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

## Health / Readiness
- `GET /healthz` — liveness (процесс запущен)
- `GET /readyz` — readiness (доступны БД и uploads)

Пример:
```powershell
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

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

## Переменные окружения
См. `server/.env.example`. Важные:
- `PORT` (по умолчанию 3000)
- `JWT_SECRET` (секрет для DM-сессий)
- `DM_COOKIE` (имя cookie для DM)
- `PLAYER_TOKEN_TTL_DAYS`
- `DND_LAN_DATA_DIR` (куда складывать базу)
- `DND_LAN_UPLOADS_DIR` (куда складывать uploads)
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

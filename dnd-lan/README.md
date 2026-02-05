# D&D LAN (v1.1)
Локальный сервер на ноутбуке DM + веб‑клиенты игроков по Wi‑Fi (без интернета).

**Основное**
- DM: `http://localhost:3000/dm`
- Игроки: ссылка или QR из DM Dashboard

## Требования
- Node.js `>=18.18`
- Windows PowerShell (для команд ниже)

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
- `npm run dev` запускает сервер и клиент в режиме разработки
- `npm run build` собирает клиент и копирует `client/dist` в `server/public`
- `npm run start` запускает сервер с раздачей собранного клиента
- `npm --prefix server test` запускает тесты сервера

## Очистка uploads (безопасный dry‑run)
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
- `JWT_SECRET` (секрет для DM‑сессий)
- `DM_COOKIE` (имя cookie для DM)
- `PLAYER_TOKEN_TTL_DAYS`
- `DND_LAN_DATA_DIR` (куда складывать базу)
- `DND_LAN_UPLOADS_DIR` (куда складывать uploads)
- `BESTIARY_PAGE_LIMIT`

## Горячие клавиши
- `Ctrl+Shift+U` — переключение вариантов UI (`v1`/`v2`/`v3`)
- Можно также задать через URL: `?ui=v1|v2|v3`

## User Guide: аркада и билеты
- Аркада открывается в клиенте игрока (раздел Fish).
- Каждый запуск игры тратит билеты (если цена входа > 0).
- Победы дают награду в диапазоне, указанный мастером. Итог зависит от множителей серии и выполнения.
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
  - `autoBalance.enabled` — включает авто‑регуляцию наград/штрафов.
  - `autoBalance.windowDays` — окно статистики.
  - `autoBalance.targetWinRate` — целевая доля побед.

## Troubleshooting
- **Игры недоступны**: проверьте, что аркада включена и у игрока хватает билетов.
- **Награды не начисляются**: убедитесь, что сервер доступен, а `/api/tickets/play` не блокируется.
- **Проблемы с UI**: попробуйте `Ctrl+Shift+U` для смены темы.

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
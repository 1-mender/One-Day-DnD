# План улучшений проекта D&D LAN

Документ фиксирует быстрый аудит проекта и приоритеты улучшений.

## Статус плана на 2026-02-11

### Done
1. 2026-02-11: Security baseline закрыт
   - `npm --prefix server audit` без high/critical.
   - `express` и `multer` актуализированы на сервере.
2. 2026-02-11: Надежность runtime закрыта
   - Есть `/healthz` и `/readyz`.
   - Есть graceful shutdown (`SIGINT`/`SIGTERM`) и закрытие `io/http/db`.
   - Включён degraded mode + write-gate (`503 read_only`, `Retry-After`).
3. 2026-02-11: DX/качество закрыто
   - В root есть `npm run verify`, `npm run preflight`, `npm run e2e`.
   - `npm run verify` проходит локально (`lint + test + build`).
4. 2026-02-11: Базовая оптимизация клиентского UX/perf выполнена
   - Включён lazy-loading экранов.
   - Текстуры оптимизированы (WebP/AVIF), baseline в README зафиксирован.

### In progress
1. Performance budget JS
   - Общий JS и крупный `vendor-react` держатся около целевых лимитов, нужен контроль после изменений UI/arcade.
2. UX roadmap (небоевой формат)
   - Двухпанельный DM layout, mobile-first навигация игрока, единая иерархия карточек.
3. Arcade progression/season layer
   - Matchmaking и базовый слой уже есть; сезонный слой и тонкая балансировка остаются в работе.

### Next
1. Зафиксировать один источник правды по roadmap
   - Использовать этот статус-блок как оперативный план, остальные секции ниже как детальный backlog.
2. Довести performance budget до стабильного прохождения
   - Контроль `npm run perf:report` после каждого значимого изменения клиентского UI.
3. Закрыть приёмочные метрики из reliability-части
   - Регулярный прогон `npm --prefix server run chaos:presence` и `npm run preflight` перед сессиями.

## Детализированный backlog (исторический и рабочий контекст)

## Project Reliability Plan (LAN D&D)

### 0) Цели (SLO/RPO) — фиксируем, чтобы не спорить “ощущениями”
SLO (качество на сессии)

- Reconnect latency (client-measured): `t_connect - t_drop`, где `t_drop` — момент первого `disconnect` или `connect_error` после успешного `connect`, а `t_connect` — момент следующего успешного `connect`. Цель: p95 ≤ 5 сек в течение 1 часа сессии.
- False-offline rate: ложный offline = сервер выставил offline, когда выполнялось хотя бы одно из условий: у игрока есть ≥1 активный сокет (по счётчику) или reconnect завершился ≤ 5 сек после drop. Окно: 1 час сессии. Цель: ≤ 1%.
- Readiness latency (host-local): `/readyz` (проверяет DB + диск). Цель: p95 ≤ 300 мс локально на хосте.
- Crash-free session: 0 необработанных падений процесса за сессию. Дополнительно: 0 “молчаливых деградаций” (любая деградация → `system:degraded`).

RPO (потеря данных)

- Цель: RPO ≤ 10 минут (авто-бэкап каждые 10 мин + бэкап “перед сессией”).

### Sprint 1 (P0) — Presence & Reconnect (главный ломатель сессий)

**1.1 Presence Core: счётчики + grace-offline**  
Задача: исключить offline при мультивкладках/быстром reconnect.  
Реализация: `activeSocketsByPlayerId` (Map<playerId, count>), `offlineTimersByPlayerId` (Map<playerId, timeoutId>), `GRACE_MS = 3000..5000`. На connect: `count++`, cancel offline timer, при 0→1 выставить online. На disconnect: `count--`, при 1→0 поставить таймер `GRACE_MS`, затем offline, если не пришёл новый connect.  
DoD: 2 вкладки → закрыть одну → статус остаётся online. 50 циклов drop/reconnect → false-offline ≤ 1%. В логах нет “offline→online” спама при `refreshAuth`.  
Тест: авто-тест (node) через `socket.io-client`: 2 клиента под одним игроком, отключать/подключать, проверять финальный статус.

**1.2 Presence Swap: auth-смена игрока без поломки счётчиков**  
Задача: если сокет меняет `playerId`, счётчики/таймеры не сбиваются.  
Реализация: хранить `socket.data.playerId`, при смене авторизации делать атомарный swap: decrement oldId (и при 0 — timer), increment newId (и online при 0→1), обновить `socket.data.playerId`. Уведомления статуса должны соответствовать реальному состоянию.  
DoD: A→B swap не оставляет “зависший online” у A. Таймер offline для A корректно стартует/отменяется. Уведомления `player.online/offline` не дублируются.  
Тест: авто-тест: connect как A → swap на B → проверить, что A ушёл корректно, B стал online.

**1.3 Клиент: измерение reconnect + понятные состояния сети**  
Задача: игрок/DM видит “переподключение” и клиент сам возвращается.  
Реализация: хранить `dropAt`, считать `reconnectMs`, обработать `connect_error` и `disconnect` → UI state reconnecting. Настройки Socket.IO: `reconnection: true`, `reconnectionAttempts: Infinity`, `reconnectionDelayMax: 5000`. Фиксировать в памяти последние N reconnect-замеров (например 50) для диагностики.  
DoD: в 95% случаев reconnect ≤ 5 сек (на нормальной Wi-Fi). UI не “мерцает” и не падает, показывает понятный статус.  
Тест (ручной): телефон уходит в сон на 20–30 сек → проснулся → соединение вернулось.

**1.4 Сокеты: явные auth-ошибки вместо “тихого гостя”**  
Задача: `dm_token` invalid → явная ошибка.  
Реализация: если cookie `dm_token` присутствует и невалиден → `next(new Error("dm_token_invalid"))`, клиент показывает “сессия истекла, перелогинься”.  
DoD: невалидный DM токен всегда даёт предсказуемый отказ, а не странные права.

### Sprint 2 (P0) — Data Safety (не потерять данные)

**2.1 SQLite Backups: консистентно и без остановки сервера**  
Задача: бэкап должен быть “восстановимый” даже при активной записи.  
Реализация (обязательное требование): использовать backup API (better-sqlite3 если доступно) или согласованный WAL-бэкап (db + wal + shm + checkpoint/lock). Расписание: backup при старте, backup каждые 10 минут, retention: последние 20.  
DoD: backup создаётся без остановки сервера и при активных write. Восстановление из любого backup открывается без ошибок и содержит данные до RPO.  
Тест: скрипт — писать данные в loop → параллельно делать backup → восстановить → проверить целостность.

**2.2 Write-Safety на файловой подсистеме (uploads)**  
Задача: не убить диск и не получить мусор.  
Реализация: лимиты size/type/count, аккуратные ошибки (413/415) + текст для UI, гарантированная очистка orphan файлов.  
DoD: огромный файл не грузится, сервер отвечает контролируемо. Удаление сущности чистит связанные файлы.

### Sprint 3 (P1) — Degraded Mode + Safe Ops (лучше “read-only”, чем смерть)

**3.1 Central Write-Gate + system:degraded**  
Задача: при проблемах DB/диска запись блокируется централизованно.  
Реализация: флаг `isDegraded`, middleware `assertWritable()` для всех write routes, gate на сокет-write событиях, API: 503 + `Retry-After`, сокеты: `system:degraded {reason}`.  
DoD: при падении readiness запись останавливается, чтение (если возможно) остаётся. UI не падает на 503: показывает баннер “только чтение”, отключает кнопки записи.

**3.2 Graceful Shutdown (SIGINT/SIGTERM) без коррапта**  
Реализация: единый shutdown handler, порядок: `io.close()` → `http.close()` → `db.close()`, таймаут 8–10 сек, затем аварийный exit.  
DoD: сервер корректно завершает работу с активными клиентами, после старта всё работает.

### Sprint 4 (P1) — Preflight + Regression Harness (закрепляем стабильность)

**4.1 npm run preflight (одна кнопка перед партией)**  
Проверяет: `/readyz` и время ответа, место на диске, IP/порт/URL подключения, тестовый create/read минимальной сущности, короткий отчёт ✅/❌ + что чинить.  
DoD: за 10 секунд ты видишь “можно начинать” или “что сломано”.

**4.2 Минимальный “хаос-тест” presence/reconnect**  
Сценарии: мультивкладка, 50 drop/reconnect, auth swap, forced disconnect server-side.  
DoD: false-offline ≤ 1%, reconnect p95 ≤ 5 сек (по клиентской метрике).

### Рекомендуемый порядок внедрения (самый рациональный)
1. Sprint 1 (presence/reconnect/auth-errors).
2. Sprint 2 (SQLite backups консистентно).
3. Sprint 3 (degraded + shutdown).
4. Sprint 4 (preflight + хаос-тест).

### Мини-чеклист перед каждой сессией (практика)
1. `npm run preflight` → ✅.
2. Открыть DM → проверить IP/QR/join.
3. С телефона зайти игроком → усыпить экран → проснуться → reconnect ok.
4. Сделать 1 запись → обновить страницу → данные на месте.

## UX roadmap для небоевого формата (мнение по предложению)

Ниже — сжатая оценка инициатив, которые дают максимум пользы именно для сюжетной/ролевой партии.

### P0 (первыми)
1. **DM двухпанельный layout (desktop) + список→детали на mobile**
   - Самый быстрый паттерн для мастера: меньше переключений контекста при работе с Players/Bestiary/InfoBlocks/Inventory.
2. **Единая шапка с operational-данными**
   - Название сессии, статус сервера, join-link/copy, online/idle/offline — это базовый контроль сессии “в одном месте”.
3. **Контекстное меню `…` и URL-фильтры**
   - Быстрые действия на карточках + фильтры, которые не сбрасываются при reload/share ссылки.

### P1 (следом)
4. **Player mobile-first navigation**
   - Нижняя навигация (Home/Inventory/Notes/Info/Settings), крупные tap-зоны, skeleton-состояния для списков.
5. **Информационная иерархия карточек**
   - Бейджи статусов, роль, last-active, единый шаблон карточек сущностей (title + 1–2 метки + краткое описание + `…`).
6. **LAN UX-блок подключения**
   - IP + QR + join-code + подсказка по сети; на стороне игрока — экран переподключения с понятным текстом.

### P2 (после стабилизации)
7. **DM-only event log (50–200 записей)**
   - Ускоряет разбор “что произошло” и ведение хроники партии.
8. **Режим “Показ игрокам” для InfoBlocks**
   - Быстрый общий фокус на сцене/улике без ручных пересылок каждому игроку.
9. **Лёгкая дизайн-система (8pt/типографика/акцент)**
   - Повышает цельность UI и снижает стоимость дальнейших изменений.

### Быстрый пакет на 2–4 часа (high impact)
- DM: двухпанельный layout + `…`-меню на карточках.
- Player: нижняя навигация + быстрые действия в инвентаре.
- Общие списки: skeleton + empty + error состояния.

## Deep Roadmap: Arcade Progression + Matchmaking

Ниже не “wishlist”, а исполняемый план под текущую архитектуру (`/api/tickets`, `ticket_plays`, `ticket_quests`, socket `tickets:updated`).

### 1) Продуктовые цели (что именно улучшаем)
1. Рост удержания игроков между сессиями (D1/D7 внутри LAN-кампании).
2. Быстрый вход в игру без ожидания: “нажал и играешь” за 1-2 тапа.
3. Прозрачная ценность аркады: игрок понимает, за что получает прогресс/награду.

### 2) Прогрессия: варианты и выбор
1. Вариант A (ticket-only, рекомендован для MVP)
   - Что: усиливаем существующие билеты + daily-quests + streak без новой валюты.
   - Плюсы: минимум миграций, низкий риск регрессий, быстрое внедрение.
   - Минусы: меньше “долгосрочной” мотивации, чем у сезонов.
2. Вариант B (XP + сезонный пропуск)
   - Что: добавляем XP, уровни сезона, milestone rewards.
   - Плюсы: сильное удержание, понятная долгосрочная цель.
   - Минусы: новые таблицы/баланс/админка, больше рисков.
3. Вариант C (гибрид)
   - Что: MVP на A, затем слой B без ломки текущих билетов.
   - Выбор: идти по C (A в Sprint-1, B в Sprint-2/3).

### 3) Матчмейкинг: варианты и выбор
1. Вариант A (in-memory очередь)
   - Плюсы: самый быстрый старт.
   - Минусы: теряется при рестарте, сложнее безопасно переживать reconnect.
2. Вариант B (SQLite-backed очередь, рекомендован)
   - Плюсы: персистентность, проще отлаживать, лучше для degraded/recover.
   - Минусы: чуть больше кода и миграций.
3. Вариант C (invite-only без очереди)
   - Плюсы: почти без backend-слоя.
   - Минусы: нет “быстрого матча”, слабый UX для случайного старта.
4. Выбор: B, но с feature flag, чтобы можно было откатить на A.

### 4) Зависимости и влияние на существующие модули
1. Backend (`server/src/routes/tickets.js`)
   - Расширить payload `/api/tickets/me`: добавить `progression` и `matchmaking`.
   - Новые endpoints: `POST /api/tickets/matchmaking/queue`, `POST /api/tickets/matchmaking/cancel`, `GET /api/tickets/matches/history`.
2. Socket слой (`server/src/sockets.js`)
   - События: `arcade:queue:updated`, `arcade:match:found`, `arcade:match:state`.
   - Обязательное поведение: после reconnect клиент получает актуальный snapshot матча.
3. DB (`server/src/schema.sql`)
   - Новые таблицы: `arcade_matches`, `arcade_match_players`, `arcade_progression` (или `season_progress`), индексы по `player_id`, `status`, `created_at`.
4. Client (`client/src/player/Arcade.jsx` + games/*)
   - Новый блок: “Быстрый матч”, “Реванш”, “История матчей”.
   - Гейт на `readOnly/degraded` и корректный fallback на PvE.
5. DM controls (`client/src/dm/DMSettings.jsx`)
   - Переключатели: `matchmaking_enabled`, `ranked_enabled`, `season_enabled`.
   - Лимиты: max concurrent matches, queue timeout.

### 5) План внедрения по этапам (с оценкой S/M/L)
1. Phase 0: Instrumentation (S)
   - Добавить метрики: `arcade_queue_wait_ms`, `arcade_match_complete_ms`, `arcade_rematch_rate`, `arcade_d1_return`.
   - DoD: события логируются в `events` и видны DM в агрегате.
2. Phase 1: Progression MVP (M)
   - Реализовать weekly quests поверх текущих `ticket_plays`.
   - Добавить “уровень аркады” (без новой валюты): level = функция от суммарных win/play.
   - DoD: игрок видит прогресс-бар и получает milestone-награды без ручной выдачи DM.
3. Phase 2: Matchmaking MVP (M)
   - SQLite queue + подбор по режиму/игре + queue timeout + отмена.
   - Реванш в 1 тап между последними оппонентами.
   - DoD: P95 time-to-match < 10 сек при 4+ активных игроках, reconnect не ломает матч.
4. Phase 3: Season Layer (M/L)
   - Сезонные задачи и таблица лидеров по партии.
   - Архивация сезона (snapshot) без удаления оперативных данных.
   - DoD: сброс сезона не ломает билеты и историю матчей.

### 6) Риски и меры снижения
1. Риск: переусложнение экономики наград.
   - Мера: флаг `season_enabled=false` по умолчанию, A/B на одной партии.
2. Риск: нагрузка от частых queue-событий.
   - Мера: debounce push-обновлений + server-side coalescing (100-250ms).
3. Риск: регресс read-only/degraded.
   - Мера: write-gate whitelist только для безопасных операций, тесты на блокировку queue writes в degraded.
4. Риск: потеря состояния матча при reconnect.
   - Мера: snapshot матча при connect + периодический heartbeat статуса.

### 7) Минимальный контракт API (предлагаемый)
1. `POST /api/tickets/matchmaking/queue`
   - body: `{ gameKey, modeKey, skillBand? }`
   - resp: `{ ok, queueId, etaSec }`
2. `POST /api/tickets/matchmaking/cancel`
   - body: `{ queueId }`
   - resp: `{ ok }`
3. `GET /api/tickets/matches/history?limit=20`
   - resp: `{ items: [{ matchId, gameKey, result, durationSec, createdAt }] }`
4. `POST /api/tickets/matches/:id/rematch`
   - resp: `{ ok, queueId }`

### 8) Готовый план на 2 спринта
1. Sprint A (3-4 дня)
   - Phase 0 + Phase 1.
   - Результат: рабочая прогрессия, метрики, без высокого риска.
2. Sprint B (4-5 дней)
   - Phase 2 + baseline тесты reconnect/queue/degraded.
   - Результат: быстрый матч + реванш + история матчей.

### 9) Критерии приёмки (обязательные)
1. Нет новых падений в `npm --prefix server test` и `npm --prefix client run lint`.
2. Queue и rematch корректно переживают reconnect игрока.
3. В degraded режиме операции матчмейкинга блокируются предсказуемо (`503 read_only`).
4. Игрок в UI всегда видит текущее состояние: `в очереди`, `матч найден`, `матч завершён`.


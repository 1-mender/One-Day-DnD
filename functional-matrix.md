# Функциональная матрица: Экран → API → Тест → Риск

Инструкция: заполните таблицу ниже для каждого экрана приложения. Колонки:
- Экран — название или путь компонента
- API — используемые эндпойнты / методы
- Тест — краткое описание тестов (юнит/интеграция/e2e)
- Риск — возможные проблемы и приоритет (низкий/средний/высокий)
- Примечания — дополнительные комментарии

| Экран | API | Тест | Риск | Примечания |
|---|---|---|---|---|
| Главный (Home) | GET /api/catalog | e2e: загрузка каталога; unit: рендер | Средний — длинная загрузка данных | Проверить кеширование
| Инвентарь | GET /api/inventory, POST /api/inventory/transfer | e2e: перемещение предмета; unit: логика фильтра | Высокий — потеря предметов при конфликте | Проверить гонки/консистентность
| Профиль / Аутентификация | POST /api/auth/login, GET /api/profile | unit: валидация данных; e2e: логин/логаут | Средний — сессии/ротация пароля | Тесты безопасности

## Как дополнить
- Могу пройти кодовую базу и попытаться автозаполнить API для экранов клиента.
- Если хочешь, укажи приоритет экранов, которые нужно заполнить в первую очередь.

(Файл с шаблоном: [functional-matrix.md](functional-matrix.md#L1))

## Автозаполнение (на основе кода проекта)
Ниже — предварительные строки, собранные из `client/src/api.js` и клиентских компонентов.

| Экран | API | Тест | Риск | Примечания |
|---|---|---|---|---|
| Главная / Каталог (Home) | GET /api/server/info, GET /api/tickets/catalog, GET /api/bestiary | e2e: загрузка; unit: кеширование компонентов | Средний — большие списки/пагинация | Пагинация и imagesLimit
| Инвентарь (Inventory) | GET /api/inventory/mine, POST /api/inventory/mine, POST /api/inventory/transfers | e2e: перемещение/разделение; unit: layout logic | Высокий — потеря/дублирование предметов при гонках | Проверить write-gate и транзакции
| Профиль игрока (Profile) | GET /api/players/{id}/profile, PATCH /api/players/{id}/profile | unit: валидация; e2e: правка профиля | Средний — несинхронность правок, права доступа | Тесты для ролей (DM vs player)
| Bestiary (монстры) | GET /api/bestiary, POST /api/bestiary, GET /api/bestiary/{id}/images, POST /api/bestiary/{id}/images | e2e: создание/импорт/экспорт; unit: парсинг импорта | Средний — загрузки больших изображений, импорт/слияние | Проверить лимиты загрузки (uploadLimits)
| Игры / Билеты (Tickets) | GET /api/tickets/catalog, POST /api/tickets/play, POST /api/tickets/matchmaking/queue | e2e: покупка/игра/матчмейкинг | Средний — очереди/время ожидания | Нагрузочное тестирование матчинга
| Party / Соединение (Join / Presence) | POST /api/party/join-request, POST /api/party/approve, POST /api/party/kick | e2e: присоединение/кик/имперсонация | Высокий — права DM, race conditions на join | Проверить сценарии импersonation
| DM панель / Настройки (DM Setup) | POST /api/dm/setup, POST /api/auth/login, GET /api/players/dm/list | unit: валидация; e2e: настройка DM | Высокий — уязвимости setup/авторизации | Защита setup-secret
| Загрузка контента / InfoBlocks | GET /api/info-blocks, POST /api/info-blocks, POST /api/info-blocks/upload | e2e: загрузка файлов; unit: валидация форматов | Средний — валидация файлов, размеры | Проверить ограничения и sanitization

## Рекомендации по улучшению

1. **BottomNav**:
   - Улучшить обработку клавиатуры для доступности (a11y).
   - Добавить тесты для сценариев с большим количеством элементов в меню.

2. **API**:
   - Проверить обработку ошибок в `api.js`, особенно для методов загрузки (например, `uploadAsset`).
   - Добавить логирование ошибок для сложных запросов (например, `dmBestiaryImportJson`).

3. **Тесты**:
   - Увеличить покрытие e2e-тестами для сценариев с `BottomNav` и `Modal`.
   - Проверить сценарии с `inventory` на гонки данных (race conditions).

4. **Оптимизация**:
   - Уменьшить дублирование кода в API (например, объединить методы `dmApprove` и `dmReject` с параметрами).
   - Проверить производительность запросов с большими данными (например, `dmEventsExportJson`).

5. **Безопасность**:
   - Убедиться, что все эндпоинты с `POST`/`PUT` имеют строгую валидацию входных данных.
   - Проверить защиту от CSRF для всех форм и запросов.

## Дальше
- Могу пройтись по `client/src/components` и сопоставить конкретные компоненты с экранами.
- Могу сгенерировать CSV/Excel-версию матрицы.

(Автозаполнение сделано на основе файлов `client/src/api.js` и бандла `server/public/assets`).

## Автоматическое сопоставление экранов → компоненты → API (быстрая сводка)

Ниже — результаты автоматического аудита маршрутов из `client/src/App.jsx` с перечислением компонент и вызываемых API (на основе поиска `api.` в исходниках) и краткими UX-проблемами.

| Маршрут / Экран | Компонент (файл) | Используемые API | UX-проблемы / рекомендации |
|---|---|---|---|
| / (Join) | `client/src/player/Join.jsx` | `serverInfo`, `me`, `joinRequest` | Проверка join-code, inline-валидация, дружелюбные ошибки сети
| /waiting | `client/src/player/Waiting.jsx` | `me`, `playerSessionStart` | Показ прогресса ожидания, retry, таймауты
| /app/players | `client/src/player/Players.jsx` | `players` | Пагинация/фильтры, skeletons
| /app/inventory | `client/src/player/Inventory.jsx` | `invMine`, `invAddMine`, `invUpdateMine`, `invDeleteMine`, `invTransferCreate`, `invLayoutUpdateMine`, `invQuickEquipMine`, `invSplitMine` | Optimistic UI для операций, rollback при ошибках, drag&drop/touch улучшения
| /app/transfers | `client/src/player/Transfers.jsx` | `invTransferInbox`, `invTransferOutbox`, `invTransferAccept`, `invTransferReject`, `invTransferCancel` | Чёткие статусы и подтверждения, защита от дублирования действий
| /app/notes | `client/src/player/Notes.jsx` | `infoBlocks` | lazy-load контента, форматированные превью
| /app/profile | `client/src/player/Profile.jsx` | `playerProfile`, `playerPatchProfile`, `playerProfileRequests`, `profilePresets`, `me`, `uploadAsset`, `playerProfileRequest` | inline validation, прогресс загрузки изображений, обзор прав (DM vs player)
| /app/bestiary | `client/src/player/Bestiary.jsx` | `bestiaryPage`, `bestiaryImagesBatch` | virtualize long lists, thumbnails, lazy images, import dry-run UX
| /app/arcade, /app/shop, /app/players (games) | `client/src/player/*` (Arcade, ShopJoe, Players) | `tickets*` (через `useTickets`) | feedback при очередях, loading states, timeout handling

| /dm | `client/src/dm/DMLogin.jsx` | `serverInfo`, `dmLogin` | secure error messages, rate limiting feedback
| /dm/setup | `client/src/dm/DMSetup.jsx` | `serverInfo`, `dmSetup`, `dmLogin` | защита setup-secret, clear onboarding steps
| /dm/app/dashboard | `client/src/dm/DMDashboard.jsx` | `serverInfo`, `dmPlayers` | dashboard perf, lazy widgets
| /dm/app/lobby | `client/src/dm/DMLobby.jsx` | `dmRequests`, `dmApprove`, `dmReject`, `dmBan` | bulk actions, confirm dialogs
| /dm/app/players | `client/src/dm/DMPlayers.jsx` | `dmPlayers`, `dmTicketsList`, `dmImpersonate`, `dmUpdatePlayer`, `dmDeletePlayer`, `dmKick`, `dmTicketsAdjust` | impersonation flow clarity, audit logs for actions
| /dm/app/players/:id/profile | `client/src/dm/DMPlayerProfile.jsx` | `dmPlayers`, `playerProfile`, `dmProfileRequests`, `dmProfilePresets`, `dmUpdatePlayerProfile`, `uploadAsset`, `dmApproveProfileRequest`, `dmRejectProfileRequest` | review workflow UX, diff view for profile requests
| /dm/app/inventory | `client/src/dm/DMInventory.jsx` | `dmPlayers`, `invDmGetPlayer`, `invTransferDmList`, `invDmUpdatePlayerItem`, `invDmAddToPlayer`, `invDmBulkVisibility`, `invDmBulkDelete`, `invDmDeletePlayerItem`, `invTransferDmCancel` | bulk operations UX, confirmations, undo
| /dm/app/bestiary | `client/src/dm/DMBestiary.jsx` | `bestiaryPage`, `bestiaryImagesBatch`, `dmBestiary*` (create/update/delete/upload/import/export/toggle) | import/export UX, progress + dry-run, image size handling
| /dm/app/events | `client/src/dm/DMEvents.jsx` | `dmEventsList`, `dmEventsExportJson`, `dmEventsCleanup` | long-running export UX, filters and previews
| /dm/app/info | `client/src/dm/DMInfoBlocks.jsx` | `infoBlocks`, `dmInfoCreate`, `dmInfoUpdate`, `dmInfoDelete`, `dmInfoUploadAsset`, `dmPlayers` | media upload UX, content preview, sanitization
| /dm/app/settings | `client/src/dm/DMSettings.jsx` | `dmGetJoinCode`, `serverInfo`, `dmTicketsRules`, `dmProfilePresets`, `dmSetJoinCode`, `dmChangePassword`, `dmTicketsResetQuest`, `dmTicketsSetActiveQuest`, `dmTicketsUpdateRules`, `dmProfilePresetsUpdate`, `exportZip`, `importZip` | long-running import/export, confirm critical actions, security for password changes

## Что я сделал и что дальше
- Провёл автоматический поиск компонентов и их вызовов API, обновил матрицу выше.
- Дальше могу: 1) сгенерировать CSV/Excel из этой матрицы, 2) добавить детальные UX-issues для каждого компонента (приоритизация), 3) создать PR с мелкими правками (skeletons, client-side file size check).

(Таблица сгенерирована автоматически на основе `client/src/App.jsx` и поиска вызовов `api.` в `client/src`.)

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

## Дальше
- Могу пройтись по `client/src/components` и сопоставить конкретные компоненты с экранами.
- Могу сгенерировать CSV/Excel-версию матрицы.

(Автозаполнение сделано на основе файлов `client/src/api.js` и бандла `server/public/assets`).

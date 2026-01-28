# D&D LAN (v1.1)
Локальный сервер на ноутбуке DM + веб-клиенты игроков по Wi-Fi (без интернета).

## Запуск (Windows PowerShell)
```powershell
npm install
npm --prefix server install
npm --prefix client install
npm run dev
```

## Продакшн (одна точка входа)

```powershell
npm run build
npm run start
```

Откройте DM: http://localhost:3000/dm
Игроки: ссылка/QR в DM Dashboard.

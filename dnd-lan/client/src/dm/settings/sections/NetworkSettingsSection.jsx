import React from "react";

export default function NetworkSettingsSection({ lanUrl }) {
  return (
    <div className="card taped">
      <div className="u-fw-800">Локальная сеть / Брандмауэр Windows</div>
      <div className="small">{"Проверьте доступность сервера с телефонов в той же сети."}</div>
      <hr />
      <div className="paper-note u-mb-10">
        <div className="title">Локальная сеть</div>
        <div className="small">{"Убедитесь, что все устройства в одной Wi‑Fi сети и открывают IP сервера."}</div>
      </div>
      <div className="small u-line-15">
        <b>{"Ссылка для игроков:"}</b> {lanUrl || "—"}<br />
        <b>{"Если не заходит:"}</b>
        <ul className="u-mt-6">
          <li>{"Сервер должен слушать 0.0.0.0, а не только localhost."}</li>
          <li>Разрешите доступ в брандмауэре для частных сетей.</li>
          <li>{"Проверьте порт и что устройства в одной сети."}</li>
        </ul>
      </div>
    </div>
  );
}

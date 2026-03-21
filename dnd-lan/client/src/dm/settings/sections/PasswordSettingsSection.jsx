import React from "react";
import { inp } from "../domain/settingsConstants.js";

export default function PasswordSettingsSection({
  showPass,
  setShowPass,
  newPass,
  setNewPass,
  newPass2,
  setNewPass2,
  changePassword,
  readOnly
}) {
  return (
    <div className="card taped">
      <div className="u-fw-800">Смена пароля мастера</div>
      <div className="small">{"Рекомендуется сменить пароль после первого запуска."}</div>
      <hr />
      <div className="row u-row-gap-8">
        <input
          type={showPass ? "text" : "password"}
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          placeholder={"Новый пароль"}
          aria-label="Новый пароль DM"
          style={inp}
        />
        <input
          type={showPass ? "text" : "password"}
          value={newPass2}
          onChange={(e) => setNewPass2(e.target.value)}
          placeholder={"Повторите пароль"}
          aria-label="Повторите новый пароль DM"
          style={inp}
        />
        <button className="btn secondary" onClick={() => setShowPass((v) => !v)}>
          {showPass ? "Скрыть" : "Показать"}
        </button>
        <button className="btn" onClick={changePassword} disabled={readOnly}>{"Сменить"}</button>
      </div>
    </div>
  );
}

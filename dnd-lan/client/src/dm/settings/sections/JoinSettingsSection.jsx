import React from "react";
import { inp } from "../domain/settingsConstants.js";

export default function JoinSettingsSection({
  joinEnabled,
  setJoinEnabled,
  showJoin,
  setShowJoin,
  joinCode,
  setJoinCode,
  saveJoinCode,
  readOnly
}) {
  return (
    <div className="card taped">
      <div className="u-fw-800">Код партии (код входа)</div>
      <div className="small">{"Если включен — игроки вводят код при входе."}</div>
      <hr />
      <label className="row">
        <input type="checkbox" checked={joinEnabled} onChange={(e) => setJoinEnabled(e.target.checked)} disabled={readOnly} />
        <span>{"Включить код партии"}</span>
      </label>
      <div className="row u-row-gap-8 u-mt-10">
        <input
          type={showJoin ? "text" : "password"}
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder={"Например: 1234"}
          aria-label="Код партии"
          style={inp}
          disabled={readOnly || !joinEnabled}
        />
        <button className="btn secondary" onClick={() => setShowJoin((v) => !v)} disabled={readOnly || !joinEnabled}>
          {showJoin ? "Скрыть" : "Показать"}
        </button>
        <button className="btn" onClick={saveJoinCode} disabled={readOnly}>{"Сохранить"}</button>
      </div>
    </div>
  );
}

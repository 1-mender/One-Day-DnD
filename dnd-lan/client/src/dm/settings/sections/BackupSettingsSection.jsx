import React from "react";

export default function BackupSettingsSection({ exportZip, importZip, readOnly }) {
  return (
    <div className="card taped">
      <div className="u-fw-800">Резервная копия</div>
      <div className="small">{"Экспорт/импорт: app.db + uploads/ (zip)"}</div>
      <hr />
      <button className="btn secondary" onClick={exportZip}>{"Экспорт (zip)"}</button>
      <div className="u-mt-10">
        <input type="file" accept=".zip" onChange={importZip} aria-label="Импорт резервной копии zip" disabled={readOnly} />
      </div>
    </div>
  );
}

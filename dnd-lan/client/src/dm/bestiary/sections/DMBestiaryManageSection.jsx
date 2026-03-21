export default function DMBestiaryManageSection({ controller }) {
  const {
    applyImport,
    doExport,
    enabled,
    importRef,
    onPickImport,
    portBusy,
    portErr,
    portImagesMeta,
    portMatch,
    portMode,
    portMsg,
    portOnExisting,
    portPendingFile,
    portPlan,
    readOnly,
    resetPlan,
    runDryRun,
    setPortImagesMeta,
    setPortMatch,
    setPortMode,
    setPortOnExisting,
    startNew,
    toggleEnabled
  } = controller;

  return (
    <div className="card taped scrap-card u-mt-12">
      <div className="u-fw-800">Управление</div>
      <div className="small">Экспорт / импорт / видимость</div>
      <hr />
      <div className="row u-row-gap-8 u-row-wrap">
        <button className="btn secondary" onClick={toggleEnabled} disabled={readOnly}>
          {enabled ? "Скрыть от игроков" : "Показать игрокам"}
        </button>
        <button className="btn" onClick={startNew} disabled={readOnly}>+ Добавить</button>
      </div>

      <div className="row u-row-gap-8 u-row-center-wrap u-mt-10">
        <button className="btn secondary" onClick={doExport} disabled={portBusy}>Экспорт JSON</button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="u-hidden-input"
          aria-label="Импорт бестиария из JSON"
          onChange={onPickImport}
        />
        <button className="btn" onClick={() => importRef.current?.click()} disabled={readOnly || portBusy}>Импорт JSON (проверка)</button>
        <select value={portMode} onChange={(event) => setPortMode(event.target.value)} aria-label="Режим импорта бестиария" className="u-select-control">
          <option value="merge">режим: слияние</option>
          <option value="replace">режим: замена</option>
        </select>
        <select value={portMatch} onChange={(event) => setPortMatch(event.target.value)} aria-label="Сопоставление при импорте" className="u-select-control">
          <option value="name">сопоставление: по имени</option>
          <option value="id">сопоставление: по id</option>
        </select>
        <select value={portOnExisting} onChange={(event) => setPortOnExisting(event.target.value)} aria-label="Действие при совпадении монстров" className="u-select-control">
          <option value="update">при совпадении: обновлять</option>
          <option value="skip">при совпадении: пропустить</option>
        </select>
        <label className="row u-row-gap-6">
          <input type="checkbox" checked={portImagesMeta} onChange={(event) => setPortImagesMeta(event.target.checked)} />
          <span className="small">импортировать метаданные картинок</span>
        </label>
      </div>
      {portErr ? <div className="badge off u-mt-10">Ошибка: {portErr}</div> : null}
      {portMsg ? <div className="badge ok u-mt-10">{portMsg}</div> : null}
      {portPlan ? (
        <div className="card taped u-mt-12">
          <div className="u-fw-900">План проверки</div>
          <div className="small u-mt-6">
            режим={portPlan.mode}, сопоставление={portPlan.match}, при совпадении={portPlan.onExisting}, картинки={String(portPlan.imagesMeta)}
          </div>
          <div className="u-mt-8">
            <b>создано:</b> {portPlan.created} <b>обновлено:</b> {portPlan.updated} <b>пропущено:</b> {portPlan.skipped}
            {portPlan.mode === "replace" ? <span> • <b>будет удалено:</b> {portPlan.willDelete}</span> : null}
          </div>
          {Array.isArray(portPlan.warnings) && portPlan.warnings.length > 0 ? (
            <div className="badge warn u-block u-mt-10">{portPlan.warnings.slice(0, 3).join(" • ")}</div>
          ) : null}
          <div className="row u-row-gap-8 u-row-wrap u-mt-10">
            <button className="btn" onClick={applyImport} disabled={readOnly || portBusy || !portPendingFile}>Применить</button>
            <button className="btn secondary" onClick={() => portPendingFile && runDryRun(portPendingFile)} disabled={readOnly || portBusy || !portPendingFile}>Пересчитать</button>
            <button className="btn secondary" onClick={resetPlan} disabled={portBusy}>Сбросить</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

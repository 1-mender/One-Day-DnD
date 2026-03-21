import ActionMenu from "../../../components/ui/ActionMenu.jsx";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";

export default function DMBestiaryListSection({ controller }) {
  const {
    err,
    filtered,
    loadingMore,
    nextCursor,
    loadMore,
    q,
    readOnly,
    selected,
    selectMonster,
    setQ,
    setVis,
    startEdit,
    startNew,
    toggleMonsterHidden,
    del,
    vis,
    enabled
  } = controller;

  return (
    <div className="pane pane-list">
      <div className="card taped scrap-card paper-stack">
        <div className="u-title-xl">Бестиарий (мастер)</div>
        <div className="small">Каталог существ и общий лор</div>
        <hr />
        {err ? <div className="badge off">Ошибка: {err}</div> : null}
        <div className="row u-row-wrap">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Поиск..."
            aria-label="Поиск монстров"
            className="u-w-min-360"
          />
          <select value={vis} onChange={(event) => setVis(event.target.value)} aria-label="Фильтр видимости монстров" className="u-w-180">
            <option value="">Видимость: все</option>
            <option value="public">Публичные</option>
            <option value="hidden">Скрытые</option>
          </select>
          <span className={`badge ${enabled ? "ok" : "off"}`}>
            {enabled ? "Видно игрокам" : "Скрыто для игроков"}
          </span>
          <button className="btn" onClick={startNew} disabled={readOnly}>+ Добавить</button>
        </div>
        <div className="list u-list-mt-12">
          {filtered.map((monster) => (
            <div
              key={monster.id}
              className={`item taped u-items-stretch${selected?.id === monster.id ? " selected" : ""}`}
              onClick={() => selectMonster(monster.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectMonster(monster.id);
                }
              }}
            >
              <PolaroidFrame src={monster.images?.[0]?.url} alt={monster.name} fallback="MON" />
              <div className="u-flex-1">
                <div className="u-fw-800">
                  {monster.name} {monster.is_hidden ? <span className="badge off">скрыт</span> : null}
                </div>
                <div className="small">{monster.type || "-"} • CR: {monster.cr || "-"}</div>
                {monster.habitat ? <div className="small">Среда: {monster.habitat}</div> : null}
              </div>
              <ActionMenu
                items={[
                  { label: "Редактировать", onClick: () => startEdit(monster), disabled: readOnly },
                  {
                    label: monster.is_hidden ? "Сделать публичным" : "Скрыть",
                    onClick: () => toggleMonsterHidden(monster),
                    disabled: readOnly
                  },
                  { label: "Удалить", onClick: () => del(monster.id), disabled: readOnly, tone: "danger" }
                ]}
              />
            </div>
          ))}
        </div>
        {nextCursor ? (
          <div className="row u-mt-10">
            <button className="btn secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Загрузка..." : "Показать ещё"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

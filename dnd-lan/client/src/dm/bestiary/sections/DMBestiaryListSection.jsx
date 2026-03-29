import { ActionMenu } from "../../../foundation/primitives/index.js";
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
    quickAccess,
    vis,
    enabled
  } = controller;

  return (
    <div className="pane pane-list">
      <div className="card taped scrap-card paper-stack tf-shell tf-dm-bestiary-shell">
        <div className="tf-page-head">
          <div className="tf-page-head-main">
            <div className="tf-overline">Master archive</div>
            <div className="u-title-xl tf-page-title">Бестиарий (мастер)</div>
            <div className="small">Каталог существ и общий лор</div>
          </div>
        </div>
        <hr />
        {err ? <div className="badge off">Ошибка: {err}</div> : null}
        <div className="dm-bestiary-summary">
          <span className={`badge ${enabled ? "ok" : "off"}`}>{enabled ? "Видно игрокам" : "Скрыто для игроков"}</span>
          <span className="badge secondary">Монстров: {filtered.length}</span>
          <span className="badge secondary">Всего в архиве: {controller.items.length}</span>
        </div>
        {(quickAccess.pinnedItems.length || quickAccess.recentItems.length) ? (
          <div className="tf-panel dm-quick-access">
            <div className="tf-section-kicker">Quick access</div>
            {quickAccess.pinnedItems.length ? (
              <div className="dm-quick-access-group">
                <div className="small">Закреплённые</div>
                <div className="dm-quick-access-chips">
                  {quickAccess.pinnedItems.map((monster) => (
                    <button key={`pin-${monster.id}`} className="btn secondary dm-quick-access-chip is-pinned" onClick={() => selectMonster(monster.id)}>
                      {monster.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {quickAccess.recentItems.length ? (
              <div className="dm-quick-access-group">
                <div className="small">Недавние</div>
                <div className="dm-quick-access-chips">
                  {quickAccess.recentItems.map((monster) => (
                    <button key={`recent-${monster.id}`} className="btn secondary dm-quick-access-chip" onClick={() => selectMonster(monster.id)}>
                      {monster.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="tf-panel tf-command-bar dm-bestiary-toolbar">
          <div className="tf-section-copy">
            <div className="tf-section-kicker">Search archive</div>
            <div className="dm-bestiary-section-title">Поиск и видимость</div>
          </div>
          <div className="row u-row-wrap dm-bestiary-toolbar-actions">
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
            <button className="btn" onClick={startNew} disabled={readOnly}>+ Добавить</button>
          </div>
        </div>
        <div className="list u-list-mt-12 dm-bestiary-list">
          {filtered.map((monster) => (
            <div
              key={monster.id}
              className={`item taped u-items-stretch tf-monster-card dm-bestiary-card${selected?.id === monster.id ? " selected" : ""}`}
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
                  { label: quickAccess.isPinned(monster.id) ? "Убрать из закреплённых" : "Закрепить", onClick: () => quickAccess.togglePinned(monster.id) },
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

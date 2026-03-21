import MarkdownView from "../../../components/markdown/MarkdownView.jsx";

export default function DMBestiaryDetailSection({ controller }) {
  const { readOnly, selectMonster, selected, startEdit, toggleMonsterHidden } = controller;

  return (
    <div className="card taped scrap-card pane-sticky">
      {selected ? (
        <>
          <div className="row u-row-between-center">
            <div>
              <div className="u-title-xl">{selected.name}</div>
              <div className="small">{selected.type || "-"} • CR: {selected.cr || "-"}</div>
            </div>
            <div className="row u-row-gap-8">
              <button className="btn secondary" onClick={() => selectMonster(0)}>Назад к списку</button>
              <button className="btn" onClick={() => startEdit(selected)} disabled={readOnly}>Редактировать</button>
            </div>
          </div>
          <hr />
          <div className="row u-row-wrap">
            {selected.habitat ? <span className="badge secondary">Среда: {selected.habitat}</span> : null}
            <span className={`badge ${selected.is_hidden ? "off" : "ok"}`}>
              {selected.is_hidden ? "Скрыт" : "Публичный"}
            </span>
          </div>
          <div className="row u-row-gap-8 u-row-wrap u-mt-8">
            <button className="btn secondary" onClick={() => toggleMonsterHidden(selected)} disabled={readOnly}>
              {selected.is_hidden ? "Сделать публичным" : "Скрыть"}
            </button>
          </div>
          {selected.description ? (
            <div className="u-mt-12">
              <MarkdownView source={selected.description} />
            </div>
          ) : null}
          {Array.isArray(selected.abilities) && selected.abilities.length ? (
            <div className="paper-note u-mt-12">
              <div className="title">Способности</div>
              <div className="small u-pre-wrap">{selected.abilities.join("\n")}</div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="small">Выберите монстра, чтобы увидеть детали.</div>
      )}
    </div>
  );
}

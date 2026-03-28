import MarkdownView from "../../../components/markdown/MarkdownView.jsx";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";

export default function DMBestiaryDetailSection({ controller }) {
  const { readOnly, selectMonster, selected, startEdit, toggleMonsterHidden } = controller;

  return (
    <div className="card taped scrap-card pane-sticky tf-panel dm-bestiary-detail">
      {selected ? (
        <>
          <div className="tf-page-head dm-bestiary-detail-head">
            <div className="tf-page-head-main">
              <div className="tf-overline">Selected creature</div>
              <div className="u-title-xl tf-page-title dm-bestiary-detail-title">{selected.name}</div>
              <div className="small">{selected.type || "-"} • CR: {selected.cr || "-"}</div>
            </div>
            <div className="row u-row-gap-8">
              <button className="btn secondary" onClick={() => selectMonster(0)}>Назад к списку</button>
              <button className="btn" onClick={() => startEdit(selected)} disabled={readOnly}>Редактировать</button>
            </div>
          </div>
          <hr />
          <div className="dm-bestiary-detail-meta">
            <div className="dm-bestiary-detail-portrait">
              <PolaroidFrame
                src={selected.images?.[0]?.url}
                alt={selected.name}
                fallback={(selected.name || "?").slice(0, 2).toUpperCase()}
                className="lg"
              />
            </div>
            <div className="dm-bestiary-detail-badges">
              {selected.habitat ? <span className="badge secondary">Среда: {selected.habitat}</span> : null}
              <span className="badge secondary">CR: {selected.cr || "-"}</span>
              <span className={`badge ${selected.is_hidden ? "off" : "ok"}`}>
                {selected.is_hidden ? "Скрыт" : "Публичный"}
              </span>
            </div>
          </div>
          <div className="row u-row-gap-8 u-row-wrap u-mt-8">
            <button className="btn secondary" onClick={() => toggleMonsterHidden(selected)} disabled={readOnly}>
              {selected.is_hidden ? "Сделать публичным" : "Скрыть"}
            </button>
          </div>
          {selected.description ? (
            <div className="u-mt-12 dm-bestiary-description tf-panel">
              <MarkdownView source={selected.description} />
            </div>
          ) : null}
          {Array.isArray(selected.abilities) && selected.abilities.length ? (
            <div className="paper-note u-mt-12 tf-panel dm-bestiary-abilities">
              <div className="title">Способности</div>
              <div className="small u-pre-wrap">{selected.abilities.join("\n")}</div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="dm-bestiary-detail-empty">
          <div className="tf-overline">Selected creature</div>
          <div className="u-fw-800 u-mt-6">Выберите монстра</div>
          <div className="small u-mt-6">Слева появится карточка, справа откроются детали, изображения и действия.</div>
        </div>
      )}
    </div>
  );
}

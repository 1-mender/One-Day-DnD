import Modal from "../../../components/Modal.jsx";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";

const INPUT_STYLE = { width: "100%" };

export default function DMBestiaryEditorModal({ controller }) {
  const {
    delImage,
    edit,
    err,
    fileRef,
    form,
    images,
    onPickFile,
    open,
    readOnly,
    save,
    setForm,
    setOpen
  } = controller;

  return (
    <Modal open={open} title={edit ? "Редактировать" : "Новый монстр"} onClose={() => setOpen(false)}>
      <div className="list">
        {err ? <div className="badge off">Ошибка: {err}</div> : null}
        <input value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Имя*" aria-label="Имя монстра" style={INPUT_STYLE} disabled={readOnly} />
        <div className="row">
          <input value={form.type || ""} onChange={(event) => setForm({ ...form, type: event.target.value })} placeholder="Тип" aria-label="Тип монстра" style={INPUT_STYLE} disabled={readOnly} />
          <input value={form.habitat || ""} onChange={(event) => setForm({ ...form, habitat: event.target.value })} placeholder="Среда" aria-label="Среда обитания" style={INPUT_STYLE} disabled={readOnly} />
        </div>
        <input value={form.cr || ""} onChange={(event) => setForm({ ...form, cr: event.target.value })} placeholder="CR (число/строка)" aria-label="CR монстра" style={INPUT_STYLE} disabled={readOnly} />
        <textarea value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Описание (markdown)" aria-label="Описание монстра" rows={5} style={INPUT_STYLE} disabled={readOnly} />
        <textarea
          value={form.abilitiesText ?? (Array.isArray(form.abilities) ? form.abilities.join("\n") : "")}
          onChange={(event) => setForm({ ...form, abilitiesText: event.target.value })}
          placeholder="Способности (по одной на строку)"
          aria-label="Способности монстра"
          rows={4}
          style={INPUT_STYLE}
          disabled={readOnly}
        />
        <label className="small">
          <input type="checkbox" checked={!!form.is_hidden} onChange={(event) => setForm({ ...form, is_hidden: event.target.checked })} disabled={readOnly} /> Скрыть для игроков (опц.)
        </label>
        <button className="btn" onClick={save} disabled={readOnly}>Сохранить</button>

        <div className="u-mt-10 u-fw-800">Изображения</div>
        <div className="small">PNG/JPG/WEBP/GIF до 5MB</div>
        {!edit ? <div className="small">Сначала сохраните монстра, чтобы загрузить картинки.</div> : null}

        <div className="row u-row-gap-8 u-mt-10">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="u-hidden-input"
            aria-label="Загрузить изображение монстра"
            onChange={onPickFile}
          />
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={readOnly || !edit}>+ Загрузить</button>
        </div>

        <div className="u-grid-auto-170">
          {images.map((image) => (
            <div key={image.id} className="item taped u-col-center">
              <PolaroidFrame src={image.url} alt={image.originalName || "image"} fallback="IMG" className="lg" />
              <button className="btn danger u-w-full u-mt-8" onClick={() => delImage(image.id)} disabled={readOnly}>
                Удалить
              </button>
            </div>
          ))}
          {edit && images.length === 0 ? <div className="small">Пока нет изображений.</div> : null}
        </div>
      </div>
    </Modal>
  );
}

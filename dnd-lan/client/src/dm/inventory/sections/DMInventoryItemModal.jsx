import Modal from "../../../components/Modal.jsx";
import { t } from "../../../i18n/index.js";

export default function DMInventoryItemModal({
  edit,
  form,
  iconSections,
  open,
  readOnly,
  save,
  selectedIcon: SelectedIcon,
  setForm,
  setOpen,
  rarityOptions
}) {
  return (
    <Modal open={open} title={edit ? t("dmInventory.editItem") : t("dmInventory.issueItem")} onClose={() => setOpen(false)}>
      <div className="list">
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t("dmInventory.formName")} aria-label={t("dmInventory.formName")} className="u-w-full" />
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={t("dmInventory.formDescription")} aria-label={t("dmInventory.formDescription")} rows={4} className="u-w-full" />
        <div className="row">
          <input value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} placeholder={t("dmInventory.formQty")} aria-label={t("dmInventory.formQty")} className="u-w-full" />
          <input value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} placeholder={t("dmInventory.formWeight")} aria-label={t("dmInventory.formWeight")} className="u-w-full" />
        </div>
        <div className="row">
          <select value={form.rarity} onChange={(event) => setForm({ ...form, rarity: event.target.value })} aria-label={t("dmInventory.rarityAll")} className="u-w-full">
            {rarityOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })} aria-label={t("dmInventory.visibilityAll")} className="u-w-full">
            <option value="public">{t("dmInventory.visibilityPublic")}</option>
            <option value="hidden">{t("dmInventory.visibilityHidden")}</option>
          </select>
        </div>
        <div className="row u-items-center">
          <select
            value={form.iconKey || ""}
            onChange={(event) => setForm({ ...form, iconKey: event.target.value })}
            aria-label={t("dmInventory.iconList")}
            className="u-w-full"
          >
            <option value="">{t("dmInventory.iconNone")}</option>
            {iconSections.map((section) => (
              <optgroup key={section.key} label={section.label}>
                {section.items.map((icon) => (
                  <option key={icon.key} value={icon.key}>{icon.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="badge secondary u-inline-center u-row-gap-8">
            {SelectedIcon ? <SelectedIcon className="inv-icon u-icon-28" aria-hidden="true" /> : <span className="small">{t("dmInventory.iconNoIcon")}</span>}
          </div>
        </div>
        <details className="inv-icon-picker" open>
          <summary>{t("dmInventory.iconList")}</summary>
          <div className="inv-icon-grid">
            {iconSections.map((section) => (
              <div key={section.key} className="inv-icon-section">
                <div className="inv-icon-section-title">{section.label}</div>
                <div className="inv-icon-section-grid">
                  {section.items.map((icon) => {
                    const Icon = icon.Icon;
                    const active = form.iconKey === icon.key;
                    return (
                      <button
                        key={icon.key}
                        type="button"
                        className={`inv-icon-tile${active ? " active" : ""}`}
                        onClick={() => setForm({ ...form, iconKey: icon.key })}
                        title={icon.label}
                        aria-pressed={active}
                      >
                        <Icon className="inv-icon" aria-hidden="true" />
                        <span>{icon.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
        <input
          value={(form.tags || []).join(", ")}
          onChange={(event) => setForm({ ...form, tags: event.target.value.split(",").map((part) => part.trim()).filter(Boolean) })}
          placeholder={t("dmInventory.formTags")}
          aria-label={t("dmInventory.formTags")}
          className="u-w-full"
        />
        <button className="btn" onClick={save} disabled={readOnly}>{edit ? t("common.save") : t("dmInventory.issue")}</button>
      </div>
    </Modal>
  );
}

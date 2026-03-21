import { EyeOff, Trash2 } from "lucide-react";
import { FilterBar } from "../../../foundation/primitives/index.js";
import { t } from "../../../i18n/index.js";

export default function DMInventoryBulkActionsSection({
  bulkDeleteSelected,
  bulkHideSelected,
  clearSelection,
  readOnly,
  selectedCount,
  selectedId
}) {
  return (
    <div className="dm-inv-panel">
      <div className="dm-inv-panel-title">Выбор</div>
      <FilterBar>
        <span className="badge secondary">{t("dmInventory.selectedCount", { count: selectedCount })}</span>
        <button
          className="btn secondary"
          onClick={bulkHideSelected}
          disabled={readOnly || !selectedId || selectedCount === 0}
          title={t("dmInventory.bulkHideTitle")}
        >
          <EyeOff className="icon" aria-hidden="true" />
          {t("dmInventory.bulkHide")}
        </button>
        <button
          className="btn danger"
          onClick={bulkDeleteSelected}
          disabled={readOnly || !selectedId || selectedCount === 0}
          title={t("dmInventory.bulkDeleteTitle")}
        >
          <Trash2 className="icon" aria-hidden="true" />
          {t("dmInventory.bulkDelete")}
        </button>
        {selectedCount > 0 ? (
          <button className="btn secondary" onClick={clearSelection}>
            {t("dmInventory.clearSelection")}
          </button>
        ) : null}
      </FilterBar>
    </div>
  );
}

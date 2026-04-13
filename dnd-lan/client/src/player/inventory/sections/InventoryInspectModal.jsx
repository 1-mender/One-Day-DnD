import React from "react";
import { FileText } from "lucide-react";
import Modal from "../../../components/Modal.jsx";
import MarkdownView from "../../../components/markdown/MarkdownView.jsx";
import { stripIconTags } from "../../../lib/inventoryIcons.js";
import { getRarityLabel } from "../../../lib/inventoryRarity.js";
import { pickInventoryIcon } from "../../../components/vintage/inventoryItemCard/iconDomain.js";

export default function InventoryInspectModal({
  open,
  item,
  readOnly,
  onClose,
  onEdit
}) {
  const icon = item ? pickInventoryIcon(item) : null;
  const rarityKey = String(item?.rarity || "common").toLowerCase().replace(/\s+/g, "_");
  const rarityLabel = getRarityLabel(rarityKey);
  const tags = stripIconTags(Array.isArray(item?.tags) ? item.tags.filter(Boolean) : []);
  const weight = Number(item?.weight || 0);
  const qty = Number(item?.qty || 0);
  const visibilityLabel = item?.visibility === "hidden" ? "Скрытый" : "Публичный";
  const hasDescription = !!String(item?.description || "").trim();

  return (
    <Modal open={open} title={item?.name || "Осмотр предмета"} onClose={onClose}>
      {item ? (
        <div className="list inv-inspect-sheet">
          <div className="item tf-panel inv-inspect-hero">
            <div className="inv-inspect-icon" aria-hidden="true">
              {icon?.Icon ? <icon.Icon className="icon" /> : <span>{icon?.text || "?"}</span>}
            </div>
            <div className="inv-inspect-copy">
              <div className="tf-section-kicker">Item Dossier</div>
              <div className="inv-inspect-title">{item.name || "Без названия"}</div>
              <div className="inv-inspect-meta">
                <span className="badge secondary">Редкость: {rarityLabel}</span>
                <span className="badge secondary">Количество: {qty || 1}</span>
                {weight > 0 ? <span className="badge secondary">Вес: {weight}</span> : null}
                <span className="badge secondary">{visibilityLabel}</span>
              </div>
            </div>
          </div>

          <div className="item tf-panel inv-inspect-description">
            <div className="title">Описание</div>
            <div className="inv-inspect-markdown">
              {hasDescription ? (
                <MarkdownView source={item.description} />
              ) : (
                <div className="small inv-inspect-empty">
                  Описание пока не добавлено. Базовые свойства предмета видны в шапке карточки.
                </div>
              )}
            </div>
          </div>

          {tags.length ? (
            <div className="item tf-panel">
              <div className="title">Теги</div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {tags.map((tag) => (
                  <span key={tag} className="badge secondary">{tag}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="row inv-inspect-actions" style={{ gap: 10, justifyContent: "flex-end" }}>
            {onEdit ? (
              <button type="button" className="btn secondary" onClick={onEdit} disabled={readOnly}>
                <FileText className="icon" aria-hidden="true" />
                Редактировать
              </button>
            ) : null}
            <button type="button" className="btn" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

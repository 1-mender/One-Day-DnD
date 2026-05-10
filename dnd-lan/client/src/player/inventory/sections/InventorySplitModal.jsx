import React from "react";
import Modal from "../../../components/Modal.jsx";
import { getSplitInputMax } from "../../inventoryDomain.js";

const inp = { width: "100%" };

export default function InventorySplitModal({
  splitOpen,
  closeSplit,
  splitItem,
  splitAvailable,
  splitTarget,
  splitQty,
  setSplitQty,
  confirmSplit
}) {
  return (
    <Modal open={splitOpen} title="Разделить стак" onClose={closeSplit}>
      <div className="list">
        {splitItem ? (
          <div className="small note-hint">
            <b>{splitItem.name}</b> • доступно: {splitAvailable}
          </div>
        ) : null}
        {splitTarget ? (
          <div className="small note-hint">
            Целевой слот: {splitTarget.container}:{splitTarget.slotX}:{splitTarget.slotY}
          </div>
        ) : null}
        <input
          type="number"
          min={1}
          max={getSplitInputMax(splitItem)}
          value={splitQty}
          onChange={(e) => setSplitQty(e.target.value)}
          placeholder="Сколько вынести в новый стак"
          aria-label="Количество для разделения стака"
          style={inp}
        />
        <button className="btn" onClick={confirmSplit} disabled={!splitItem}>
          Разделить
        </button>
      </div>
    </Modal>
  );
}

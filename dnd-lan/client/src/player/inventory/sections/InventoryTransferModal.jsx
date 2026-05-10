import { Send } from "lucide-react";
import React from "react";
import Modal from "../../../components/Modal.jsx";

const inp = { width: "100%" };

export default function InventoryTransferModal({
  transferOpen,
  closeTransfer,
  transferItem,
  transferAvailable,
  transferTo,
  setTransferTo,
  players,
  transferInputMax,
  transferQty,
  setTransferQty,
  transferNote,
  setTransferNote,
  sendTransfer
}) {
  return (
    <Modal open={transferOpen} title="Передать предмет" onClose={closeTransfer}>
      <div className="list">
        {transferItem ? (
          <div className="small note-hint">
            <b>{transferItem.name}</b> • доступно: {transferAvailable}
          </div>
        ) : null}
        <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} aria-label="Получатель передачи" style={inp}>
          <option value="">Выберите получателя</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.displayName} (id:{p.id})</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={transferInputMax}
          value={transferQty}
          onChange={(e) => setTransferQty(e.target.value)}
          placeholder="Количество"
          aria-label="Количество для передачи"
          style={inp}
        />
        <textarea
          value={transferNote}
          onChange={(e) => setTransferNote(e.target.value)}
          rows={3}
          maxLength={140}
          placeholder="Сообщение (до 140 символов)"
          aria-label="Сообщение к передаче"
          style={inp}
        />
        <div className="small">{String(transferNote || "").length}/140</div>
        <button className="btn" onClick={sendTransfer} disabled={!transferItem || !transferTo}>
          <Send className="icon" aria-hidden="true" />Отправить
        </button>
      </div>
    </Modal>
  );
}

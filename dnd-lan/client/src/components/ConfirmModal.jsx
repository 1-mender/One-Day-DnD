import React from "react";
import Modal from "./Modal.jsx";
import { t } from "../i18n/index.js";

export default function ConfirmModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel,
  confirmDisabled = false,
  danger = true,
  children
}) {
  return (
    <Modal open={open} title={title || t("confirmDialog.defaultTitle")} onClose={onCancel}>
      <div className="list">
        {message ? <div className="small">{message}</div> : null}
        {children}
        <div className="row u-row-gap-8">
          <button className="btn secondary" onClick={onCancel}>{cancelLabel || t("common.cancel")}</button>
          <button className={`btn ${danger ? "danger" : ""}`.trim()} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel || t("common.confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

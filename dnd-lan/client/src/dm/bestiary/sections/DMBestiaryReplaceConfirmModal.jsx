import Modal from "../../../components/Modal.jsx";

export default function DMBestiaryReplaceConfirmModal({ controller }) {
  const { portBusy, portPlan, readOnly, replaceConfirmOpen, runImport, setReplaceConfirmOpen } = controller;

  return (
    <Modal
      open={replaceConfirmOpen}
      title="Подтвердите режим «замена»"
      onClose={() => {
        if (!portBusy) setReplaceConfirmOpen(false);
      }}
    >
      <div className="list">
        <div className="small">
          Режим «замена» удалит текущих монстров: <b>{portPlan?.willDelete ?? "всех"}</b>.
        </div>
        <div className="small">
          Также будут очищены связанные изображения монстров. Продолжить импорт?
        </div>
        <div className="row u-row-gap-8">
          <button className="btn secondary" onClick={() => setReplaceConfirmOpen(false)} disabled={portBusy}>
            Отмена
          </button>
          <button className="btn danger" onClick={runImport} disabled={readOnly || portBusy}>
            {portBusy ? "Импорт..." : "Подтвердить и импортировать"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

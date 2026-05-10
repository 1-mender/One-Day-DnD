import React from "react";
import Modal from "../../../components/Modal.jsx";
import InventoryIconPickerSection from "./InventoryIconPickerSection.jsx";
import InventoryItemFormFields from "./InventoryItemFormFields.jsx";

export default function InventoryItemModal({
  open,
  edit,
  closeEditor,
  form,
  setForm,
  selectedIcon: SelectedIcon,
  iconPickerOpen,
  setIconPickerOpen,
  iconQuery,
  setIconQuery,
  filteredIconSections,
  save
}) {
  return (
    <Modal open={open} title={edit ? "Редактировать предмет" : "Новый предмет"} onClose={closeEditor}>
      <div className="list">
        <InventoryItemFormFields form={form} setForm={setForm} />
        <InventoryIconPickerSection
          form={form}
          setForm={setForm}
          selectedIcon={SelectedIcon}
          iconPickerOpen={iconPickerOpen}
          setIconPickerOpen={setIconPickerOpen}
          iconQuery={iconQuery}
          setIconQuery={setIconQuery}
          filteredIconSections={filteredIconSections}
        />
        <button className="btn" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}

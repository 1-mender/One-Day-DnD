import { useEffect, useMemo, useState } from "react";
import { getIconKeyFromItem, getInventoryIcon, stripIconTags } from "../../../lib/inventoryIcons.js";
import { EMPTY_INVENTORY_FORM } from "../../inventoryDomain.js";

export function useInventoryEditorState() {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY_INVENTORY_FORM);
  const [iconQuery, setIconQuery] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (iconQuery) setIconPickerOpen(true);
  }, [iconQuery]);

  useEffect(() => {
    if (!open) {
      setIconQuery("");
      setIconPickerOpen(false);
    }
  }, [open]);

  const SelectedIcon = useMemo(() => getInventoryIcon(form.iconKey), [form.iconKey]);

  function startAdd() {
    setEdit(null);
    setForm(EMPTY_INVENTORY_FORM);
    setOpen(true);
  }

  function startEdit(item) {
    setEdit(item);
    const rest = { ...(item || {}) };
    delete rest.imageUrl;
    delete rest.image_url;
    delete rest.reservedQty;
    delete rest.reserved_qty;
    setForm({
      ...rest,
      tags: stripIconTags(item.tags || []),
      iconKey: getIconKeyFromItem(item)
    });
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
  }

  return {
    open,
    setOpen,
    edit,
    setEdit,
    form,
    setForm,
    iconQuery,
    setIconQuery,
    iconPickerOpen,
    setIconPickerOpen,
    SelectedIcon,
    startAdd,
    startEdit,
    closeEditor,
  };
}

import { getTrapFocusTarget } from "./modalA11y.js";

export function getPopoverTabTarget(focusable, activeElement, shiftKey = false) {
  if (!Array.isArray(focusable) || !focusable.length) return null;
  const wrapped = getTrapFocusTarget(focusable, activeElement, shiftKey);
  if (wrapped) return wrapped;
  if (!focusable.includes(activeElement)) {
    return shiftKey ? focusable[focusable.length - 1] : focusable[0];
  }
  return null;
}

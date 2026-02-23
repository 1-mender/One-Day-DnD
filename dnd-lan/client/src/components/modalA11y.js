const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([type='hidden']):not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function getFocusable(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((node) => !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true");
}

export function getTrapFocusTarget(focusable, activeElement, shiftKey = false) {
  if (!Array.isArray(focusable) || !focusable.length) return null;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (shiftKey) return activeElement === first || !activeElement ? last : null;
  return activeElement === last ? first : null;
}

export function shouldCloseOnBackdropMouseDown(target, currentTarget) {
  return target === currentTarget;
}

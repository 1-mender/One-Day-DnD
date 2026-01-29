import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export function useQueryState(key, def = "") {
  const [sp, setSp] = useSearchParams();

  const value = useMemo(() => sp.get(key) ?? def, [sp, key, def]);

  const setValue = (next, { replace = true } = {}) => {
    const nsp = new URLSearchParams(sp);
    const v = String(next ?? "");
    if (!v || v === def) nsp.delete(key);
    else nsp.set(key, v);
    setSp(nsp, { replace });
  };

  return [value, setValue];
}

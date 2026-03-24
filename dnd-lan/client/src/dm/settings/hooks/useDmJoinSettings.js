import { useCallback, useState } from "react";
export function useDmJoinSettings() {
  const [joinEnabled, setJoinEnabled] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  const hydrateJoinSettings = useCallback((joinSettings) => {
    setJoinEnabled(!!joinSettings?.enabled);
    setJoinCode(joinSettings?.joinCode || "");
  }, []);

  return {
    joinEnabled,
    setJoinEnabled,
    joinCode,
    setJoinCode,
    showJoin,
    setShowJoin,
    hydrateJoinSettings
  };
}

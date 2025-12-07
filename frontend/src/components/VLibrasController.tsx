import { useState, useEffect } from "react";
// @ts-ignore
import VLibras from "vlibras-react";

export const VLibrasController = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const vlibrasState = localStorage.getItem("vlibrasEnabled") === "true";
    setEnabled(vlibrasState);
  }, []);

  return enabled ? <VLibras forceOnload={true} /> : null;
};

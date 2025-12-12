import { useEffect, useState } from "react";

export const VLibrasController = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      const vlibrasState = localStorage.getItem("vlibrasEnabled") === "true";
      setEnabled(vlibrasState);
    } catch {
      setEnabled(false);
    }
  }, []);

  useEffect(() => {
    // Control VLibras visibility via display property
    const vlibrasContainer = document.querySelector('[vw]') as HTMLElement;
    if (vlibrasContainer) {
      vlibrasContainer.style.display = enabled ? 'block' : 'none';
    }
  }, [enabled]);

  // VLibras widget is now in index.html, this component only controls visibility
  return null;
};

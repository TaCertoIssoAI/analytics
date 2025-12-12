import { useEffect, useState } from "react";

export const VLibrasController = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Initial state from localStorage
    try {
      const vlibrasState = localStorage.getItem("vlibrasEnabled") === "true";
      setEnabled(vlibrasState);
    } catch {
      setEnabled(false);
    }

    // Listen for changes in localStorage (from Header toggle)
    const handleStorageChange = () => {
      try {
        const vlibrasState = localStorage.getItem("vlibrasEnabled") === "true";
        setEnabled(vlibrasState);
      } catch {
        setEnabled(false);
      }
    };

    // Custom event listener for same-page localStorage changes
    window.addEventListener('vlibras-toggle', handleStorageChange);
    
    return () => {
      window.removeEventListener('vlibras-toggle', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    // Control VLibras visibility via display property
    const vlibrasContainer = document.querySelector('[vw]') as HTMLElement;
    if (vlibrasContainer) {
      if (enabled) {
        vlibrasContainer.style.setProperty('display', 'block', 'important');
      } else {
        vlibrasContainer.style.setProperty('display', 'none', 'important');
      }
    }
  }, [enabled]);

  // VLibras widget is now in index.html, this component only controls visibility
  return null;
};

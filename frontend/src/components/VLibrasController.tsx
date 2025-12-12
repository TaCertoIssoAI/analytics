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
    if (enabled) {
      const w = window as any;

      const scriptSrc = "https://vlibras.gov.br/app/vlibras-plugin.js";
      
      if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
        const script = document.createElement("script");
        script.src = scriptSrc;
        script.async = true;
        script.onload = () => {
          if (!w.__vlibrasWidgetInitialized && w.VLibras) {
            w.__vlibrasWidgetInitialized = true;
            new w.VLibras.Widget("https://vlibras.gov.br/app");
          }
        };
        document.body.appendChild(script);
      } else {
        if (!w.__vlibrasWidgetInitialized && w.VLibras) {
          w.__vlibrasWidgetInitialized = true;
          new w.VLibras.Widget("https://vlibras.gov.br/app");
        }
      }
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    // @ts-ignore
    <div vw="true" className="enabled">
      <div vw-access-button="true" className="active"></div>
      <div vw-plugin-wrapper="true">
        <div className="vw-plugin-top-wrapper"></div>
      </div>
    </div>
  );
};

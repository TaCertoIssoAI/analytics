import { useEffect, useState } from "react";

export const VLibrasController = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const vlibrasState = localStorage.getItem("vlibrasEnabled") === "true";
    setEnabled(vlibrasState);
  }, []);

  useEffect(() => {
    if (enabled) {
      const scriptSrc = "https://vlibras.gov.br/app/vlibras-plugin.js";
      
      if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
        const script = document.createElement("script");
        script.src = scriptSrc;
        script.async = true;
        script.onload = () => {
          // @ts-ignore
          if (window.VLibras) {
            // @ts-ignore
            new window.VLibras.Widget('https://vlibras.gov.br/app');
          }
        };
        document.body.appendChild(script);
      } else {
        // @ts-ignore
        if (window.VLibras) {
          // @ts-ignore
          new window.VLibras.Widget('https://vlibras.gov.br/app');
        }
      }
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    // @ts-ignore
    <div vw="true">
      <div vw-access-button="true" className="active"></div>
      <div vw-plugin-wrapper="true">
        <div className="vw-plugin-top-wrapper"></div>
      </div>
    </div>
  );
};

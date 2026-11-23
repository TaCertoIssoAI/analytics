import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { IS_MOCK_MODE } from "./mocks/config";
import { installMockFetch } from "./mocks/mockApi";

if (IS_MOCK_MODE) {
  installMockFetch();
}

createRoot(document.getElementById("root")!).render(<App />);

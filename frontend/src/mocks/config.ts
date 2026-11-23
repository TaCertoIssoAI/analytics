/**
 * Configuration for the offline / static-data mock mode.
 *
 * Enabled by default so both local preview and Netlify deploys work with
 * the exported historical dataset without requiring the backend API or
 * Firebase Auth. Set `VITE_USE_MOCK_API=false` to reconnect to a live backend.
 */
export const IS_MOCK_MODE = import.meta.env.VITE_USE_MOCK_API !== "false";

export const MOCK_API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

/**
 * Simulates a brief, realistic API round-trip latency so loading skeletons
 * and transitions behave naturally while keeping the UI snappy.
 */
export const simulateNetworkDelay = (minMs = 90, maxMs = 210): Promise<void> => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const previewOrigin = process.env.ROOTLANE_PREVIEW_ORIGIN;
const previewHost = previewOrigin ? new URL(previewOrigin).hostname : undefined;
if (previewHost?.startsWith(".") || previewHost?.includes("*")) {
  throw new Error("Rootlane preview origin must use one exact hostname.");
}
export default defineConfig({
  define: { __RALLY_TEST_HARNESS__: JSON.stringify(process.env.VITE_RALLY_TEST_HARNESS === "1") },
  plugins: [react(), tailwindcss(), {
    name: "rally-public-boundary",
    generateBundle() {
      for (const id of this.getModuleIds()) {
        if (id.includes("/design/scenario/") || id.includes("/tests/fixtures/")) this.error("Private scenario/test data must not enter the browser module graph: " + id);
      }
    },
  }],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  preview: { allowedHosts: previewHost ? [previewHost] : undefined },
});

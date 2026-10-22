import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const previewOrigin = process.env.ROOTLANE_PREVIEW_ORIGIN;
const previewHost = previewOrigin ? new URL(previewOrigin).hostname : undefined;
if (previewHost?.startsWith(".") || previewHost?.includes("*")) {
  throw new Error("Rootlane preview origin must use one exact hostname.");
}
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  preview: { allowedHosts: previewHost ? [previewHost] : undefined },
});

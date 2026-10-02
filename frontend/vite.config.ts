import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The path part of the public address (https://example.org/openpip -> /openpip/),
// so a deployment's PUBLIC_URL alone decides where the app is served.
function basePath(publicUrl?: string): string {
  if (!publicUrl) return "/";
  const path = new URL(publicUrl).pathname.replace(/\/+$/, "");
  return `${path}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE ?? basePath(env.PUBLIC_URL),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // Mol* ships skin CSS only in build/viewer; map the non-existent lib path
        // so that dynamic import('molstar/lib/mol-plugin-ui/skin/light.css') resolves
        // in test (and dev) without crashing vite:import-analysis.
        "molstar/lib/mol-plugin-ui/skin/light.css":
          "molstar/build/viewer/theme/light.css",
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: "http://localhost:8001", changeOrigin: true },
        "/media": { target: "http://localhost:8001", changeOrigin: true },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});

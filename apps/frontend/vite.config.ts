import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const proxyTarget = env.API_PROXY_TARGET || "http://localhost:4000";

  return {
    envDir: repoRoot,
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/v1": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});

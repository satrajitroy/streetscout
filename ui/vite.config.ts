import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const BACKEND = env.VITE_BACKEND_URL || "http://localhost:8080";
    const DISC_PREFIX = env.VITE_DISCOVERY_PREFIX || "/api";
    const OPENAPI_PATH = env.VITE_OPENAPI_PATH || "/api.json";

    return {
        plugins: [react()],
        server: {
            proxy: {
                // proxy all your API calls (both backends live under /api)
                [DISC_PREFIX]: { target: BACKEND, changeOrigin: true },

                // proxy the OpenAPI endpoint (works for Ktor or Spring)
                [OPENAPI_PATH]: { target: BACKEND, changeOrigin: true },

                // OPTIONAL: if you want to always request '/openapi.json' in the UI,
                // uncomment this block to rewrite Spring to /v3/api-docs:
                // "/openapi.json": {
                //   target: BACKEND,
                //   changeOrigin: true,
                //   rewrite: () => "/v3/api-docs",
                // },
            },
        },
    };
});
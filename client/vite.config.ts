import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const clientRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const useMock = process.env.VITE_USE_MOCK === "true";

  return {
    root: clientRoot,
    plugins: [react()],
    base: "/app/",
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    // Expose VITE_USE_MOCK to client code via import.meta.env
    define: {
      // Also expose as a boolean global for tree-shaking in production builds
      __USE_MOCK__: JSON.stringify(useMock),
    },
    // In mock mode, print a clear reminder in the terminal
    ...(useMock && mode === "development"
      ? {
          server: {
            host: "127.0.0.1",
            // No proxy — mock fetch intercepts at the browser level
          },
        }
      : {
          server: {
            host: "127.0.0.1",
            // In live dev mode you can optionally proxy to your deployed function.
            // Uncomment and set your Catalyst URL to run against real live data:
            // proxy: {
            //   "/server": "https://your-app.catalystserverless.com",
            // },
          },
        }),
  };
});

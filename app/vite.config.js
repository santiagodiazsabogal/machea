import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En GitHub Codespaces la app se abre en una URL https://...app.github.dev:
// hay que escuchar en todas las interfaces, permitir ese host y mandar el HMR por el puerto 443.
const enCodespaces = !!process.env.CODESPACES;

export default defineConfig({
  plugins: [react()],
  define: { global: "globalThis" },
  server: enCodespaces ? { host: true, allowedHosts: true, hmr: { clientPort: 443 } } : {},
});

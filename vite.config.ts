import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Makes every company's storefront installable ("adicionar à tela inicial")
// so a link shared on WhatsApp opens fast, full-screen, and app-like — the
// real, buildable equivalent of "abrir no próprio app" for a web link (there
// is no way to force a link to open inside a native app that doesn't exist).
// One shared manifest/identity for now; a distinct installable identity per
// company would need a server-rendered per-slug manifest, out of scope for v1.
const pwaPlugin = VitePWA({
  registerType: "autoUpdate",
  includeAssets: ["icon.svg"],
  manifest: {
    name: "Marmitaria Flow",
    short_name: "Marmitaria",
    description: "Peça sua marmita favorita direto pelo app.",
    theme_color: "#2f5d50",
    background_color: "#fbfaf7",
    display: "standalone",
    start_url: "/",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  },
  workbox: {
    // Never cache API/tRPC calls — menus, orders and payment status must always be fresh.
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [{ urlPattern: /^\/api\//, handler: "NetworkOnly" }],
  },
});

const plugins = [react(), tailwindcss(), jsxLocPlugin(), pwaPlugin];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
  },
});

import { defineConfig } from "vite";
import { resolve } from "path";

/** Build do site (mesmo código do módulo sobre o shim). `npm run build:site`. */
export default defineConfig({
  root: resolve(__dirname, "site"),
  base: "/criar/",
  publicDir: false,
  build: {
    outDir: resolve(__dirname, "site/dist"),
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
  },
});

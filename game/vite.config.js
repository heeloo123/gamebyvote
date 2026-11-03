// Builds the game into ../play/ (plain static files, served by GitHub Pages next to the home page).
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: '../play', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import counterConfig from './counter/public-config.json';
import { fileURLToPath } from 'node:url';

// GitHub Pages project site: https://<user>.github.io/<repo>/
// Đổi REPO_NAME cho khớp tên repo của bạn (giữ credit/API của nagisanzenin).
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'toinayxemgi';
const base = `/${REPO_NAME}/`;

export default defineConfig({
  base,
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  define: {
    'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify(base.replace(/\/$/, '') || ''),
    // Giữ counter API của tác giả gốc (truanayangi).
    'process.env.NEXT_PUBLIC_COUNTER_API_URL': JSON.stringify(
      process.env.NEXT_PUBLIC_COUNTER_API_URL || counterConfig.apiUrl,
    ),
  },
  build: { outDir: 'dist-pages', emptyOutDir: true },
});

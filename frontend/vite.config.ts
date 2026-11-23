import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Country flags (flag-icons, MW_003 B1) stay separate files: inlined as data URIs, the
    // ~270 small SVGs would make one 400 kB stylesheet. As files, only the flags shown load.
    assetsInlineLimit: (file) => (file.includes('flag-icons') ? false : undefined),
  },
});

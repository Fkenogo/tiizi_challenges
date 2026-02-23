import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
          return 'vendor-misc';
        },
      },
    },
  },
});

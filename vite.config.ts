/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const founderPreview = process.env.TIIZI_FOUNDER_PREVIEW === '1';

export default defineConfig({
  plugins: [
    react(),
    ...(founderPreview ? [{
      name: 'tiizi-founder-preview-local-assets',
      transformIndexHtml(html: string) {
        const withoutRemoteFonts = html.replace(/\s*<link[^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>/g, '');
        return withoutRemoteFonts.replace('</body>', '<div style="position:fixed;left:82px;top:13px;z-index:2147483647;border-radius:999px;background:#172033;color:white;padding:4px 7px;font:600 10px system-ui;box-shadow:0 2px 8px #0003;pointer-events:none">Founder Preview · local development</div></body>');
      },
    }] : []),
  ],
  server: founderPreview ? {
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: process.env.TIIZI_FOUNDER_API_TARGET ?? 'http://127.0.0.1:4019',
        changeOrigin: false,
      },
    },
  } : undefined,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // TIIZI-FER-P5T-2-S3B: DOM tests (Vitest + jsdom + React Testing Library). Run by
  // `npm run test:v2-dom`; they are never part of the production bundle.
  test: {
    environment: 'jsdom',
    setupFiles: ['src/testSetup.ts'],
    alias: [{ find: /^.*\/lib\/firebaseAuth$/, replacement: fileURLToPath(new URL('./src/testStubs/authTransportStub.ts', import.meta.url)) }],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    unstubEnvs: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@firebase/')) return 'vendor-firebase-internal';
          if (id.includes('firebase/auth')) return 'vendor-firebase-auth';
          if (id.includes('firebase/firestore')) return 'vendor-firebase-firestore';
          if (id.includes('firebase/storage')) return 'vendor-firebase-storage';
          if (id.includes('firebase/app')) return 'vendor-firebase-core';
          if (id.includes('firebase')) return 'vendor-firebase-misc';
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

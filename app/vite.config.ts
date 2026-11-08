import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      // The page's own fonts are small and always needed. Fetching them straight away (rather than after
      // the stylesheet is read) means text is drawn in the right font the first time, so it does not
      // change width a moment later. Only the Latin letters, which almost every student needs.
      name: 'preload-main-fonts',
      transformIndexHtml(_html, ctx) {
        if (!ctx.bundle) return;
        return Object.keys(ctx.bundle)
          .filter((file) => /(inter|bricolage-grotesque)-latin-wght-normal.*\.woff2$/.test(file))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `/${file}` },
            injectTo: 'head' as const
          }));
      }
    }
  ],
  test: {
    exclude: ['node_modules/**', 'rules-tests/**', 'e2e/**', 'e2e-prod/**']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('firebase')) {
            return 'vendor-firebase';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
        }
      }
    }
  }
});

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Files bigger than this are not saved at install (they are saved the first time they are used), so installing stays a small download.
const PRECACHE_MAX_BYTES = 400_000;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      // Writes /sw.js (template: src/pwa/sw.template.js) with the list of built files, so the app can open with no connection.
      // The version comes from the file names (which carry a content hash), so any change to the app makes a new version.
      name: 'service-worker',
      apply: 'build',
      generateBundle(_options, bundle) {
        // Whatever the page needs just to start (the entry file and everything it imports straight away) is always saved, however big;
        // a big file that is only loaded later (for example Word export) is saved the first time it is used.
        const needed = new Set<string>();
        const visit = (name: string) => {
          if (needed.has(name)) return;
          needed.add(name);
          const chunk = bundle[name];
          if (chunk && chunk.type === 'chunk') chunk.imports.forEach(visit);
        };
        Object.values(bundle).forEach((f) => f.type === 'chunk' && f.isEntry && visit(f.fileName));
        const files = Object.values(bundle)
          .filter((f) => f.fileName.startsWith('assets/') && !f.fileName.endsWith('.map'))
          .filter((f) => needed.has(f.fileName) || /^assets\/vendor-/.test(f.fileName) || (f.type === 'chunk' ? f.code.length : f.source.length) <= PRECACHE_MAX_BYTES)
          .map((f) => `/${f.fileName}`)
          .sort();
        const version = createHash('sha1').update(files.join('|')).digest('hex').slice(0, 10);
        const template = readFileSync(fileURLToPath(new URL('./src/pwa/sw.template.js', import.meta.url)), 'utf8');
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(['/index.html', ...files]))
        });
      }
    },
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

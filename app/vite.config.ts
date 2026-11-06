import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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

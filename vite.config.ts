import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: 'src/background.ts',
        content_marketplace: 'src/content_marketplace.ts',
        content_notifications: 'src/content_notifications.ts',
        popup: 'src/popup.ts',
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
    target: 'es2020',
  },
});

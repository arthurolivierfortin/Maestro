import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

// Check if we should skip Electron (for web-only builds)
const isElectronDisabled = process.env.ELECTRON_DISABLE === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Only include Electron plugins if not disabled
    ...(!isElectronDisabled
      ? [
          electron([
            {
              // Main process entry point
              entry: 'electron/main.ts',
              vite: {
                build: {
                  outDir: 'dist-electron',
                  rollupOptions: {
                    external: ['electron', 'electron-updater'],
                    output: {
                      format: 'cjs',
                    },
                  },
                },
              },
            },
            {
              // Preload script entry point
              entry: 'electron/preload.ts',
              vite: {
                build: {
                  outDir: 'dist-electron',
                  rollupOptions: {
                    external: ['electron'],
                    output: {
                      format: 'cjs',
                    },
                  },
                },
              },
              onstart(options) {
                // Notify the renderer process that preload has been rebuilt
                options.reload();
              },
            },
          ]),
          // Enable Node.js API in the renderer process
          renderer(),
        ]
      : []),
  ],
  server: {
    port: 5173,
    open: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@store': path.resolve(__dirname, './src/store'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@electron': path.resolve(__dirname, './src/electron'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['zustand', 'axios'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  // Ensure proper handling of Node.js globals in renderer
  define: {
    'process.env.IS_ELECTRON': JSON.stringify(!isElectronDisabled),
  },
});

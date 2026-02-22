import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@maestro/client': path.resolve(__dirname, '../maestro-client/index.ts'),
    },
  },
});

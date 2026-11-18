import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tasks',
    setupFiles: ['./test/network-guard.ts'],
  },
});

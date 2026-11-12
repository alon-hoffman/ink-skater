import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    testTimeout: 30_000,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      reporter: ['text', 'html'],
      // Guards and domain logic are pure; keep them thoroughly covered.
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/index.ts',
        'src/ui.ts',
        'src/tui/App.tsx',
        'src/tui/start.tsx',
        'src/tui/agentRunner.ts',
        'src/tui/components/**',
      ],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80 },
    },
  },
});

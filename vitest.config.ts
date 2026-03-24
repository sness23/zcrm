import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Exclude Playwright test files (*.spec.ts) from vitest
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.spec.ts', // Playwright tests
      '**/analytics/**', // Playwright tests
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/types/**',
        'cli-app/**',
        'table-app/**', 
        'view-app/**',
        'vault/**',
        '**/*.d.ts',
        '**/node_modules/**'
      ]
    }
  }
})

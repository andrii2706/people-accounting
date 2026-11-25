import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // throwaway keys and a test configuration — no real secrets, no real database (see test/fake-db.ts)
    setupFiles: ['test/setup-env.ts'],
    coverage: {
      provider: 'v8',
      // every source file counts, also the ones no test imports — the report shows what is not tested at all
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        // wiring and entry points: no logic to test
        'src/main.ts',
        'src/**/*.module.ts',
        'src/database/migrations/**',
        'src/database/entities.ts',
        // command-line scripts run by hand (seed, password reset, billing jobs)
        'src/database/seed*.ts',
        'src/database/reset-password.ts',
        'src/jobs/**',
        // type declarations
        'src/shared/interfaces/**',
        'src/platform/contracts/**',
      ],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // the floor: a change that drops the coverage below it fails `npm run test:cov`
      thresholds: { lines: 85, statements: 83, functions: 80, branches: 70 },
    },
  },
});

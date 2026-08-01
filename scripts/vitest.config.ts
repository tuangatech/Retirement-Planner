/// <reference types="vitest/config" />
// Separate Vitest config for one-off scripts in this folder (e.g.
// scenario-tax-comparison.test.ts), kept out of the main app's `test.include` glob
// (vite.config.ts) so `npm test` doesn't run them as part of the engine's test suite.
//
// Run with: npx vitest run -c scripts/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '../src'),
        },
    },
    test: {
        environment: 'node',
        include: ['scripts/**/*.{test,spec}.ts'],
    },
});

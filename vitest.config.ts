import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
    },
    server: {
        watch: {
            ignored: ['**/node_modules/**', '**/dist/**'],
        },
    },
})

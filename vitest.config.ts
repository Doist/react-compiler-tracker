import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['src/**/*.test.{ts,mts}'],
    },
    server: {
        watch: {
            ignored: ['**/node_modules/**', '**/dist/**'],
        },
    },
})

import { glob } from 'glob'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAll } from './source-files.mjs'

vi.mock('glob', () => ({
    glob: {
        sync: vi.fn(),
    },
}))

afterEach(() => {
    vi.clearAllMocks()
})

describe('getAll', () => {
    it('returns files matching the glob pattern', () => {
        vi.mocked(glob.sync).mockReturnValue(['src/index.ts', 'src/app.tsx', 'src/utils.js'])

        const result = getAll({ globPattern: 'src/**/*.{js,jsx,ts,tsx}' })

        expect(result).toEqual(['src/index.ts', 'src/app.tsx', 'src/utils.js'])
        expect(glob.sync).toHaveBeenCalledWith('src/**/*.{js,jsx,ts,tsx}', {
            cwd: process.cwd(),
            absolute: false,
        })
    })

    it('returns empty array when no files match', () => {
        vi.mocked(glob.sync).mockReturnValue([])

        const result = getAll({ globPattern: 'nonexistent/**/*.ts' })

        expect(result).toEqual([])
    })
})

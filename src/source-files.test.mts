import { execSync } from 'node:child_process'
import { glob } from 'glob'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAll, normalizeFilePaths } from './source-files.mjs'

vi.mock('node:child_process', () => ({
    execSync: vi.fn(),
}))

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

describe('normalizeFilePaths', () => {
    it('strips prefix from matching paths', () => {
        vi.mocked(execSync).mockReturnValue('apps/frontend/\n')

        const result = normalizeFilePaths([
            'apps/frontend/src/App.tsx',
            'apps/frontend/src/utils/helper.ts',
        ])

        expect(result).toEqual(['src/App.tsx', 'src/utils/helper.ts'])
    })

    it('leaves non-matching paths unchanged', () => {
        vi.mocked(execSync).mockReturnValue('apps/frontend/\n')

        const result = normalizeFilePaths(['src/App.tsx', 'src/utils/helper.ts'])

        expect(result).toEqual(['src/App.tsx', 'src/utils/helper.ts'])
    })

    it('handles mixed paths (some matching, some not)', () => {
        vi.mocked(execSync).mockReturnValue('apps/frontend/\n')

        const result = normalizeFilePaths([
            'apps/frontend/src/App.tsx',
            'src/local.ts',
            'apps/frontend/index.ts',
        ])

        expect(result).toEqual(['src/App.tsx', 'src/local.ts', 'index.ts'])
    })

    it('returns paths unchanged when at git root', () => {
        vi.mocked(execSync).mockReturnValue('\n')

        const result = normalizeFilePaths(['src/App.tsx', 'src/utils/helper.ts'])

        expect(result).toEqual(['src/App.tsx', 'src/utils/helper.ts'])
    })

    it('returns paths unchanged when not in a git repo', () => {
        vi.mocked(execSync).mockImplementation(() => {
            throw new Error('fatal: not a git repository')
        })

        const result = normalizeFilePaths(['src/App.tsx', 'src/utils/helper.ts'])

        expect(result).toEqual(['src/App.tsx', 'src/utils/helper.ts'])
    })

    it('handles empty file list', () => {
        vi.mocked(execSync).mockReturnValue('apps/frontend/\n')

        const result = normalizeFilePaths([])

        expect(result).toEqual([])
    })

    it('converts absolute paths to cwd-relative paths', () => {
        vi.mocked(execSync).mockReturnValue('\n')
        const cwd = process.cwd()

        const result = normalizeFilePaths([`${cwd}/src/App.tsx`, `${cwd}/src/utils/helper.ts`])

        expect(result).toEqual(['src/App.tsx', 'src/utils/helper.ts'])
    })

    it('handles absolute paths outside cwd with ../', () => {
        vi.mocked(execSync).mockReturnValue('\n')

        const result = normalizeFilePaths(['/other/project/file.tsx'])

        expect(result[0]).toMatch(/^\.\.\//)
    })

    it('handles mixed absolute and relative paths', () => {
        vi.mocked(execSync).mockReturnValue('\n')
        const cwd = process.cwd()

        const result = normalizeFilePaths([`${cwd}/src/App.tsx`, 'src/local.ts'])

        expect(result).toEqual(['src/App.tsx', 'src/local.ts'])
    })
})

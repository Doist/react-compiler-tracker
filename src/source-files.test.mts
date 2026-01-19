import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { glob } from 'glob'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { filterByGlob, getAll, normalizeFilePaths, validateFilesExist } from './source-files.mjs'

vi.mock('node:child_process', () => ({
    execSync: vi.fn(),
}))

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
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

    it('unescapes shell-escaped $ characters', () => {
        vi.mocked(execSync).mockReturnValue('\n')

        const result = normalizeFilePaths(['src/route.\\$id.tsx', 'src/draft.\\$slug.tsx'])

        expect(result).toEqual(['src/route.$id.tsx', 'src/draft.$slug.tsx'])
    })

    it('unescapes shell-escaped spaces', () => {
        vi.mocked(execSync).mockReturnValue('\n')

        const result = normalizeFilePaths(['src/file\\ with\\ spaces.tsx'])

        expect(result).toEqual(['src/file with spaces.tsx'])
    })

    it('unescapes multiple different escape characters', () => {
        vi.mocked(execSync).mockReturnValue('\n')

        const result = normalizeFilePaths(['src/route.\\$id\\ (copy).tsx'])

        expect(result).toEqual(['src/route.$id (copy).tsx'])
    })

    it('handles paths with no escapes unchanged', () => {
        vi.mocked(execSync).mockReturnValue('\n')

        const result = normalizeFilePaths(['src/normal-file.tsx'])

        expect(result).toEqual(['src/normal-file.tsx'])
    })

    it('unescapes before stripping prefix', () => {
        vi.mocked(execSync).mockReturnValue('apps/frontend/\n')

        const result = normalizeFilePaths(['apps/frontend/src/route.\\$id.tsx'])

        expect(result).toEqual(['src/route.$id.tsx'])
    })
})

describe('filterByGlob', () => {
    it('filters paths matching the glob pattern', () => {
        const result = filterByGlob({
            filePaths: ['src/App.tsx', 'src/utils.ts', 'package.json', 'README.md'],
            globPattern: 'src/**/*.{ts,tsx}',
        })

        expect(result).toEqual(['src/App.tsx', 'src/utils.ts'])
    })

    it('returns empty array when no paths match', () => {
        const result = filterByGlob({
            filePaths: ['package.json', 'README.md'],
            globPattern: 'src/**/*.{ts,tsx}',
        })

        expect(result).toEqual([])
    })

    it('returns all paths when all match', () => {
        const result = filterByGlob({
            filePaths: ['src/a.ts', 'src/b.tsx'],
            globPattern: 'src/**/*.{ts,tsx}',
        })

        expect(result).toEqual(['src/a.ts', 'src/b.tsx'])
    })
})

describe('validateFilesExist', () => {
    it('throws error when file does not exist', () => {
        vi.mocked(existsSync).mockReturnValue(false)

        expect(() => validateFilesExist(['nonexistent.tsx'])).toThrow(
            'File not found: nonexistent.tsx',
        )
    })

    it('does not throw when all files exist', () => {
        vi.mocked(existsSync).mockReturnValue(true)

        expect(() => validateFilesExist(['exists.tsx'])).not.toThrow()
    })

    it('throws on first missing file', () => {
        vi.mocked(existsSync).mockImplementation((path) => path === 'exists.tsx')

        expect(() => validateFilesExist(['exists.tsx', 'missing.tsx'])).toThrow(
            'File not found: missing.tsx',
        )
    })
})

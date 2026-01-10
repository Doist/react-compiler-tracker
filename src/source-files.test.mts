import { execSync } from 'node:child_process'
import { glob } from 'glob'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { filterSupportedFiles, getAll, getStagedFromGit } from './source-files.mjs'

vi.mock('glob', () => ({
    glob: {
        sync: vi.fn(),
    },
}))

vi.mock('node:child_process', () => ({
    execSync: vi.fn(),
}))

afterEach(() => {
    vi.clearAllMocks()
})

describe('filterSupportedFiles', () => {
    const supportedFileExtensions = ['js', 'jsx', 'ts', 'tsx']

    it('filters files by supported extensions', () => {
        const filePaths = [
            'src/index.ts',
            'src/app.tsx',
            'src/utils.js',
            'src/styles.module.css',
            'README.md',
            'src/fixture.json',
            'Makefile',
        ]

        const result = filterSupportedFiles({ filePaths, supportedFileExtensions })

        expect(result).toEqual(['src/index.ts', 'src/app.tsx', 'src/utils.js'])
    })

    it('handles empty file list', () => {
        const result = filterSupportedFiles({ filePaths: [], supportedFileExtensions })

        expect(result).toEqual([])
    })
})

describe('getAll', () => {
    const supportedFileExtensions = ['js', 'jsx', 'ts', 'tsx']

    it('returns results that match glob pattern and supported extensions', () => {
        vi.mocked(glob.sync).mockReturnValue([
            'src/index.ts',
            'src/app.tsx',
            'src/utils.js',
            'src/styles.module.css',
            'README.md',
            'src/fixture.json',
            'Makefile',
        ])

        const result = getAll({ globPattern: 'src/**/*', supportedFileExtensions })

        expect(result).toEqual(['src/index.ts', 'src/app.tsx', 'src/utils.js'])
        expect(glob.sync).toHaveBeenCalledWith('src/**/*', {
            cwd: process.cwd(),
            absolute: false,
        })
    })
})

describe('getStagedFromGit', () => {
    const supportedFileExtensions = ['js', 'jsx', 'ts', 'tsx']

    it('returns staged files that match glob pattern and supported extensions', () => {
        vi.mocked(glob.sync).mockReturnValue([
            'src/index.ts',
            'src/app.tsx',
            'src/utils.js',
            'src/styles.module.css',
            'README.md',
            'src/fixture.json',
            'Makefile',
        ])
        vi.mocked(execSync).mockReturnValue(
            'eslint.config.ts\nsrc/index.ts\nsrc/app.tsx\nsrc/styles.module.css\nsrc/fixture.json\nMakefile',
        )

        const result = getStagedFromGit({ globPattern: 'src/**/*', supportedFileExtensions })

        expect(result).toEqual(['src/index.ts', 'src/app.tsx'])
    })

    it('returns empty array when no files are staged', () => {
        vi.mocked(glob.sync).mockReturnValue(['src/index.ts'])
        vi.mocked(execSync).mockReturnValue('')

        const result = getStagedFromGit({ globPattern: 'src/**/*', supportedFileExtensions })

        expect(result).toEqual([])
    })

    it('returns empty array when git command fails', () => {
        vi.mocked(glob.sync).mockReturnValue(['src/index.ts'])
        vi.mocked(execSync).mockImplementation(() => {
            throw new Error('git error')
        })

        const result = getStagedFromGit({ globPattern: 'src/**/*', supportedFileExtensions })

        expect(result).toEqual([])
    })
})

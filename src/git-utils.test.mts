import { execSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeFilePaths } from './git-utils.mjs'

vi.mock('node:child_process', () => ({
    execSync: vi.fn(),
}))

afterEach(() => {
    vi.clearAllMocks()
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
})

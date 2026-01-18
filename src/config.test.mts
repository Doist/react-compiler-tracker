import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG, loadConfig } from './config.mjs'

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}))

afterEach(() => {
    vi.clearAllMocks()
})

describe('loadConfig', () => {
    it('returns defaults when no config file exists', () => {
        vi.mocked(existsSync).mockReturnValue(false)

        const result = loadConfig()

        expect(result).toEqual(DEFAULT_CONFIG)
    })

    it('loads and merges user config correctly', () => {
        vi.mocked(existsSync).mockReturnValue(true)
        vi.mocked(readFileSync).mockReturnValue(
            JSON.stringify({
                recordsFile: 'custom-records.json',
                sourceGlob: 'app/**/*.{ts,tsx}',
            }),
        )

        const result = loadConfig()

        expect(result).toEqual({
            recordsFile: 'custom-records.json',
            sourceGlob: 'app/**/*.{ts,tsx}',
        })
    })

    it('handles partial config (only some fields specified)', () => {
        vi.mocked(existsSync).mockReturnValue(true)
        vi.mocked(readFileSync).mockReturnValue(
            JSON.stringify({
                sourceGlob: 'packages/frontend/**/*.tsx',
            }),
        )

        const result = loadConfig()

        expect(result).toEqual({
            recordsFile: DEFAULT_CONFIG.recordsFile,
            sourceGlob: 'packages/frontend/**/*.tsx',
        })
    })

    it('throws when config file is invalid JSON', () => {
        vi.mocked(existsSync).mockReturnValue(true)
        // Trailing comma - a common mistake when editing JSON by hand
        vi.mocked(readFileSync).mockReturnValue(`{
            "recordsFile": ".react-compiler.rec.json",
        }`)

        expect(() => loadConfig()).toThrow('Failed to parse config')
    })

    it('throws when config has invalid field types', () => {
        vi.mocked(existsSync).mockReturnValue(true)
        vi.mocked(readFileSync).mockReturnValue(
            JSON.stringify({
                recordsFile: { path: '.react-compiler.rec.json' },
            }),
        )

        expect(() => loadConfig()).toThrow('Invalid config file')
    })

    it('throws when config file contains an array instead of object', () => {
        vi.mocked(existsSync).mockReturnValue(true)
        vi.mocked(readFileSync).mockReturnValue(JSON.stringify([{ recordsFile: 'records.json' }]))

        expect(() => loadConfig()).toThrow('Invalid config file')
    })
})

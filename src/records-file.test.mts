import { afterEach, describe, expect, it, vi } from 'vitest'
import { getErrorIncreases, load, save } from './records-file.mjs'

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
}))

vi.mock('./react-compiler.mjs', () => ({
    getVersion: vi.fn(() => '1.0.0'),
}))

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

afterEach(() => {
    vi.clearAllMocks()
})

describe('getErrorIncreases', () => {
    it('returns empty object when no errors in either records', () => {
        const result = getErrorIncreases({
            filePaths: ['src/index.ts'],
            existingRecords: {},
            newRecords: {},
        })

        expect(result).toEqual({})
    })

    it('returns empty object when new errors are less than or equal to existing', () => {
        const result = getErrorIncreases({
            filePaths: ['src/index.ts'],
            existingRecords: {
                'src/index.ts': { CompileError: 2 },
            },
            newRecords: {
                'src/index.ts': { CompileError: 1 },
            },
        })

        expect(result).toEqual({})
    })

    it('detects increased errors for a file', () => {
        const result = getErrorIncreases({
            filePaths: ['src/index.ts'],
            existingRecords: {
                'src/index.ts': { CompileError: 1 },
            },
            newRecords: {
                'src/index.ts': { CompileError: 3 },
            },
        })

        expect(result).toEqual({ 'src/index.ts': 2 })
    })

    it('detects new errors for a file with no previous records', () => {
        const result = getErrorIncreases({
            filePaths: ['src/index.ts'],
            existingRecords: {},
            newRecords: {
                'src/index.ts': { CompileError: 2 },
            },
        })

        expect(result).toEqual({ 'src/index.ts': 2 })
    })

    it('sums all error types when comparing', () => {
        const result = getErrorIncreases({
            filePaths: ['src/index.ts'],
            existingRecords: {
                'src/index.ts': { CompileError: 1, CompileSkip: 1 },
            },
            newRecords: {
                'src/index.ts': { CompileError: 2, CompileSkip: 2, PipelineError: 1 },
            },
        })

        expect(result).toEqual({ 'src/index.ts': 3 })
    })

    it('only checks files in the provided filePaths', () => {
        const result = getErrorIncreases({
            filePaths: ['src/index.ts'],
            existingRecords: {
                'src/other.ts': { CompileError: 0 },
            },
            newRecords: {
                'src/other.ts': { CompileError: 5 },
            },
        })

        expect(result).toEqual({})
    })
})

describe('load', () => {
    it('returns null when file does not exist', () => {
        vi.mocked(existsSync).mockReturnValue(false)

        const result = load('/path/to/records.json')

        expect(result).toBeNull()
        expect(existsSync).toHaveBeenCalledWith('/path/to/records.json')
    })

    it('returns parsed records when file exists and is valid JSON', () => {
        const records = {
            recordVersion: 1,
            'react-compiler-version': '1.0.0',
            files: { 'src/index.ts': { CompileError: 1 } },
        }
        vi.mocked(existsSync).mockReturnValue(true)
        vi.mocked(readFileSync).mockReturnValue(JSON.stringify(records))

        const result = load('/path/to/records.json')

        expect(result).toEqual(records)
        expect(readFileSync).toHaveBeenCalledWith('/path/to/records.json', 'utf8')
    })

    it('returns null when file contains invalid JSON', () => {
        vi.mocked(existsSync).mockReturnValue(true)
        vi.mocked(readFileSync).mockReturnValue('not valid json')

        vi.stubGlobal('console', { warn: vi.fn(), log: console.log })

        const result = load('/path/to/records.json')

        vi.unstubAllGlobals()

        expect(result).toBeNull()
    })
})

describe('save', () => {
    it('writes records to file with sorted file paths', () => {
        save({
            filePaths: ['src/b.ts', 'src/a.ts'],
            recordsPath: '/path/to/records.json',
            compilerErrors: {
                'src/b.ts': { CompileError: 1 },
                'src/a.ts': { CompileError: 2 },
            },
            records: null,
        })

        expect(writeFileSync).toHaveBeenCalledWith(
            '/path/to/records.json',
            JSON.stringify(
                {
                    recordVersion: 1,
                    'react-compiler-version': '1.0.0',
                    files: {
                        'src/a.ts': { CompileError: 2 },
                        'src/b.ts': { CompileError: 1 },
                    },
                },
                null,
                2,
            ),
        )
    })

    it('removes files with no errors', () => {
        save({
            filePaths: ['src/index.ts'],
            recordsPath: '/path/to/records.json',
            compilerErrors: {
                'src/index.ts': { CompileError: 0 },
            },
            records: { 'src/index.ts': { CompileError: 1 } },
        })

        expect(writeFileSync).toHaveBeenCalledWith(
            '/path/to/records.json',
            JSON.stringify(
                {
                    recordVersion: 1,
                    'react-compiler-version': '1.0.0',
                    files: {},
                },
                null,
                2,
            ),
        )
    })

    it('preserves existing records for files not in filePaths', () => {
        save({
            filePaths: ['src/new.ts'],
            recordsPath: '/path/to/records.json',
            compilerErrors: {
                'src/new.ts': { CompileError: 1 },
            },
            records: { 'src/existing.ts': { CompileError: 2 } },
        })

        expect(writeFileSync).toHaveBeenCalledWith(
            '/path/to/records.json',
            JSON.stringify(
                {
                    recordVersion: 1,
                    'react-compiler-version': '1.0.0',
                    files: {
                        'src/existing.ts': { CompileError: 2 },
                        'src/new.ts': { CompileError: 1 },
                    },
                },
                null,
                2,
            ),
        )
    })
})

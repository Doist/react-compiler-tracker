import { describe, expect, it } from 'vitest'
import { parseArgs } from './args.mjs'

describe('parseArgs', () => {
    it('parses --check-files with files', () => {
        const result = parseArgs(['--check-files', 'file.ts'])
        expect(result).toEqual({
            command: 'check-files',
            filePaths: ['file.ts'],
            showErrors: false,
        })
    })

    it('parses --show-errors before command', () => {
        const result = parseArgs(['--show-errors', '--check-files', 'file.ts'])
        expect(result).toEqual({
            command: 'check-files',
            filePaths: ['file.ts'],
            showErrors: true,
        })
    })

    it('parses --show-errors after command', () => {
        const result = parseArgs(['--check-files', '--show-errors', 'file.ts'])
        expect(result.showErrors).toBe(true)
        expect(result.filePaths).toEqual(['file.ts'])
    })

    it('parses --show-errors at end', () => {
        const result = parseArgs(['--check-files', 'file.ts', '--show-errors'])
        expect(result.showErrors).toBe(true)
        expect(result.filePaths).toEqual(['file.ts'])
    })

    it('parses --overwrite with --show-errors', () => {
        const result = parseArgs(['--show-errors', '--overwrite'])
        expect(result.command).toBe('overwrite')
        expect(result.showErrors).toBe(true)
    })

    it('defaults to check-all when no command', () => {
        const result = parseArgs([])
        expect(result.command).toBe('check-all')
    })

    it('parses --stage-record-file with files', () => {
        const result = parseArgs(['--stage-record-file', 'file1.ts', 'file2.ts'])
        expect(result).toEqual({
            command: 'stage-record-file',
            filePaths: ['file1.ts', 'file2.ts'],
            showErrors: false,
        })
    })

    it('parses --overwrite without files', () => {
        const result = parseArgs(['--overwrite'])
        expect(result).toEqual({
            command: 'overwrite',
            filePaths: [],
            showErrors: false,
        })
    })

    it('treats unknown flags as check-all command', () => {
        const result = parseArgs(['--unknown-flag'])
        expect(result.command).toBe('check-all')
    })
})

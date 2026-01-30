import { execSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(__dirname, '__fixtures__/sample-project')
const recordsPath = join(fixtureDir, '.react-compiler.rec.json')
const configPath = join(fixtureDir, '.react-compiler-tracker.config.json')

function runCLI(args: string[] = [], cwd = fixtureDir): string {
    const cliPath = join(__dirname, 'index.mts')
    try {
        return execSync(`npx tsx ${cliPath} ${args.join(' ')} 2>&1`, {
            cwd,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        })
    } catch (error) {
        const execError = error as { stderr?: string; stdout?: string }
        return execError.stderr || execError.stdout || ''
    }
}

describe('CLI', () => {
    afterEach(() => {
        if (existsSync(recordsPath)) {
            rmSync(recordsPath)
        }
        if (existsSync(configPath)) {
            rmSync(configPath)
        }
    })

    describe('no flag (default check-all)', () => {
        it('runs check on all files when no flag provided', () => {
            const output = runCLI()

            expect(output).toContain('🔍 Checking all 5 source files for React Compiler errors…')
            expect(output).toContain('⚠️  Found 4 React Compiler issues across 2 files')
            expect(() => JSON.parse(readFileSync(recordsPath, 'utf8'))).toThrow()
        })

        it('--show-errors works with default check-all', () => {
            const output = runCLI(['--show-errors'])

            expect(output).toContain('Found 4 React Compiler issues')
            expect(output).toContain('Errors:')
            expect(output).toMatch(/Line \d+:/)
        })
    })

    describe('--check-files', () => {
        it('accepts --check-files flag with file arguments', () => {
            const output = runCLI(['--check-files', 'src/bad-component.tsx', 'src/bad-hook.ts'])

            expect(output).toContain('🔍 Checking 2 files for React Compiler errors…')
            expect(output).toContain('React Compiler errors have increased in:')
            expect(output).toContain('• src/bad-component.tsx: +1')
            expect(output).toContain('• src/bad-hook.ts: +3')
            expect(output).toContain('Please fix the errors and run the command again.')
            expect(output).not.toContain('src/good-component.tsx')
            expect(output).not.toContain('src/good-hook.ts')
            expect(() => JSON.parse(readFileSync(recordsPath, 'utf8'))).toThrow()
        })

        it('errors when file does not exist', () => {
            const output = runCLI(['--check-files', 'src/nonexistent-file.tsx'])

            expect(output).toContain('File not found: src/nonexistent-file.tsx')
        })

        it('handles shell-escaped file paths with $ character', () => {
            // Simulate what CI tools do when passing filenames with $ through shell variables
            const output = runCLI(['--check-files', 'src/route.\\$param.tsx'])

            expect(output).toContain('🔍 Checking 1 file for React Compiler errors…')
            expect(output).not.toContain('File not found')
        })

        it('--show-errors shows detailed error info', () => {
            const output = runCLI(['--check-files', '--show-errors', 'src/bad-hook.ts'])

            expect(output).toContain('React Compiler errors have increased')
            expect(output).toContain('Errors:')
            expect(output).toContain(
                'src/bad-hook.ts: Line 6: Cannot access refs during render (x3)',
            )
        })

        it('--show-errors shows errors even when no increase', () => {
            runCLI(['--overwrite'])
            const output = runCLI(['--check-files', '--show-errors', 'src/bad-hook.ts'])

            expect(output).toContain('Errors:')
            expect(output).toContain(
                'src/bad-hook.ts: Line 6: Cannot access refs during render (x3)',
            )
            expect(output).not.toContain('React Compiler errors have increased')
            expect(output).toContain('✅ No new React Compiler errors')
        })
    })

    describe('--overwrite', () => {
        it('accepts --overwrite flag', () => {
            const output = runCLI(['--overwrite'])

            expect(output).toContain(
                '🔍 Checking all 5 source files for React Compiler errors and recreating records…',
            )
            expect(output).toContain(
                '✅ Records saved to .react-compiler.rec.json. Found 4 total React Compiler issues across 2 files',
            )

            const records = JSON.parse(readFileSync(recordsPath, 'utf8'))
            expect(records.recordVersion).toBe(1)
            expect(records['react-compiler-version']).toBe('1.0.0')
            expect(records.files).toEqual({
                'src/bad-component.tsx': {
                    CompileError: 1,
                },
                'src/bad-hook.ts': {
                    CompileError: 3,
                },
            })
        })

        it('--show-errors shows detailed errors while saving', () => {
            const output = runCLI(['--overwrite', '--show-errors'])

            expect(output).toContain('Records saved to')
            expect(output).toContain('Errors:')
            expect(output).toMatch(/Line \d+:/)
        })
    })

    describe('--stage-record-file', () => {
        it('exits cleanly when no files provided', () => {
            const output = runCLI(['--stage-record-file'])

            expect(output).toContain('✅ No files to check')
        })

        it('checks provided files and reports increased errors', () => {
            const output = runCLI([
                '--stage-record-file',
                'src/bad-component.tsx',
                'src/bad-hook.ts',
            ])

            expect(output).toContain(
                '🔍 Checking 2 files for React Compiler errors and updating records…',
            )
            expect(output).toContain('React Compiler errors have increased in:')
            expect(output).toContain('• src/bad-component.tsx: +1')
            expect(output).toContain('• src/bad-hook.ts: +3')
        })

        it('--stage-record-file --show-errors shows detailed errors', () => {
            const output = runCLI(['--stage-record-file', '--show-errors', 'src/bad-hook.ts'])

            expect(output).toContain('React Compiler errors have increased')
            expect(output).toContain('Errors:')
            expect(output).toMatch(/Line \d+:/)
        })

        it('--stage-record-file --show-errors shows errors even when no increase', () => {
            runCLI(['--overwrite'])
            const output = runCLI(['--stage-record-file', '--show-errors', 'src/bad-hook.ts'])

            expect(output).toContain('Errors:')
            expect(output).toContain(
                'src/bad-hook.ts: Line 6: Cannot access refs during render (x3)',
            )
            expect(output).not.toContain('React Compiler errors have increased')
        })

        it('checks provided files with existing records', () => {
            // First create records
            runCLI(['--overwrite'])

            // Then check staged files - should pass since errors match records
            const output = runCLI([
                '--stage-record-file',
                'src/bad-component.tsx',
                'src/good-component.tsx',
            ])

            expect(output).toContain(
                '🔍 Checking 2 files for React Compiler errors and updating records…',
            )
            // The staging step may fail in test environment due to gitignore,
            // but the important thing is that error checking passed
            expect(output).not.toContain('React Compiler errors have increased')
        })

        it('removes deleted files from records', () => {
            // First create records
            runCLI(['--overwrite'])

            // Manually add a fake entry to records simulating a previously tracked file
            let records = JSON.parse(readFileSync(recordsPath, 'utf8'))
            records.files['src/deleted-file.tsx'] = { CompileError: 2 }
            writeFileSync(recordsPath, JSON.stringify(records, null, 2))

            // Verify the fake entry is in records
            records = JSON.parse(readFileSync(recordsPath, 'utf8'))
            expect(records.files['src/deleted-file.tsx']).toEqual({ CompileError: 2 })

            // Run --stage-record-file WITHOUT the deleted file in arguments
            // (simulating lint-staged which doesn't pass deleted files)
            // The tool should auto-detect that src/deleted-file.tsx no longer exists
            const output = runCLI(['--stage-record-file', 'src/good-component.tsx'])

            expect(output).toContain('🗑️  Removing 1 deleted file from records:')
            expect(output).toContain('• src/deleted-file.tsx')
            expect(output).toContain('🔍 Checking 1 file for React Compiler errors')
            expect(output).not.toContain('File not found')

            // Verify the deleted file was removed from records
            records = JSON.parse(readFileSync(recordsPath, 'utf8'))
            expect(records.files['src/deleted-file.tsx']).toBeUndefined()
        })

        it('exits cleanly when only deleted files provided', () => {
            // First create records
            runCLI(['--overwrite'])

            // Run with only deleted files
            const output = runCLI(['--stage-record-file', 'src/deleted1.tsx', 'src/deleted2.tsx'])

            // Should log the deleted files being removed
            expect(output).toContain('🗑️  Removing 2 deleted files from records:')
            expect(output).toContain('• src/deleted1.tsx')
            expect(output).toContain('• src/deleted2.tsx')
            // Should show clear message when no existing files
            expect(output).toContain('📁 No existing files to check.')
            expect(output).not.toContain('File not found')
        })
    })

    describe('config file', () => {
        it('uses custom sourceGlob from config', () => {
            writeFileSync(
                configPath,
                JSON.stringify({
                    sourceGlob: 'src/**/*.tsx',
                }),
            )

            const output = runCLI()

            // Should only find .tsx files (3 instead of 5)
            expect(output).toContain('🔍 Checking all 3 source files for React Compiler errors…')
        })

        it('uses custom recordsFile from config', () => {
            const customRecordsPath = join(fixtureDir, 'custom-records.json')
            writeFileSync(
                configPath,
                JSON.stringify({
                    recordsFile: 'custom-records.json',
                }),
            )

            try {
                runCLI(['--overwrite'])

                expect(existsSync(customRecordsPath)).toBe(true)
                expect(existsSync(recordsPath)).toBe(false)

                const records = JSON.parse(readFileSync(customRecordsPath, 'utf8'))
                expect(records.files).toEqual({
                    'src/bad-component.tsx': {
                        CompileError: 1,
                    },
                    'src/bad-hook.ts': {
                        CompileError: 3,
                    },
                })
            } finally {
                if (existsSync(customRecordsPath)) {
                    rmSync(customRecordsPath)
                }
            }
        })
    })
})

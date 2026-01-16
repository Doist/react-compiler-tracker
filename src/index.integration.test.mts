import { execSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(__dirname, '__fixtures__/sample-project')
const recordsPath = join(fixtureDir, '.react-compiler.rec.json')

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
    })

    it('runs check on all files when no flag provided', () => {
        const output = runCLI()

        expect(output).toContain('🔍 Checking all 4 source files for React Compiler errors…')
        expect(output).toContain('⚠️  Found 4 React Compiler issues across 2 files')
        expect(() => JSON.parse(readFileSync(recordsPath, 'utf8'))).toThrow()
    })

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

    it('accepts --overwrite flag', () => {
        const output = runCLI(['--overwrite'])

        expect(output).toContain(
            '🔍 Checking all 4 source files for React Compiler errors and recreating records…',
        )
        expect(output).toContain(
            '✅ Records file completed. Found 4 total React Compiler issues across 2 files',
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
})

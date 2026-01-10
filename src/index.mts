#!/usr/bin/env node

import { join, relative } from 'node:path'
import type { Logger as ReactCompilerLogger } from 'babel-plugin-react-compiler'
import * as babel from './babel.mjs'
import type { FileErrors } from './records-file.mjs'
import * as recordsFile from './records-file.mjs'
import * as sourceFiles from './source-files.mjs'

const RECORDS_PATH = '.react-compiler.rec.json'
const SUPPORTED_FILE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx']
const SOURCE_FILES = 'src/**/*.{js,jsx,ts,tsx}'
const BABEL_CONFIG_PATH = 'babel.config.js'

const OVERWRITE_FLAG = '--overwrite'
const STAGE_RECORD_FILE_FLAG = '--stage-record-file'
const CHECK_FILES_FLAG = '--check-files'

const compilerErrors: Map<string, FileErrors> = new Map()
const recordsFilePath = join(process.cwd(), RECORDS_PATH)

const customReactCompilerLogger: ReactCompilerLogger = {
    logEvent: (filename, event) => {
        if (!filename) return

        const relativePath = relative(process.cwd(), filename)

        if (
            event.kind === 'CompileError' ||
            event.kind === 'CompileSkip' ||
            event.kind === 'PipelineError'
        ) {
            const current = compilerErrors.get(relativePath) || {}
            current[event.kind] = (current[event.kind] ?? 0) + 1
            compilerErrors.set(relativePath, current)
        }
    },
}

main().catch(console.error)

async function main() {
    try {
        const flag = process.argv[2]

        switch (flag) {
            case STAGE_RECORD_FILE_FLAG:
                await runStageRecords()
                break
            case OVERWRITE_FLAG:
                await runOverwriteRecords()
                break
            case CHECK_FILES_FLAG:
                {
                    const filePaths = process.argv.slice(3)
                    await runCheckFiles(filePaths)
                }
                break
            default:
                await runCheckAllFiles()
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            exitWithError(error.message)
        } else {
            exitWithError('Failed to compile files')
        }
    }
}

/**
 * Handles the `--overwrite` flag by re-recording errors across all files.
 */
async function runOverwriteRecords() {
    const filePaths = sourceFiles.getAll({
        globPattern: SOURCE_FILES,
        supportedFileExtensions: SUPPORTED_FILE_EXTENSIONS,
    })

    if (!filePaths.length) {
        exitWithWarning('No files to check')
    }

    console.log(
        `🔍 Checking all ${filePaths.length} source files for React Compiler errors and recreating records...`,
    )

    //
    // Compile files and update `compilerErrors` with `customReactCompilerLogger`
    //

    await babel.compileFiles({
        filePaths,
        configPath: BABEL_CONFIG_PATH,
        customReactCompilerLogger: customReactCompilerLogger,
    })

    //
    // Overwrite records file
    //

    recordsFile.save({
        filePaths,
        recordsPath: recordsFilePath,
        compilerErrors: Object.fromEntries(compilerErrors.entries()),
        records: null,
    })

    //
    // Report error stats
    //

    const totalErrors = getErrorCount()

    if (totalErrors > 0) {
        console.log(
            `✅ Records file completed. Found ${totalErrors} total React Compiler issues across ${compilerErrors.size} files`,
        )
    } else {
        console.log('🎉 No React Compiler errors found')
    }
}

/**
 * Handles the `--stage-record-file` flag by checking git staged files and updating the records file.
 *
 * If errors have increased, the process will exit with code 1 and the records file will not be updated.
 */
async function runStageRecords() {
    const filePaths = sourceFiles.getStagedFromGit({
        globPattern: SOURCE_FILES,
        supportedFileExtensions: SUPPORTED_FILE_EXTENSIONS,
    })

    if (!filePaths.length) {
        console.log('✅ No staged files to check')
        return
    }

    console.log(
        `🔍 Checking ${filePaths.length} staged files for React Compiler errors and updating records...`,
    )

    //
    // Compile files and update `compilerErrors` with `customReactCompilerLogger`
    //

    await babel.compileFiles({
        filePaths,
        configPath: BABEL_CONFIG_PATH,
        customReactCompilerLogger: customReactCompilerLogger,
    })

    const records = exitIfErrorsIncreased({ filePaths })

    //
    // Update and stage records file
    //

    recordsFile.save({
        filePaths,
        recordsPath: recordsFilePath,
        compilerErrors: Object.fromEntries(compilerErrors.entries()),
        records: records?.files ?? null,
    })

    try {
        recordsFile.stage(RECORDS_PATH)
    } catch {
        exitWithWarning(`Failed to stage records file at ${RECORDS_PATH}`)
    }

    console.log('✅ No new React Compiler errors in staged files')
}

/**
 * Handles the `--check-files` flag by checking the files passed as arguments.
 *
 * If errors have increased, the process will exit with code 1.
 */
async function runCheckFiles(filePathArgs: string[]) {
    const filePaths = sourceFiles.filterSupportedFiles({
        filePaths: filePathArgs,
        supportedFileExtensions: SUPPORTED_FILE_EXTENSIONS,
    })

    if (!filePaths.length) {
        console.log('✅ No files to check')
        return
    }

    console.log(`🔍 Checking ${filePaths.length} files for React Compiler errors...`)

    //
    // Compile files and update `compilerErrors` with `customReactCompilerLogger`
    //

    await babel.compileFiles({
        filePaths: filePaths,
        configPath: BABEL_CONFIG_PATH,
        customReactCompilerLogger: customReactCompilerLogger,
    })

    exitIfErrorsIncreased({ filePaths })

    console.log('✅ No new React Compiler errors in checked files')
}

/**
 * Handles the no flag case by checking all files and reporting the total number of errors.
 *
 * The records file is not updated.
 */
async function runCheckAllFiles() {
    const filePaths = sourceFiles.getAll({
        globPattern: SOURCE_FILES,
        supportedFileExtensions: SUPPORTED_FILE_EXTENSIONS,
    })

    if (!filePaths.length) {
        exitWithWarning('No files to check')
    }

    console.log(`🔍 Checking all ${filePaths.length} source files for React Compiler errors...`)

    //
    // Compile files and update `compilerErrors` with `customReactCompilerLogger`
    //

    await babel.compileFiles({
        filePaths,
        configPath: BABEL_CONFIG_PATH,
        customReactCompilerLogger: customReactCompilerLogger,
    })

    //
    // Report error stats
    //

    const totalErrors = getErrorCount()

    if (totalErrors > 0) {
        exitWithWarning(
            `Found ${totalErrors} React Compiler issues across ${compilerErrors.size} files`,
        )
    }

    console.log('🎉 No React Compiler errors found')
}

function getErrorCount() {
    return Array.from(compilerErrors.values()).reduce(
        (sum, errors) => sum + Object.values(errors).reduce((a, b) => a + b, 0),
        0,
    )
}

/**
 * Compare error changes between the existing records and errors captured during this session in `compilerErrors`.
 * If errors have increased, exit with an error message.
 */
function exitIfErrorsIncreased({ filePaths }: { filePaths: string[] }) {
    const records = recordsFile.load(recordsFilePath)
    const errorIncreases = recordsFile.getErrorIncreases({
        filePaths,
        existingRecords: records?.files ?? {},
        newRecords: Object.fromEntries(compilerErrors.entries()),
    })

    const errorEntries = Object.entries(errorIncreases)

    if (errorEntries.length) {
        const errorList = errorEntries.map(([filePath, count]) => `  • ${filePath}: +${count}`)

        exitWithError(
            `React Compiler errors have increased in:\r\n${errorList.join('\r\n')}\r\n\r\nPlease fix the errors and run the command again.`,
        )
    }

    return records
}

function exitWithWarning(message: string): never {
    console.warn(`⚠️  ${message}`)
    process.exit(0)
}

function exitWithError(message: string): never {
    console.error(`❌ ${message}`)
    process.exit(1)
}

#!/usr/bin/env node

import { join, relative } from 'node:path'
import type { Logger as ReactCompilerLogger } from 'babel-plugin-react-compiler'
import { parseArgs } from './args.mjs'
import * as babel from './babel.mjs'
import { loadConfig } from './config.mjs'
import type { FileErrors } from './records-file.mjs'
import * as recordsFile from './records-file.mjs'
import * as sourceFiles from './source-files.mjs'
import { pluralize } from './utils.mjs'

const compilerErrors: Map<string, FileErrors> = new Map()

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
    const config = loadConfig()
    const { command, filePaths: filePathParams } = parseArgs(process.argv.slice(2))

    try {
        switch (command) {
            case 'stage-record-file': {
                const filePaths = sourceFiles.filterByGlob({
                    filePaths: sourceFiles.normalizeFilePaths(filePathParams),
                    globPattern: config.sourceGlob,
                })

                return await runStageRecords({
                    filePaths,
                    recordsFilePath: config.recordsFile,
                })
            }
            case 'overwrite': {
                return await runOverwriteRecords({
                    sourceGlob: config.sourceGlob,
                    recordsFilePath: config.recordsFile,
                })
            }
            case 'check-files': {
                const filePaths = sourceFiles.filterByGlob({
                    filePaths: sourceFiles.normalizeFilePaths(filePathParams),
                    globPattern: config.sourceGlob,
                })
                sourceFiles.validateFilesExist(filePaths)

                return await runCheckFiles({ filePaths, recordsFilePath: config.recordsFile })
            }
            default: {
                return await runCheckAllFiles({ sourceGlob: config.sourceGlob })
            }
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
async function runOverwriteRecords({
    sourceGlob,
    recordsFilePath,
}: {
    sourceGlob: string
    recordsFilePath: string
}) {
    const filePaths = sourceFiles.getAll({
        globPattern: sourceGlob,
    })

    if (!filePaths.length) {
        exitWithWarning('No files to check')
    }

    console.log(
        `🔍 Checking all ${filePaths.length} source files for React Compiler errors and recreating records…`,
    )

    //
    // Compile files and update `compilerErrors` with `customReactCompilerLogger`
    //

    await babel.compileFiles({
        filePaths,
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
            `✅ Records saved to ${recordsFilePath}. Found ${totalErrors} total React Compiler issues across ${compilerErrors.size} files`,
        )
    } else {
        console.log(`🎉 Records saved to ${recordsFilePath}. No React Compiler errors found`)
    }
}

/**
 * Handles the `--stage-record-file` flag by checking provided files and updating the records file.
 *
 * If errors have increased, the process will exit with code 1 and the records file will not be updated.
 * Deleted files are automatically detected by checking which recorded files no longer exist on disk.
 */
async function runStageRecords({
    filePaths,
    recordsFilePath,
}: {
    filePaths: string[]
    recordsFilePath: string
}) {
    const records = recordsFile.load(recordsFilePath)
    const recordedFilePaths = records ? Object.keys(records.files) : []
    const { deleted: deletedFromRecords } = sourceFiles.partitionByExistence(recordedFilePaths)

    const { existing: existingFilePaths, deleted: deletedFromInput } =
        sourceFiles.partitionByExistence(filePaths)

    const allDeletedFilePaths = [...new Set([...deletedFromRecords, ...deletedFromInput])]
    const allFilePaths = [...new Set([...filePaths, ...deletedFromRecords])]

    if (!allFilePaths.length) {
        console.log('✅ No files to check')
        return
    }

    if (allDeletedFilePaths.length > 0) {
        const deletedFileWord = pluralize(allDeletedFilePaths.length, 'file', 'files')
        const fileList = allDeletedFilePaths.map((f) => `  • ${f}`).join('\n')
        console.log(
            `🗑️  Removing ${allDeletedFilePaths.length} deleted ${deletedFileWord} from records:\n${fileList}`,
        )
    }

    if (!existingFilePaths.length) {
        console.log('📁 No existing files to check.')
    } else {
        const fileWord = pluralize(existingFilePaths.length, 'file', 'files')
        console.log(
            `🔍 Checking ${existingFilePaths.length} ${fileWord} for React Compiler errors and updating records…`,
        )
    }

    //
    // Compile only existing files and update `compilerErrors` with `customReactCompilerLogger`
    //

    await babel.compileFiles({
        filePaths: existingFilePaths,
        customReactCompilerLogger: customReactCompilerLogger,
    })

    checkErrorChanges({ filePaths: existingFilePaths, recordsFilePath, records })

    //
    // Update and stage records file (includes deleted files so they get removed from records)
    //

    recordsFile.save({
        filePaths: allFilePaths,
        recordsPath: recordsFilePath,
        compilerErrors: Object.fromEntries(compilerErrors.entries()),
        records: records?.files ?? null,
    })

    const recordsFileRelativePath = join(process.cwd(), recordsFilePath)

    try {
        recordsFile.stage(recordsFileRelativePath)
    } catch {
        exitWithWarning(`Failed to stage records file at ${recordsFileRelativePath}`)
    }

    console.log(`✅ Records saved to ${recordsFilePath}. No new React Compiler errors`)
}

/**
 * Handles the `--check-files` flag by checking the files passed as arguments.
 *
 * If errors have increased, the process will exit with code 1.
 */
async function runCheckFiles({
    filePaths,
    recordsFilePath,
}: {
    filePaths: string[]
    recordsFilePath: string
}) {
    if (!filePaths.length) {
        console.log('✅ No files to check')
        return
    }

    const fileWord = pluralize(filePaths.length, 'file', 'files')
    console.log(`🔍 Checking ${filePaths.length} ${fileWord} for React Compiler errors…`)

    //
    // Compile files and update `compilerErrors` with `customReactCompilerLogger`
    //

    await babel.compileFiles({
        filePaths: filePaths,
        customReactCompilerLogger: customReactCompilerLogger,
    })

    checkErrorChanges({ filePaths, recordsFilePath })

    console.log('✅ No new React Compiler errors in checked files')
}

/**
 * Handles the no flag case by checking all files and reporting the total number of errors.
 *
 * The records file is not updated.
 */
async function runCheckAllFiles({ sourceGlob }: { sourceGlob: string }) {
    const filePaths = sourceFiles.getAll({
        globPattern: sourceGlob,
    })

    if (!filePaths.length) {
        exitWithWarning('No files to check')
    }

    console.log(`🔍 Checking all ${filePaths.length} source files for React Compiler errors…`)

    //
    // Compile files and update `compilerErrors` with `customReactCompilerLogger`
    //

    await babel.compileFiles({
        filePaths,
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
 * If errors have decreased, report the good news.
 */
function checkErrorChanges({
    filePaths,
    recordsFilePath,
    records: providedRecords,
}: {
    filePaths: string[]
    recordsFilePath: string
    records?: recordsFile.Records | null
}) {
    const records = providedRecords ?? recordsFile.load(recordsFilePath)
    const { increases, decreases } = recordsFile.getErrorChanges({
        filePaths,
        existingRecords: records?.files ?? {},
        newRecords: Object.fromEntries(compilerErrors.entries()),
    })

    const increaseEntries = Object.entries(increases)

    // Report decreases first so users see their progress even if there are also increases
    const decreaseEntries = Object.entries(decreases)
    if (decreaseEntries.length) {
        const decreaseList = decreaseEntries.map(
            ([filePath, count]) => `  • ${filePath}: -${count}`,
        )
        console.log(`🎉 React Compiler errors have decreased in:\n${decreaseList.join('\n')}`)
        if (increaseEntries.length) {
            console.log() // blank line separator
        }
    }

    // Report increases (exit with error)
    if (increaseEntries.length) {
        const errorList = increaseEntries.map(([filePath, count]) => `  • ${filePath}: +${count}`)

        exitWithError(
            `React Compiler errors have increased in:\n${errorList.join('\n')}\n\nPlease fix the errors and run the command again.`,
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

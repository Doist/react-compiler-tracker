/* eslint-disable no-console */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import * as reactCompiler from './react-compiler.mjs'

const RECORD_VERSION = 1

type FileErrors = {
    CompileError?: number
    CompileSkip?: number
    PipelineError?: number
}

type Records = {
    recordVersion: typeof RECORD_VERSION
    'react-compiler-version': string
    files: Record<string, FileErrors>
}

function load(recordsPath: string) {
    if (existsSync(recordsPath)) {
        try {
            const content = readFileSync(recordsPath, 'utf8')
            const records: Records = JSON.parse(content)
            return records
        } catch (error) {
            console.warn('⚠️ Failed to parse existing tracking file:', error)
        }
    }
    return null
}

type ErrorChanges = {
    increases: Record<string, number>
    decreases: Record<string, number>
}

function getErrorChanges({
    filePaths,
    existingRecords,
    newRecords,
}: {
    filePaths: string[]
    existingRecords: Records['files']
    newRecords: Records['files']
}): ErrorChanges {
    const changes: ErrorChanges = { increases: {}, decreases: {} }

    for (const filePath of filePaths) {
        const existingErrors = existingRecords[filePath]
        const newErrors = newRecords[filePath]

        if (!existingErrors && !newErrors) {
            continue
        }

        const existingErrorCount = Object.values(existingErrors ?? {}).reduce(
            (total, count) => total + count,
            0,
        )
        const newErrorCount = Object.values(newErrors ?? {}).reduce(
            (total, count) => total + count,
            0,
        )

        if (newErrorCount > existingErrorCount) {
            changes.increases[filePath] = newErrorCount - existingErrorCount
        } else if (newErrorCount < existingErrorCount) {
            changes.decreases[filePath] = existingErrorCount - newErrorCount
        }
    }

    return changes
}

function save({
    filePaths,
    recordsPath,
    compilerErrors,
    records,
}: {
    filePaths: string[]
    compilerErrors: Records['files']
    records: Records['files'] | null
    recordsPath: string
}) {
    const newFileRecords = { ...records }

    for (const filePath of filePaths) {
        const errors = compilerErrors[filePath]

        if (errors) {
            const hasErrors = Object.values(errors).some((count) => count > 0)

            if (hasErrors) {
                newFileRecords[filePath] = { ...errors }
            } else {
                delete newFileRecords[filePath]
            }
        } else {
            delete newFileRecords[filePath]
        }
    }

    const recordsFile: Records = {
        recordVersion: RECORD_VERSION,
        'react-compiler-version': reactCompiler.getVersion(),
        files: Object.entries(newFileRecords)
            .sort(([filePathA], [filePathB]) => filePathA.localeCompare(filePathB))
            .reduce<Records['files']>((records, [filePath, errors]) => {
                records[filePath] = errors
                return records
            }, {}),
    }

    writeFileSync(recordsPath, JSON.stringify(recordsFile, null, 2))
}

function stage(recordsPath: string) {
    execSync(`git add ${recordsPath}`, { stdio: 'inherit' })
}

export { type ErrorChanges, type FileErrors, getErrorChanges, load, type Records, save, stage }

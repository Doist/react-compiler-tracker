import { execSync } from 'node:child_process'

import { glob } from 'glob'

function getStagedFromGit({
    globPattern,
    supportedFileExtensions,
}: {
    globPattern: string
    supportedFileExtensions: string[]
}) {
    const allFilePaths = getAll({ globPattern, supportedFileExtensions })

    try {
        const output = execSync('git diff --cached --name-only', { encoding: 'utf8' })
        const stagedFiles = output.trim().split('\n').filter(Boolean)
        const allFilePathsSet = new Set(allFilePaths)
        const filePaths = stagedFiles.filter((path) => allFilePathsSet.has(path))

        return filterSupportedFiles({ filePaths, supportedFileExtensions })
    } catch {
        return []
    }
}

function getAll({
    globPattern,
    supportedFileExtensions,
}: {
    globPattern: string
    supportedFileExtensions: string[]
}) {
    const srcFiles = glob.sync(globPattern, {
        cwd: process.cwd(),
        absolute: false,
    })
    return filterSupportedFiles({ filePaths: srcFiles, supportedFileExtensions })
}

function filterSupportedFiles({
    filePaths,
    supportedFileExtensions,
}: {
    filePaths: string[]
    supportedFileExtensions: string[]
}) {
    return filePaths.filter((filePath) => {
        const ext = filePath.split('.').pop()?.toLowerCase()
        return supportedFileExtensions.includes(ext || '')
    })
}

export { filterSupportedFiles, getAll, getStagedFromGit }

import { execSync } from 'child_process'

import { glob } from 'glob'
import intersection from 'lodash/intersection'

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
        const filePaths = intersection(output.trim().split('\n').filter(Boolean), allFilePaths)

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

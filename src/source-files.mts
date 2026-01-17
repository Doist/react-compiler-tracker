import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import { glob } from 'glob'
import { minimatch } from 'minimatch'

function getAll({ globPattern }: { globPattern: string }) {
    return glob.sync(globPattern, {
        cwd: process.cwd(),
        absolute: false,
    })
}

/**
 * Gets the current working directory relative to the git repository root.
 *
 * @returns The cwd relative to git root (e.g., "apps/frontend/"), empty string if at git root, or null if not in a git repo
 */
function getGitPrefix() {
    try {
        const result = execSync('git rev-parse --show-prefix', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        })
        return result.trim()
    } catch {
        return null
    }
}

/**
 * Normalizes file paths by converting absolute paths to cwd-relative
 * and stripping the git prefix when present.
 *
 * When running from a package subdirectory in a monorepo, file paths from git
 * (e.g., lint-staged) are relative to the repo root. This function converts
 * those paths to cwd-relative paths.
 *
 * @example
 * // When cwd is apps/frontend/ (prefix is "apps/frontend/")
 * normalizeFilePaths(["apps/frontend/src/file.tsx"]) // => ["src/file.tsx"]
 *
 * // Absolute paths are converted to cwd-relative
 * normalizeFilePaths(["/Users/frankie/project/src/file.tsx"]) // => ["src/file.tsx"]
 *
 * // Paths that don't start with prefix are unchanged
 * normalizeFilePaths(["src/file.tsx"]) // => ["src/file.tsx"]
 */
function normalizeFilePaths(filePaths: string[]) {
    const prefix = getGitPrefix()
    const cwd = process.cwd()

    return filePaths.map((filePath) => {
        // Handle absolute paths by converting to cwd-relative
        if (filePath.startsWith('/')) {
            return relative(cwd, filePath)
        }

        // Handle monorepo prefix stripping
        if (prefix && filePath.startsWith(prefix)) {
            return filePath.slice(prefix.length)
        }

        return filePath
    })
}

/**
 * Filters file paths to only include those matching the glob pattern.
 */
function filterByGlob({ filePaths, globPattern }: { filePaths: string[]; globPattern: string }) {
    return filePaths.filter((filePath) => minimatch(filePath, globPattern))
}

/**
 * Validates that all file paths exist on the filesystem.
 * Throws an error if any file is not found.
 */
function validateFilesExist(filePaths: string[]) {
    for (const filePath of filePaths) {
        if (!existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`)
        }
    }
}

export { getAll, normalizeFilePaths, filterByGlob, validateFilesExist }

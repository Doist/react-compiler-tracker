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
 * Normalizes file paths by unescaping shell-escaped characters, converting
 * absolute paths to cwd-relative, and stripping the git prefix when present.
 *
 * When running from a package subdirectory in a monorepo, file paths from git
 * (e.g., lint-staged) are relative to the repo root. This function converts
 * those paths to cwd-relative paths.
 *
 * Shell escapes (e.g., \$ → $) are only applied to paths containing forward
 * slashes, which indicates Unix-style paths. Paths using only backslashes
 * (Windows native paths) are preserved to avoid corrupting path separators.
 *
 * @example
 * // When cwd is apps/frontend/ (prefix is "apps/frontend/")
 * normalizeFilePaths(["apps/frontend/src/file.tsx"]) // => ["src/file.tsx"]
 *
 * // Absolute paths are converted to cwd-relative
 * normalizeFilePaths(["/Users/frankie/project/src/file.tsx"]) // => ["src/file.tsx"]
 *
 * // Shell-escaped characters are unescaped (Unix-style paths)
 * normalizeFilePaths(["src/route.\\$id.tsx"]) // => ["src/route.$id.tsx"]
 *
 * // Windows-style paths are preserved (no forward slashes)
 * normalizeFilePaths(["src\\utils\\file.ts"]) // => ["src\\utils\\file.ts"]
 *
 * // Paths that don't start with prefix are unchanged
 * normalizeFilePaths(["src/file.tsx"]) // => ["src/file.tsx"]
 */
function normalizeFilePaths(filePaths: string[]) {
    const prefix = getGitPrefix()
    const cwd = process.cwd()

    return filePaths.map((filePath) => {
        // Only unescape shell-escaped characters for Unix-style paths (containing /).
        // Windows paths use \ as separator, so we preserve them to avoid corruption.
        // This handles Git Bash on Windows and Windows CI which use forward slashes.
        const normalized = filePath.includes('/') ? filePath.replace(/\\(.)/g, '$1') : filePath

        // Handle absolute paths by converting to cwd-relative
        if (normalized.startsWith('/')) {
            return relative(cwd, normalized)
        }

        // Handle monorepo prefix stripping
        if (prefix && normalized.startsWith(prefix)) {
            return normalized.slice(prefix.length)
        }

        return normalized
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

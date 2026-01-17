import { execSync } from 'node:child_process'

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
 * Normalizes file paths by stripping the git prefix when present.
 *
 * When running from a package subdirectory in a monorepo, file paths from git
 * (e.g., lint-staged) are relative to the repo root. This function converts
 * those paths to cwd-relative paths.
 *
 * @example
 * // When cwd is apps/frontend/ (prefix is "apps/frontend/")
 * normalizeFilePaths(["apps/frontend/src/file.tsx"]) // => ["src/file.tsx"]
 *
 * // Paths that don't start with prefix are unchanged
 * normalizeFilePaths(["src/file.tsx"]) // => ["src/file.tsx"]
 */
function normalizeFilePaths(filePaths: string[]) {
    const prefix = getGitPrefix()

    if (!prefix) {
        return filePaths
    }

    return filePaths.map((filePath) => {
        if (filePath.startsWith(prefix)) {
            return filePath.slice(prefix.length)
        }
        return filePath
    })
}

export { normalizeFilePaths }

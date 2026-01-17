import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type Config = {
    recordsFile: string
    sourceGlob: string
}

const DEFAULT_CONFIG: Config = {
    recordsFile: '.react-compiler.rec.json',
    sourceGlob: 'src/**/*.{js,jsx,ts,tsx}',
}

const CONFIG_FILE_NAME = '.react-compiler-tracker.config.json'

function isValidConfig(config: unknown): config is Partial<Config> {
    if (typeof config !== 'object' || config === null) {
        return false
    }
    const obj = config as Record<string, unknown>
    if (obj.recordsFile !== undefined && typeof obj.recordsFile !== 'string') {
        return false
    }
    if (obj.sourceGlob !== undefined && typeof obj.sourceGlob !== 'string') {
        return false
    }
    return true
}

function loadConfig(): Config {
    const configPath = join(process.cwd(), CONFIG_FILE_NAME)

    if (!existsSync(configPath)) {
        return { ...DEFAULT_CONFIG }
    }

    try {
        const configContent = readFileSync(configPath, 'utf8')
        const parsed: unknown = JSON.parse(configContent)
        if (!isValidConfig(parsed)) {
            console.warn(`Invalid config file at ${configPath}, using defaults`)
            return { ...DEFAULT_CONFIG }
        }

        return {
            ...DEFAULT_CONFIG,
            ...parsed,
        }
    } catch {
        return { ...DEFAULT_CONFIG }
    }
}

export { type Config, DEFAULT_CONFIG, loadConfig }

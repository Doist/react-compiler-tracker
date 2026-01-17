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

function loadConfig(): Config {
    const configPath = join(process.cwd(), CONFIG_FILE_NAME)

    if (!existsSync(configPath)) {
        return DEFAULT_CONFIG
    }

    try {
        const configContent = readFileSync(configPath, 'utf8')
        const userConfig = JSON.parse(configContent) as Partial<Config>

        return {
            ...DEFAULT_CONFIG,
            ...userConfig,
        }
    } catch {
        return DEFAULT_CONFIG
    }
}

export { type Config, DEFAULT_CONFIG, loadConfig }

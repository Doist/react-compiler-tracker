import {
    type ConfigAPI,
    type ConfigFunction,
    type TransformOptions,
    transformFileAsync,
} from '@babel/core'
import type { Logger } from 'babel-plugin-react-compiler'
import { createRequire } from 'module'
import { join } from 'path'

function loadConfig(configPath: string) {
    const require = createRequire(import.meta.url)
    const babelConfigPath = join(process.cwd(), configPath)
    const babelConfigFn: ConfigFunction = require(babelConfigPath)
    const babelConfig = babelConfigFn({
        cache: {
            using: (callback) => callback(),
        },
    } as ConfigAPI)

    return babelConfig
}

function setCustomReactCompilerLogger(
    babelConfig: TransformOptions,
    customReactCompilerLogger: Logger,
) {
    if (!babelConfig?.plugins) {
        throw new Error('Failed to load Babel config')
    }

    const reactCompilerPlugin = babelConfig.plugins.find(
        (plugin) => Array.isArray(plugin) && plugin[0] === 'babel-plugin-react-compiler',
    )
    if (!reactCompilerPlugin || !Array.isArray(reactCompilerPlugin)) {
        throw new Error('Failed to find React Compiler plugin in Babel config')
    }
    reactCompilerPlugin[1] = { ...reactCompilerPlugin[1], logger: customReactCompilerLogger }
}

async function compileFileWithBabel(filePath: string, config: TransformOptions) {
    try {
        await transformFileAsync(filePath, config)
    } catch {
        // Babel transform errors are handled by the logger
        // We don't need to do anything special here
    }
}

async function compileFiles({
    filePaths,
    configPath,
    customReactCompilerLogger,
}: {
    filePaths: string[]
    configPath: string
    customReactCompilerLogger: Logger
}) {
    const config = loadConfig(configPath)
    setCustomReactCompilerLogger(config, customReactCompilerLogger)

    const processJobs: Promise<void>[] = []

    for (const filePath of filePaths) {
        processJobs.push(compileFileWithBabel(filePath, config))
    }

    await Promise.all(processJobs)
}

export { compileFiles }

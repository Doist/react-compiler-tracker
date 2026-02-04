import { type TransformOptions, transformFileAsync } from '@babel/core'
import type { Logger } from 'babel-plugin-react-compiler'

function createConfig(logger: Logger): TransformOptions {
    return {
        presets: [['@babel/preset-react', { runtime: 'automatic' }], '@babel/preset-typescript'],
        plugins: [['babel-plugin-react-compiler', { logger }]],
    }
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
    customReactCompilerLogger,
}: {
    filePaths: string[]
    customReactCompilerLogger: Logger
}) {
    const config = createConfig(customReactCompilerLogger)
    await Promise.all(filePaths.map((filePath) => compileFileWithBabel(filePath, config)))
}

export { compileFiles }

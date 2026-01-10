import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function getVersion() {
    try {
        const packageJsonPath = join(process.cwd(), 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
        return (
            (packageJson.devDependencies['babel-plugin-react-compiler'] as string | undefined) ??
            'unknown'
        )
    } catch {
        return 'unknown'
    }
}

export { getVersion }

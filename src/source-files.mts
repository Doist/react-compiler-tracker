import { glob } from 'glob'

function getAll({ globPattern }: { globPattern: string }) {
    return glob.sync(globPattern, {
        cwd: process.cwd(),
        absolute: false,
    })
}

export { getAll }

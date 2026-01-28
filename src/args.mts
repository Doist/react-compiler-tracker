type Command = 'check-files' | 'overwrite' | 'stage-record-file' | 'check-all'

type ParsedArgs = {
    command: Command
    filePaths: string[]
    showErrors: boolean
}

const FLAG_TO_COMMAND: Record<string, Command> = {
    '--check-files': 'check-files',
    '--overwrite': 'overwrite',
    '--stage-record-file': 'stage-record-file',
}

function parseArgs(argv: string[]): ParsedArgs {
    const showErrors = argv.includes('--show-errors')
    const argsWithoutShowErrors = argv.filter((arg) => arg !== '--show-errors')

    const flag = argsWithoutShowErrors[0] ?? ''
    const filePaths = argsWithoutShowErrors.slice(1)
    const command = FLAG_TO_COMMAND[flag] ?? 'check-all'

    return { command, filePaths, showErrors }
}

export { parseArgs, type ParsedArgs }

# React Compiler Tracker

[![npm version](https://img.shields.io/npm/v/@doist/react-compiler-tracker)](https://www.npmjs.com/package/@doist/react-compiler-tracker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/@doist/react-compiler-tracker)](https://nodejs.org/)

The [React Compiler](https://react.dev/learn/react-compiler) automatically memoizes your components, eliminating the need for `useCallback` and `useMemo`. However, certain code patterns cause the compiler to bail out. When this happens, your components lose automatic optimization, potentially causing performance regressions.

Inspired by [esplint](https://github.com/hjylewis/esplint) and [react-compiler-marker](https://github.com/blazejkustra/react-compiler-marker), this tool tracks compiler errors in a `.react-compiler.rec.json` file and integrates with Git hooks and CI to prevent new violations from being introduced.

## Prerequisites

This tool requires `babel-plugin-react-compiler` to be installed in your project:

```bash
npm install --save-dev babel-plugin-react-compiler
```

## Installation

```bash
npm install --save-dev @doist/react-compiler-tracker
```

## Configuration

Create a `.react-compiler-tracker.config.json` file in your project root to customize the tool's behavior:

```json
{
    "recordsFile": ".react-compiler.rec.json",
    "sourceGlob": "src/**/*.{js,jsx,ts,tsx}"
}
```

All fields are optional. Default values are shown above.

| Option | Description | Default |
|--------|-------------|---------|
| `recordsFile` | Path to the records file | `.react-compiler.rec.json` |
| `sourceGlob` | Glob pattern for source files | `src/**/*.{js,jsx,ts,tsx}` |

### Monorepo Usage

In a monorepo, run the tool from your package directory. The config file and all paths are relative to where you run the command. The defaults typically work out of the box:

```
my-monorepo/
├── packages/
│   └── frontend/
│       ├── .react-compiler-tracker.config.json  # Optional config
│       ├── .react-compiler.rec.json             # Records file
│       └── src/
│           └── ...
```

If your source files are in a different location (e.g., `app/` instead of `src/`), customize the config:

```json
{
    "sourceGlob": "app/**/*.{ts,tsx}"
}
```

## Usage

### `--overwrite`

Regenerates the entire records file by scanning all source files matching `sourceGlob`. Useful for initialization or picking up changes from skipped Git hooks.

```bash
npx @doist/react-compiler-tracker --overwrite
```

### `--stage-record-file <file1> <file2> ...`

Checks the provided files and updates the records. Exits with code 1 if errors increase (preventing the commit), otherwise updates the records file for the checked files. Reports when errors decrease, celebrating your progress. Deleted files are automatically removed from the records (no need to pass their paths).

```bash
npx @doist/react-compiler-tracker --stage-record-file src/components/Button.tsx src/hooks/useData.ts
```

If no files are provided, exits cleanly with a success message.

### `--check-files <file1> <file2> ...`

Checks specific files without updating records. Exits with code 1 if checked files show increased error counts (or new errors), or if any provided file does not exist. Reports when errors decrease, celebrating your progress. Primarily for CI to ensure PRs don't introduce new compiler errors.

```bash
npx @doist/react-compiler-tracker --check-files src/components/Button.tsx src/hooks/useData.ts
```

### No flags

Checks all source files matching `sourceGlob` and reports the total error count. The records file is **not** updated in this mode.

```bash
npx @doist/react-compiler-tracker
```

### `--show-errors`

Shows error information from the compiler including file path, line number, and error reason. Can be combined with any command. Errors are displayed for all checked files regardless of whether they increased.

```bash
npx @doist/react-compiler-tracker --check-files --show-errors src/components/Button.tsx
```

Example output when errors have increased:
```
Errors:
    - src/components/Button.tsx: Line 15: Cannot access refs during render (x2)
    - src/components/Button.tsx: Line 28: Invalid hook usage
❌ React Compiler errors have increased in:
  • src/components/Button.tsx: +3

Please fix the errors and run the command again.
```

When no new errors are introduced, you still see the existing errors:
```
Errors:
    - src/components/Button.tsx: Line 15: Cannot access refs during render (x2)
✅ No new React Compiler errors in checked files
```

## Integration Examples

### lint-staged

In `package.json`:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": "npx @doist/react-compiler-tracker --stage-record-file"
  }
}
```

With lint-staged, the matched files are automatically passed as arguments to the command.

### GitHub Actions CI

```yaml
- name: Check React Compiler violations
  run: |
    # Get changed files in the PR
    FILES=$(git diff --name-only origin/main...HEAD -- '*.tsx' '*.ts' '*.jsx' '*.js' | tr '\n' ' ')
    if [ -n "$FILES" ]; then
      npx @doist/react-compiler-tracker --check-files $FILES
    fi
```

### Pre-commit hook (manual)

```bash
#!/bin/sh
# Get staged files and pass them to the tracker
# (deleted files are auto-detected from records, no need to pass them)
FILES=$(git diff --diff-filter=ACMR --cached --name-only -- '*.tsx' '*.ts' '*.jsx' '*.js' | tr '\n' ' ')
if [ -n "$FILES" ]; then
  npx @doist/react-compiler-tracker --stage-record-file $FILES
fi
```

## License

Released under the [MIT License](https://opensource.org/licenses/MIT).

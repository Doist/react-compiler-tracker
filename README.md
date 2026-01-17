# React Compiler Tracker

[![npm version](https://img.shields.io/npm/v/@doist/react-compiler-tracker)](https://www.npmjs.com/package/@doist/react-compiler-tracker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/@doist/react-compiler-tracker)](https://nodejs.org/)

The [React Compiler](https://react.dev/learn/react-compiler) automatically memoizes your components, eliminating the need for `useCallback` and `useMemo`. However, certain code patterns cause the compiler to bail out. When this happens, your components lose automatic optimization, potentially causing performance regressions.

Designed for Git hooks and CI, this tool tracks compiler errors in a `.react-compiler-tracker.json` file and prevents regressions by warning when new violations are introduced.

## Prerequisites

This tool requires `babel-plugin-react-compiler` to be installed in your project:

```bash
npm install --save-dev babel-plugin-react-compiler
```

## Installation

```bash
npm install --save-dev @doist/react-compiler-tracker
```

## Usage

### `--overwrite`

Regenerates the entire `.react-compiler-tracker.json` by scanning all supported source files (`src/**/*.{js,jsx,ts,tsx}`). Useful for initialization or picking up changes from skipped Git hooks.

```bash
npx @doist/react-compiler-tracker --overwrite
```

### `--stage-record-file`

Checks Git staged files and updates the records. Exits with code 1 if errors increase (preventing the commit), otherwise updates `.react-compiler-tracker.json` for staged files.

```bash
npx @doist/react-compiler-tracker --stage-record-file
```

### `--check-files <file1> <file2> ...`

Checks specific files without updating records. Exits with code 1 if checked files show increased error counts (or new errors). Primarily for CI to ensure PRs don't introduce new compiler errors.

```bash
npx @doist/react-compiler-tracker --check-files src/components/Button.tsx src/hooks/useData.ts
```

### No flags

Checks all supported source files and reports the total error count. The records file is **not** updated in this mode.

```bash
npx @doist/react-compiler-tracker
```

## Integration Examples

### lint-staged

In `package.json`:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "npx @doist/react-compiler-tracker --stage-record-file"
  }
}
```

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

## License

Released under the [MIT License](https://opensource.org/licenses/MIT).

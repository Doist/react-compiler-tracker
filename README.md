# React Compiler Tracker

While it's safe to opt out of using memoization hooks such as `useCallback` and `useMemo` in code optimized by the [React Compiler](https://react.dev/learn/react-compiler), it is easy to introduce violations that cause the compiler to bail out, leading to performance issues when values are not memoized.

Designed to run as a part of Git hooks and CI, this tool helps prevent this and progressively adopt the React Compiler by tracking and warning against newly introduced compilation errors. It maintains a `.react-compiler-tracker.json` record file to track known compiler errors per file.

## Prerequisites

This tool requires the React Compiler to be configured in your project using `babel.config.js`.

See the [React Compiler installation guide](https://react.dev/learn/react-compiler/installation#babel) for setup instructions.

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

### Git Hook with Husky

Add to `.husky/pre-commit`:

```bash
npx @doist/react-compiler-tracker --stage-record-file
```

### lint-staged

In `package.json`:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "npx @doist/react-compiler-tracker --check-files"
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

# React Compiler Tracker

While it's safe to opt out of using memoization hooks such as `useCallback` and `useMemo` in code optimized by the [React Compiler](https://react.dev/learn/react-compiler/introduction), it is easy to introduce violations that cause the compiler to bail out, leading to performance issues when values are not memoized.

Designed to run as a part of Git hooks and CI, this tool helps prevent this and progressively adopt the React Compiler by tracking and warning against newly introduced compilation errors.

## License

Released under the [MIT License](https://opensource.org/licenses/MIT).

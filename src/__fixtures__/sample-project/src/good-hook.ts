import { useCallback, useState } from 'react'

/**
 * A clean custom hook that compiles without issues
 */
export function useCounter(initialValue: number = 0) {
    const [count, setCount] = useState(initialValue)
    const increment = useCallback(() => setCount((c) => c + 1), [])
    const decrement = useCallback(() => setCount((c) => c - 1), [])
    return { count, increment, decrement }
}

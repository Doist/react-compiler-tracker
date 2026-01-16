import { useRef } from 'react'

/**
 * A custom hook with a React Compiler violation (mutating ref during render)
 */
export function useBadCounter() {
    const countRef = useRef(0)
    // Mutating ref during render - React Compiler violation
    countRef.current += 1
    return countRef.current
}

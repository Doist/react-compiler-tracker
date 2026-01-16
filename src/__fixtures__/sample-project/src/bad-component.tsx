import { useState } from 'react'

/**
 * A component with a React Compiler violation (conditional hook)
 */
export function WithViolation({ showCount }: { showCount: boolean }) {
    if (showCount) {
        // Violates the Rules of Hooks - hooks must be called unconditionally
        const [count] = useState(0)
        return <div>Count: {count}</div>
    }
    return <div>No count</div>
}

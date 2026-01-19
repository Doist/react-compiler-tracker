/**
 * A dynamic route component (e.g., React Router or Remix)
 * The $param in the filename indicates a URL parameter
 */
export function RouteParam({ id }: { id: string }) {
    return <div>Route param: {id}</div>
}

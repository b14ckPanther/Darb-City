/**
 * The query of the /search page being shown, for the header box (first-load, a few bytes): the
 * results page publishes it, the box shows it, so the text that was searched stays editable.
 */
let current: string | null = null;
const listeners = new Set<(q: string) => void>();

export function publishQuery(q: string): void {
  current = q;
  for (const listener of listeners) listener(q);
}

/** Calls back now with the query already shown (if any), then on every new one. */
export function onQuery(listener: (q: string) => void): () => void {
  listeners.add(listener);
  if (current !== null) listener(current);
  return () => {
    listeners.delete(listener);
  };
}

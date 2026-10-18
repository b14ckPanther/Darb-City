/**
 * What the list is asking the map right now. Two tiny stores the list writes and the lazy stage
 * reads (and back), so a hovered row and its pin light up together without either importing the
 * other: the list ships no map code and the map no list code.
 */

export interface Store<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T, same: (a: T, b: T) => boolean = Object.is): Store<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(value) {
      if (same(value, current)) return;
      current = value;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** A category someone is looking at on a place's list: only its businesses go on the map. */
export interface Preview {
  /** The place slug the list is for. */
  place: string;
  /** The kind slug. */
  kind: string;
  /** "Garages in Haifa", for the map's caption. */
  title: string;
  /** Businesses of this kind here (the row's count). */
  count: number;
  /**
   * Chosen, not merely hovered: it stays when the pointer leaves the list. A phone's map button
   * chooses, and opens the map over the list.
   */
  sticky: boolean;
}

const samePreview = (a: Preview | null, b: Preview | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.place === b.place &&
    a.kind === b.kind &&
    a.sticky === b.sticky &&
    a.count === b.count);

export const previewStore = createStore<Preview | null>(null, samePreview);

/** The business lifted on both the list and the map: a hovered or focused row, or a hovered pin. */
export interface Hot {
  key: string;
  from: "list" | "map";
}

export const hotStore = createStore<Hot | null>(
  null,
  (a, b) => a === b || (a !== null && b !== null && a.key === b.key && a.from === b.from),
);

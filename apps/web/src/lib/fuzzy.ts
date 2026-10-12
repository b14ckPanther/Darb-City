export function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** The candidate within max(1, ⌊length/3⌋) edits, closest first, alphabetical on ties. */
export function closestSlug(input: string, candidates: readonly string[]): string | null {
  if (input.length < 2) return null;
  const limit = Math.max(1, Math.floor(input.length / 3));
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - input.length) > limit) continue;
    const distance = levenshtein(input, candidate);
    if (
      distance < bestDistance ||
      (distance === bestDistance && best !== null && candidate < best)
    ) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= limit ? best : null;
}

export interface SlugWorld {
  places: readonly string[];
  sectors: readonly string[];
  /** kind slug → its sector slug */
  kinds: ReadonlyMap<string, string>;
}

const pick = (input: string | undefined, candidates: readonly string[]) =>
  input === undefined ? null : candidates.includes(input) ? input : closestSlug(input, candidates);

/** The nearest real path to a broken one, or null when there is none or it is not broken. */
export function closestPath(segments: readonly string[], world: SlugWorld): string[] | null {
  const [first, second, third] = segments;
  if (!first) return null;
  const kindSlugs = [...world.kinds.keys()];
  const kindPath = (place: string, kind: string) => [place, world.kinds.get(kind)!, kind];
  let result: string[] | null;
  if (first === "k") {
    const kind = pick(second, kindSlugs);
    result = kind ? ["k", kind] : null;
  } else {
    const place = pick(first, world.places);
    if (!place) return null;
    result = [place];
    if (second === "k") {
      const kind = pick(third, kindSlugs);
      if (kind) result = kindPath(place, kind);
    } else if (second !== undefined) {
      const kind = pick(third, kindSlugs);
      if (kind) result = kindPath(place, kind);
      else {
        const sector = pick(second, world.sectors);
        if (sector) result = [place, sector];
      }
    }
  }
  if (!result || result.join("/") === segments.join("/")) return null;
  return result;
}

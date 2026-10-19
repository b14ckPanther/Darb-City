/** Edit distance; returns max + 1 as soon as the answer must exceed `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  // Two rows reused for every line: the matcher calls this for every word against every name.
  let prev = new Uint16Array(b.length + 1);
  let row = new Uint16Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    row[0] = i;
    let best = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const value = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      row[j] = value;
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    [prev, row] = [row, prev];
  }
  return prev[b.length]!;
}

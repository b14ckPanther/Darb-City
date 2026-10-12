export interface ByteRange {
  start: number;
  /** Inclusive. */
  end: number;
}

/**
 * One `bytes=` range (RFC 9110 §14), which is all PMTiles readers send. `null`: no usable Range
 * header, so serve the whole file (allowed for other units and multiple ranges). "unsatisfiable":
 * answer 416.
 */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | null | "unsatisfiable" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") return null;
  let start: number;
  let end: number;
  if (first === "") {
    const suffix = Number(last);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(first);
    end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

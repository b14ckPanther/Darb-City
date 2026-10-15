import { isIPv4, isIPv6 } from "node:net";

/** Eight lower-case hextets without leading zeros; an embedded IPv4 tail becomes two hextets. */
function hextets(ip: string): string[] {
  let s = ip;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const [a, b, c, d] = v4[1]!.split(".").map(Number) as [number, number, number, number];
    s = `${s.slice(0, -v4[1]!.length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = s.split("::") as [string, string | undefined];
  const h = head ? head.split(":") : [];
  const t = tail === undefined ? [] : tail ? tail.split(":") : [];
  const fill = tail === undefined ? [] : Array<string>(8 - h.length - t.length).fill("0");
  return [...h, ...fill, ...t].map((x) => parseInt(x, 16).toString(16));
}

/**
 * Who a rate limit counts: an IPv4 address, or an IPv6 /64 (one home or host gets a whole /64,
 * so per-address limits would be free to dodge).
 */
export function ipBucket(ip: string): string {
  let raw = ip.trim();
  // A port is not part of who is asking: "[2001:db8::1]:443" and "1.2.3.4:80" drop it.
  const bracketed = /^\[(.*)\](?::\d+)?$/.exec(raw);
  if (bracketed) raw = bracketed[1]!;
  else raw = raw.replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
  raw = raw.split("%")[0]!;
  if (isIPv4(raw)) return raw;
  if (!isIPv6(raw)) return raw.slice(0, 64);
  const h = hextets(raw);
  // IPv4-mapped (::ffff:a.b.c.d, in any spelling) and IPv4-compatible (::a.b.c.d) are IPv4.
  const zeros = h.slice(0, 5).every((x) => x === "0");
  if (zeros && (h[5] === "ffff" || (h[5] === "0" && raw.includes(".")))) {
    const [hi, lo] = [parseInt(h[6]!, 16), parseInt(h[7]!, 16)];
    return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
  }
  return `${h.slice(0, 4).join(":")}::/64`;
}

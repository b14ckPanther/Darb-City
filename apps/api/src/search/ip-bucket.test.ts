import { expect, it } from "vitest";
import { ipBucket } from "./ip-bucket.js";

it("keeps IPv4 as it is and unwraps IPv4-mapped IPv6", () => {
  expect(ipBucket("203.0.113.9")).toBe("203.0.113.9");
  expect(ipBucket("::ffff:203.0.113.9")).toBe("203.0.113.9");
  expect(ipBucket("0:0:0:0:0:ffff:203.0.113.9")).toBe("203.0.113.9");
  expect(ipBucket("::ffff:cb00:7109")).toBe("203.0.113.9");
  expect(ipBucket("::203.0.113.9")).toBe("203.0.113.9");
});

it("drops a port", () => {
  expect(ipBucket("203.0.113.9:80")).toBe("203.0.113.9");
  expect(ipBucket("[2001:db8:1:2::7]:443")).toBe("2001:db8:1:2::/64");
  expect(ipBucket("[::ffff:203.0.113.9]:443")).toBe("203.0.113.9");
});

it("groups IPv6 by /64", () => {
  const a = ipBucket("2001:db8:1:2:aaaa::1");
  expect(a).toBe("2001:db8:1:2::/64");
  expect(ipBucket("2001:DB8:0001:0002:ffff:ffff:ffff:ffff")).toBe(a);
  expect(ipBucket("[2001:db8:1:2::7]")).toBe(a);
  expect(ipBucket("2001:db8:1:3::1")).not.toBe(a);
  expect(ipBucket("::1")).toBe("0:0:0:0::/64");
  expect(ipBucket("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
});

it("passes anything else through, bounded", () => {
  expect(ipBucket("unknown")).toBe("unknown");
  expect(ipBucket("x".repeat(100))).toHaveLength(64);
});

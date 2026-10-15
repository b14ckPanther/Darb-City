import { expect, it } from "vitest";
import { fontStack } from "./font-stack";

it("keeps one real family per script and drops next/font's Arial fallbacks", () => {
  const f = (fontFamily: string) => ({ style: { fontFamily } });
  expect(
    fontStack(
      f("'Ubuntu', 'Ubuntu Fallback'"),
      f("'Heebo', 'Heebo Fallback'"),
      f("'Cairo', 'Cairo Fallback'"),
    ),
  ).toBe("'Ubuntu', 'Heebo', 'Cairo', system-ui, sans-serif");
});

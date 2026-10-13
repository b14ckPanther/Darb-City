import { expect, it } from "vitest";
import { exceptionsToText, parseExceptions } from "./hours-form";

it("round-trips special days", () => {
  const ex = [
    { date: "2026-12-25", intervals: [] },
    {
      date: "2026-12-31",
      intervals: [
        { open: "09:00", close: "13:00" },
        { open: "16:00", close: "20:00" },
      ],
    },
  ];
  const text = exceptionsToText(ex);
  expect(text).toBe("2026-12-25 closed\n2026-12-31 09:00-13:00 16:00-20:00");
  expect(parseExceptions(text)).toEqual({ ok: true, value: ex });
});

it("names the first line it cannot read", () => {
  expect(parseExceptions("2026-12-25 closed\nchristmas eve")).toEqual({
    ok: false,
    line: "christmas eve",
  });
  expect(parseExceptions("")).toEqual({ ok: true, value: [] });
});

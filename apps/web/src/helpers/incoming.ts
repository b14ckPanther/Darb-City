import type { QuickAdd } from "@/admin/street/StreetCapture";

/** The first web address in a shared text, if any (a map link shared with the place's name). */
const LINK = /https?:\/\/\S+/;

/** What the home screen shortcut or a share into the app brought (public/helper-sw.js). */
export function incomingFrom(
  q: Record<string, string | string[] | undefined>,
): QuickAdd["incoming"] {
  const one = (k: string) => {
    const v = q[k];
    return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 2000) ?? "";
  };
  const text = one("text");
  const link = LINK.exec(one("url"))?.[0] ?? LINK.exec(text)?.[0] ?? null;
  // A shared place usually comes as "Name\nlink": the name is the first line that is not the link.
  const name =
    [one("title"), ...text.split("\n")]
      .map((s) => s.replace(LINK, "").trim())
      .find((s) => s.length >= 2 && !/^google maps$/i.test(s))
      ?.slice(0, 80) ?? null;
  return {
    camera: one("camera") === "1",
    photo: one("shared") === "photo",
    link,
    name,
  };
}

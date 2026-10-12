import { expect, test } from "@playwright/test";
import { EMPTY_KIND, isPhone, LEVELS } from "./fixtures";

for (const path of [...Object.values(LEVELS), EMPTY_KIND, "/for-business"]) {
  test(`${path}: touch targets are at least 44 px and nothing scrolls sideways`, async ({
    page,
  }, info) => {
    test.skip(!isPhone(info), "phone only");
    await page.goto(path);
    // Measure the settled layout: mid-entrance transforms report 43.9998 px for a 44 px target.
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    const report = await page.evaluate(() => {
      const targets = document.querySelectorAll("a[href], button, input, summary, [role='button']");
      const small = [...targets]
        .filter((el) => !el.closest(".visually-hidden, .skip-link, p"))
        .filter((el) => {
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (box.width === 0 || style.visibility === "hidden" || style.display === "none")
            return false;
          return box.width < 44 || box.height < 44;
        })
        .map((el) => el.outerHTML.slice(0, 90));
      return {
        small,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(report.small).toEqual([]);
    expect(report.overflow).toBe(false);
  });
}

import { expect, test } from "@playwright/test";
import { EMPTY_KIND, isPhone, LEVELS, SITE_PAGES } from "./fixtures";

for (const path of [...Object.values(LEVELS), EMPTY_KIND, ...SITE_PAGES]) {
  test(`${path}: touch targets are at least 44 px and nothing scrolls sideways`, async ({
    page,
  }, info) => {
    test.skip(!isPhone(info), "phone only");
    await page.goto(path);
    // Measure the settled layout: mid-entrance transforms report 43.9998 px for a 44 px target.
    // Endless ambient loops (the landing page's glow) never finish, so only finite ones count.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ),
    );
    const report = await page.evaluate(() => {
      const targets = document.querySelectorAll("a[href], button, input, summary, [role='button']");
      const small = [...targets]
        // aria-hidden: the contact form's honeypot, off screen for people and screen readers.
        .filter((el) => !el.closest(".visually-hidden, .skip-link, p, [aria-hidden='true']"))
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

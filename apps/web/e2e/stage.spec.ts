import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BUSINESS_KEY, HAIFA, isPhone, LEVELS, localePath, settleStage } from "./fixtures";

test.describe.configure({ timeout: 60_000 });

type DarbStage = { pointOf(id: string): [number, number] | null; center(): [number, number] };
const host = (page: Page) => page.locator("[data-stage-host]");
const html = (page: Page) => page.locator("html");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __DARB_E2E__: true }));
});

/** Opens a page and waits until the stage shows it. */
async function stageAt(page: Page, path: string) {
  await page.goto(path);
  await expect(host(page)).toHaveAttribute("data-stage-state", "ready", { timeout: 30_000 });
  await expect(host(page)).toHaveAttribute("data-stage-path", new URL(page.url()).pathname);
}

/** Where a live place (slug) or business (key) is on screen. */
async function pointOf(page: Page, id: string): Promise<[number, number]> {
  const point = await page.evaluate(
    (key) => (window as unknown as { darbStage: DarbStage }).darbStage.pointOf(key),
    id,
  );
  expect(point, id).not.toBeNull();
  return point!;
}

/**
 * Picks a live place on the country map. Nearby places share a count bubble until the map is
 * close enough to split them, so the mouse wheel zooms in on the place until its own dot is there.
 */
async function pickPlace(page: Page, slug: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const [x, y] = await pointOf(page, slug);
    await page.mouse.click(x, y);
    if (
      await page.waitForURL(`/${slug}`, { timeout: 1500 }).then(
        () => true,
        () => false,
      )
    )
      return;
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(800);
  }
  throw new Error(`no dot for ${slug} on the map`);
}

const center = (page: Page) =>
  page.evaluate(() => (window as unknown as { darbStage: DarbStage }).darbStage.center());

/** The list is the whole city: no stage pane, the 2A column, every door. */
async function expectListOnly(page: Page) {
  await expect(page.locator("#stage")).toBeHidden();
  await expect(page.locator("[data-door]")).toHaveCount(18);
  expect((await page.locator("[data-city]").boundingBox())!.width).toBeGreaterThan(1400);
}

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("the map loads in the Darb style from self-hosted tiles and glyphs, no third party", async ({
    page,
  }) => {
    const hosts = new Set<string>();
    const status = new Map<string, number>();
    page.on("request", (r) => hosts.add(new URL(r.url()).host));
    page.on("response", (r) => {
      const path = new URL(r.url()).pathname;
      for (const kind of ["api/tiles", "map/glyphs", "map/vendor"])
        if (path.startsWith(`/${kind}/`)) status.set(kind, r.status());
    });
    await stageAt(page, LEVELS.country);
    await expect(host(page)).toHaveAttribute("data-stage-view", "map");
    const canvas = page.locator('[data-stage-layer="map"] canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("role", "img");
    await expect(canvas).toHaveAttribute("aria-label", "מפת המקומות הפעילים בדרב");
    await expect(canvas).toHaveAttribute("tabindex", "-1");
    await expect(page.locator("[data-stage-attribution]")).toContainText("OpenStreetMap");
    await expect.poll(() => status.get("api/tiles")).toBe(206);
    await expect.poll(() => status.get("map/vendor")).toBe(200);
    await expect.poll(() => status.get("map/glyphs")).toBe(200);
    expect([...hosts]).toEqual([new URL(page.url()).host]);
  });

  test("a place shows the map beside its category cards: the plaza is retired", async ({
    page,
  }) => {
    for (const [path, level] of [
      [LEVELS.place, "1"],
      [LEVELS.sector, "2"],
    ] as const) {
      await stageAt(page, path);
      await expect(host(page)).toHaveAttribute("data-stage-view", "map");
      await expect(host(page)).toHaveAttribute("data-stage-level", level);
      await expect(page.locator('[data-stage-layer="map"] canvas')).toBeVisible();
      await expect(page.locator("[data-plaza], [data-plaza-door]")).toHaveCount(0);
    }
    await stageAt(page, LEVELS.place);
    const doors = await page
      .locator("[data-door]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(doors).toHaveLength(18);
    expect(new Set(doors).size).toBe(18);
    for (const door of doors) expect(door).toMatch(new RegExp(`^${LEVELS.place}/[a-z0-9-]+$`));
    await expect(page.getByRole("list", { name: "כל סוגי העסקים" })).toBeVisible();
  });

  for (const [locale, rtl] of [
    ["he", true],
    ["en", false],
  ] as const)
    test(`${locale}: the stage and the first category card sit at the ${rtl ? "left / right" : "right / left"}`, async ({
      page,
    }) => {
      await stageAt(page, localePath(locale, LEVELS.place));
      const first = (await page.locator("[data-door]").nth(0).boundingBox())!;
      const second = (await page.locator("[data-door]").nth(1).boundingBox())!;
      expect(first.x > second.x).toBe(rtl);
      expect((await page.locator("#stage").boundingBox())!.x < 10).toBe(rtl);
    });

  test("the camera follows each level to the right URL", async ({ page }) => {
    await stageAt(page, LEVELS.country);
    await pickPlace(page, "sakhnin");
    await expect(page).toHaveURL(LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.place);
    // Map to map: the camera flies, no layer crossfades.
    await expect(host(page)).toHaveAttribute("data-stage-view", "map");
    await expect(host(page)).toHaveAttribute("data-stage-motion", "fly");
    await expect(host(page)).toHaveAttribute("data-stage-fade", "0");
    await page.locator('[data-door="beauty"]').click();
    await expect(page).toHaveURL(LEVELS.sector);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.sector);
    await expect(host(page)).toHaveAttribute("data-stage-level", "2");
    await expect(host(page)).toHaveAttribute("data-stage-view", "map");
    await page.locator('[data-door="barbershops"]').click();
    await expect(page).toHaveURL(LEVELS.kind);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.kind);
    await expect(host(page)).toHaveAttribute("data-stage-view", "map");
    await page.mouse.click(...(await pointOf(page, BUSINESS_KEY)));
    await expect(page).toHaveURL(new RegExp(`${LEVELS.kind}/[a-z0-9-]+$`));
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("a click 15 px off a 5–12 px dot or pin still counts (44 px targets)", async ({ page }) => {
    await stageAt(page, LEVELS.kind);
    const [px, py] = await pointOf(page, BUSINESS_KEY);
    const [dx, dy] = await pointOf(page, "sakhnin");
    // 15 px from each, on the side away from the other.
    const d = Math.hypot(px - dx, py - dy);
    const [ux, uy] = [(px - dx) / d, (py - dy) / d];
    await page.mouse.click(px + 15 * ux, py + 15 * uy);
    await expect(page).toHaveURL(LEVELS.business);
    await stageAt(page, LEVELS.kind);
    await page.mouse.click(dx - 15 * ux, dy - 15 * uy);
    await expect(page).toHaveURL(LEVELS.place);
  });

  test("Back goes up a level, and the camera with it", async ({ page }) => {
    await stageAt(page, LEVELS.place);
    await page.locator('[data-door="beauty"]').click();
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.sector);
    await page.goBack();
    await expect(page).toHaveURL(LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-level", "1");
  });

  test("navigation during a camera move ends where the URL ends", async ({ page }) => {
    await stageAt(page, LEVELS.country);
    await page.locator('#places a[href="/sakhnin"]').click();
    await expect(page).toHaveURL(LEVELS.place);
    // Back while the camera is still flying into the place.
    await expect(host(page)).toHaveAttribute("data-stage-moving", "");
    expect(await host(page).getAttribute("data-stage-path")).not.toBe(LEVELS.place);
    await page.goBack();
    await expect(page).toHaveURL(LEVELS.country);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.country);
    await expect(host(page)).toHaveAttribute("data-stage-level", "0");
    await expect(host(page)).not.toHaveAttribute("data-stage-moving", "");
  });

  test("content appears before the camera settles", async ({ page }) => {
    await stageAt(page, LEVELS.country);
    const heading = await page.locator("#main-heading").innerText();
    const timing = page.evaluate(
      ({ heading, path }) =>
        new Promise<{ content: number; settled: number }>((resolve) => {
          let content = 0;
          const stage = document.querySelector("[data-stage-host]")!;
          const observer = new MutationObserver(() => {
            const now = document.querySelector("#main-heading")?.textContent;
            if (!content && now && now !== heading) content = performance.now();
            if (content && stage.getAttribute("data-stage-path") === path) {
              observer.disconnect();
              resolve({ content, settled: performance.now() });
            }
          });
          observer.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
          });
        }),
      { heading, path: LEVELS.place },
    );
    await page.locator('#places a[href="/sakhnin"]').click();
    const { content, settled } = await timing;
    expect(content).toBeLessThan(settled);
  });

  test("the sheet is non-modal and the map stays usable behind it", async ({ page }) => {
    const business = localePath("en", LEVELS.business);
    await stageAt(page, business);
    await expect(host(page)).toHaveAttribute("data-stage-view", "map");
    const dialog = page.getByRole("dialog");
    await expect(dialog).not.toHaveAttribute("aria-modal", "true");
    const list = (await page.locator("[data-city]").boundingBox())!;
    const sheet = (await dialog.boundingBox())!;
    const x = (list.x + list.width + sheet.x) / 2;
    const y = 450;
    expect(
      await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.tagName, [x, y]),
    ).toBe("CANVAS");
    const before = await center(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 120, y + 60, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => center(page)).not.toEqual(before);
    await expect(page).toHaveURL(business);
    await expect(dialog).toBeVisible();
  });

  test("Enter in the search box searches without reloading: the map stays up", async ({ page }) => {
    await stageAt(page, LEVELS.place);
    // Survives a client navigation, never a reload.
    await page.evaluate(() => Object.assign(window, { __darbSamePage: true }));
    const box = page.getByRole("combobox");
    await box.fill("barber haifa");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=barber\+haifa$/);
    await expect(host(page)).toHaveAttribute("data-stage-path", "/search");
    await expect(host(page)).toHaveAttribute("data-stage-state", "ready");
    expect(await page.evaluate(() => "__darbSamePage" in window)).toBe(true);
    await expect(box).toHaveValue("barber haifa");
  });

  test("a neighbourhood business keeps the listed place's camera", async ({ page }) => {
    await stageAt(page, HAIFA.subPlaceBusiness);
    await expect(page).toHaveURL(HAIFA.subPlaceBusiness);
    await expect(host(page)).toHaveAttribute("data-stage-level", "3");
    await expect(host(page)).toHaveAttribute("data-stage-place", "haifa");
    await expect(host(page)).toHaveAttribute("data-stage-active-pin", HAIFA.subPlaceKey);
  });

  test("no long task over 50 ms while the camera flies into a place", async ({ page }) => {
    await stageAt(page, LEVELS.country);
    await page.evaluate(() => {
      const w = window as unknown as {
        __moves: [number, number][];
        __tasks: { start: number; duration: number }[];
      };
      w.__moves = [];
      w.__tasks = [];
      const stage = document.querySelector("[data-stage-host]")!;
      let start = 0;
      new MutationObserver(() => {
        const moving = stage.hasAttribute("data-stage-moving");
        if (moving && !start) start = performance.now();
        if (!moving && start) {
          w.__moves.push([start, performance.now()]);
          start = 0;
        }
      }).observe(stage, { attributes: true, attributeFilter: ["data-stage-moving"] });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          w.__tasks.push({ start: e.startTime, duration: e.duration });
      }).observe({ type: "longtask" });
    });
    await page.locator('#places a[href="/sakhnin"]').click();
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.place);
    await page.waitForTimeout(300); // long-task entries arrive after their task
    const { moves, tasks } = await page.evaluate(() => {
      const w = window as unknown as {
        __moves: [number, number][];
        __tasks: { start: number; duration: number }[];
      };
      return { moves: w.__moves, tasks: w.__tasks };
    });
    expect(moves.length).toBeGreaterThan(0);
    const [from, to] = moves[moves.length - 1]!;
    const during = tasks.filter((t) => t.start + t.duration > from && t.start < to);
    expect(to - from).toBeGreaterThan(0);
    console.log(
      `long tasks during the fly (${Math.round(to - from)} ms): ${JSON.stringify(during)}`,
    );
    const slow = during.filter((t) => t.duration > 50);
    // Controller ruling 8: a hard gate locally; CI's software WebGL is too noisy, so it only reports.
    if (process.env.CI) {
      if (slow.length > 0) console.warn(`CI (not gated): ${slow.length} long task(s) over 50 ms`);
    } else expect(slow).toEqual([]);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("levels switch with a short fade and no flying", async ({ page }) => {
      await stageAt(page, LEVELS.country);
      await page.locator('#places a[href="/sakhnin"]').click();
      await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.place);
      await expect(host(page)).toHaveAttribute("data-stage-motion", "jump");
      await expect(host(page)).toHaveAttribute("data-stage-fade", "400");
    });
  });

  test("no WebGL2 at all: the list is the whole city", async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, "WebGL2RenderingContext");
    });
    const vendor: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/map/vendor/")) vendor.push(r.url());
    });
    await page.goto(LEVELS.place);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500); // past the idle point where the stage would load
    await expect(html(page)).not.toHaveAttribute("data-stage-capable", "");
    await expectListOnly(page);
    expect(vendor).toEqual([]);
  });

  test("a GPU that refuses WebGL2: the list never shifts (ruling 9)", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        value: function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
          if (type === "webgl2" || type === "webgl") return null;
          return Reflect.apply(original, this, [type, ...rest]);
        },
      });
      // From the first paint on: every value html[data-stage] takes, the list's first box, and
      // every layout shift.
      const w = window as unknown as { __stage: string[]; __first: number[]; __shifts: number[] };
      w.__stage = [];
      w.__shifts = [];
      new MutationObserver(() => {
        const value = document.documentElement?.getAttribute("data-stage");
        if (value) w.__stage.push(value);
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-stage"] });
      document.addEventListener("DOMContentLoaded", () => {
        const box = document.querySelector("[data-city]")!.getBoundingClientRect();
        w.__first = [box.x, box.y, box.width];
      });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          w.__shifts.push((e as unknown as { value: number }).value);
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(LEVELS.place);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500); // past the idle point where the stage would load
    await expect(html(page)).not.toHaveAttribute("data-stage-capable", "");
    await expectListOnly(page);
    const box = (await page.locator("[data-city]").boundingBox())!;
    const { stage, first, shifts } = await page.evaluate(() => {
      const w = window as unknown as { __stage: string[]; __first: number[]; __shifts: number[] };
      return { stage: w.__stage, first: w.__first, shifts: w.__shifts };
    });
    expect(stage).not.toContain("on");
    expect(first).toEqual([box.x, box.y, box.width]);
    // A collapsing split would shift the whole list (CLS of tenths); sub-pixel text settling is
    // allowed.
    expect(shifts.reduce((sum, value) => sum + value, 0)).toBeLessThan(0.001);
  });

  test("a failed tile load: the stage steps aside", async ({ page }) => {
    await page.route("**/api/tiles/**", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto(LEVELS.place);
    await expect(html(page)).toHaveAttribute("data-stage", "off", { timeout: 30_000 });
    await expectListOnly(page);
  });
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  async function openStage(page: Page, path: string, { go = true } = {}) {
    if (go) await page.goto(path);
    const toggle = page.locator("[data-stage-toggle]");
    await expect(toggle).toHaveText("מפה", { timeout: 30_000 });
    await toggle.click();
    await expect(html(page)).toHaveAttribute("data-stage-open", "");
    await expect(host(page)).toHaveAttribute("data-stage-state", "ready", { timeout: 30_000 });
    await expect(host(page)).toHaveAttribute("data-stage-path", path);
  }

  test("the Map pill opens the map over the list, and List hands the list back", async ({
    page,
  }) => {
    await openStage(page, LEVELS.sector);
    await expect(host(page)).toHaveAttribute("data-stage-view", "map");
    await expect(host(page)).toHaveAttribute("data-stage-level", "2");
    await expect(page.locator('[data-stage-layer="map"] canvas')).toBeVisible();
    await expect(page.locator("[data-plaza], [data-plaza-door]")).toHaveCount(0);
    await expect(page.locator("[data-city]")).toHaveAttribute("inert", "");
    const toggle = page.locator("[data-stage-toggle]");
    await expect(toggle).toHaveText("רשימה");
    const pill = (await toggle.boundingBox())!;
    expect(Math.min(pill.width, pill.height)).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(html(page)).not.toHaveAttribute("data-stage-open", "");
    await expect(page.locator("[data-city]")).not.toHaveAttribute("inert", "");
    await expect(toggle).toHaveText("מפה");
    await expect(page.locator('[data-door="barbershops"]')).toBeVisible();
  });

  test("the docked search bar stays above the open stage and usable", async ({ page }) => {
    await openStage(page, LEVELS.place);
    const search = page.locator("#q");
    expect(
      await search.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === el;
      }),
    ).toBe(true);
    // The stage ends above the pill: nothing of the map sits under it or the bar.
    const pill = (await page.locator("[data-stage-toggle]").boundingBox())!;
    const stage = (await host(page).boundingBox())!;
    expect(stage.y + stage.height).toBeLessThanOrEqual(pill.y);
    await search.fill("barber");
    await expect(search).toHaveValue("barber");
  });

  test("level 3 hands the phone back to the list", async ({ page }) => {
    // From a kind's list up to its sector, open the map there, then Back to the kind.
    await page.goto(LEVELS.kind);
    await page.goto(LEVELS.sector);
    await openStage(page, LEVELS.sector, { go: false });
    await page.goBack();
    await expect(page).toHaveURL(LEVELS.kind);
    await expect(html(page)).not.toHaveAttribute("data-stage-open", "");
    await expect(page.locator("[data-stage-toggle]")).toHaveCount(0);
    await expect(page.locator(`[data-business-link="${BUSINESS_KEY}"]`)).toBeVisible();
  });

  test("the open stage has no WCAG A/AA violations", async ({ page }) => {
    await openStage(page, LEVELS.place);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    ).toEqual([]);
  });
});

test("the city and the map load under the production CSP", async ({ page }, info) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  const res = await page.goto("/sakhnin");
  expect(res?.headers()["content-security-policy"]).toContain("worker-src 'self'");
  await settleStage(page);
  // On desktop the map draws (tiles, worker, glyphs) under the policy, not merely switches off.
  if (!isPhone(info))
    await expect(host(page)).toHaveAttribute("data-stage-state", "ready", { timeout: 30_000 });
  expect(violations).toEqual([]);
});

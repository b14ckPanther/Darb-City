import { expect, test } from "@playwright/test";
import { isPhone, LEVELS } from "./fixtures";

for (const [name, path] of [...Object.entries(LEVELS), ["landing", "/"] as const]) {
  test(`${name}: Largest Contentful Paint under 1.5 s on fast 4G`, async ({ page }, info) => {
    test.skip(!isPhone(info), "phone only");
    await page.goto(path); // warm the ISR cache: the budget is for cached pages
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (9 * 1024 * 1024) / 8,
      uploadThroughput: (1.5 * 1024 * 1024) / 8,
    });
    await page.goto(path, { waitUntil: "load" });
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries[entries.length - 1]!.startTime);
          }).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => resolve(-1), 5000);
        }),
    );
    console.log(`LCP ${name} ${path}: ${Math.round(lcp)} ms`);
    expect(lcp).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(1500);
  });
}

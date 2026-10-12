import { describe, expect, it, vi } from "vitest";
import { fadeLayer } from "./fade";

describe("fadeLayer", () => {
  it("animates only opacity and transform, holding the last frame", async () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    const el = { animate } as unknown as HTMLElement;
    await fadeLayer(el, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1 }, 550, "ease");
    expect(animate).toHaveBeenCalledWith(
      [
        { opacity: 0, transform: "scale(0.94)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 550, easing: "ease", fill: "forwards" },
    );
  });
  it("does nothing for a zero duration or without the Web Animations API", async () => {
    const animate = vi.fn();
    await fadeLayer(
      { animate } as unknown as HTMLElement,
      { opacity: 0, scale: 1 },
      { opacity: 1, scale: 1 },
      0,
      "ease",
    );
    expect(animate).not.toHaveBeenCalled();
    await expect(
      fadeLayer({} as HTMLElement, { opacity: 0, scale: 1 }, { opacity: 1, scale: 1 }, 400, "ease"),
    ).resolves.toBeUndefined();
  });
  it("settles even when the animation is cancelled", async () => {
    const el = { animate: () => ({ finished: Promise.reject(new Error("AbortError")) }) };
    await expect(
      fadeLayer(
        el as unknown as HTMLElement,
        { opacity: 1, scale: 1 },
        { opacity: 0, scale: 1 },
        400,
        "ease",
      ),
    ).resolves.toBeUndefined();
  });
});

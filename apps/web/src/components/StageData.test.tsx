import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it } from "vitest";
import type { StageLevel } from "@darb/stage";
import { stageStore } from "@/lib/stage-store";
import { StageData } from "./StageData";

afterEach(() => stageStore.set(null));

const place: StageLevel = {
  depth: 3,
  place: { slug: "sakhnin", name: "Sakhnin", lat: 32.86, lng: 35.3 },
  pins: [],
};

it("publishes its level while mounted and clears it after", async () => {
  const seen: (StageLevel | null)[] = [];
  const stop = stageStore.subscribe(() => seen.push(stageStore.get()));
  const { container, unmount } = render(<StageData level={place} />);
  expect(container.innerHTML).toBe("");
  expect(stageStore.get()).toBe(place);
  unmount();
  await Promise.resolve();
  expect(stageStore.get()).toBeNull();
  expect(seen).toEqual([place, null]);
  stop();
});

it("never clears a level a newer page already published", async () => {
  const { unmount } = render(<StageData level={place} />);
  const next: StageLevel = { depth: 0 };
  stageStore.set(next);
  unmount();
  await Promise.resolve();
  expect(stageStore.get()).toBe(next);
});

it("hands over to the next page's level without passing through null", async () => {
  const seen: (StageLevel | null)[] = [];
  const stop = stageStore.subscribe(() => seen.push(stageStore.get()));
  const next: StageLevel = { depth: 0 };
  const { rerender } = render(<StageData key="a" level={place} />);
  rerender(<StageData key="b" level={next} />);
  await Promise.resolve();
  expect(stageStore.get()).toBe(next);
  expect(seen).toEqual([place, next]);
  stop();
});

it("survives a Strict Mode remount", async () => {
  render(
    <StrictMode>
      <StageData level={place} />
    </StrictMode>,
  );
  await Promise.resolve();
  expect(stageStore.get()).toBe(place);
});

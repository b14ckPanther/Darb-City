import { render } from "@testing-library/react";
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

it("publishes its level while mounted and clears it after", () => {
  const seen: (StageLevel | null)[] = [];
  const stop = stageStore.subscribe(() => seen.push(stageStore.get()));
  const { container, unmount } = render(<StageData level={place} />);
  expect(container.innerHTML).toBe("");
  expect(stageStore.get()).toBe(place);
  unmount();
  expect(stageStore.get()).toBeNull();
  expect(seen).toEqual([place, null]);
  stop();
});

it("never clears a level a newer page already published", () => {
  const { unmount } = render(<StageData level={place} />);
  const next: StageLevel = { depth: 0 };
  stageStore.set(next);
  unmount();
  expect(stageStore.get()).toBe(next);
});

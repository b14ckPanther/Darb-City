import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cached = vi.fn(async () => true);
const unstable_cache = vi.fn((..._args: unknown[]) => cached);
vi.mock("next/cache", () => ({ unstable_cache }));
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));
const { ApiUnavailableError } = await import("./api");
const { metadataOrUnavailable, orUnavailable, UNAVAILABLE_TAG } = await import("./unavailable");

afterEach(() => vi.clearAllMocks());

const params = Promise.resolve({ locale: "ar" });

describe("orUnavailable", () => {
  it("renders the level when the API answers", async () => {
    const Level = orUnavailable(async () => <p>level</p>);
    render(await Level({}));
    expect(screen.getByText("level")).toBeTruthy();
    expect(unstable_cache).not.toHaveBeenCalled();
  });
  it("renders the retry view and marks the render uncacheable when the API is down", async () => {
    const Level = orUnavailable(async (): Promise<never> => {
      throw new ApiUnavailableError(new TypeError("fetch failed"));
    });
    const { container } = render(await Level({}));
    expect(container.querySelector("[data-unreachable]")).not.toBeNull();
    expect(unstable_cache).toHaveBeenCalledWith(expect.any(Function), [UNAVAILABLE_TAG], {
      revalidate: 1,
      tags: [UNAVAILABLE_TAG],
    });
    expect(cached).toHaveBeenCalled();
  });
  it("lets notFound, redirects and other errors through", async () => {
    const boom = new Error("NEXT_NOT_FOUND");
    const Level = orUnavailable(async (): Promise<never> => {
      throw boom;
    });
    await expect(Level({})).rejects.toBe(boom);
  });
});

describe("metadataOrUnavailable", () => {
  it("gives the retry view a localized title", async () => {
    const generate = metadataOrUnavailable(async (): Promise<never> => {
      throw new ApiUnavailableError(null);
    });
    const metadata = await generate({ params });
    expect(metadata.title).toBe("لا يمكن الوصول إلى درب الآن.");
    expect(cached).toHaveBeenCalled();
  });
});

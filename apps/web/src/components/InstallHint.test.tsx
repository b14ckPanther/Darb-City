import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IOS_TIP_KEY, PROMPT_EVENT, PROMPT_KEY, iosSafari } from "@/lib/install";
import { pwaCopy } from "@/lib/pwa";
import { InstallHint } from "./InstallHint";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const copy = pwaCopy.he.install;
const win = window as unknown as Record<string, unknown>;

function media(standalone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: standalone && q.includes("standalone"),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
function userAgent(ua: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
}

beforeEach(() => {
  media(false);
  localStorage.clear();
  win[PROMPT_KEY] = null;
});
afterEach(() => vi.restoreAllMocks());

it("tells iOS Safari from other iOS browsers and from Android", () => {
  expect(iosSafari({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe(true);
  expect(iosSafari({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 })).toBe(false);
  expect(iosSafari({ userAgent: ANDROID, maxTouchPoints: 5 })).toBe(false);
});

it("offers Chrome's own install prompt as a chip once Chrome has one", async () => {
  userAgent(ANDROID);
  const prompt = vi.fn().mockResolvedValue(undefined);
  render(<InstallHint copy={copy} />);
  expect(screen.queryByRole("button")).toBeNull();
  win[PROMPT_KEY] = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  act(() => {
    window.dispatchEvent(new Event(PROMPT_EVENT));
  });
  const chip = screen.getByRole("button", { name: copy.chip });
  await act(async () => {
    fireEvent.click(chip);
  });
  expect(prompt).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: copy.chip })).toBeNull();
});

it("shows the iOS tip until it is dismissed once", () => {
  userAgent(IPHONE);
  const { unmount } = render(<InstallHint copy={copy} />);
  expect(screen.getByText(copy.iosBody)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: copy.dismiss }));
  expect(screen.queryByText(copy.iosBody)).toBeNull();
  expect(localStorage.getItem(IOS_TIP_KEY)).toBe("dismissed");
  unmount();
  render(<InstallHint copy={copy} />);
  expect(screen.queryByText(copy.iosBody)).toBeNull();
});

it("says nothing once Darb runs from the home screen", () => {
  userAgent(IPHONE);
  media(true);
  win[PROMPT_KEY] = new Event("beforeinstallprompt");
  const { container } = render(<InstallHint copy={copy} />);
  expect(container.innerHTML).toBe("");
});

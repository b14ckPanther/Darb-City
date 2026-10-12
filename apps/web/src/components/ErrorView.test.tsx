import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "ar" }) }));
const { ErrorView } = await import("./ErrorView");

it("says quietly that Darb cannot be reached and retries on request", () => {
  const retry = vi.fn();
  render(<ErrorView retry={retry} />);
  expect(screen.getByRole("status").textContent).toContain("لا يمكن الوصول إلى درب الآن.");
  fireEvent.click(screen.getByRole("button", { name: "حاول مرة أخرى" }));
  expect(retry).toHaveBeenCalledOnce();
});

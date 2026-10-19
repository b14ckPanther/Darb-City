import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { CodeField, digitsOnly } from "./CodeField";

function Harness({ onComplete }: { onComplete: (code: string) => void }) {
  const [value, setValue] = useState("");
  return <CodeField label="Code" value={value} onChange={setValue} onComplete={onComplete} />;
}

const cells = (container: HTMLElement) =>
  [...container.querySelectorAll('[aria-hidden="true"] > span')].map((c) => c.textContent);

afterEach(() => document.documentElement.removeAttribute("dir"));

it("keeps digits only, reading Arabic and Persian digits", () => {
  expect(digitsOnly("12a 3-4")).toBe("1234");
  expect(digitsOnly("٧٨٦٧٨٣")).toBe("786783");
  expect(digitsOnly("۷۸۶۷۸۳")).toBe("786783");
  expect(digitsOnly("1234567")).toBe("123456");
});

for (const dir of ["rtl", "ltr"] as const)
  it(`fills a pasted or autofilled code left to right on a ${dir} page, and sends it`, () => {
    document.documentElement.setAttribute("dir", dir);
    const onComplete = vi.fn();
    const { container } = render(
      <div dir={dir}>
        <Harness onComplete={onComplete} />
      </div>,
    );
    const input = screen.getByLabelText("Code") as HTMLInputElement;
    expect(input.getAttribute("autocomplete")).toBe("one-time-code");
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("dir")).toBe("ltr");
    // The cells' row reads left to right whatever the page's direction.
    expect(container.querySelector('[dir="ltr"]')).not.toBeNull();
    fireEvent.change(input, { target: { value: "786783" } });
    expect(cells(container)).toEqual(["7", "8", "6", "7", "8", "3"]);
    expect(onComplete).toHaveBeenCalledWith("786783");
  });

it("advances one cell per digit and sends only on the sixth", () => {
  const onComplete = vi.fn();
  const { container } = render(<Harness onComplete={onComplete} />);
  const input = screen.getByLabelText("Code");
  let typed = "";
  for (const d of "78678") {
    typed += d;
    fireEvent.change(input, { target: { value: typed } });
  }
  expect(cells(container)).toEqual(["7", "8", "6", "7", "8", ""]);
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "786783" } });
  expect(onComplete).toHaveBeenCalledOnce();
});

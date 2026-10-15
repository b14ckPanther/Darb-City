import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { legal } from "@/content/legal";
import { LegalDocument, Prose } from "./LegalDocument";

it("numbers each section and links to it from the contents", () => {
  const doc = legal.privacy.en;
  const { container } = render(<LegalDocument locale="en" doc={doc} />);
  expect(screen.getByRole("heading", { level: 1, name: doc.title })).toBeTruthy();
  const contents = screen.getByRole("navigation", { name: "On this page" });
  const links = [...contents.querySelectorAll("a")];
  expect(links.map((a) => a.getAttribute("href"))).toEqual(doc.sections.map((s) => `#${s.id}`));
  for (const [i, section] of doc.sections.entries()) {
    expect(container.querySelector(`section#${section.id} h2`)?.textContent).toBe(
      `${i + 1}. ${section.title}`,
    );
  }
  expect(container.querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-15");
  expect(container.querySelector("time")?.textContent).toBe("15 October 2026");
  // The address the law asks for stays as text; writing to Darb goes through the contact page.
  expect(container.textContent).toContain("founder@darb.co.il");
  expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  expect(screen.getByRole("link", { name: "Contact us" }).getAttribute("href")).toBe("/en/contact");
});

it("isolates Latin runs in RTL copy and leaves the sentence's full stop outside", () => {
  const { container } = render(
    <p>
      <Prose text="כתבו ל-founder@darb.co.il. נתוני Voyage AI ו-WCAG 2.0." rtl />
    </p>,
  );
  const runs = [...container.querySelectorAll("bdi")].map((b) => b.textContent);
  expect(runs).toEqual(["founder@darb.co.il", "Voyage AI", "WCAG 2.0"]);
  expect(container.querySelector("a")).toBeNull();
  expect(container.textContent).toBe("כתבו ל-founder@darb.co.il. נתוני Voyage AI ו-WCAG 2.0.");
});

it("renders every locale of every page with the Hebrew date in Hebrew", () => {
  const { container } = render(<LegalDocument locale="he" doc={legal.accessibility.he} />);
  expect(container.querySelector("time")?.textContent).toBe("15 באוקטובר 2026");
});

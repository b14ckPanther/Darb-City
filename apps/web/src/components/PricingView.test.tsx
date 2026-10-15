import type { PricingDto } from "@darb/contracts";
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PricingView } from "./PricingView";

const base = {
  tagline: {},
  setup: null,
  priceNote: {},
  finePrint: {},
  highlighted: false,
  ctaHref: "/contact?plan=ecosystem",
};
const pricing: PricingDto = {
  plans: [
    {
      ...base,
      id: "1",
      slug: "presence",
      order: 1,
      name: { he: "נוכחות", en: "Presence" },
      monthly: 0,
      features: { he: ["נעץ על המפה"], ar: [], en: ["A pin on the map"] },
      ctaLabel: { he: "הכניסו אותי", en: "Put me on Darb" },
      ctaHref: "/contact?topic=join",
    },
    {
      ...base,
      id: "2",
      slug: "signature",
      order: 2,
      name: { he: "חותם", en: "Signature" },
      monthly: 349,
      setup: 2900,
      priceNote: { he: "לחודש", en: "per month" },
      features: { he: [], ar: [], en: ["Never a template"] },
      highlighted: true,
      ctaLabel: { en: "Design my app" },
      ctaHref: "https://instagram.com/darbco",
      finePrint: { en: "Quoted after a free call." },
    },
    {
      ...base,
      id: "3",
      slug: "ecosystem",
      order: 3,
      name: { en: "Ecosystem" },
      monthly: null,
      features: { he: [], ar: [], en: [] },
      ctaLabel: { en: "Let's build it together" },
    },
  ],
  texts: {
    "pricing.title": { he: "לא תבנית", en: "Not a template" },
    "pricing.badge": { he: "הנבחר ביותר", en: "Most chosen" },
    "pricing.free": { he: "חינם", en: "Free" },
    "pricing.custom": { he: "בואו נדבר", en: "Let's talk" },
    "pricing.setup": { en: "+ {amount} one-time setup" },
    "pricing.termsTitle": { en: "The terms" },
    "pricing.terms": { en: "Prices are in shekels.\nCancel any time." },
    "pricing.faqTitle": { en: "Questions" },
    "pricing.faq": { en: "Do I need a site?\nNo.\n\nCan I grow?\nYes." },
  },
};

it("shows each plan's price, button and features from the data, in English", () => {
  render(<PricingView locale="en" pricing={pricing} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Not a template");
  const cards = screen.getAllByRole("listitem").filter((li) => li.querySelector("h2"));
  expect(cards).toHaveLength(3);
  expect(within(cards[0]!).getByText("Free")).toBeTruthy();
  expect(within(cards[1]!).getByText("Most chosen")).toBeTruthy();
  expect(cards[1]!.textContent).toContain("₪349");
  expect(cards[1]!.textContent).toContain("+ ₪2,900 one-time setup");
  expect(within(cards[2]!).getByText("Let's talk")).toBeTruthy();
  const link = within(cards[1]!).getByRole("link", { name: "Design my app" });
  expect([link.getAttribute("href"), link.getAttribute("target")]).toEqual([
    "https://instagram.com/darbco",
    "_blank",
  ]);
  const join = within(cards[0]!).getByRole("link", { name: "Put me on Darb" });
  // A path on Darb opens in the same tab, in the visitor's language.
  expect([join.getAttribute("href"), join.getAttribute("target")]).toEqual([
    "/en/contact?topic=join",
    null,
  ]);
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toContain("Cancel any time.");
  expect(screen.getByText("Do I need a site?")).toBeTruthy();
});

it("speaks Hebrew, falls back per field, and badges only the highlighted plan", () => {
  render(<PricingView locale="he" pricing={pricing} />);
  expect(screen.getByRole("link", { name: "Let's build it together" }).getAttribute("href")).toBe(
    "/contact?plan=ecosystem",
  );
  expect(screen.getAllByText("הנבחר ביותר")).toHaveLength(1);
  expect(screen.getByText("נעץ על המפה")).toBeTruthy();
  // No Hebrew features yet: the English list stands in rather than an empty card.
  expect(screen.getByText("Never a template")).toBeTruthy();
  expect(screen.getByText("בואו נדבר")).toBeTruthy();
});

it("sends the contact section to the contact page, never a mail pop-up", () => {
  const texts = { ...pricing.texts, "pricing.contactTitle": { en: "Not sure?" } };
  const { container } = render(<PricingView locale="en" pricing={{ ...pricing, texts }} />);
  expect(screen.getByRole("link", { name: "Contact us" }).getAttribute("href")).toBe("/en/contact");
  expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
});

it("says plans are coming when there are none, and leaves out empty sections", () => {
  render(<PricingView locale="en" pricing={{ plans: [], texts: {} }} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Pricing");
  expect(screen.getByText(/being polished/)).toBeTruthy();
  expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
});

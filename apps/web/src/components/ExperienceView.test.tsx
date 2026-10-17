import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BusinessDetailDto, KindDto } from "@darb/contracts";
import { contrastRatio } from "@/lib/contrast";
import { detail } from "@/lib/fixtures/business";
import { ExperienceView } from "./ExperienceView";

const kind: KindDto = {
  id: "k1",
  slug: "restaurants",
  sectorId: "s1",
  parentKindId: null,
  name: { en: "Restaurants", he: "מסעדות" },
  template: "menu",
  attributes: ["delivers"],
  icon: null,
  order: 1,
};
const view = (b: BusinessDetailDto, locale: "he" | "ar" | "en" = "en") =>
  render(
    <ExperienceView
      locale={locale}
      business={b}
      kind={kind}
      placeName="Akko"
      sectorAccent="#d6a473"
      segments={["akko", "food", "restaurants", "caramel"]}
      shareUrl="https://darb.co.il/en/akko/food/restaurants/caramel"
      // Sunday 10:00 in Israel.
      now={new Date("2026-10-18T07:00:00Z")}
    />,
  );

describe("gluten-free badge (Task 27b)", () => {
  it("shows on a fully gluten-free kitchen, in each language", () => {
    const { container, unmount } = view(detail({ dietary: ["gluten_free"] }));
    expect(container.querySelector("[data-gluten-free]")?.textContent).toBe("Gluten-free");
    unmount();
    view(detail({ dietary: ["gluten_free"] }), "he");
    expect(screen.getByText("ללא גלוטן")).toBeTruthy();
  });
  it("never shows without the dietary fact", () => {
    const { container } = view(detail());
    expect(container.querySelector("[data-gluten-free]")).toBeNull();
  });
});

describe("Darb clients (Task 28)", () => {
  const caramel = detail({
    apps: { web: "https://caramel.darb.co.il" },
    website: "https://caramel.darb.co.il",
    experience: {
      brand: { en: "Caramel" },
      title: { en: "A celiac's paradise" },
      items: [{ label: { en: "Meals" } }],
      cta: { en: "Open menu" },
      palette: { bg: "#0D0806", surface: "#1F1712", ink: "#FBF3E6", accent: "#E9A43A" },
      font: "Heebo",
    },
  });
  it("opens the app from the main button, once, and says Built by Darb with a link to Darb", () => {
    const { container } = view(caramel);
    const main = container.querySelector("[data-primary-action]")!;
    expect([main.textContent, main.getAttribute("href")]).toEqual([
      "Open menu",
      "https://caramel.darb.co.il/",
    ]);
    expect(container.querySelectorAll('a[href="https://caramel.darb.co.il/"]')).toHaveLength(1);
    const note = container.querySelector("[data-built-by-darb] a")!;
    expect([note.textContent, note.getAttribute("href")]).toEqual([
      "Built by Darb",
      "/en/for-business",
    ]);
  });
  it("puts the note on every darb-tier listing and never on others", () => {
    const { container, unmount } = view(detail({ tier: "verified" }));
    expect(container.querySelector("[data-built-by-darb]")).toBeNull();
    unmount();
    view(detail(), "he");
    expect(screen.getByText("נבנה על ידי דרב").getAttribute("href")).toBe("/for-business");
  });
  it("shows By appointment instead of open or closed, and no hours table", () => {
    const raghad = detail({
      openNow: null,
      hours: { weekly: {}, exceptions: [], byAppointment: true },
      attributes: { delivers: true, addressHidden: true },
      whatsapp: "+972 50-477-4367",
    });
    const { container } = view(raghad, "he");
    expect(container.querySelector("[data-appointment]")?.textContent).toBe("בתיאום מראש");
    expect(container.querySelector("[data-open]")).toBeNull();
    expect(container.querySelector("table")).toBeNull();
    // A home business: no directions or Waze to the town's centre, and no street.
    expect(container.querySelector('a[href*="google.com/maps"]')).toBeNull();
    expect(container.querySelector('a[href*="waze.com"]')).toBeNull();
    expect(container.querySelector("[data-address]")).toBeNull();
  });
  it("navigates from a station's main button", () => {
    const { container } = view(
      detail({ attributes: { primaryAction: "directions" }, lat: 32.8587, lng: 35.0908 }),
    );
    expect(container.querySelector("[data-primary-action]")?.getAttribute("href")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=32.8587,35.0908",
    );
    expect(container.querySelectorAll('a[href*="google.com/maps"]')).toHaveLength(1);
  });
  it("never links Paz's staff app", () => {
    const { container } = view(detail({ apps: {} }));
    expect(container.innerHTML).not.toMatch(/paz\.darb\.co\.il/);
  });
});

it("links the owner's social pages, and only real web links", () => {
  view(
    detail({
      links: {
        instagram: "https://www.instagram.com/caramel/",
        facebook: "javascript:alert(1)",
      },
    }),
  );
  expect(screen.getByRole("link", { name: "Instagram" }).getAttribute("href")).toBe(
    "https://www.instagram.com/caramel/",
  );
  expect(screen.queryByRole("link", { name: "Facebook" })).toBeNull();
});

describe("the card (designed business cards)", () => {
  it("names every round button by its word, the icons hidden from screen readers", () => {
    const { container } = view(
      detail({ whatsapp: "+972 50-123-4567", website: "https://caramel.co.il" }),
    );
    const row = screen.getByRole("list", { name: "Ways to reach them" });
    const names = within(row)
      .getAllByRole("link")
      .map((a) => a.textContent);
    expect(names).toEqual(["Call", "Waze", "Maps", "Website"]);
    expect(within(row).getByRole("button", { name: "Share" })).toBeTruthy();
    for (const svg of container.querySelectorAll("[data-action] svg"))
      expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("drives there in Waze, with Google Maps as the second way", () => {
    view(detail());
    expect(screen.getByRole("link", { name: "Waze" }).getAttribute("href")).toBe(
      "https://waze.com/ul?ll=32.92,35.07&navigate=yes",
    );
    expect(screen.getByRole("link", { name: "Maps" }).getAttribute("href")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=32.92,35.07",
    );
  });

  it("wears the owner's accent, else the sector's, with ink that reads on it", () => {
    const { container, unmount } = view(
      detail({ cardStyle: { accent: "#5fb3a8", icons: "solid" } }),
    );
    const card = container.querySelector<HTMLElement>("[data-business-card]")!;
    expect(card.style.getPropertyValue("--card-accent")).toBe("#5fb3a8");
    expect(card.getAttribute("data-icons")).toBe("solid");
    const ink = card.style.getPropertyValue("--card-ink");
    expect(contrastRatio("#5fb3a8", ink)).toBeGreaterThanOrEqual(4.5);
    unmount();
    const plain = view(detail()).container.querySelector<HTMLElement>("[data-business-card]")!;
    expect(plain.style.getPropertyValue("--card-accent")).toBe("#d6a473");
    expect(plain.getAttribute("data-icons")).toBe("line");
  });

  it("shows the owner's logo, or the name's first letter", () => {
    const { container, unmount } = view(
      detail({ logo: { key: "pending/0b3c6b1e-6f0e-4d36-9b0e-2f7f8c1d2a10.webp" } }),
    );
    expect(container.querySelector("header img")?.getAttribute("src")).toContain(
      encodeURIComponent("https://media.darb.co.il/pending/0b3c6b1e"),
    );
    unmount();
    view(detail(), "he");
    expect(document.querySelector("[data-monogram]")?.textContent).toBe("ק");
  });

  it("says today's hours in words, with the street beside a pin", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-18T07:00:00Z") });
    view(detail());
    expect(await screen.findByText("Open until 17:30")).toBeTruthy();
    vi.useRealTimers();
    expect(document.querySelector("[data-today-state]")?.getAttribute("data-open")).toBe("true");
    expect(document.querySelector("[data-address]")?.textContent).toBe("Address: Akko");
  });

  it("strips the photos and opens one large", async () => {
    const photos = ["a", "b"].map((n) => ({
      key: `pending/0b3c6b1e-6f0e-4d36-9b0e-2f7f8c1d2a1${n === "a" ? 0 : 1}.webp`,
      alt: { en: `Photo ${n}` },
    }));
    const { unmount } = view(detail({ photos }));
    // Its code is a chunk of its own, loaded only by a card with photos.
    const strip = await screen.findByRole("region", { name: "Photos" });
    const open = within(strip).getAllByRole("button", { name: /^Open photo/ });
    expect(open).toHaveLength(2);
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    fireEvent.click(open[1]!);
    expect(document.querySelector("[data-lightbox]")?.hasAttribute("open")).toBe(true);
    unmount();
    view(detail());
    expect(screen.queryByRole("region", { name: "Photos" })).toBeNull();
  });
});

describe("the chain's app", () => {
  it("credits Darb on a client of the chain, and invites the chain's other stations", () => {
    const ours = view(detail({ tier: "darb", brandSlug: "paz" }));
    expect(ours.container.querySelector('[data-chain-app="ours"]')).not.toBeNull();
    expect(ours.container.querySelector('a[href*="paz.darb.co.il"]')).toBeNull();
    ours.unmount();
    const other = view(detail({ tier: "basic", brandSlug: "paz" }));
    expect(other.container.querySelector('[data-chain-app="invite"]')).not.toBeNull();
    other.unmount();
    const none = view(detail({ brandSlug: null }));
    expect(none.container.querySelector("[data-chain-app]")).toBeNull();
  });
});

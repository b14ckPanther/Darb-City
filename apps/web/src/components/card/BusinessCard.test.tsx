import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { card as copy } from "@/content/card";
import { cardFromBusiness } from "@/lib/card";
import { detail } from "@/lib/fixtures/business";
import { BusinessCard } from "./BusinessCard";

const GOOGLE = "https://www.google.com/maps/place/Caramel/data=!3d32.92!4d35.07";

const draw = (links: Record<string, string>, locale: "he" | "ar" | "en" = "en") =>
  render(
    <BusinessCard
      locale={locale}
      copy={copy[locale]}
      renderedAt={Date.UTC(2026, 9, 18, 9)}
      card={cardFromBusiness({
        locale,
        copy: copy[locale],
        business: detail({ links }),
        kindName: "Restaurants",
        placeName: "Akko",
        sectorAccent: "#d6a473",
        ctaLabel: null,
        shareUrl: "https://darb.co.il/en/akko/food/restaurants/caramel",
      })}
    />,
  );

it("shows Google reviews only when the business has its Google Maps link", () => {
  const { unmount } = draw({});
  expect(screen.queryByRole("link", { name: /Google reviews/ })).toBeNull();
  unmount();
  draw({ google: GOOGLE });
  const link = screen.getByRole("link", { name: /Google reviews/ });
  expect(link.getAttribute("href")).toBe(GOOGLE);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.getAttribute("data-action")).toBe("reviews");
  // Only a link out: no stars, counts or review text from Google on the card.
  expect(link.textContent).toBe("Google reviews");
});

it("names the button in each language", () => {
  const { unmount } = draw({ google: GOOGLE }, "he");
  expect(screen.getByRole("link", { name: /ביקורות בגוגל/ })).toBeTruthy();
  unmount();
  draw({ google: GOOGLE }, "ar");
  expect(screen.getByRole("link", { name: /تقييمات بجوجل/ })).toBeTruthy();
});

it("names the helper who added it only when the API sends a name", () => {
  const card = (addedBy: string | null, locale: "he" | "ar" | "en" = "en") =>
    render(
      <BusinessCard
        locale={locale}
        copy={copy[locale]}
        renderedAt={Date.UTC(2026, 9, 18, 9)}
        card={cardFromBusiness({
          locale,
          copy: copy[locale],
          business: detail({ addedBy }),
          kindName: "Restaurants",
          placeName: "Akko",
          sectorAccent: "#d6a473",
          ctaLabel: null,
          shareUrl: "https://darb.co.il/en/akko/food/restaurants/caramel",
        })}
      />,
    );
  const { container, unmount } = card(null);
  expect(container.querySelector("[data-added-by]")).toBeNull();
  unmount();
  card("Rami");
  expect(screen.getByText("Rami").closest("p")?.textContent).toBe("Added to Darb by Rami");
});

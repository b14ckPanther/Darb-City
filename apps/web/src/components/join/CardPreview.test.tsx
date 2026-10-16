import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "@/content/join";
import { emptyWeek, presetWeek, type Week } from "@/lib/week-hours";
import { CardPreview, type CardPreviewProps } from "./CardPreview";
import { WeekHours } from "./WeekHours";
import { foldText } from "@/lib/fold-text";

const base: CardPreviewProps = {
  locale: "en",
  copy: join.en.preview,
  name: "Abu Samir",
  kindName: "Barbershops",
  townName: "Sakhnin",
  address: "Main St 10",
  accent: "#5fb3a8",
  icons: "solid",
  logoUrl: null,
  photoUrls: [],
  phone: "04-674-1234",
  whatsapp: "",
  point: { lat: 32.86, lng: 35.3 },
  website: "",
  instagram: "https://www.instagram.com/abusamir/",
  facebook: "",
  tiktok: "",
  week: presetWeek("sunThu"),
  // Sunday 10:00 in Israel.
  now: new Date("2026-10-18T07:00:00Z"),
};

describe("the card preview", () => {
  // The card's today follows the browser's clock once mounted.
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: base.now }));
  afterEach(() => vi.useRealTimers());
  it("draws the public card: name, kind and town, today, and only the buttons there are", async () => {
    render(<CardPreview {...base} />);
    const card = screen.getByRole("figure", { name: "How it will look" });
    expect(card.querySelector("[data-business-card]")?.getAttribute("data-business-card")).toBe(
      "preview",
    );
    expect(within(card).getByText("Abu Samir")).toBeTruthy();
    expect(within(card).getByText("Barbershops · Sakhnin")).toBeTruthy();
    expect(await within(card).findByText("Open until 18:00")).toBeTruthy();
    // No WhatsApp: the call is the main button, so the row starts with the way there.
    expect(card.querySelector("[data-primary-action]")?.textContent).toBe("Call");
    const row = within(card).getByRole("list", { name: "Ways to reach them" });
    expect(
      within(row)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Waze", "Maps"]);
    expect(within(card).getByRole("list", { name: "On social media" }).textContent).toBe(
      "Instagram",
    );
    // Pictures of buttons: nothing in the preview leaves the form.
    expect(within(card).queryAllByRole("link")).toHaveLength(0);
    const look = card.querySelector<HTMLElement>("[data-business-card]")!;
    expect(look.getAttribute("data-icons")).toBe("solid");
    expect(look.style.getPropertyValue("--card-accent")).toBe("#5fb3a8");
  });

  it("stands in a placeholder name and says nothing about hours it does not have", () => {
    render(
      <CardPreview {...base} name=" " week={emptyWeek()} point={null} phone="" instagram="" />,
    );
    expect(screen.getByText("Your business")).toBeTruthy();
    expect(document.querySelector("[data-today-state]")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});

function Week() {
  const [week, setWeek] = useState<Week>(emptyWeek());
  return (
    <>
      <WeekHours week={week} onChange={setWeek} copy={join.en.hours} invalid={false} errorId="e" />
      <output data-testid="open">{week.filter((d) => d.open).length}</output>
    </>
  );
}

describe("the week editor", () => {
  it("fills a usual week, opens a day, and copies a day to all", () => {
    render(<Week />);
    fireEvent.click(screen.getByRole("button", { name: "Sun to Thu 9 to 18, Fri 9 to 14" }));
    expect(screen.getByTestId("open").textContent).toBe("6");
    fireEvent.click(screen.getByRole("checkbox", { name: "Saturday" }));
    expect(screen.getByTestId("open").textContent).toBe("7");
    fireEvent.change(screen.getByLabelText("Friday, From"), { target: { value: "07:30" } });
    fireEvent.click(screen.getByRole("button", { name: /Copy to all days.*Friday/ }));
    expect(screen.getAllByLabelText(/, From$/).map((i) => (i as HTMLInputElement).value)).toEqual(
      Array(7).fill("07:30"),
    );
  });
});

describe("matching names", () => {
  it("folds accents, marks and alef spellings", () => {
    expect(foldText("  Café  أبو ")).toBe("cafe ابو");
    expect(foldText("סַח'נִין")).toBe("סח'נין");
  });
});

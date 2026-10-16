import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { join } from "@/content/join";
import { emptyWeek, presetWeek, type Week } from "@/lib/week-hours";
import { CardPreview, type CardPreviewProps } from "./CardPreview";
import { WeekHours } from "./WeekHours";
import { foldText } from "./SearchPicker";

const base: CardPreviewProps = {
  copy: join.en.preview,
  name: "Abu Samir",
  kindName: "Barbershops",
  townName: "Sakhnin",
  address: "Main St 10",
  accent: "#5fb3a8",
  icons: "solid",
  logoUrl: null,
  photoUrl: null,
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
  it("shows the name, kind and town, open now, and only the buttons there are", () => {
    render(<CardPreview {...base} />);
    const card = screen.getByRole("figure", { name: "How it will look" });
    expect(within(card).getByText("Abu Samir")).toBeTruthy();
    expect(within(card).getByText("Barbershops · Sakhnin")).toBeTruthy();
    expect(within(card).getByText("Open now")).toBeTruthy();
    const buttons = within(card)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(buttons).toEqual(["Call", "Waze", "Instagram"]);
    expect(card.getAttribute("data-icons")).toBe("solid");
    expect(card.getAttribute("style")).toContain("#5fb3a8");
  });

  it("stands in a placeholder name and says nothing about hours it does not have", () => {
    render(
      <CardPreview {...base} name=" " week={emptyWeek()} point={null} phone="" instagram="" />,
    );
    expect(screen.getByText("Your business")).toBeTruthy();
    expect(screen.queryByText(/now$/)).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
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

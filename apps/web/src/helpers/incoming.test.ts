import { expect, it } from "vitest";
import { incomingFrom } from "./incoming";

it("reads a home screen shortcut and a shared photo", () => {
  expect(incomingFrom({ camera: "1" })).toEqual({
    camera: true,
    photo: false,
    link: null,
    name: null,
  });
  expect(incomingFrom({ shared: "photo" })).toMatchObject({ photo: true, camera: false });
});

it("takes the map link and the place's name from a shared text", () => {
  expect(
    incomingFrom({ text: "Abu Samir Salon\nhttps://maps.app.goo.gl/abc123", title: "Google Maps" }),
  ).toMatchObject({ link: "https://maps.app.goo.gl/abc123", name: "Abu Samir Salon" });
  expect(
    incomingFrom({ url: "https://www.google.com/maps/place/x", title: "מספרת אבו סמיר" }),
  ).toMatchObject({ link: "https://www.google.com/maps/place/x", name: "מספרת אבו סמיר" });
});

it("has nothing when nothing came", () => {
  expect(incomingFrom({})).toEqual({ camera: false, photo: false, link: null, name: null });
  expect(incomingFrom({ text: "   " })).toMatchObject({ link: null, name: null });
});

import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { kmBetween, positionGranted } from "@/lib/live-position";
import { LiveDistance } from "./LiveDistance";

afterEach(() => vi.unstubAllGlobals());

it("measures straight-line kilometres", () => {
  // Karmiel to central Haifa, as the crow flies.
  expect(kmBetween({ lat: 32.919, lng: 35.295 }, { lat: 32.794, lng: 34.99 })).toBeCloseTo(31.3, 0);
});

it("shows nothing until the location is shared, then how far, live", () => {
  vi.stubGlobal("navigator", {
    geolocation: { watchPosition: () => 1, clearWatch: () => {} },
    permissions: { query: () => new Promise(() => {}) },
  });
  render(<LiveDistance lat={32.919} lng={35.295} template="{km} km" metres="{m} m" locale="en" />);
  expect(screen.queryByText(/km/)).toBeNull();
  act(() => positionGranted({ lat: 32.92, lng: 35.3 }));
  expect(screen.getByText(/^\d+ m$/)).toBeTruthy();
  act(() => positionGranted({ lat: 32.794, lng: 34.99 }));
  expect(screen.getByText(/^\d+ km$/)).toBeTruthy();
});

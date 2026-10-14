import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { OwnerBadge, StatusBadge } from "./Badges";

it("names status and ownership in the admin's language", () => {
  render(
    <>
      <StatusBadge locale="ar" status="suspended" />
      <OwnerBadge locale="en" editedAt="2026-10-13T10:00:00.000Z" />
      <OwnerBadge locale="en" editedAt={null} />
    </>,
  );
  expect(screen.getByText("موقوف")).toBeTruthy();
  expect(screen.getByText("Edited in admin")).toBeTruthy();
  expect(screen.getByText("From seed data")).toBeTruthy();
});

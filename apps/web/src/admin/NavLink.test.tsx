import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

let pathname = "/admin";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
const { NavLink } = await import("./ShellControls");

const nav = () =>
  render(
    <nav>
      <NavLink href="/admin" item="">
        Overview
      </NavLink>
      <NavLink href="/admin/sectors" item="/sectors">
        Categories
      </NavLink>
    </nav>,
  );

const current = () =>
  screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent);

// The shell is a layout and keeps its first render, so each link reads the address itself.
it.each([
  ["/admin", "Overview"],
  ["/admin/sectors", "Categories"],
  ["/admin/sectors/123", "Categories"],
  ["/ar/admin/sectors", "Categories"],
])("%s marks %s", (path, label) => {
  pathname = path;
  nav();
  expect(current()).toEqual([label]);
});

it("follows a client navigation without a new render from the server", () => {
  pathname = "/admin";
  const { rerender } = nav();
  expect(current()).toEqual(["Overview"]);
  pathname = "/en/admin/sectors";
  rerender(
    <nav>
      <NavLink href="/admin" item="">
        Overview
      </NavLink>
      <NavLink href="/admin/sectors" item="/sectors">
        Categories
      </NavLink>
    </nav>,
  );
  expect(current()).toEqual(["Categories"]);
});

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ActionForm } from "./ActionForm";

it("shows the action's errors in an alert and keeps the fields", async () => {
  const action = async () => ({ ok: false, message: "Fix these", errors: ["slug: Invalid slug"] });
  render(
    <ActionForm action={action} submit="Save" labels={{ fix: "Fix these and save again:" }}>
      <input aria-label="slug" name="slug" defaultValue="Bad Slug" />
    </ActionForm>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("slug: Invalid slug")).toBeTruthy();
});

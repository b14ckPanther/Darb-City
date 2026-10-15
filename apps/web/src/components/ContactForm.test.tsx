import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { contact } from "@/content/contact";
import { ContactForm } from "./ContactForm";

const copy = contact.en.form;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const renderForm = (props: Partial<Parameters<typeof ContactForm>[0]> = {}) =>
  render(
    <ContactForm
      locale="en"
      copy={copy}
      initialTopic="general"
      plan={null}
      planName={null}
      {...props}
    />,
  );
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fill = () => {
  type("Your name", "Lina");
  type("Phone or email", "050-123-4567");
  type("Your message", "Do you build apps for clinics?");
};
const send = () => fireEvent.click(screen.getByRole("button", { name: "Send" }));

it("labels every field and hides the honeypot from people", () => {
  const { container } = renderForm();
  for (const label of ["Your name", "Phone or email", /Business name/, "What is it about?"])
    expect(screen.getByLabelText(label)).toBeTruthy();
  const trap = container.querySelector('input[name="website"]')!;
  expect(trap.getAttribute("tabindex")).toBe("-1");
  expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
});

it("says what is wrong beside each field and sends nothing", async () => {
  renderForm();
  type("Your name", "L");
  send();
  const name = screen.getByLabelText("Your name");
  expect(name.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByText(copy.errors.name)).toBeTruthy();
  expect(screen.getByText(copy.errors.contact)).toBeTruthy();
  expect(screen.getByText(copy.errors.messageShort)).toBeTruthy();
  expect(document.activeElement).toBe(name);
  expect(fetchMock).not.toHaveBeenCalled();
  // Fixing a field clears its message at once.
  type("Your name", "Lina");
  expect(screen.queryByText(copy.errors.name)).toBeNull();
});

it("sends, shows that it is sending, then thanks", async () => {
  let answer: (r: Response) => void = () => undefined;
  fetchMock.mockReturnValue(new Promise<Response>((r) => (answer = r)));
  renderForm();
  fill();
  send();
  const button = await screen.findByRole("button", { name: "Sending..." });
  expect(button.hasAttribute("disabled")).toBe(true);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/contact");
  expect(JSON.parse(String(init.body))).toEqual({
    name: "Lina",
    contact: "050-123-4567",
    topic: "general",
    message: "Do you build apps for clinics?",
    locale: "en",
  });
  answer(new Response("{}", { status: 201 }));
  const thanks = await screen.findByRole("heading", { name: copy.thanksTitle });
  expect(screen.getByText(copy.thanksBody)).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(thanks));
  fireEvent.click(screen.getByRole("button", { name: copy.sendAnother }));
  expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("");
});

it("keeps the message on a failure and sends it again on retry", async () => {
  fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
  renderForm();
  fill();
  send();
  expect((await screen.findByRole("alert")).textContent).toContain(copy.errors.failed);
  expect((screen.getByLabelText("Your message") as HTMLTextAreaElement).value).toBe(
    "Do you build apps for clinics?",
  );
  fetchMock.mockResolvedValueOnce(new Response("{}", { status: 201 }));
  fireEvent.click(screen.getByRole("button", { name: copy.retry }));
  expect(await screen.findByRole("heading", { name: copy.thanksTitle })).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("asks a visitor who sent too many to wait, and survives a dropped connection", async () => {
  fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
  renderForm();
  fill();
  send();
  expect((await screen.findByRole("alert")).textContent).toContain(copy.errors.tooMany);
  fetchMock.mockRejectedValueOnce(new TypeError("offline"));
  send();
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(copy.errors.failed));
});

it("opens on the plan from the link, names it, and sends it", async () => {
  fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));
  renderForm({ initialTopic: "plan", plan: "spotlight", planName: "Spotlight" });
  expect((screen.getByLabelText("What is it about?") as HTMLSelectElement).value).toBe("plan");
  expect(screen.getByText("About the plan: Spotlight")).toBeTruthy();
  fill();
  type(/Business name/, "Lina's Clinic");
  send();
  await screen.findByRole("heading", { name: copy.thanksTitle });
  const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
  expect([body.topic, body.plan, body.businessName]).toEqual([
    "plan",
    "spotlight",
    "Lina's Clinic",
  ]);
});

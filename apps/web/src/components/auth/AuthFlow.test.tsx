import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { authCopy } from "./auth-copy";
import { AuthFlow } from "./AuthFlow";
import type { AuthBackend, Outcome } from "./backend";

const copy = authCopy.en;

beforeAll(() => {
  // Reduced motion: the gold moment does not wait.
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce") })) as never;
});

function backend(over: Partial<AuthBackend> = {}): AuthBackend {
  const code: Outcome = {
    ok: true,
    step: "code",
    channel: "email",
    canSwitch: false,
    resendable: true,
  };
  return {
    start: vi.fn(async () => code),
    password: vi.fn(async () => ({ ok: true, step: "done" }) as Outcome),
    code: vi.fn(async () => ({ ok: true, step: "done" }) as Outcome),
    resend: vi.fn(async () => code),
    switchMethod: vi.fn(async () => ({ ok: false, error: "unsupported" }) as Outcome),
    reset: vi.fn(),
    finish: vi.fn(async () => ({ ok: true, step: "done" }) as Outcome),
    ...over,
  };
}

async function toCode(b: AuthBackend, other: string | null = "/en/helpers/sign-up") {
  render(<AuthFlow kind="sign-in" backend={b} copy={copy} other={other} onSignedIn={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(copy.emailLabel), {
    target: { value: "rami@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: copy.continue }));
  return screen.findByLabelText(copy.codeLabel);
}

it("asks for the email, then the code, and signs in on the sixth digit", async () => {
  const b = backend();
  const input = await toCode(b);
  expect(b.start).toHaveBeenCalledWith("rami@example.com");
  expect(screen.getByText("rami@example.com")).toBeTruthy();
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: "786783" } });
  await waitFor(() => expect(b.finish).toHaveBeenCalled());
  expect(b.code).toHaveBeenCalledWith("786783");
  expect(screen.getByRole("status").textContent).toContain(copy.done);
});

it("clears a wrong code, says so, and keeps the person on the code", async () => {
  const b = backend({ code: vi.fn(async () => ({ ok: false, error: "wrongCode" }) as Outcome) });
  const input = (await toCode(b)) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "000000" } });
  expect((await screen.findByRole("alert")).textContent).toContain(copy.errWrongCode);
  expect(input.value).toBe("");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(b.finish).not.toHaveBeenCalled();
});

it("waits before a new code can be sent, then sends one", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const b = backend();
  await toCode(b);
  const resend = screen.getByRole("button", { name: /New code in 0:30/ });
  expect((resend as HTMLButtonElement).disabled).toBe(true);
  for (let i = 0; i < 30; i++) await act(() => vi.advanceTimersByTimeAsync(1000));
  fireEvent.click(screen.getByRole("button", { name: copy.resend }));
  expect(await screen.findByText(copy.resent)).toBeTruthy();
  expect(b.resend).toHaveBeenCalled();
  vi.useRealTimers();
});

it("offers a sign-up for an unknown email, with the email carried over", async () => {
  const b = backend({ start: vi.fn(async () => ({ ok: false, error: "notFound" }) as Outcome) });
  render(
    <AuthFlow
      kind="sign-in"
      backend={b}
      copy={copy}
      other="/en/helpers/sign-up"
      onSignedIn={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText(copy.emailLabel), {
    target: { value: "new@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: copy.continue }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(copy.errNotFound);
  expect(screen.getAllByRole("link", { name: copy.toSignUp })[0]!.getAttribute("href")).toBe(
    "/en/helpers/sign-up?email=new%40example.com",
  );
});

it("never promises a sign-up on the admin, and checks the email before asking Clerk", async () => {
  const b = backend({ start: vi.fn(async () => ({ ok: false, error: "notFound" }) as Outcome) });
  render(<AuthFlow kind="sign-in" backend={b} copy={copy} onSignedIn={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(copy.emailLabel), { target: { value: "rami" } });
  fireEvent.click(screen.getByRole("button", { name: copy.continue }));
  expect((await screen.findByRole("alert")).textContent).toContain(copy.errBadEmail);
  expect(b.start).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(copy.emailLabel), { target: { value: "x@darb.co.il" } });
  fireEvent.click(screen.getByRole("button", { name: copy.continue }));
  expect((await screen.findByRole("alert")).textContent).toContain(copy.errNotFoundAdmin);
  expect(screen.queryByRole("link")).toBeNull();
});

it("goes to the password when Clerk asks for one, and switches to a code", async () => {
  const b = backend({
    start: vi.fn(
      async () => ({ ok: true, step: "password", isNew: false, canSwitch: true }) as Outcome,
    ),
    switchMethod: vi.fn(
      async () =>
        ({
          ok: true,
          step: "code",
          channel: "email",
          canSwitch: true,
          resendable: true,
        }) as Outcome,
    ),
  });
  render(<AuthFlow kind="sign-in" backend={b} copy={copy} onSignedIn={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(copy.emailLabel), { target: { value: "a@b.co" } });
  fireEvent.click(screen.getByRole("button", { name: copy.continue }));
  const pw = await screen.findByLabelText(copy.passwordLabel);
  expect(pw.getAttribute("autocomplete")).toBe("current-password");
  expect(pw.getAttribute("dir")).toBe("ltr");
  fireEvent.click(screen.getByRole("button", { name: copy.useCode }));
  expect(await screen.findByLabelText(copy.codeLabel)).toBeTruthy();
  expect(screen.getByRole("button", { name: copy.usePassword })).toBeTruthy();
});

it("leaves at once when this browser is already signed in", async () => {
  const onSignedIn = vi.fn();
  const b = backend({ start: vi.fn(async () => ({ ok: false, error: "signedIn" }) as Outcome) });
  render(<AuthFlow kind="sign-in" backend={b} copy={copy} onSignedIn={onSignedIn} />);
  fireEvent.change(screen.getByLabelText(copy.emailLabel), { target: { value: "a@b.co" } });
  fireEvent.click(screen.getByRole("button", { name: copy.continue }));
  await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
});

it("goes back to the email and resets Clerk's attempt", async () => {
  const b = backend();
  await toCode(b);
  fireEvent.click(screen.getByRole("button", { name: copy.changeEmail }));
  expect(b.reset).toHaveBeenCalled();
  expect((screen.getByLabelText(copy.emailLabel) as HTMLInputElement).value).toBe(
    "rami@example.com",
  );
});

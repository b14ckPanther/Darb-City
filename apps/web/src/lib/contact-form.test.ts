import { InquiryCreateSchema } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { contact } from "@/content/contact";
import {
  fieldErrors,
  initialTopic,
  inquiryBody,
  isContact,
  type ContactFields,
} from "./contact-form";

const ok: ContactFields = {
  name: "Lina",
  contact: "lina@example.com",
  businessName: "",
  topic: "general",
  message: "Do you build apps for clinics?",
};

describe("the form's own checks", () => {
  it("passes a good message and names each bad field", () => {
    expect(fieldErrors(ok)).toEqual({});
    expect(fieldErrors({ ...ok, name: " L ", contact: "soon", message: "hi" })).toEqual({
      name: "name",
      contact: "contact",
      message: "messageShort",
    });
    expect(fieldErrors({ ...ok, message: "m".repeat(3001) })).toEqual({ message: "messageLong" });
  });

  it("agrees with the API's schema on what a phone or email is", () => {
    for (const c of ["050-123-4567", "+972 4 123 4567", "a@b.co", "12345", "call me", "a@b"]) {
      const api = InquiryCreateSchema.safeParse({
        ...inquiryBody({ ...ok, contact: c }, null, "en", ""),
      }).success;
      expect(isContact(c) && c.length >= 5, c).toBe(api);
    }
  });

  it("builds a body the API takes, dropping blanks and a stray plan", () => {
    const body = inquiryBody({ ...ok, name: " Lina ", topic: "plan" }, "spotlight", "he", "");
    expect(body).toEqual({
      name: "Lina",
      contact: "lina@example.com",
      topic: "plan",
      plan: "spotlight",
      message: "Do you build apps for clinics?",
      locale: "he",
    });
    expect(InquiryCreateSchema.safeParse(body).success).toBe(true);
    expect(inquiryBody({ ...ok, topic: "join" }, "spotlight", "he", "")).not.toHaveProperty("plan");
    expect(inquiryBody(ok, null, "en", "x").website).toBe("x");
  });
});

describe("the topic a link opens on", () => {
  it("reads ?plan= first, then ?topic=, and ignores anything else", () => {
    expect(initialTopic({ plan: "spotlight" })).toEqual({ topic: "plan", plan: "spotlight" });
    expect(initialTopic({ topic: "join" })).toEqual({ topic: "join", plan: null });
    expect(initialTopic({ plan: "../x", topic: "nope" })).toEqual({ topic: "general", plan: null });
    expect(initialTopic({})).toEqual({ topic: "general", plan: null });
  });
});

describe("the page's words", () => {
  const all = JSON.stringify(contact);

  it("never uses long dashes or the Hebrew maqaf, and never the word halal", () => {
    expect(all).not.toMatch(/[–—־]/);
    expect(all).not.toMatch(/halal|חלאל|حلال/i);
  });

  it("speaks everyday Arabic and never names languages", () => {
    expect(all).not.toMatch(/هلأ/);
    expect(all).not.toMatch(/Hebrew|Arabic|English|עברית|ערבית|אנגלית|العربية|العبرية/);
  });

  it("thanks people warmly in every language", () => {
    expect(`${contact.en.form.thanksTitle} ${contact.en.form.thanksBody}`).toBe(
      "Thanks, we got it. We'll get back to you soon.",
    );
    for (const locale of ["he", "ar"] as const)
      expect(contact[locale].form.thanksTitle.trim()).not.toBe("");
  });
});

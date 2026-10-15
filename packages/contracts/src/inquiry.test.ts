import { describe, expect, it } from "vitest";
import { AdminInquiryListQuerySchema, AdminInquiryStatusSchema, adminContract } from "./admin.js";
import { contract } from "./contract.js";
import { InquiryCreateSchema, looksLikeEmail, looksLikePhone } from "./inquiry.js";

const valid = {
  name: "Samir",
  contact: "050-123-4567",
  topic: "general",
  message: "I run a bakery in Sakhnin.",
  locale: "ar",
};

describe("the contact form", () => {
  it("accepts a phone or an email, trims, and keeps the honeypot", () => {
    const parsed = InquiryCreateSchema.parse({
      ...valid,
      name: "  Samir ",
      businessName: "Samir Sweets",
      topic: "plan",
      plan: "spotlight",
      website: "",
    });
    expect(parsed).toMatchObject({ name: "Samir", plan: "spotlight", website: "" });
    expect(InquiryCreateSchema.safeParse({ ...valid, contact: "samir@example.com" }).success).toBe(
      true,
    );
    expect(InquiryCreateSchema.safeParse({ ...valid, contact: "+972 50 123 4567" }).success).toBe(
      true,
    );
  });

  it.each([
    ["a one-letter name", { name: "S" }],
    ["a name over 80", { name: "x".repeat(81) }],
    ["a contact that is neither", { contact: "call me maybe" }],
    ["a short phone", { contact: "12345" }],
    ["a contact over 120", { contact: `${"a".repeat(115)}@x.com` }],
    ["a business name over 120", { businessName: "b".repeat(121) }],
    ["an unknown topic", { topic: "jobs" }],
    ["a plan that is not a slug", { plan: "Not a slug" }],
    ["a short message", { message: "Hi there" }],
    ["a message over 3000", { message: "m".repeat(3001) }],
    ["an unknown locale", { locale: "fr" }],
  ])("refuses %s", (_, change) => {
    expect(InquiryCreateSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });

  it("tells an email from a phone", () => {
    expect([looksLikeEmail("a@b.co"), looksLikeEmail("050-1234567")]).toEqual([true, false]);
    expect([looksLikePhone("(04) 123-4567"), looksLikePhone("a@b.co")]).toEqual([true, false]);
  });
});

describe("routes", () => {
  it("posts publicly and lists and updates in the admin", () => {
    expect([contract.inquiries.create.method, contract.inquiries.create.path]).toEqual([
      "POST",
      "/inquiries",
    ]);
    expect(adminContract.inquiries.list.path).toBe("/admin/inquiries");
    expect(adminContract.inquiries.status.method).toBe("PATCH");
  });

  it("filters by status and only sets a known one", () => {
    expect(AdminInquiryListQuerySchema.parse({ status: "new" })).toEqual({
      status: "new",
      limit: 50,
    });
    expect(AdminInquiryListQuerySchema.safeParse({ status: "spam" }).success).toBe(false);
    expect(AdminInquiryStatusSchema.safeParse({ status: "handled" }).success).toBe(true);
    expect(AdminInquiryStatusSchema.safeParse({ status: "handled", note: "x" }).success).toBe(
      false,
    );
  });
});

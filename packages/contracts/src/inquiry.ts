import { z } from "zod";
import { SlugSchema } from "./schemas.js";
import { LocaleSchema } from "./search.js";

/** What a message on /contact is about. "plan" names the plan it came from (?plan=<slug>). */
export const INQUIRY_TOPICS = ["general", "join", "plan", "other"] as const;
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];
export const INQUIRY_STATUSES = ["new", "handled"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]+$/;

/** An email address, so the admin can answer with mailto: and the mail can set reply_to. */
export const looksLikeEmail = (contact: string): boolean => EMAIL.test(contact.trim());

/** A phone number: digits with spaces, dashes and brackets, an optional +, at least 7 digits. */
export const looksLikePhone = (contact: string): boolean => {
  const c = contact.trim();
  return PHONE.test(c) && c.replace(/\D/g, "").length >= 7;
};

/**
 * The /contact form. `website` is a honeypot: people never see it, so a filled one is a bot and
 * the API answers 201 without storing anything. Its length is bounded so a bot still gets a 201.
 */
export const InquiryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  contact: z
    .string()
    .trim()
    .min(5)
    .max(120)
    .refine((c) => looksLikeEmail(c) || looksLikePhone(c), {
      message: "Use a phone number or an email address",
    }),
  businessName: z.string().trim().max(120).optional(),
  topic: z.enum(INQUIRY_TOPICS),
  plan: SlugSchema.optional(),
  message: z.string().trim().min(10).max(3000),
  locale: LocaleSchema,
  website: z.string().max(500).optional(),
});
export type InquiryCreateDto = z.infer<typeof InquiryCreateSchema>;

export const InquiryAcceptedSchema = z.object({ ok: z.literal(true) });

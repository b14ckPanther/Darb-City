import type { InquiryTopic } from "@darb/contracts";
import { isSlug } from "@darb/core";

/**
 * The /contact form's own checks, the same limits as InquiryCreateSchema (contact-form.test.ts
 * holds them together). Kept apart from @darb/contracts so the browser never loads zod.
 */
export const LIMITS = {
  name: [2, 80],
  contact: [5, 120],
  business: 120,
  message: [10, 3000],
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]+$/;

export const isContact = (value: string): boolean => {
  const v = value.trim();
  return EMAIL.test(v) || (PHONE.test(v) && v.replace(/\D/g, "").length >= 7);
};

export interface ContactFields {
  name: string;
  contact: string;
  businessName: string;
  topic: InquiryTopic;
  message: string;
}

export type FieldError = "name" | "contact" | "messageShort" | "messageLong";

/** Each field that cannot be sent, with the reason (the copy's error key). */
export function fieldErrors(f: ContactFields): Partial<Record<keyof ContactFields, FieldError>> {
  const name = f.name.trim().length;
  const contact = f.contact.trim();
  const message = f.message.trim().length;
  return {
    ...(name < LIMITS.name[0] || name > LIMITS.name[1] ? { name: "name" as const } : {}),
    ...(contact.length < LIMITS.contact[0] ||
    contact.length > LIMITS.contact[1] ||
    !isContact(contact)
      ? { contact: "contact" as const }
      : {}),
    ...(message < LIMITS.message[0] ? { message: "messageShort" as const } : {}),
    ...(message > LIMITS.message[1] ? { message: "messageLong" as const } : {}),
  };
}

const TOPICS: readonly InquiryTopic[] = ["general", "join", "plan", "other"];

/** ?plan=<slug> opens the form on that plan; ?topic=join on joining. Anything else: a question. */
export function initialTopic(params: { plan?: string; topic?: string }): {
  topic: InquiryTopic;
  plan: string | null;
} {
  if (params.plan && isSlug(params.plan)) return { topic: "plan", plan: params.plan };
  const topic = TOPICS.find((t) => t === params.topic);
  return { topic: topic ?? "general", plan: null };
}

/** The body the API takes: blanks dropped, the plan only on a plan message. */
export function inquiryBody(
  f: ContactFields,
  plan: string | null,
  locale: string,
  website: string,
): Record<string, string> {
  const business = f.businessName.trim();
  return {
    name: f.name.trim(),
    contact: f.contact.trim(),
    ...(business ? { businessName: business.slice(0, LIMITS.business) } : {}),
    topic: f.topic,
    ...(f.topic === "plan" && plan ? { plan } : {}),
    message: f.message.trim(),
    locale,
    ...(website ? { website } : {}),
  };
}

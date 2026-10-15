import { Inject, Injectable, Logger } from "@nestjs/common";
import { looksLikeEmail } from "@darb/contracts";
import { APP_CONFIG, type AppConfig } from "../config.js";
import type { Inquiry } from "../generated/prisma/client.js";

const RESEND_URL = "https://api.resend.com/emails";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\n/g, "<br>");

/** Every field, in the order the founder reads them. */
function fields(row: Inquiry): [string, string][] {
  return [
    ["Name", row.name],
    ["Contact", row.contact],
    ["Business", row.businessName ?? ""],
    ["Topic", row.topic],
    ["Plan", row.plan ?? ""],
    ["Language", row.locale],
    ["Sent", row.createdAt.toISOString()],
    ["Message", row.message],
  ];
}

export function inquiryEmail(row: Inquiry, from: string, to: string) {
  const list = fields(row).filter(([, v]) => v !== "");
  return {
    from,
    to: [to],
    ...(looksLikeEmail(row.contact) ? { reply_to: row.contact } : {}),
    subject: `Darb · ${row.topic} · ${row.name}`,
    text: list.map(([k, v]) => (k === "Message" ? `\n${v}` : `${k}: ${v}`)).join("\n"),
    html: `<table cellpadding="6" style="font-family:sans-serif;font-size:15px">${list
      .map(([k, v]) => `<tr><th align="left" valign="top">${k}</th><td>${escape(v)}</td></tr>`)
      .join("")}</table>`,
  };
}

/**
 * Sends a /contact message to the founder through Resend's HTTP API (no SDK). Without
 * RESEND_API_KEY it does nothing (logged once). A failure is logged and never thrown: the message
 * is already in the admin inbox.
 */
@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  private warned = false;
  fetchImpl: typeof fetch = fetch;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Whether Resend accepted the mail. */
  async sendInquiry(row: Inquiry): Promise<boolean> {
    const { resendApiKey, mailFrom, mailTo } = this.config.inquiry;
    if (!resendApiKey) {
      if (!this.warned)
        this.logger.warn("RESEND_API_KEY is not set: contact messages go to the admin inbox only");
      this.warned = true;
      return false;
    }
    try {
      const res = await this.fetchImpl(RESEND_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${resendApiKey}`, "content-type": "application/json" },
        body: JSON.stringify(inquiryEmail(row, mailFrom, mailTo)),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return true;
      this.logger.warn(`Resend answered ${res.status} for inquiry ${row.id}`);
    } catch {
      this.logger.warn(`Resend could not be reached for inquiry ${row.id}`);
    }
    return false;
  }
}

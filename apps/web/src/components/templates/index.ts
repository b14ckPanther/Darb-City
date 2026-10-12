import type { Template } from "@darb/core";
import { ScreenSchema, type ScreenDto } from "@darb/contracts";
import type { JSX } from "react";
import { Booking } from "./Booking";
import { Builder } from "./Builder";
import { Donate } from "./Donate";
import { Listing } from "./Listing";
import { Menu } from "./Menu";
import { Pass } from "./Pass";
import { Portfolio } from "./Portfolio";
import { Quote } from "./Quote";
import { Schedule } from "./Schedule";
import type { TemplateProps } from "./shared";
import { Shop } from "./Shop";
import { Tracker } from "./Tracker";

export const TEMPLATE_BODIES: Record<Template, (props: TemplateProps) => JSX.Element> = {
  menu: Menu,
  booking: Booking,
  shop: Shop,
  portfolio: Portfolio,
  listing: Listing,
  schedule: Schedule,
  quote: Quote,
  donate: Donate,
  tracker: Tracker,
  pass: Pass,
  builder: Builder,
};

export function parseScreen(experience: unknown): ScreenDto | null {
  const parsed = ScreenSchema.safeParse(experience);
  return parsed.success ? parsed.data : null;
}

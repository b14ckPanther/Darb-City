import { z } from "zod";
import {
  BusinessSummarySchema,
  LocalizedSchema,
  NearestPlaceSchema,
  SlugSchema,
} from "./schemas.js";

export const LocaleSchema = z.enum(["he", "ar", "en"]);

/** A person's position: sent only after "Near me", used once, never stored (spec §5.4). */
export const PointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Spec §5.3's intent, with slugs for ids (decision 3). Chips are drawn from it. */
export const IntentSchema = z.object({
  kinds: z.array(SlugSchema).max(5),
  place: SlugSchema.nullable(),
  nearMe: z.boolean(),
  openNow: z.boolean(),
  attributes: z.object({ delivers: z.boolean() }),
  freeText: z.string().max(120),
});
export type IntentDto = z.infer<typeof IntentSchema>;

export const EMPTY_INTENT: IntentDto = {
  kinds: [],
  place: null,
  nearMe: false,
  openNow: false,
  attributes: { delivers: false },
  freeText: "",
};

export const SearchRequestSchema = z.object({
  q: z.string().trim().min(1).max(200),
  locale: LocaleSchema,
  near: PointSchema.optional(),
});
export type SearchRequestDto = z.infer<typeof SearchRequestSchema>;

/** A chip edit: retrieval again with the edited intent, never the model. */
export const ResultsRequestSchema = z.object({
  q: z.string().max(200),
  locale: LocaleSchema,
  intent: IntentSchema,
  near: PointSchema.optional(),
});
export type ResultsRequestDto = z.infer<typeof ResultsRequestSchema>;

export const SearchResponseSchema = z.object({
  status: z.enum(["ok", "blocked"]),
  lane: z.enum(["smart", "instant"]),
  /** For POST /search/click; null for chip edits and blocked queries. */
  queryId: z.string().nullable(),
  intent: IntentSchema,
  /** The intent asks for "near me" and no point was sent: the page offers the Near me button. */
  needsLocation: z.boolean(),
  items: z.array(BusinessSummarySchema),
  /** When nothing matched a kind: the nearest live places that have it (spec §7). */
  nearest: z.array(NearestPlaceSchema),
});
export type SearchResponseDto = z.infer<typeof SearchResponseSchema>;

export const SuggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(60),
  /** The place the person is looking at: its businesses come first. */
  place: SlugSchema.optional(),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

export const SuggestionSchema = z.object({
  slug: SlugSchema,
  placeSlug: SlugSchema,
  kindSlug: SlugSchema,
  sectorSlug: SlugSchema,
  name: LocalizedSchema,
  placeName: LocalizedSchema,
});
export type SuggestionDto = z.infer<typeof SuggestionSchema>;

export const ClickRequestSchema = z.object({
  queryId: z.string().uuid(),
  key: z.string().min(1).max(200),
});

export const ReportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const ReportRowSchema = z.object({
  term: z.string(),
  count: z.number().int().nonnegative(),
});
export const MissingReportSchema = z.object({
  since: z.string(),
  missingKinds: z.array(ReportRowSchema),
  missingPlaces: z.array(ReportRowSchema),
  noResults: z.array(ReportRowSchema),
});
export type MissingReportDto = z.infer<typeof MissingReportSchema>;

export const TooManySchema = z.object({
  message: z.string(),
  retryAfter: z.number().int().nonnegative(),
});

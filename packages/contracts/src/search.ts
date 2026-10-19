import { z } from "zod";
import {
  BusinessSummarySchema,
  DietarySchema,
  LocalizedSchema,
  NearestPlaceSchema,
  SlugSchema,
} from "./schemas.js";

export const LocaleSchema = z.enum(["he", "ar", "en"]);

/** A condition a search can state: open now, delivers, or a whole gluten-free kitchen. */
export const ConditionSchema = z.enum(["openNow", "delivers", "gluten_free"]);
export type Condition = z.infer<typeof ConditionSchema>;

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
  /** Whole-business dietary facts asked for ("gluten free", "ללא גלוטן"); lane 1 finds them. */
  dietary: z.array(DietarySchema).max(4).default([]),
  freeText: z.string().max(120),
  /**
   * The specific things asked for ("shawarma", "car wash", "EV charging"), searched inside every
   * business's card: its items, services and tags. Empty: a kind or a place is the whole ask.
   */
  items: z.array(z.string().trim().min(1).max(60)).max(5).default([]),
  /** Stated conditions every result must meet (the server derives it from the flags above). */
  mustHave: z.array(ConditionSchema).max(3).default([]),
  /** Conditions said as a wish ("ideally open now"): they lift results instead of filtering. */
  niceToHave: z.array(ConditionSchema).max(3).default([]),
});
export type IntentDto = z.infer<typeof IntentSchema>;

export const EMPTY_INTENT: IntentDto = {
  kinds: [],
  place: null,
  nearMe: false,
  openNow: false,
  attributes: { delivers: false },
  dietary: [],
  freeText: "",
  items: [],
  mustHave: [],
  niceToHave: [],
};

/** Gluten free is a safety fact, never only a wish: it is always a must. */
export function conditionsOf(intent: IntentDto): {
  mustHave: Condition[];
  niceToHave: Condition[];
} {
  const stated: Condition[] = [
    ...(intent.openNow ? (["openNow"] as const) : []),
    ...(intent.attributes.delivers ? (["delivers"] as const) : []),
    ...(intent.dietary.includes("gluten_free") ? (["gluten_free"] as const) : []),
  ];
  const nice = stated.filter((c) => c !== "gluten_free" && intent.niceToHave.includes(c));
  return { mustHave: stated.filter((c) => !nice.includes(c)), niceToHave: nice };
}

export const SearchRequestSchema = z.object({
  q: z.string().trim().min(1).max(200),
  locale: LocaleSchema,
  near: PointSchema.optional(),
  /**
   * Answer now without waiting for the model (cached answers still count): the page shows this
   * first, then the full search replaces it. `refining` in the response says one is coming.
   */
  instant: z.boolean().optional(),
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

/** The thing inside a business's card that answered the search ("Shawarma" in "Sandwiches"). */
export const MatchedSchema = z.object({
  label: LocalizedSchema,
  context: LocalizedSchema.optional(),
});
export type MatchedDto = z.infer<typeof MatchedSchema>;

export const SearchItemSchema = BusinessSummarySchema.extend({
  matched: MatchedSchema.optional(),
});
export type SearchItemDto = z.infer<typeof SearchItemSchema>;

export const SearchResponseSchema = z.object({
  status: z.enum(["ok", "blocked"]),
  lane: z.enum(["smart", "instant"]),
  /** For POST /search/click; null for chip edits and blocked queries. */
  queryId: z.string().uuid().nullable(),
  intent: IntentSchema,
  /** The intent asks for "near me" and no point was sent: the page offers the Near me button. */
  needsLocation: z.boolean(),
  items: z.array(SearchItemSchema),
  /** When nothing matched a kind: the nearest live places that have it (spec §7). */
  nearest: z.array(NearestPlaceSchema),
  /**
   * Nothing matched where the search asked, so the items come from further away ("wider", each
   * with its distance) or are related businesses without the asked thing ("related").
   */
  fallback: z.enum(["wider", "related"]).nullable().default(null),
  /** The thing looked for inside the cards, in the query's words ("shawarma"); null if none. */
  searched: z.string().max(60).nullable().default(null),
  /**
   * When nothing (or nothing exact) answered: the kinds closest to what was typed, by spelling
   * or by meaning, to search instead ("did you mean").
   */
  suggestions: z
    .array(z.object({ slug: z.string(), name: LocalizedSchema }))
    .max(4)
    .default([]),
  /** An `instant` answer that the full search (with the model) may still refine. */
  refining: z.boolean().default(false),
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

/** A result's key: its place slug and its business slug, "sakhnin/abu-salim". */
export const ClickKeySchema = z
  .string()
  .max(200)
  .refine((key) => {
    const parts = key.split("/");
    return parts.length === 2 && parts.every((p) => SlugSchema.safeParse(p).success);
  }, "A click key is place/slug");

export const ClickRequestSchema = z.object({
  queryId: z.string().uuid(),
  key: ClickKeySchema,
});

/**
 * Never a 400: a bad value reads as the default, so the endpoint answers nothing but 404 to a
 * caller without the key, whatever the query.
 */
export const ReportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).catch(30),
  limit: z.coerce.number().int().min(1).max(200).catch(50),
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
  /**
   * Lane 2 per UTC day, newest first: how each search's intent was decided (instant, cached,
   * answered, empty, timeout, error, budget, negative), model calls, their total milliseconds
   * and latency buckets (le500 to gt5000). Counts only, never queries.
   */
  intent: z
    .array(z.object({ day: z.string(), counts: z.record(z.string(), z.number()) }))
    .default([]),
});
export type MissingReportDto = z.infer<typeof MissingReportSchema>;

export const TooManySchema = z.object({
  message: z.string(),
  retryAfter: z.number().int().nonnegative(),
});

/** The lane-1 index (packages/search-text InstantIndex); entries are checked by the matcher. */
export const InstantIndexSchema = z
  .object({ v: z.literal(1), places: z.array(z.unknown()), kinds: z.array(z.unknown()) })
  .passthrough();
export type InstantIndexDto = z.infer<typeof InstantIndexSchema>;

import type { Locale } from "@darb/core";
import { normalize } from "@darb/search-text";
import type { z } from "zod";
import {
  RawIntentSchema,
  type IntentProvider,
  type IntentRequest,
  type RawIntent,
} from "./intent.js";

export interface RecordedCase {
  query: string;
  locale: Locale;
  /** What the model answered (or, before `search:record` runs, what it is expected to answer). */
  recorded: z.input<typeof RawIntentSchema>;
  /** "authored" or the model id that produced `recorded`. */
  source: string;
  /**
   * Spec §9.3: the kind and place that must be in the top 3. `modelOnly` cases are ones lane 1
   * cannot answer: the quality run checks they fail with the model off and pass with it on.
   * Deep search cases name the business that must come first (`first`, "place/slug"), a dietary
   * fact the first result must have (`firstHas`), and words its matched thing must show (`matched`).
   */
  expect: {
    kind: string | null;
    place: string | null;
    blocked?: boolean;
    modelOnly?: boolean;
    first?: string;
    firstHas?: "gluten_free";
    matched?: string;
  };
  /** A mocked "Near me" point, for near-me cases. */
  near?: { lat: number; lng: number };
}

const key = (query: string, locale: Locale) => `${locale}:${normalize(query)}`;

/** Replays committed answers: the quality set and CI never call the model. */
export class RecordedIntentProvider implements IntentProvider {
  readonly name = "recorded";
  private readonly byKey: Map<string, RawIntent>;

  constructor(cases: readonly RecordedCase[]) {
    this.byKey = new Map(
      cases.map((c) => [key(c.query, c.locale), RawIntentSchema.parse(c.recorded)]),
    );
  }

  async extract(request: IntentRequest, _signal?: AbortSignal): Promise<RawIntent | null> {
    return this.byKey.get(key(request.query, request.locale)) ?? null;
  }
}

/** No model: every search is answered from lane 1. */
export class OffIntentProvider implements IntentProvider {
  readonly name = "off";
  async extract(_request?: IntentRequest, _signal?: AbortSignal): Promise<RawIntent | null> {
    return null;
  }
}

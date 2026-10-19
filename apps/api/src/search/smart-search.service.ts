import { Inject, Injectable } from "@nestjs/common";
import {
  conditionsOf,
  type IntentDto,
  type ResultsRequestDto,
  type SearchRequestDto,
  type SearchResponseDto,
} from "@darb/contracts";
import { isBlocked, normalize, type InstantResult } from "@darb/search-text";
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from "../ai/embeddings.js";
import { CLOCK, type Clock } from "../businesses/businesses.controller.js";
import { BusinessesRepository } from "../businesses/businesses.repository.js";
import { toPlaceDto } from "../places/place.mapper.js";
import { TaxonomyRepository } from "../taxonomy/taxonomy.repository.js";
import { cleanItems, searchedWords } from "./filters.js";
import { InstantService, type World } from "./instant.service.js";
import { IntentService } from "./intent.service.js";
import { RANKING } from "./ranking.config.js";
import { rank, type Ranked } from "./ranking.js";
import { RetrievalRepository, type RetrievalFilters } from "./retrieval.repository.js";
import { SearchLogRepository } from "./search-log.repository.js";
import { candidateSummary } from "./summary.js";

export const NEAR_RADIUS_KM = 25;
/** Voyage from Railway: about 0.3 to 0.9 s; it runs alongside the intent, so it costs no wait. */
export const EMBED_TIMEOUT_MS = 1500;
/** Results shown when nothing matched where asked: the nearest matches beyond it. */
export const WIDER_LIMIT = 10;

/** A deep-search candidate with real evidence of the asked thing on its card (or its name). */
const answers = (c: Ranked) =>
  (c.matched?.score ?? 0) >=
    (c.kind === 0 ? RANKING.offerings.otherKindEvidence : RANKING.offerings.evidence) ||
  c.text >= RANKING.offerings.nameEvidence;
type Point = { lat: number; lng: number };

const blockedResponse = (intent: IntentDto): SearchResponseDto => ({
  suggestions: [],
  refining: false,
  status: "blocked",
  lane: "instant",
  queryId: null,
  intent,
  needsLocation: false,
  items: [],
  nearest: [],
  fallback: null,
  searched: null,
});

@Injectable()
export class SmartSearchService {
  constructor(
    private readonly intents: IntentService,
    private readonly instant: InstantService,
    private readonly retrieval: RetrievalRepository,
    private readonly taxonomy: TaxonomyRepository,
    private readonly businesses: BusinessesRepository,
    private readonly log: SearchLogRepository,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async search(req: SearchRequestDto): Promise<SearchResponseDto> {
    // Lane 1 first (in process, no network): blocked text never reaches the embeddings provider.
    const lane1 = await this.instant.match(req.q);
    const embedding = lane1.blocked ? Promise.resolve(null) : this.embed(req.q); // parallel with the intent
    const resolved = await this.intents.resolve(req.q, req.locale, req.instant !== true);
    if (resolved.blocked) {
      await this.log.record({
        normalized: resolved.instant.normalized,
        locale: req.locale,
        intent: resolved.intent,
        unmatched: [],
        lane: "blocked",
        resultCount: 0,
      });
      return blockedResponse(resolved.intent);
    }
    const vector = await embedding;
    const intent =
      resolved.lane === "instant"
        ? await this.byMeaning(resolved.intent, resolved.instant, vector)
        : resolved.intent;
    const body = await this.answer(intent, req.near ?? null, vector, resolved.instant);
    // The quick answer is not logged: the full search that follows logs the query once.
    if (resolved.skipped) return { ...body, lane: resolved.lane, queryId: null, refining: true };
    const queryId = await this.log.record({
      normalized: resolved.instant.normalized,
      locale: req.locale,
      intent,
      unmatched: resolved.instant.unmatched,
      lane: resolved.lane,
      resultCount: body.items.length,
    });
    return { ...body, lane: resolved.lane, queryId, refining: false };
  }

  async results(req: ResultsRequestDto): Promise<SearchResponseDto | null> {
    const world = await this.instant.world();
    if (req.intent.kinds.some((k) => !world.kinds.has(k))) return null;
    if (req.intent.place && !world.places.has(req.intent.place)) return null;
    // The URL carries both the query and the free text: either may name what Darb does not list,
    // and neither then reaches the embeddings provider or retrieval.
    const names = world.prepared.names;
    if (isBlocked(req.q, names) || isBlocked(req.intent.freeText, names))
      return blockedResponse(req.intent);
    // The same text search() embeds (the query), so a chip edit never changes the ranking by
    // itself; the free text still narrows retrieval through the text filter.
    const body = await this.answer(
      req.intent,
      req.near ?? null,
      await this.embed(req.q),
      await this.instant.match(req.q),
    );
    return { ...body, lane: "instant", queryId: null, refining: false };
  }

  /**
   * Deep search never ends at nothing: what was asked where it was asked; else, for a kind with
   * nothing in it, the searched words inside every card; else the nearest matches beyond the
   * place ("wider"); else businesses of the asked kinds that meet every must ("related").
   */
  private async answer(
    asked: IntentDto,
    near: Point | null,
    embedding: number[] | null,
    lane1: InstantResult,
  ) {
    const world = await this.instant.world();
    const now = this.clock();
    // The flags are the truth: a chip edit that drops "open now" drops it from the musts too.
    const intent = { ...asked, ...conditionsOf(asked) };
    const filters = await this.filters(intent, near, embedding, world, now);
    const items = cleanItems(intent.items).map(normalize).filter(Boolean);
    const probe = filters.text ? [filters.text] : [];
    let fallback: "wider" | "related" | null = null;
    // What is looked for inside the cards: the intent's items, else the query's own words for
    // its kind (kinds then lift rather than filter), else, only when a kind has nothing, every
    // word but the place's.
    const own = searchedWords(lane1);
    const typed = cleanItems(
      intent.items.length
        ? intent.items
        : own.kind === null || intent.kinds.includes(own.kind)
          ? own.words
          : [],
    );
    const words = typed.map(normalize).filter(Boolean);
    // The query's words for a kind count only for a kind the intent kept (the model may read a
    // sentence better than lane 1 did).
    const ofKind = own.kind !== null && intent.kinds.includes(own.kind);
    // With no kind at all, the query's words are the ask itself ("pizza in Nazareth"): only
    // businesses that show them count, never whatever a loose text match brings.
    const deepFirst =
      items.length > 0 ||
      (ofKind && words.length > 0) ||
      (intent.kinds.length === 0 && words.length > 0);
    const origin = this.origin(intent, near, world);
    const bounded = !!(filters.placePath || filters.radiusKm);
    // Deep search shows only businesses with evidence of the asked thing (a burger search never
    // pads with grills that serve none). A business of an asked kind that lacks it answers only
    // when nothing has it, and then it is labelled "related".
    let related: Ranked[] = [];
    // When the searched words are the kind's own ("7ala2" for barbers), being of that kind is the
    // evidence.
    const byKind = items.length === 0 && ofKind;
    const answering = (found: Ranked[]) => {
      const hits = found.filter((c) => answers(c) || (byKind && c.kind === 1));
      if (hits.length === 0 && related.length === 0)
        related = found.filter((c) => c.kind === undefined || c.kind === 1);
      return hits;
    };
    // The asked things embedded on their own (once, only when looked for).
    let itemEmbedding: Promise<number[] | null> | null = null;
    const embedWords = () => (itemEmbedding ??= this.embed(words.join(" / ")));
    const deep = async () => ({ ...filters, items: words, itemEmbedding: await embedWords() });
    let found = deepFirst
      ? answering(await this.ranked(await deep()))
      : await this.ranked({ ...filters, probe });
    if (found.length === 0 && !deepFirst && filters.kindIds && words.length)
      found = answering(await this.ranked(await deep()));
    if (found.length === 0 && words.length && origin && bounded) {
      found = answering(await this.wider(await deep(), origin));
      if (found.length) fallback = "wider";
    }
    // Related businesses only for an asked kind or diet: never whatever happens to be open.
    if (found.length === 0 && words.length && (filters.kindIds || filters.dietary.length > 0)) {
      const plain = { ...filters, items: [], probe: [], text: "" };
      found = related.length ? related : await this.ranked(plain);
      if (found.length === 0 && origin && bounded) found = await this.wider(plain, origin);
      if (found.length) fallback = "related";
    }
    // No kind and nothing shows the words (a spelling no card has, "بيتسا"): the closest matches
    // by text and meaning, said to be related, never passed off as the answer.
    if (found.length === 0 && !filters.kindIds && filters.text) {
      found = (await this.ranked({ ...filters, probe })).slice(0, WIDER_LIMIT);
      if (found.length) fallback = "related";
    }
    const results = found.map((c) => candidateSummary(c, now));
    const nearest =
      results.length === 0 && filters.kindIds
        ? await this.nearest(filters.kindIds, intent, near, world)
        : [];
    const suggestions =
      results.length === 0 || fallback !== null
        ? await this.suggestions(intent, lane1, embedding, world)
        : [];
    return {
      status: "ok" as const,
      intent,
      needsLocation: intent.nearMe && near === null,
      items: results,
      nearest,
      fallback,
      searched: typed[0] ?? null,
      suggestions,
    };
  }

  /**
   * Lane 2 without the model (slow, down or over budget): when lane 1 found no kind, the kinds
   * closest in meaning to the whole query, if they are close enough to trust.
   */
  private async byMeaning(
    intent: IntentDto,
    lane1: InstantResult,
    embedding: number[] | null,
  ): Promise<IntentDto> {
    if (intent.kinds.length > 0 || !embedding || lane1.unmatched.length === 0) return intent;
    const s = RANKING.semantic;
    const near = await this.retrieval.nearestKinds(embedding, 5).catch(() => []);
    const top = near[0]?.similarity ?? 0;
    if (top < s.useKind) return intent;
    const world = await this.instant.world();
    const slugOf = new Map([...world.kinds.values()].map((k) => [k.id, k.slug]));
    const kinds = near
      .filter((k) => k.similarity >= top - s.band)
      .map((k) => slugOf.get(k.kindId))
      .filter((k): k is string => k !== undefined)
      .slice(0, s.maxKinds);
    return kinds.length ? { ...intent, kinds } : intent;
  }

  /**
   * "Did you mean": kinds lane 1 nearly matched by spelling, then kinds close in meaning, never
   * one already asked. Empty when nothing is close enough.
   */
  private async suggestions(
    intent: IntentDto,
    lane1: InstantResult,
    embedding: number[] | null,
    world: World,
  ) {
    const picked: string[] = [];
    const add = (slug: string | undefined) => {
      if (slug && world.kinds.has(slug) && !intent.kinds.includes(slug) && !picked.includes(slug))
        picked.push(slug);
    };
    // Spelled close to a kind (a typo or a sound-alike), not merely sharing a few letters.
    for (const k of lane1.kinds) if (k.score >= 0.7) add(k.entry.s);
    if (embedding) {
      const slugOf = new Map([...world.kinds.values()].map((k) => [k.id, k.slug]));
      const near = await this.retrieval.nearestKinds(embedding, 6).catch(() => []);
      for (const k of near) if (k.similarity >= RANKING.semantic.suggest) add(slugOf.get(k.kindId));
    }
    return picked.slice(0, 4).map((slug) => ({ slug, name: world.kinds.get(slug)!.name }));
  }

  private async ranked(filters: RetrievalFilters): Promise<Ranked[]> {
    return rank(await this.retrieval.retrieve(filters));
  }

  /** The same search with no place and no radius, nearest first, measured from the origin. */
  private async wider(filters: RetrievalFilters, origin: Point): Promise<Ranked[]> {
    const all = await this.ranked({ ...filters, placePath: null, radiusKm: null, near: origin });
    return all.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity)).slice(0, WIDER_LIMIT);
  }

  /** Where "nearest" is measured from: the person's point, else the searched place's centre. */
  private origin(intent: IntentDto, near: Point | null, world: World): Point | null {
    if (intent.nearMe && near) return near;
    const place = intent.place ? world.places.get(intent.place) : undefined;
    return place ? { lat: place.lat, lng: place.lng } : null;
  }

  private async filters(
    intent: IntentDto,
    near: Point | null,
    embedding: number[] | null,
    world: World,
    now: Date,
  ): Promise<RetrievalFilters> {
    const kindIds = intent.kinds.length
      ? [
          ...new Set(
            (
              await Promise.all(
                // A kind can vanish between the intent and this world (a rebuild): drop it.
                intent.kinds
                  .map((k) => world.kinds.get(k))
                  .filter((k) => k !== undefined)
                  .map((k) => this.taxonomy.descendantKindIds(k.id)),
              )
            ).flat(),
          ),
        ]
      : null;
    const place = intent.place ? world.places.get(intent.place) : undefined;
    const point = intent.nearMe && near ? near : null;
    return {
      kindIds,
      placePath: place?.path ?? null,
      near: point,
      radiusKm: point && !place ? NEAR_RADIUS_KM : null,
      // A wish ("ideally open now") lifts results; a must filters them.
      openAt: intent.mustHave.includes("openNow") ? now : null,
      delivers: intent.mustHave.includes("delivers"),
      nice: {
        openAt: intent.niceToHave.includes("openNow") ? now : null,
        delivers: intent.niceToHave.includes("delivers"),
      },
      dietary: intent.dietary,
      text: normalize(intent.freeText),
      embedding,
    };
  }

  private async nearest(kindIds: string[], intent: IntentDto, near: Point | null, world: World) {
    const place = intent.place ? world.places.get(intent.place) : undefined;
    const origin = near ?? (place ? { lat: place.lat, lng: place.lng } : null);
    if (!origin) return [];
    const rows = await this.businesses.nearestPlacesWithKind(kindIds, origin.lat, origin.lng, 5);
    return rows.map((r) => ({ ...toPlaceDto(r.place), count: r.count, distanceKm: r.distanceKm }));
  }

  /** The query's embedding, or null when the provider is slow or failing (ranking then skips it). */
  private async embed(text: string): Promise<number[] | null> {
    if (text.trim() === "") return null;
    try {
      const [v] = await this.embeddings.embed(
        [text],
        "query",
        AbortSignal.timeout(EMBED_TIMEOUT_MS),
      );
      return v ?? null;
    } catch {
      return null;
    }
  }
}

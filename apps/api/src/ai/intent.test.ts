import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AnthropicIntentProvider } from "./anthropic-intent.provider.js";
import {
  INTENT_TOOL,
  systemPrompt,
  userMessage,
  type IntentRequest,
  type RawIntent,
} from "./intent.js";
import { OffIntentProvider, RecordedIntentProvider } from "./recorded-intent.provider.js";

const request: IntentRequest = {
  query: "knafeh near me open now",
  locale: "en",
  candidates: { kinds: [{ slug: "sweets", name: "Knafeh and Arabic sweets" }], places: [] },
  activeKinds: [],
};
const intent: RawIntent = {
  kinds: ["sweets"],
  place: null,
  nearMe: true,
  openNow: true,
  attributes: { delivers: false },
  freeText: "",
};

function fakeClient(message: Partial<Anthropic.Message>) {
  const create = vi.fn(
    async () => ({ stop_reason: "tool_use", content: [], ...message }) as Anthropic.Message,
  );
  return { client: { messages: { create } } as unknown as Pick<Anthropic, "messages">, create };
}
const toolUse = (input: unknown): Anthropic.ContentBlock =>
  ({ type: "tool_use", id: "t1", name: "record_intent", input }) as Anthropic.ContentBlock;

describe("Anthropic intent provider", () => {
  it("forces one strict tool call on the configured model, with a cached system prompt", async () => {
    const { client, create } = fakeClient({ content: [toolUse(intent)] });
    const provider = new AnthropicIntentProvider(client, "claude-haiku-5-5");
    expect(
      await provider.extract(
        { ...request, activeKinds: ["cafes", "sweets"] },
        new AbortController().signal,
      ),
    ).toEqual(intent);
    const [params, options] = create.mock.calls[0] as unknown as [
      Anthropic.MessageCreateParamsNonStreaming,
      { signal: AbortSignal },
    ];
    expect(params.model).toBe("claude-haiku-5-5");
    expect(params.tools).toEqual([INTENT_TOOL]);
    expect(INTENT_TOOL.strict).toBe(true);
    expect(params.tool_choice).toEqual({
      type: "tool",
      name: "record_intent",
      disable_parallel_tool_use: true,
    });
    expect(params.thinking).toEqual({ type: "disabled" });
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params).not.toHaveProperty("temperature");
    expect(params.system).toEqual([
      {
        type: "text",
        text: systemPrompt(["cafes", "sweets"]),
        cache_control: { type: "ephemeral" },
      },
    ]);
    expect(params.messages).toEqual([{ role: "user", content: userMessage(request) }]);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it("gives null on a refusal, a missing tool call, or input outside the schema", async () => {
    for (const message of [
      { stop_reason: "refusal" as const, content: [] },
      { content: [{ type: "text", text: "hi", citations: null } as Anthropic.ContentBlock] },
      { content: [toolUse({ ...intent, kinds: "sweets" })] },
      { stop_reason: "max_tokens" as const, content: [toolUse(intent)] },
    ]) {
      const { client } = fakeClient(message);
      expect(
        await new AnthropicIntentProvider(client, "m").extract(
          request,
          new AbortController().signal,
        ),
      ).toBeNull();
    }
  });
  it("lets transport errors through for the service's fallback", async () => {
    const client = {
      messages: { create: vi.fn().mockRejectedValue(new Error("boom")) },
    } as unknown as Pick<Anthropic, "messages">;
    await expect(
      new AnthropicIntentProvider(client, "m").extract(request, new AbortController().signal),
    ).rejects.toThrow("boom");
  });
});

describe("prompts", () => {
  it("never mention halal or religion, and list the active kinds", () => {
    const text = `${systemPrompt(["sweets"])} ${JSON.stringify(INTENT_TOOL)}`;
    expect(text).not.toMatch(/halal|religio|islam|kosher/i);
    expect(systemPrompt(["sweets", "cafes"])).toContain("sweets, cafes");
  });
  it("send the query and the candidates only", () => {
    expect(JSON.parse(userMessage(request))).toEqual({
      query: "knafeh near me open now",
      locale: "en",
      candidateKinds: [{ slug: "sweets", name: "Knafeh and Arabic sweets" }],
      candidatePlaces: [],
    });
  });
});

describe("recorded and off providers", () => {
  it("replays by normalized query and locale", async () => {
    const recorded = new RecordedIntentProvider([
      {
        query: "Knafeh near me, open now!",
        locale: "en",
        recorded: intent,
        source: "authored",
        expect: { kind: "sweets", place: null },
      },
    ]);
    expect(await recorded.extract(request, new AbortController().signal)).toEqual(intent);
    expect(
      await recorded.extract({ ...request, locale: "he" }, new AbortController().signal),
    ).toBeNull();
  });
  it("off answers null at once", async () => {
    expect(await new OffIntentProvider().extract(request, new AbortController().signal)).toBeNull();
  });
});

it("builds the system prompt from the request's kind list and reuses identical bytes", async () => {
  const calls: unknown[] = [];
  const client = {
    messages: {
      create: async (body: { system: unknown }) => {
        calls.push(body.system);
        return { stop_reason: "end_turn", content: [] };
      },
    },
  } as unknown as ConstructorParameters<typeof AnthropicIntentProvider>[0];
  const provider = new AnthropicIntentProvider(client, "m");
  const base = { query: "q", locale: "en" as const, candidates: { kinds: [], places: [] } };
  const signal = new AbortController().signal;
  await provider.extract({ ...base, activeKinds: ["a", "b"] }, signal);
  await provider.extract({ ...base, activeKinds: ["a", "b"] }, signal);
  await provider.extract({ ...base, activeKinds: ["a", "b", "c"] }, signal);
  expect(calls[0]).toBe(calls[1]); // same array instance: memoized
  expect(JSON.stringify(calls[2])).toContain("c");
  expect(calls[2]).not.toBe(calls[1]);
});

import type Anthropic from "@anthropic-ai/sdk";
import {
  INTENT_TOOL,
  RawIntentSchema,
  systemPrompt,
  userMessage,
  type IntentProvider,
  type IntentRequest,
  type RawIntent,
} from "./intent.js";

/** Claude Haiku 5.5 by default (INTENT_MODEL). See Task 10's notes for every parameter. */
export class AnthropicIntentProvider implements IntentProvider {
  readonly name = "anthropic";
  /** One entry: the same kind list reuses the same bytes, so the cached prefix holds. */
  private memo: { key: string; system: Anthropic.TextBlockParam[] } | null = null;

  constructor(
    private readonly client: Pick<Anthropic, "messages">,
    private readonly model: string,
  ) {}

  private system(kinds: readonly string[]): Anthropic.TextBlockParam[] {
    const key = kinds.join(",");
    if (this.memo?.key !== key)
      this.memo = {
        key,
        system: [{ type: "text", text: systemPrompt(kinds), cache_control: { type: "ephemeral" } }],
      };
    return this.memo.system;
  }

  async extract(request: IntentRequest, signal: AbortSignal): Promise<RawIntent | null> {
    const message = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: 400,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: this.system(request.activeKinds),
        tools: [INTENT_TOOL],
        tool_choice: { type: "tool", name: INTENT_TOOL.name, disable_parallel_tool_use: true },
        messages: [{ role: "user", content: userMessage(request) }],
      },
      { signal },
    );
    if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") return null;
    const call = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === INTENT_TOOL.name,
    );
    const parsed = call ? RawIntentSchema.safeParse(call.input) : null;
    return parsed?.success ? parsed.data : null;
  }
}

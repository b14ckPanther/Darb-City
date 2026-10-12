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
  private readonly system: Anthropic.TextBlockParam[];

  constructor(
    private readonly client: Pick<Anthropic, "messages">,
    private readonly model: string,
    activeKindSlugs: readonly string[],
  ) {
    this.system = [
      { type: "text", text: systemPrompt(activeKindSlugs), cache_control: { type: "ephemeral" } },
    ];
  }

  async extract(request: IntentRequest, signal: AbortSignal): Promise<RawIntent | null> {
    const message = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: 400,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: this.system,
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

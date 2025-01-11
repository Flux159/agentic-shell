import { Anthropic } from "@anthropic-ai/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";

const USE_BEDROCK = false;

export function getAnthropicClient(): {
  anthropic: Anthropic | AnthropicBedrock;
  model: string;
} {
  let anthropic: Anthropic | AnthropicBedrock;
  let model: string;

  if (USE_BEDROCK) {
    // Should use ~/.aws/credentials or AWS_SECRET_ACCESS_KEY and AWS_ACCESS_KEY_ID environment vars automatically for Bedrock
    anthropic = new AnthropicBedrock({});
    // model = "anthropic.claude-3-5-sonnet-20240620-v1:0";
    model = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
  } else {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    // model = "claude-3-5-sonnet-20240620";
    model = "claude-3-5-sonnet-20241022";
  }

  return { anthropic, model };
}

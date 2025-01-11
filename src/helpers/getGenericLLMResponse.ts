import { OpenAI } from "openai";
import type { Anthropic } from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./getAnthropicClient";

export type ProviderOption = "openai" | "anthropic" | "google";

type OpenAIOptions = {
  oldMessages?: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  provider?: "openai";
};

type AnthropicOptions = {
  oldMessages?: Anthropic.Messages.MessageParam[];
  provider?: "anthropic";
};

type GoogleOptions = {
  oldMessages?: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  provider?: "google";
  tools?: {
    google_search?: {};
  };
  generationConfig?: any;
};

type CommonOptions = {
  system?: string;
  model?: string;
};

type GenericLLMResponseOptions = CommonOptions &
  (OpenAIOptions | AnthropicOptions | GoogleOptions);

async function getOpenAIResponse(
  input: string,
  options?: CommonOptions & OpenAIOptions
): Promise<string> {
  let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  // Add system message if provided
  if (options?.system) {
    // @ts-ignore
    messages.push({
      role: "system",
      content: [{ type: "text" as "text", text: options.system }],
    });
  }

  if (options?.oldMessages) {
    messages = [...options.oldMessages, { role: "user", content: input }];
  } else {
    messages = [{ role: "user", content: input }];
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });

  // TODO: Support tool use here too
  return response.choices[0].message.content || "";
}

async function getAnthropicResponse(
  input: string,
  options: CommonOptions & AnthropicOptions
): Promise<string | Anthropic.ToolUseBlock> {
  const { anthropic, model } = getAnthropicClient();

  let messages: Anthropic.Messages.MessageParam[] = [];
  if (options.oldMessages) {
    messages = [...options.oldMessages, { role: "user", content: input }];
  } else {
    messages = [{ role: "user", content: input }];
  }

  const message = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: options.system,
    messages,
  });

  if (message.content[0].type == "text") {
    message.content[0].text;
  } else {
    return message.content[0];
  }

  messages.push({ role: "assistant", content: message.content[0].text });

  return message.content[0].text;
}

async function getGoogleResponse(
  input: string,
  options: CommonOptions & GoogleOptions
): Promise<string | any> {
  const model = options.model || "gemini-2.0-flash-exp";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: input }] }],
      systemInstruction: options.system
        ? {
            role: "user",
            parts: [{ text: options.system }],
          }
        : undefined,
      generationConfig: options.generationConfig || undefined,
      tools: options.tools,
    }),
  });

  const data = await response.json();

  // TODO: Type this properly
  return data.candidates[0].content.parts[0].text;
}

export async function getGenericLLMResponse(
  input: string,
  options?: GenericLLMResponseOptions
): Promise<string | any> {
  switch (options?.provider) {
    case "anthropic":
      return getAnthropicResponse(input, options);
    case "google":
      return getGoogleResponse(input, options);
    case "openai":
    default:
      const openAIOptions = options as CommonOptions & OpenAIOptions;
      return getOpenAIResponse(input, openAIOptions);
  }
}

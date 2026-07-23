import OpenAI from "openai";

import type { ChatMessage } from "./types";

export function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export function shouldUseMockMode(): boolean {
  const mode = process.env.IMERSIA_AI_MODE?.trim().toLowerCase();
  if (mode === "mock") return true;
  if (mode === "openai") return false;
  return !process.env.OPENAI_API_KEY?.trim();
}

export async function createOpenAIChatStream(
  client: OpenAI,
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<ReadableStream<Uint8Array>> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user", content: userMessage },
  ];

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    messages,
    stream: true,
    max_tokens: 180,
    temperature: 0.85,
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

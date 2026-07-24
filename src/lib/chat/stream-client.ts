import type { ChatRequestBody, GeneroEscolhido } from "./types";

export interface CoachRequestBody {
  generoEscolhido: GeneroEscolhido;
  patienceLevel?: number;
  lastBossMessage?: string;
  history?: ChatRequestBody["history"];
}

export interface StreamResult {
  text: string;
  patience: number;
  mode: string;
}

export async function consumeTextStream(
  response: Response,
  onChunk: (accumulated: string) => void,
): Promise<StreamResult> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Falha na resposta do servidor.");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Stream indisponível.");
  }

  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += decoder.decode(value, { stream: true });
    onChunk(fullText);
  }

  return {
    text: fullText,
    patience: Number(response.headers.get("X-Patience-Level") ?? 100),
    mode: response.headers.get("X-AI-Mode") ?? "mock",
  };
}

export async function streamChat(
  body: ChatRequestBody,
  onChunk: (accumulated: string) => void,
): Promise<StreamResult> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return consumeTextStream(response, onChunk);
}

export async function streamCoach(
  body: CoachRequestBody,
  onChunk: (accumulated: string) => void,
): Promise<StreamResult> {
  const response = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return consumeTextStream(response, onChunk);
}

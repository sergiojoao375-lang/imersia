import { buildSystemPrompt, getArquetipo } from "@/lib/chat/arquetipos";
import { buildMockReply, createMockTextStream } from "@/lib/chat/mock-stream";
import {
  createOpenAIChatStream,
  createOpenAIClient,
  shouldUseMockMode,
} from "@/lib/chat/openai-stream";
import {
  calculatePatienceAfterMessage,
  resolvePatienceLevel,
} from "@/lib/chat/patience";
import type { ChatRequestBody } from "@/lib/chat/types";

export const runtime = "nodejs";

const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

function buildStreamResponse(
  stream: ReadableStream<Uint8Array>,
  patienceLevel: number,
  mode: "openai" | "mock",
): Response {
  return new Response(stream, {
    headers: {
      ...STREAM_HEADERS,
      "X-Patience-Level": String(patienceLevel),
      "X-AI-Mode": mode,
    },
  });
}

function validateRequest(body: ChatRequestBody): string | null {
  if (!body.message || typeof body.message !== "string") {
    return "Campo 'message' é obrigatório.";
  }

  if (!body.generoEscolhido || !["masculino", "feminino"].includes(body.generoEscolhido)) {
    return "Campo 'generoEscolhido' deve ser 'masculino' ou 'feminino'.";
  }

  if (body.patienceLevel !== undefined) {
    const level = Number(body.patienceLevel);
    if (Number.isNaN(level) || level < 0 || level > 100) {
      return "Campo 'patienceLevel' deve estar entre 0 e 100.";
    }
  }

  return null;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "JSON inválido no corpo do pedido." }, { status: 400 });
  }

  const validationError = validateRequest(body);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const arquetipo = getArquetipo(body.arquetipoId ?? "chefe_narcisista");
  const biometrics = body.biometrics ?? {};
  const history = body.history ?? [];
  const currentPatience = resolvePatienceLevel(body.patienceLevel);
  const updatedPatience = calculatePatienceAfterMessage(
    currentPatience,
    biometrics,
    body.message,
  );

  const systemPrompt = buildSystemPrompt(
    arquetipo,
    body.generoEscolhido,
    updatedPatience,
    biometrics,
  );

  const useMock = shouldUseMockMode();

  try {
    if (useMock) {
      const mockText = buildMockReply(
        arquetipo,
        body.generoEscolhido,
        updatedPatience,
        biometrics,
        body.message,
      );
      const stream = await createMockTextStream(mockText);
      return buildStreamResponse(stream, updatedPatience, "mock");
    }

    const client = createOpenAIClient();
    if (!client) {
      const fallbackText = buildMockReply(
        arquetipo,
        body.generoEscolhido,
        updatedPatience,
        biometrics,
        body.message,
      );
      const stream = await createMockTextStream(fallbackText);
      return buildStreamResponse(stream, updatedPatience, "mock");
    }

    const stream = await createOpenAIChatStream(
      client,
      systemPrompt,
      history,
      body.message,
    );

    return buildStreamResponse(stream, updatedPatience, "openai");
  } catch (error) {
    console.error("[api/chat] Erro ao gerar resposta:", error);
    return Response.json(
      { error: "Falha ao gerar resposta da simulação." },
      { status: 500 },
    );
  }
}

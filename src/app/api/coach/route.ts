import { createCoachStream } from "@/lib/chat/coach";
import type { CoachRequestBody } from "@/lib/chat/stream-client";

export const runtime = "nodejs";

const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

function validateRequest(body: CoachRequestBody): string | null {
  if (!body.generoEscolhido || !["masculino", "feminino"].includes(body.generoEscolhido)) {
    return "Campo 'generoEscolhido' deve ser 'masculino' ou 'feminino'.";
  }
  return null;
}

export async function POST(request: Request) {
  let body: CoachRequestBody;

  try {
    body = (await request.json()) as CoachRequestBody;
  } catch {
    return Response.json({ error: "JSON inválido no corpo do pedido." }, { status: 400 });
  }

  const validationError = validateRequest(body);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  try {
    const { stream, patienceLevel, mode } = await createCoachStream(body);

    return new Response(stream, {
      headers: {
        ...STREAM_HEADERS,
        "X-Patience-Level": String(patienceLevel),
        "X-AI-Mode": mode,
      },
    });
  } catch (error) {
    console.error("[api/coach] Erro ao gerar sugestões:", error);
    return Response.json(
      { error: "Falha ao gerar sugestões do Coach Sombra." },
      { status: 500 },
    );
  }
}

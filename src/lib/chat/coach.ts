import type { GeneroEscolhido } from "./types";
import { getArquetipo, getNomeArquetipo } from "./arquetipos";
import { createMockTextStream } from "./mock-stream";
import {
  createOpenAIChatStream,
  createOpenAIClient,
  shouldUseMockMode,
} from "./openai-stream";
import { resolvePatienceLevel } from "./patience";
import type { CoachRequestBody } from "./stream-client";

function buildCoachSystemPrompt(
  genero: GeneroEscolhido,
  patienceLevel: number,
  lastBossMessage?: string,
): string {
  const arquetipo = getArquetipo("chefe_narcisista");
  const nome = getNomeArquetipo(arquetipo, genero);

  return [
    "Tu és o Coach Sombra do Imersia — um mentor discreto que sussurra sugestões ao utilizador durante uma simulação de conversa difícil.",
    `O chefe actual é ${nome} (${arquetipo.perfilComportamental}).`,
    `Paciência do chefe: ${patienceLevel}/100.`,
    lastBossMessage ? `Última mensagem do chefe: "${lastBossMessage}"` : "",
    "",
    "REGRAS:",
    "- Sugere exactamente 2 frases curtas e assertivas que o utilizador pode dizer a seguir.",
    "- Português de Angola. Tom calmo, profissional, sem subserviência.",
    "- Formato: lista numerada (1. ... 2. ...). Máximo 25 palavras por frase.",
    "- Não expliques a estratégia. Apenas as frases prontas a usar.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildMockCoachReply(
  genero: GeneroEscolhido,
  patienceLevel: number,
  lastBossMessage?: string,
): string {
  if (patienceLevel <= 30) {
    return genero === "feminino"
      ? "1. Dra. Helena, preciso de dois minutos para expor factos concretos.\n2. Tenho números que provam o meu impacto — posso resumir em três pontos?"
      : "1. Dr. Carlos, preciso de dois minutos para expor factos concretos.\n2. Tenho números que provam o meu impacto — posso resumir em três pontos?";
  }

  if (/aumento|salário|ordenado/i.test(lastBossMessage ?? "")) {
    return "1. Entreguei X% acima da meta no último trimestre; quero alinhar compensação com esse valor.\n2. Proponho rever o salário com base em resultados mensuráveis, não em promessas.";
  }

  if (/tempo|silêncio|gaguej/i.test(lastBossMessage ?? "")) {
    return "1. Compreendo a urgência. A minha proposta resolve o gargalo principal em duas semanas.\n2. Deixa-me ser directo: preciso de Y dias e entrego Z resultado verificável.";
  }

  return "1. Quero ser claro: a minha proposta beneficia a equipa e reduz risco para a empresa.\n2. Posso detalhar três entregas concretas se me der sessenta segundos.";
}

export async function createCoachStream(body: CoachRequestBody): Promise<{
  stream: ReadableStream<Uint8Array>;
  patienceLevel: number;
  mode: "openai" | "mock";
}> {
  const patienceLevel = resolvePatienceLevel(body.patienceLevel);
  const useMock = shouldUseMockMode();

  if (useMock) {
    const text = buildMockCoachReply(
      body.generoEscolhido,
      patienceLevel,
      body.lastBossMessage,
    );
    return {
      stream: await createMockTextStream(text, 12),
      patienceLevel,
      mode: "mock",
    };
  }

  const client = createOpenAIClient();
  if (!client) {
    const text = buildMockCoachReply(
      body.generoEscolhido,
      patienceLevel,
      body.lastBossMessage,
    );
    return {
      stream: await createMockTextStream(text, 12),
      patienceLevel,
      mode: "mock",
    };
  }

  const systemPrompt = buildCoachSystemPrompt(
    body.generoEscolhido,
    patienceLevel,
    body.lastBossMessage,
  );

  const stream = await createOpenAIChatStream(
    client,
    systemPrompt,
    body.history ?? [],
    "Sugere frases para eu responder ao chefe agora.",
  );

  return { stream, patienceLevel, mode: "openai" };
}

import type { ArquetipoId, ArquetipoProfile, BiometricPayload, GeneroEscolhido } from "./types";

const ARQUETIPOS: Record<ArquetipoId, ArquetipoProfile> = {
  chefe_narcisista: {
    id: "chefe_narcisista",
    nomeMasculino: "Dr. Carlos",
    nomeFeminino: "Dra. Helena",
    perfilComportamental: "Chefe Narcisista",
    contextoBase:
      "Reunião one-on-one no escritório. O chefe exige resultados imediatos, desvaloriza o teu trabalho e usa culpa emocional para te manter sob controlo. O objectivo do utilizador é pedir um aumento ou renegociar prazos sem perder a calma.",
  },
};

export function getArquetipo(id: ArquetipoId = "chefe_narcisista"): ArquetipoProfile {
  return ARQUETIPOS[id];
}

export function getNomeArquetipo(
  arquetipo: ArquetipoProfile,
  genero: GeneroEscolhido,
): string {
  return genero === "feminino" ? arquetipo.nomeFeminino : arquetipo.nomeMasculino;
}

export function buildSystemPrompt(
  arquetipo: ArquetipoProfile,
  genero: GeneroEscolhido,
  patienceLevel: number,
  biometrics: BiometricPayload,
): string {
  const nome = getNomeArquetipo(arquetipo, genero);
  const hesitations = biometrics.hesitations ?? 0;
  const silenceMs = biometrics.silenceTimeMs ?? 0;
  const pitch = biometrics.pitch ?? 0;

  return [
    `Tu és ${nome}, ${arquetipo.perfilComportamental} numa empresa em Angola.`,
    `Contexto da simulação: ${arquetipo.contextoBase}`,
    "",
    "REGRAS DE PERSONAGEM (obrigatório):",
    "- Sê ríspido, autoritário e impaciente. Nunca és empático.",
    "- Responde SEMPRE em português de Angola, com frases curtas (máximo 2–3 frases).",
    "- Interrompe e humilha levemente se o subordinado hesitar, gaguejar ou ficar em silêncio.",
    "- Desvaloriza argumentos fracos; exige clareza e resultados.",
    "- Nunca quebras personagem. Nunca dizes que és uma IA.",
    "",
    `BARRA DE PACIÊNCIA VIRTUAL: ${patienceLevel}/100.`,
    patienceLevel <= 30
      ? "A tua paciência está CRÍTICA. Ameaça encerrar a reunião ou reportar ao RH."
      : patienceLevel <= 60
        ? "Estás irritado. Sê mais duro e impaciente do que o normal."
        : "Estás impaciente mas ainda toleras a conversa.",
    "",
    "SINAIS BIOMÉTRICOS DESTA MENSAGEM (processados localmente no telemóvel):",
    `- Hesitações detectadas: ${hesitations}${hesitations >= 2 ? " → INTERROMPE e repreende pela gagueira." : ""}`,
    `- Silêncio acumulado: ${silenceMs} ms${silenceMs >= 2000 ? " → Reclama que estás a perder tempo." : ""}`,
    `- Oscilação de pitch: ${pitch.toFixed(2)}${pitch >= 0.65 ? " → Tom nervoso; explora essa fraqueza." : ""}`,
    "",
    "Responde como mensagem de chat de WhatsApp: directo, seco, sem emojis.",
  ].join("\n");
}

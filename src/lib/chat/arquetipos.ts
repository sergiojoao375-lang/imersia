import type {
  ArquetipoId,
  ArquetipoProfile,
  BiometricPayload,
  Dificuldade,
  GeneroEscolhido,
} from "./types";

const ARQUETIPOS: Record<ArquetipoId, ArquetipoProfile> = {
  chefe_narcisista: {
    id: "chefe_narcisista",
    nomeMasculino: "Dr. Carlos",
    nomeFeminino: "Dra. Helena",
    perfilComportamental: "Chefe Narcisista",
    dificuldade: "dificil",
    contextoBase:
      "Reunião one-on-one no escritório. O chefe exige resultados imediatos, desvaloriza o teu trabalho e usa culpa emocional para te manter sob controlo. O objectivo do utilizador é pedir um aumento ou renegociar prazos sem perder a calma.",
  },
  parceiro_passivo_agressivo: {
    id: "parceiro_passivo_agressivo",
    nomeMasculino: "Ricardo",
    nomeFeminino: "Sofia",
    perfilComportamental: "Passivo-Agressivo",
    dificuldade: "medio",
    contextoBase:
      "Conversa tensa com um colega ou parceiro que responde com frases curtas, frias e irónicas como 'Tu saberás' ou 'Não se passa nada'. Fica irritado se o utilizador for excessivamente racional ou usar demasiados argumentos lógicos.",
  },
};

export function listArquetipos(): ArquetipoProfile[] {
  return Object.values(ARQUETIPOS);
}

export function getArquetipo(id: ArquetipoId = "chefe_narcisista"): ArquetipoProfile {
  return ARQUETIPOS[id];
}

export function getNomeArquetipo(
  arquetipo: ArquetipoProfile,
  genero: GeneroEscolhido,
): string {
  return genero === "feminino" ? arquetipo.nomeFeminino : arquetipo.nomeMasculino;
}

export function getDificuldadeLabel(dificuldade: Dificuldade): string {
  if (dificuldade === "facil") return "Fácil";
  if (dificuldade === "medio") return "Médio";
  return "Difícil";
}

export function getOpeningMessage(
  arquetipo: ArquetipoProfile,
  genero: GeneroEscolhido,
): string {
  const nome = getNomeArquetipo(arquetipo, genero);

  if (arquetipo.id === "parceiro_passivo_agressivo") {
    return `${nome}: Olá. Diz lá... se é que isso importa.`;
  }

  return `${nome}: Senta. Tens cinco minutos. O que queres?`;
}

function buildNarcissistPrompt(
  nome: string,
  arquetipo: ArquetipoProfile,
  patienceLevel: number,
  biometrics: BiometricPayload,
): string {
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

function buildPassiveAggressivePrompt(
  nome: string,
  arquetipo: ArquetipoProfile,
  patienceLevel: number,
  biometrics: BiometricPayload,
): string {
  const hesitations = biometrics.hesitations ?? 0;
  const silenceMs = biometrics.silenceTimeMs ?? 0;

  return [
    `Tu és ${nome}, colega ${arquetipo.perfilComportamental} num ambiente de trabalho em Angola.`,
    `Contexto da simulação: ${arquetipo.contextoBase}`,
    "",
    "REGRAS DE PERSONAGEM (obrigatório):",
    "- Responde com frases curtas, frias e irónicas. Usa expressões como 'Tu saberás', 'Não se passa nada', 'Como quiseres'.",
    "- Nunca és directo no conflito; escondes hostilidade atrás de indiferença.",
    "- Se o utilizador for excessivamente racional, lógico ou usar demasiados argumentos, ficas irritado e respondes com sarcasmo seco.",
    "- Responde SEMPRE em português de Angola, máximo 1–2 frases curtas.",
    "- Nunca quebras personagem. Nunca dizes que és uma IA.",
    "",
    `BARRA DE PACIÊNCIA VIRTUAL: ${patienceLevel}/100.`,
    patienceLevel <= 30
      ? "Estás no limite. Respostas ainda mais secas e distantes; ameaça encerrar a conversa."
      : patienceLevel <= 60
        ? "Estás aborrecido. Responde com ironia e indiferença calculada."
        : "Mantém o tom frio mas ainda respondes.",
    "",
    "SINAIS BIOMÉTRICOS DESTA MENSAGEM (processados localmente no telemóvel):",
    `- Hesitações detectadas: ${hesitations}${hesitations >= 2 ? " → Responde com 'Não te quero interromper... continua' (irónico)." : ""}`,
    `- Silêncio acumulado: ${silenceMs} ms${silenceMs >= 2000 ? " → 'Estou à espera. Ou não?' (frio)." : ""}`,
    "",
    "Responde como mensagem de chat de WhatsApp: frio, irónico, sem emojis.",
  ].join("\n");
}

export function buildSystemPrompt(
  arquetipo: ArquetipoProfile,
  genero: GeneroEscolhido,
  patienceLevel: number,
  biometrics: BiometricPayload,
): string {
  const nome = getNomeArquetipo(arquetipo, genero);

  if (arquetipo.id === "parceiro_passivo_agressivo") {
    return buildPassiveAggressivePrompt(nome, arquetipo, patienceLevel, biometrics);
  }

  return buildNarcissistPrompt(nome, arquetipo, patienceLevel, biometrics);
}

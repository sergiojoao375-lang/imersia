import type { ArquetipoProfile, BiometricPayload, GeneroEscolhido } from "./types";
import { getNomeArquetipo } from "./arquetipos";

function pickNarcissistMockReply(
  nome: string,
  patienceLevel: number,
  biometrics: BiometricPayload,
  userMessage: string,
): string {
  const hesitations = biometrics.hesitations ?? 0;
  const silenceMs = biometrics.silenceTimeMs ?? 0;

  if (patienceLevel <= 15) {
    return `${nome}: Chega. Sai da minha sala. Quando souberes o que queres, voltamos a falar.`;
  }

  if (hesitations >= 2) {
    return `${nome}: Para de gaguejar. Ou falas com convicção ou não perco mais tempo contigo.`;
  }

  if (silenceMs >= 2000) {
    return `${nome}: Estás a perder o meu tempo com estes silêncios. Diz o que queres de uma vez.`;
  }

  if (userMessage.trim().length < 8) {
    return `${nome}: Isso não é resposta. Sê específico ou considera a conversa terminada.`;
  }

  if (patienceLevel <= 40) {
    return `${nome}: A minha paciência acabou. Tens trinta segundos para me convencer, senão fico com a minha decisão.`;
  }

  if (/aumento|salário|ordenado/i.test(userMessage)) {
    return `${nome}: Aumento? Com estes resultados? Convence-me com números, não com desculpas.`;
  }

  if (/prazo|deadline|tempo/i.test(userMessage)) {
    return `${nome}: Prazos não se negociam por pedido. O que entregaste até agora justifica alguma flexibilidade?`;
  }

  return `${nome}: Ouve bem — aqui quem decide sou eu. Reformula isso sem rodeios e mostra valor concreto.`;
}

function pickPassiveAggressiveMockReply(
  nome: string,
  patienceLevel: number,
  biometrics: BiometricPayload,
  userMessage: string,
): string {
  const hesitations = biometrics.hesitations ?? 0;
  const silenceMs = biometrics.silenceTimeMs ?? 0;
  const isOverlyRational =
    /portanto|logicamente|objectivamente|evidência|dados|estatística|análise|racional/i.test(
      userMessage,
    );

  if (patienceLevel <= 15) {
    return `${nome}: Não se passa nada. Faz como quiseres — já estou habituado.`;
  }

  if (isOverlyRational) {
    return `${nome}: Tu saberás. Não preciso de uma aula de lógica para perceber o que queres dizer.`;
  }

  if (hesitations >= 2) {
    return `${nome}: Não te quero interromper... continua.`;
  }

  if (silenceMs >= 2000) {
    return `${nome}: Estou à espera. Ou não?`;
  }

  if (patienceLevel <= 40) {
    return `${nome}: Interessante. Muito interessante mesmo.`;
  }

  if (/desculpa|perdão/i.test(userMessage)) {
    return `${nome}: Não se passa nada. De verdade.`;
  }

  return `${nome}: Tu saberás.`;
}

function pickMockReply(
  arquetipo: ArquetipoProfile,
  nome: string,
  patienceLevel: number,
  biometrics: BiometricPayload,
  userMessage: string,
): string {
  if (arquetipo.id === "parceiro_passivo_agressivo") {
    return pickPassiveAggressiveMockReply(
      nome,
      patienceLevel,
      biometrics,
      userMessage,
    );
  }

  return pickNarcissistMockReply(nome, patienceLevel, biometrics, userMessage);
}

export async function createMockTextStream(
  text: string,
  chunkDelayMs = 18,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const char of text) {
        controller.enqueue(encoder.encode(char));
        await new Promise((resolve) => setTimeout(resolve, chunkDelayMs));
      }
      controller.close();
    },
  });
}

export function buildMockReply(
  arquetipo: ArquetipoProfile,
  genero: GeneroEscolhido,
  patienceLevel: number,
  biometrics: BiometricPayload,
  userMessage: string,
): string {
  const nome = getNomeArquetipo(arquetipo, genero);
  return pickMockReply(arquetipo, nome, patienceLevel, biometrics, userMessage);
}

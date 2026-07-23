export type GeneroEscolhido = "masculino" | "feminino";

export type ArquetipoId = "chefe_narcisista";

export interface BiometricPayload {
  /** Oscilação de pitch detectada localmente (0–1). */
  pitch?: number;
  /** Tempo acumulado de silêncio prolongado, em ms. */
  silenceTimeMs?: number;
  /** Hesitações detetadas na fala actual. */
  hesitations?: number;
  /** Velocidade de fala estimada (palavras/minuto ou índice normalizado). */
  speechSpeed?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  message: string;
  generoEscolhido: GeneroEscolhido;
  arquetipoId?: ArquetipoId;
  biometrics?: BiometricPayload;
  /** Nível de paciência virtual actual (0–100). Omite para iniciar em 100. */
  patienceLevel?: number;
  history?: ChatMessage[];
}

export interface ArquetipoProfile {
  id: ArquetipoId;
  nomeMasculino: string;
  nomeFeminino: string;
  perfilComportamental: string;
  contextoBase: string;
}

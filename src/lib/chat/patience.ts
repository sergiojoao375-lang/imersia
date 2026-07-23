import type { BiometricPayload } from "./types";

const DEFAULT_PATIENCE = 100;

export function resolvePatienceLevel(level?: number): number {
  if (level === undefined || Number.isNaN(level)) return DEFAULT_PATIENCE;
  return Math.max(0, Math.min(100, level));
}

export function calculatePatienceAfterMessage(
  currentPatience: number,
  biometrics: BiometricPayload,
  message: string,
): number {
  let next = currentPatience;
  const hesitations = biometrics.hesitations ?? 0;
  const silenceMs = biometrics.silenceTimeMs ?? 0;
  const pitch = biometrics.pitch ?? 0;
  const trimmed = message.trim();

  if (hesitations >= 3) next -= 22;
  else if (hesitations >= 2) next -= 15;
  else if (hesitations === 1) next -= 8;

  if (silenceMs >= 4000) next -= 20;
  else if (silenceMs >= 2000) next -= 10;

  if (pitch >= 0.75) next -= 10;
  else if (pitch >= 0.55) next -= 5;

  if (trimmed.length < 8) next -= 12;
  if (/desculpa|por favor|talvez|acho que|não sei|hmm|éee/i.test(trimmed)) {
    next -= 6;
  }

  return Math.max(0, Math.min(100, next));
}

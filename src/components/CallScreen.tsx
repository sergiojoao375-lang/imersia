"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Eye,
  Loader2,
  Mic,
  Phone,
  Sparkles,
  User,
  Volume2,
} from "lucide-react";

import { useAudioProcessor } from "@/hooks/useAudioProcessor";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { getArquetipo, getNomeArquetipo } from "@/lib/chat/arquetipos";
import { streamChat, streamCoach } from "@/lib/chat/stream-client";
import type { ChatMessage, GeneroEscolhido } from "@/lib/chat/types";

type UiMessage = {
  id: string;
  role: "user" | "boss" | "coach";
  content: string;
  streaming?: boolean;
};

const INITIAL_PATIENCE = 100;

function createId(): string {
  return crypto.randomUUID();
}

function getPatienceBarColor(level: number): string {
  if (level >= 70) return "bg-emerald-400";
  if (level >= 40) return "bg-amber-400";
  if (level >= 20) return "bg-orange-500";
  return "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.65)]";
}

function getPatienceLabel(level: number): string {
  if (level >= 70) return "Calmo";
  if (level >= 40) return "Irritado";
  if (level >= 20) return "Crítico";
  return "Explosivo";
}

function normalizePitch(volumeDb: number, samples: number[]): number {
  if (samples.length < 2) {
    return Math.min(1, Math.max(0, volumeDb / -30));
  }

  const mean = samples.reduce((acc, value) => acc + value, 0) / samples.length;
  const variance =
    samples.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
    samples.length;

  return Math.min(1, Math.max(0, Math.sqrt(variance) * 12));
}

export default function CallScreen() {
  const arquetipo = getArquetipo("chefe_narcisista");

  const [genero, setGenero] = useState<GeneroEscolhido>("masculino");
  const [patience, setPatience] = useState(INITIAL_PATIENCE);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: createId(),
      role: "boss",
      content: `${getNomeArquetipo(arquetipo, "masculino")}: Senta. Tens cinco minutos. O que queres?`,
    },
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isBossStreaming, setIsBossStreaming] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [coachText, setCoachText] = useState("");
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [manualText, setManualText] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [pendingMetrics, setPendingMetrics] = useState<{
    pitch: number;
    silenceTimeMs: number;
    hesitations: number;
  } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const volumeSamplesRef = useRef<number[]>([]);
  const metricsSnapshotRef = useRef({
    hesitationCount: 0,
    totalSilenceTime: 0,
    volume: -60,
  });

  const {
    audioMetrics,
    startListening,
    stopListening,
    error: audioError,
  } = useAudioProcessor();
  const { isSupported: speechSupported, startRecognition, stopRecognition } =
    useSpeechToText();

  const bossName = useMemo(
    () => getNomeArquetipo(arquetipo, genero),
    [arquetipo, genero],
  );

  const historyForApi = useCallback((): ChatMessage[] => {
    return messages
      .filter((message) => message.role === "user" || message.role === "boss")
      .map((message) => ({
        role: message.role === "user" ? "user" : "assistant",
        content: message.content,
      }));
  }, [messages]);

  const lastBossMessage = useMemo(() => {
    const bossMessages = messages.filter((message) => message.role === "boss");
    return bossMessages[bossMessages.length - 1]?.content ?? "";
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, coachText, isCoachOpen]);

  useEffect(() => {
    metricsSnapshotRef.current = {
      hesitationCount: audioMetrics.hesitationCount,
      totalSilenceTime: audioMetrics.totalSilenceTime,
      volume: audioMetrics.volume,
    };

    if (isRecording) {
      volumeSamplesRef.current.push(audioMetrics.volume);
      if (volumeSamplesRef.current.length > 24) {
        volumeSamplesRef.current.shift();
      }
    }
  }, [audioMetrics, isRecording]);

  const sendToBoss = useCallback(
    async (userText: string, biometrics: {
      pitch: number;
      silenceTimeMs: number;
      hesitations: number;
    }) => {
      const trimmed = userText.trim();
      if (!trimmed || isBossStreaming) return;

      const userMessage: UiMessage = {
        id: createId(),
        role: "user",
        content: trimmed,
      };

      const bossMessageId = createId();
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: bossMessageId, role: "boss", content: "", streaming: true },
      ]);
      setIsBossStreaming(true);

      try {
        const result = await streamChat(
          {
            message: trimmed,
            generoEscolhido: genero,
            arquetipoId: "chefe_narcisista",
            patienceLevel: patience,
            biometrics,
            history: historyForApi(),
          },
          (accumulated) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === bossMessageId
                  ? { ...message, content: accumulated }
                  : message,
              ),
            );
          },
        );

        setPatience(result.patience);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === bossMessageId
              ? { ...message, content: result.text, streaming: false }
              : message,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === bossMessageId
              ? {
                  ...message,
                  content: `${bossName}: Perdi a ligação. Repete o que disseste.`,
                  streaming: false,
                }
              : message,
          ),
        );
      } finally {
        setIsBossStreaming(false);
      }
    },
    [bossName, genero, historyForApi, isBossStreaming, patience],
  );

  const handleMicPress = useCallback(async () => {
    if (isRecording || isBossStreaming) return;

    volumeSamplesRef.current = [];
    setIsRecording(true);
    await startListening();
    startRecognition();
  }, [isBossStreaming, isRecording, startListening, startRecognition]);

  const handleMicRelease = useCallback(async () => {
    if (!isRecording) return;

    setIsRecording(false);
    stopListening();

    const transcript = await stopRecognition();
    const snapshot = metricsSnapshotRef.current;
    const biometrics = {
      pitch: normalizePitch(snapshot.volume, volumeSamplesRef.current),
      silenceTimeMs: snapshot.totalSilenceTime,
      hesitations: snapshot.hesitationCount,
    };

    if (transcript) {
      await sendToBoss(transcript, biometrics);
      return;
    }

    setPendingMetrics(biometrics);
    setManualText("");
    setShowManualInput(true);
  }, [isRecording, sendToBoss, stopListening, stopRecognition]);

  const confirmManualMessage = useCallback(async () => {
    if (!pendingMetrics || !manualText.trim()) return;
    setShowManualInput(false);
    await sendToBoss(manualText, pendingMetrics);
    setPendingMetrics(null);
    setManualText("");
  }, [manualText, pendingMetrics, sendToBoss]);

  const handleCoach = useCallback(async () => {
    if (isCoachLoading || isBossStreaming) return;

    setIsCoachOpen(true);
    setCoachText("");
    setIsCoachLoading(true);

    try {
      await streamCoach(
        {
          generoEscolhido: genero,
          patienceLevel: patience,
          lastBossMessage: lastBossMessage,
          history: historyForApi(),
        },
        setCoachText,
      );
    } catch {
      setCoachText(
        "1. Respira. Sê directo e mostra um resultado concreto.\n2. Proponho uma solução em três passos — posso resumir?",
      );
    } finally {
      setIsCoachLoading(false);
    }
  }, [
    genero,
    historyForApi,
    isBossStreaming,
    isCoachLoading,
    lastBossMessage,
    patience,
  ]);

  const handleGenderChange = (nextGenero: GeneroEscolhido) => {
    if (isRecording || isBossStreaming) return;
    setGenero(nextGenero);
    const nome = getNomeArquetipo(arquetipo, nextGenero);
    setMessages([
      {
        id: createId(),
        role: "boss",
        content: `${nome}: Senta. Tens cinco minutos. O que queres?`,
      },
    ]);
    setPatience(INITIAL_PATIENCE);
    setCoachText("");
    setIsCoachOpen(false);
  };

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.12),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.08),transparent_40%)]" />

      {/* Top bar */}
      <header className="relative z-10 border-b border-white/5 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Chamada Privada
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Phone className="h-3.5 w-3.5" />
            Alta Tensão
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 ${
              isBossStreaming
                ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.45)]"
                : "border-zinc-700"
            } bg-zinc-800`}
          >
            <User className="h-8 w-8 text-zinc-300" />
            {isBossStreaming && (
              <span className="absolute -bottom-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold">
                A falar...
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{bossName}</h1>
            <p className="text-sm text-zinc-400">{arquetipo.perfilComportamental}</p>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleGenderChange("masculino")}
                disabled={isRecording || isBossStreaming}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  genero === "masculino"
                    ? "bg-red-500/90 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                Dr. Carlos
              </button>
              <button
                type="button"
                onClick={() => handleGenderChange("feminino")}
                disabled={isRecording || isBossStreaming}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  genero === "feminino"
                    ? "bg-red-500/90 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                Dra. Helena
              </button>
            </div>
          </div>
        </div>

        {/* Patience bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Paciência do Chefe</span>
            <span className={`font-medium ${patience <= 20 ? "text-red-400" : "text-zinc-300"}`}>
              {patience}% · {getPatienceLabel(patience)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${getPatienceBarColor(patience)}`}
              style={{ width: `${patience}%` }}
            />
          </div>
        </div>

        {/* Live audio metrics */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-zinc-500">
          <div className="rounded-lg bg-black/30 px-2 py-1.5">
            <div className="flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              Volume
            </div>
            <p className="mt-0.5 font-mono text-zinc-300">
              {audioMetrics.volume.toFixed(0)} dB
            </p>
          </div>
          <div className="rounded-lg bg-black/30 px-2 py-1.5">
            <div className="flex items-center gap-1">
              <Mic className="h-3 w-3" />
              A falar
            </div>
            <p
              className={`mt-0.5 font-medium ${
                audioMetrics.isSpeaking ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              {audioMetrics.isSpeaking ? "Sim" : "Não"}
            </p>
          </div>
          <div className="rounded-lg bg-black/30 px-2 py-1.5">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Hesitações
            </div>
            <p className="mt-0.5 font-mono text-zinc-300">
              {audioMetrics.hesitationCount}
            </p>
          </div>
        </div>
      </header>

      {/* Chat area */}
      <main className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "rounded-br-md bg-emerald-600/20 text-emerald-100 ring-1 ring-emerald-500/20"
                    : message.role === "coach"
                      ? "rounded-bl-md bg-violet-600/15 text-violet-100 ring-1 ring-violet-500/20"
                      : "rounded-bl-md bg-zinc-800/90 text-zinc-100 ring-1 ring-white/5"
                }`}
              >
                {message.content}
                {message.streaming && (
                  <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-red-400 align-middle" />
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Controls */}
      <footer className="relative z-10 border-t border-white/5 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {audioError && (
          <p className="mb-3 text-center text-xs text-red-400">{audioError}</p>
        )}

        <div className="mx-auto flex max-w-lg items-end justify-center gap-6">
          <button
            type="button"
            onClick={handleCoach}
            disabled={isCoachLoading || isBossStreaming}
            className="flex flex-col items-center gap-1 text-zinc-400 transition hover:text-violet-300 disabled:opacity-40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 ring-1 ring-white/10">
              {isCoachLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </span>
            <span className="text-[10px] uppercase tracking-wide">Coach Sombra</span>
          </button>

          <button
            type="button"
            aria-label={isRecording ? "A gravar — larga para enviar" : "Mantém premido para falar"}
            disabled={isBossStreaming}
            onPointerDown={handleMicPress}
            onPointerUp={handleMicRelease}
            onPointerLeave={isRecording ? handleMicRelease : undefined}
            onContextMenu={(event) => event.preventDefault()}
            className={`flex h-20 w-20 touch-none select-none items-center justify-center rounded-full transition-all duration-200 ${
              isRecording
                ? "scale-110 bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.55)]"
                : "bg-zinc-100 text-zinc-900 hover:bg-white"
            } disabled:opacity-40`}
          >
            <Mic className={`h-8 w-8 ${isRecording ? "text-white" : ""}`} />
          </button>

          <div className="flex w-12 flex-col items-center gap-1 opacity-0">
            {/* Spacer para centrar o microfone */}
            <span className="h-12 w-12" />
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-zinc-500">
          {isRecording
            ? "A gravar... larga para enviar"
            : speechSupported
              ? "Mantém premido o microfone para falar"
              : "Mantém premido — escreverás a mensagem se o reconhecimento falhar"}
        </p>
      </footer>

      {/* Manual input fallback */}
      {showManualInput && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/10">
            <p className="mb-2 text-sm text-zinc-300">
              Não captei a voz. Escreve o que querias dizer:
            </p>
            <textarea
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              placeholder="Ex.: Preciso de mais três dias para entregar o relatório."
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowManualInput(false);
                  setPendingMetrics(null);
                }}
                className="flex-1 rounded-xl bg-zinc-800 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmManualMessage}
                disabled={!manualText.trim()}
                className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coach panel */}
      {isCoachOpen && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full rounded-2xl bg-zinc-900/95 p-4 ring-1 ring-violet-500/20">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
                <Sparkles className="h-4 w-4" />
                Coach Sombra
              </div>
              <button
                type="button"
                onClick={() => setIsCoachOpen(false)}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Fechar
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {coachText || (isCoachLoading ? "A pensar contigo..." : "")}
              {isCoachLoading && (
                <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-violet-400 align-middle" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

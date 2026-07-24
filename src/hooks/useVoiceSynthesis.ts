"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GeneroEscolhido } from "@/lib/chat/types";

export interface VoiceProsody {
  rate: number;
  pitch: number;
}

export interface SpeakOptions {
  genero: GeneroEscolhido;
  patience: number;
}

type SpeechSynthesisVoiceLike = SpeechSynthesisVoice;

const PT_LANG_PREFIXES = ["pt-PT", "pt-BR", "pt"];

function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getProsodyFromPatience(patience: number): VoiceProsody {
  if (patience < 20) return { rate: 1.35, pitch: 0.78 };
  if (patience < 50) return { rate: 1.18, pitch: 0.88 };
  if (patience < 70) return { rate: 1.05, pitch: 0.95 };
  return { rate: 0.92, pitch: 1.0 };
}

export function extractDialogueText(rawText: string): string {
  const trimmed = rawText.trim();
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) return trimmed;
  return trimmed.slice(colonIndex + 1).trim();
}

function isPortugueseVoice(voice: SpeechSynthesisVoiceLike): boolean {
  const lang = voice.lang.toLowerCase();
  return PT_LANG_PREFIXES.some(
    (prefix) => lang === prefix.toLowerCase() || lang.startsWith("pt"),
  );
}

function isFemaleVoice(voice: SpeechSynthesisVoiceLike): boolean {
  const hint = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  return /female|feminino|mulher|woman|helena|sofia|maria|luciana|joana|francisca|amelia|lúcia|lucia/.test(
    hint,
  );
}

function isMaleVoice(voice: SpeechSynthesisVoiceLike): boolean {
  const hint = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  return /male|masculino|homem|man|carlos|ricardo|daniel|joão|joao|pedro|felipe|tiago/.test(
    hint,
  );
}

function pickPortugueseLang(voices: SpeechSynthesisVoiceLike[]): string {
  const ptPt = voices.find((voice) => voice.lang.toLowerCase().startsWith("pt-pt"));
  if (ptPt) return ptPt.lang;
  const ptBr = voices.find((voice) => voice.lang.toLowerCase().startsWith("pt-br"));
  if (ptBr) return ptBr.lang;
  return "pt-PT";
}

function selectVoice(
  voices: SpeechSynthesisVoiceLike[],
  genero: GeneroEscolhido,
): SpeechSynthesisVoiceLike | null {
  const portugueseVoices = voices.filter(isPortugueseVoice);
  if (portugueseVoices.length === 0) return null;

  if (genero === "feminino") {
    return (
      portugueseVoices.find(isFemaleVoice) ??
      portugueseVoices.find((voice) => !isMaleVoice(voice)) ??
      portugueseVoices[0]
    );
  }

  return (
    portugueseVoices.find(isMaleVoice) ??
    portugueseVoices.find((voice) => !isFemaleVoice(voice)) ??
    portugueseVoices[0]
  );
}

function extractCompleteSentences(text: string): string[] {
  return text.match(/[^.!?…]+[.!?…]+/g)?.map((sentence) => sentence.trim()) ?? [];
}

export function useVoiceSynthesis() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);

  const voicesRef = useRef<SpeechSynthesisVoiceLike[]>([]);
  const queueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef(false);
  const completedSentenceCountRef = useRef(0);
  const streamDialogueRef = useRef("");
  const optionsRef = useRef<SpeakOptions>({ genero: "masculino", patience: 100 });

  const loadVoices = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      voicesRef.current = voices;
      setVoicesReady(true);
    }
  }, []);

  useEffect(() => {
    const supported = isSpeechSynthesisSupported();
    setIsSupported(supported);
    if (!supported) return;

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [loadVoices]);

  const stopSpeaking = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;

    window.speechSynthesis.cancel();
    queueRef.current = [];
    isProcessingQueueRef.current = false;
    setIsSpeaking(false);
  }, []);

  const resetStreamSession = useCallback(() => {
    completedSentenceCountRef.current = 0;
    streamDialogueRef.current = "";
    queueRef.current = [];
    isProcessingQueueRef.current = false;
  }, []);

  const createUtterance = useCallback(
    (text: string, options: SpeakOptions): SpeechSynthesisUtterance | null => {
      if (!isSpeechSynthesisSupported() || !text.trim()) return null;

      const { rate, pitch } = getProsodyFromPatience(options.patience);
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = selectVoice(voicesRef.current, options.genero);

      utterance.lang = voice?.lang ?? pickPortugueseLang(voicesRef.current);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1;

      if (voice) {
        utterance.voice = voice;
      }

      return utterance;
    },
    [],
  );

  const processQueue = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;
    if (isProcessingQueueRef.current || queueRef.current.length === 0) return;

    const nextText = queueRef.current.shift();
    if (!nextText) return;

    const utterance = createUtterance(nextText, optionsRef.current);
    if (!utterance) {
      processQueue();
      return;
    }

    isProcessingQueueRef.current = true;
    setIsSpeaking(true);

    utterance.onend = () => {
      isProcessingQueueRef.current = false;
      if (queueRef.current.length === 0 && !window.speechSynthesis.speaking) {
        setIsSpeaking(false);
      }
      processQueue();
    };

    utterance.onerror = () => {
      isProcessingQueueRef.current = false;
      setIsSpeaking(false);
      processQueue();
    };

    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }, [createUtterance]);

  const enqueueSpeech = useCallback(
    (sentences: string[], options: SpeakOptions) => {
      if (!isSpeechSynthesisSupported() || sentences.length === 0) return;

      optionsRef.current = options;
      queueRef.current.push(...sentences.filter((sentence) => sentence.trim()));
      processQueue();
    },
    [processQueue],
  );

  const speakImmediate = useCallback(
    (rawText: string, options: SpeakOptions) => {
      const dialogue = extractDialogueText(rawText);
      if (!dialogue) return;

      stopSpeaking();
      resetStreamSession();
      optionsRef.current = options;
      enqueueSpeech([dialogue], options);
    },
    [enqueueSpeech, resetStreamSession, stopSpeaking],
  );

  const processStreamChunk = useCallback(
    (rawText: string, options: SpeakOptions) => {
      if (!isSpeechSynthesisSupported()) return;

      const dialogue = extractDialogueText(rawText);
      streamDialogueRef.current = dialogue;
      optionsRef.current = options;

      const completeSentences = extractCompleteSentences(dialogue);
      const newSentences = completeSentences.slice(
        completedSentenceCountRef.current,
      );

      if (newSentences.length === 0) return;

      completedSentenceCountRef.current = completeSentences.length;
      enqueueSpeech(newSentences, options);
    },
    [enqueueSpeech],
  );

  const finalizeStream = useCallback(
    (rawText: string, options: SpeakOptions) => {
      if (!isSpeechSynthesisSupported()) return;

      const dialogue = extractDialogueText(rawText);
      streamDialogueRef.current = dialogue;
      optionsRef.current = options;

      const completeSentences = extractCompleteSentences(dialogue);
      const newSentences = completeSentences.slice(
        completedSentenceCountRef.current,
      );
      completedSentenceCountRef.current = completeSentences.length;

      const spokenComplete = completeSentences.join(" ");
      const remainder = dialogue.slice(spokenComplete.length).trim();

      const toSpeak = [...newSentences];
      if (remainder) {
        toSpeak.push(remainder);
      }

      if (toSpeak.length > 0) {
        enqueueSpeech(toSpeak, options);
      }
    },
    [enqueueSpeech],
  );

  const warmUp = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;

    loadVoices();
    window.speechSynthesis.resume();

    if (!window.speechSynthesis.speaking) {
      const silent = new SpeechSynthesisUtterance("");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
      window.speechSynthesis.cancel();
    }
  }, [loadVoices]);

  return {
    isSupported,
    isSpeaking,
    voicesReady,
    warmUp,
    stopSpeaking,
    resetStreamSession,
    speakImmediate,
    processStreamChunk,
    finalizeStream,
  };
}

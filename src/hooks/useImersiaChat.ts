"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";

export default function useImersiaChat(arquetipoId: string, genero: "masculino" | "feminino") {
  const [paciencia, setPatience] = useState(100);
  const [messages, setMessages] = useState<{ id: string; role: string; content: string }[]>([]);
  const [currentReply, setCurrentReply] = useState("");
  const [isBossStreaming, setIsBossStreaming] = useState(false);
  const [isBossSpeaking, setIsBossSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Fallback caso useAudioProcessor não seja exportado como default
  const audioProcessor = useAudioProcessor();
  const audioMetrics = audioProcessor?.audioMetrics || { volume: 0, isSpeaking: false, hesitationCount: 0, totalSilenceTime: 0 };
  const startListening = audioProcessor?.startListening || (() => {});
  const stopListening = audioProcessor?.stopListening || (() => {});

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const createId = () => Math.random().toString(36).substring(2, 9);

  const warmUpVoice = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(u);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsBossSpeaking(false);
    }
  }, []);

  const speakText = useCallback((text: string, currentPatience: number) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const cleanText = text.replace(/.*:\s*/, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "pt-PT";

    if (currentPatience < 50) {
      utterance.rate = 1.25;
      utterance.pitch = 1.1;
    } else {
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
    }

    utterance.onstart = () => setIsBossSpeaking(true);
    utterance.onend = () => setIsBossSpeaking(false);
    utterance.onerror = () => setIsBossSpeaking(false);

    synthRef.current.speak(utterance);
  }, []);

  const startRecognition = useCallback(() => {
    setIsRecording(true);
    startListening();
  }, [startListening]);

  const stopRecognition = useCallback((forcedText?: string) => {
    setIsRecording(false);
    stopListening();
    if (forcedText) {
      handleEnviarMensagem(forcedText);
    }
  }, [stopListening]);

  const handleEnviarMensagem = async (textoInput: string) => {
    if (!textoInput.trim() || isBossStreaming || isBossSpeaking) return;

    stopSpeaking();
    const userMessageId = createId();
    const bossMessageId = createId();

    setMessages((prev) => [...prev, { id: userMessageId, role: "user", content: textoInput }]);
    setCurrentReply("");
    setIsBossStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textoInput,
          generoEscolhido: genero,
          arquetipoId: arquetipoId,
          patienceLevel: paciencia,
          biometrics: {
            pitch: 0.5,
            silenceTimeMs: audioMetrics.totalSilenceTime,
            hesitations: audioMetrics.hesitationCount,
            speechSpeed: 120
          },
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const resultPatience = response.headers.get("X-Patience-Level");
      const nextPatience = resultPatience ? Number(resultPatience) : paciencia;
      setPatience(nextPatience);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setCurrentReply(accumulated);
      }

      setIsBossStreaming(false);
      setCurrentReply("");
      setMessages((prev) => [...prev, { id: bossMessageId, role: "assistant", content: accumulated }]);
      speakText(accumulated, nextPatience);

    } catch {
      const bossName = arquetipoId === "chefe_narcisista" ? "Chefe" : "Ricardo";
      const fallback = `${bossName}: Perdi a ligação. Repete o que disseste.`;
      setIsBossStreaming(false);
      setCurrentReply("");
      setMessages((prev) => [...prev, { id: bossMessageId, role: "assistant", content: fallback }]);
      speakText(fallback, paciencia);
    }
  };

  return {
    paciencia,
    setPatience,
    messages,
    setMessages,
    currentReply,
    isBossStreaming,
    isBossSpeaking,
    isRecording,
    audioMetrics,
    warmUpVoice,
    stopSpeaking,
    speakText,
    startRecognition,
    stopRecognition,
    handleEnviarMensagem,
    createId
  };
}

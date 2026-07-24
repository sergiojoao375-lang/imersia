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

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setPatience(100);
    setCurrentReply("");
    stopSpeaking();
  }, [arquetipoId, genero]);

  const audioProcessor = useAudioProcessor();
  const audioMetrics = audioProcessor?.audioMetrics || { volume: 0, isSpeaking: false, hesitationCount: 0, totalSilenceTime: 0 };
  const startListening = audioProcessor?.startListening || (() => {});
  const stopListening = audioProcessor?.stopListening || (() => {});

  const createId = () => Math.random().toString(36).substring(2, 9);

  const warmUpVoice = useCallback(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onplaying = () => setIsBossSpeaking(true);
      audioRef.current.onended = () => setIsBossSpeaking(false);
      audioRef.current.onerror = () => setIsBossSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsBossSpeaking(false);
    }
  }, []);

  // CORRECÇÃO DA LINHA DO ERRO: Agora liga perfeitamente para a nossa rota local segura
  const speakText = useCallback(async (text: string) => {
    warmUpVoice();
    if (!audioRef.current) return;

    try {
      stopSpeaking();

      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, genero }),
      });

      if (!response.ok) throw new Error("Falha ao gerar voz na rota API");

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);

      audioRef.current.src = audioUrl;
      audioRef.current.play();

    } catch (error) {
      console.error("Erro ao reproduzir áudio:", error);
      setIsBossSpeaking(false);
    }
  }, [genero, warmUpVoice, stopSpeaking]);

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
      speakText(accumulated);

    } catch {
      const bossName = arquetipoId === "chefe_narcisista" ? "Chefe" : "Ricardo";
      const fallback = `${bossName}: Perdi a ligação. Repete o que disseste.`;
      setIsBossStreaming(false);
      setCurrentReply("");
      setMessages((prev) => [...prev, { id: bossMessageId, role: "assistant", content: fallback }]);
      speakText(fallback);
    }
  };

  useEffect(() => {
    warmUpVoice();
    const initText = arquetipoId === "chefe_narcisista" 
      ? "Senta. Tens cinco minutos. O que queres?" 
      : "Faz como quiseres. Não se passa nada.";
    
    const prefixo = arquetipoId === "chefe_narcisista" 
      ? (genero === "masculino" ? "Dr. Carlos" : "Dra. Helena") 
      : (genero === "masculino" ? "Ricardo" : "Sofia");

    setMessages([{ id: createId(), role: "assistant", content: `${prefixo}: ${initText}` }]);
    
    const timer = setTimeout(() => {
      speakText(initText);
    }, 1000);

    return () => clearTimeout(timer);
  }, [arquetipoId, genero]);

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

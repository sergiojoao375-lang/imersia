"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioMetrics {
  /** Nível de volume em decibéis (aprox. -60 a 0 dB). */
  volume: number;
  /** Verdadeiro quando o volume ultrapassa o limiar de fala. */
  isSpeaking: boolean;
  /** Número de hesitações detetadas (ex.: "humm", "éee"). */
  hesitationCount: number;
  /** Tempo acumulado de silêncio prolongado (> 2 s), em milissegundos. */
  totalSilenceTime: number;
}

const ANALYSER_FFT_SIZE = 2048;
const ANALYSER_SMOOTHING = 0.75;
const SAMPLE_INTERVAL_MS = 100;

/** Limiar em dB acima do qual consideramos que o utilizador está a falar. */
const SPEAKING_THRESHOLD_DB = -45;

/** Duração mínima de silêncio para contabilizar (ms). */
const PROLONGED_SILENCE_MS = 2000;

/** Faixa de volume associada a hesitações ("humm", "éee"). */
const HESITATION_DB_MIN = -50;
const HESITATION_DB_MAX = -32;

/** Variância máxima do RMS normalizado para considerar volume "estável". */
const HESITATION_MAX_VARIANCE = 0.0008;

/** Tempo mínimo com volume estável na faixa média para contar hesitação (ms). */
const HESITATION_MIN_DURATION_MS = 700;

const INITIAL_METRICS: AudioMetrics = {
  volume: -60,
  isSpeaking: false,
  hesitationCount: 0,
  totalSilenceTime: 0,
};

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ??
    null
  );
}

function rmsToDecibels(rms: number): number {
  if (rms <= 0) return -60;
  const db = 20 * Math.log10(rms);
  return Math.max(-60, Math.min(0, db));
}

function computeRmsFromByteSamples(samples: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const normalized = (samples[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / samples.length);
}

function isInHesitationBand(db: number): boolean {
  return db >= HESITATION_DB_MIN && db <= HESITATION_DB_MAX;
}

export function useAudioProcessor() {
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics>(INITIAL_METRICS);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const silenceStartRef = useRef<number | null>(null);
  const prolongedSilenceCountedRef = useRef(false);
  const hesitationStartRef = useRef<number | null>(null);
  const hesitationActiveRef = useRef(false);
  const recentRmsRef = useRef<number[]>([]);

  const metricsRef = useRef<AudioMetrics>(INITIAL_METRICS);

  const cleanupAudioGraph = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (audioContextRef.current?.state !== "closed") {
      void audioContextRef.current?.close();
    }
    audioContextRef.current = null;

    silenceStartRef.current = null;
    prolongedSilenceCountedRef.current = false;
    hesitationStartRef.current = null;
    hesitationActiveRef.current = false;
    recentRmsRef.current = [];
  }, []);

  const processSample = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);

    const rms = computeRmsFromByteSamples(buffer);
    const volume = rmsToDecibels(rms);
    const isSpeaking = volume > SPEAKING_THRESHOLD_DB;
    const now = performance.now();

    const prev = metricsRef.current;
    let { hesitationCount, totalSilenceTime } = prev;

    if (isSpeaking) {
      silenceStartRef.current = null;
      prolongedSilenceCountedRef.current = false;
    } else {
      if (silenceStartRef.current === null) {
        silenceStartRef.current = now;
      } else {
        const silenceDuration = now - silenceStartRef.current;
        if (
          silenceDuration >= PROLONGED_SILENCE_MS &&
          !prolongedSilenceCountedRef.current
        ) {
          totalSilenceTime += silenceDuration;
          prolongedSilenceCountedRef.current = true;
        }
      }
    }

    const rmsWindow = recentRmsRef.current;
    rmsWindow.push(rms);
    if (rmsWindow.length > 8) {
      rmsWindow.shift();
    }

    const mean =
      rmsWindow.reduce((acc, value) => acc + value, 0) / rmsWindow.length;
    const variance =
      rmsWindow.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
      rmsWindow.length;

    const stableMediumVolume =
      isInHesitationBand(volume) &&
      rmsWindow.length >= 5 &&
      variance <= HESITATION_MAX_VARIANCE;

    if (stableMediumVolume) {
      if (hesitationStartRef.current === null) {
        hesitationStartRef.current = now;
      }

      const hesitationDuration = now - hesitationStartRef.current;
      if (
        hesitationDuration >= HESITATION_MIN_DURATION_MS &&
        !hesitationActiveRef.current
      ) {
        hesitationCount += 1;
        hesitationActiveRef.current = true;
      }
    } else {
      hesitationStartRef.current = null;
      hesitationActiveRef.current = false;
    }

    const nextMetrics: AudioMetrics = {
      volume,
      isSpeaking,
      hesitationCount,
      totalSilenceTime,
    };

    metricsRef.current = nextMetrics;
    setAudioMetrics(nextMetrics);
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;

    setError(null);
    cleanupAudioGraph();
    metricsRef.current = INITIAL_METRICS;
    setAudioMetrics(INITIAL_METRICS);

    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) {
      setError("Web Audio API não disponível neste navegador.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Acesso ao microfone não suportado neste dispositivo.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const audioContext = new AudioContextClass();
      await audioContext.resume();

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      mediaStreamRef.current = stream;
      sourceRef.current = source;

      intervalRef.current = setInterval(processSample, SAMPLE_INTERVAL_MS);
      setIsListening(true);
    } catch (cause) {
      cleanupAudioGraph();

      const message =
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Permissão do microfone negada. Autoriza o acesso nas definições do navegador."
          : "Não foi possível iniciar a captura de áudio.";

      setError(message);
      setIsListening(false);
    }
  }, [cleanupAudioGraph, isListening, processSample]);

  const stopListening = useCallback(() => {
    cleanupAudioGraph();
    setIsListening(false);
  }, [cleanupAudioGraph]);

  useEffect(() => {
    return () => {
      cleanupAudioGraph();
    };
  }, [cleanupAudioGraph]);

  return {
    audioMetrics,
    isListening,
    error,
    startListening,
    stopListening,
  };
};

"use client";

import React, { useState, useEffect } from "react";
import { Mic, Settings, User } from "lucide-react";
import  useImersiaChat  from "@/hooks/useImersiaChat";

export default function CallScreen() {
  const [arquetipoId, setArquetipoId] = useState("chefe_narcisista");
  const [genero, setGenero] = useState<"masculino" | "feminino">("masculino");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Importamos todas as funções e métricas do nosso Hook isolado (Parte 1)
  const {
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
  } = useImersiaChat(arquetipoId, genero);

  const bossName = arquetipoId === "chefe_narcisista" 
    ? (genero === "masculino" ? "Dr. Carlos" : "Dra. Helena") 
    : (genero === "masculino" ? "Ricardo" : "Sofia");

  // Mensagem inicial quando o app abre ou quando trocas de arquétipo
  useEffect(() => {
    warmUpVoice();
    const initText = arquetipoId === "chefe_narcisista" 
      ? "Dr. Carlos: Senta. Tens cinco minutos. O que queres?" 
      : "Ricardo: Faz como quiseres. Não se passa nada.";
    
    setMessages([{ id: createId(), role: "assistant", content: initText }]);
    setTimeout(() => speakText(initText, 100), 600);
  }, [arquetipoId, genero, warmUpVoice, speakText, setMessages]);

  const handleToggleListening = () => {
    const isBossActive = isBossStreaming || isBossSpeaking;
    if (isBossActive) return;

    if (isRecording) {
      stopRecognition("Estou a tentar explicar a minha situação com dados reais.");
    } else {
      stopSpeaking();
      warmUpVoice();
      startRecognition();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100 p-4 font-sans select-none max-w-md mx-auto justify-between overflow-hidden">
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-full ${arquetipoId === "chefe_narcisista" ? "bg-red-950 text-red-500" : "bg-cyan-950 text-cyan-500"}`}>
            <User size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold">{bossName}</h1>
            <span className="text-xs text-zinc-400">Chamada Privada • {arquetipoId === "chefe_narcisista" ? "Narcisista" : "Passivo-Agressivo"}</span>
          </div>
        </div>
        <button onClick={() => setIsDrawerOpen(true)} className="p-2 bg-zinc-900 rounded-full border border-zinc-800 hover:bg-zinc-800 transition">
          <Settings size={20} />
        </button>
      </div>

      {/* MEDIDOR DE PACIÊNCIA */}
      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1 text-zinc-400">
          <span>Paciência do Interlocutor</span>
          <span className={paciencia < 40 ? "text-red-500 font-bold" : "text-green-500"}>{paciencia}%</span>
        </div>
        <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <div 
            className={`h-full transition-all duration-500 ${paciencia < 40 ? "bg-red-500" : paciencia < 70 ? "bg-amber-500" : "bg-green-500"}`} 
            style={{ width: `${paciencia}%` }}
          />
        </div>
      </div>

      {/* HISTÓRICO DE MENSAGENS */}
      <div className="flex-1 my-6 overflow-y-auto flex flex-col justify-end gap-4 p-2 min-h-0 border border-zinc-900 rounded-xl bg-zinc-900/20">
        {messages.map((msg) => (
          <div key={msg.id} className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === "user" ? "bg-zinc-800 text-zinc-100 self-end rounded-br-none" : "bg-zinc-900 border border-zinc-800 text-zinc-300 self-start rounded-bl-none"}`}>
            {msg.content}
          </div>
        ))}
        {currentReply && (
          <div className="max-w-[85%] p-3 rounded-2xl text-sm bg-zinc-900 border border-zinc-800 text-zinc-300 self-start rounded-bl-none animate-pulse">
            {currentReply}
          </div>
        )}
      </div>

      {/* BIOMETRIA LOCAL */}
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] bg-zinc-900/40 p-2 rounded-xl border border-zinc-900 mb-4 text-zinc-400">
        <div>Vol: <span className="text-zinc-200">{audioMetrics.volume} dB</span></div>
        <div>Fala: <span className="text-zinc-200">{isRecording ? "Sim" : "Não"}</span></div>
        <div>Hesitações: <span className="text-zinc-200 text-red-500 font-bold">{audioMetrics.hesitationCount}</span></div>
      </div>

      {/* ACÇÃO CENTRAL (MICROFONE) */}
      <div className="flex flex-col items-center gap-3">
        <button 
          onClick={handleToggleListening}
          disabled={isBossStreaming || isBossSpeaking}
          className={`p-6 rounded-full border transition-all duration-300 ${isRecording ? "bg-red-600 border-red-500 scale-105 shadow-lg shadow-red-600/30" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 disabled:opacity-40"}`}
        >
          <Mic size={32} className={isRecording ? "text-white" : "text-zinc-400"} />
        </button>
        <span className="text-[10px] text-zinc-500">Toque para falar / Parar no telemóvel</span>
      </div>

      {/* TÁTICAS MANUAIS */}
      <div className="mt-4 flex gap-2">
        <button onClick={() => handleEnviarMensagem("Aqui estão os relatórios consolidados da equipa.")} className="flex-1 text-xs py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-800">
          Apresentar Dados
        </button>
        <button onClick={() => handleEnviarMensagem("Compreendo a urgência, vou focar-me na solução imediata.")} className="flex-1 text-xs py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-800">
          Postura Diplomática
        </button>
      </div>

      {/* DRAWER MOBILE */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
          <div className="bg-zinc-900 w-full max-w-md p-6 rounded-t-3xl border-t border-zinc-800 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Trocar Personagem</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-xs px-3 py-1 bg-zinc-800 rounded-full text-zinc-400">Fechar</button>
            </div>
            
            <div 
              onClick={() => { setArquetipoId("chefe_narcisista"); setPatience(100); stopSpeaking(); setIsDrawerOpen(false); }}
              className={`p-4 rounded-2xl border cursor-pointer ${arquetipoId === "chefe_narcisista" ? "border-red-500 bg-red-950/10" : "border-zinc-800 bg-zinc-950"}`}
            >
              <h3 className="font-bold text-red-500">Chefe Narcisista (Dr. Carlos / Dra. Helena)</h3>
              <p className="text-xs text-zinc-400 mt-1">Nível: Difícil. Arrogante e ríspido.</p>
            </div>

            <div 
              onClick={() => { setArquetipoId("parceiro_passivo_agressivo"); setPatience(100); stopSpeaking(); setIsDrawerOpen(false); }}
              className={`p-4 rounded-2xl border cursor-pointer ${arquetipoId === "parceiro_passivo_agressivo" ? "border-cyan-500 bg-cyan-950/10" : "border-zinc-800 bg-zinc-950"}`}
            >
              <h3 className="font-bold text-cyan-500">Parceiro Passivo-Agressivo (Ricardo / Sofia)</h3>
              <p className="text-xs text-zinc-400 mt-1">Nível: Médio. Frio e irónico.</p>
            </div>

            <div className="mt-2 border-t border-zinc-800 pt-3">
              <span className="text-xs text-zinc-400 block mb-2">Género do Personagem</span>
              <div className="flex gap-2">
                <button onClick={() => { setGenero("masculino"); stopSpeaking(); }} className={`flex-1 py-2 text-xs rounded-xl font-bold border ${genero === "masculino" ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "bg-zinc-950 text-zinc-400 border-zinc-800"}`}>Masculino</button>
                <button onClick={() => { setGenero("feminino"); stopSpeaking(); }} className={`flex-1 py-2 text-xs rounded-xl font-bold border ${genero === "feminino" ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "bg-zinc-950 text-zinc-400 border-zinc-800"}`}>Feminino</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

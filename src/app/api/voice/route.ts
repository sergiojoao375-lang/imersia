import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, genero } = body;

    if (!text) {
      return NextResponse.json({ error: "Texto não fornecido" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave ElevenLabs não configurada no servidor." }, { status: 500 });
    }

    // Adam (Masculino Corporativo Firme) | Rachel (Feminina Clara)
    const voiceId = genero === "feminino" 
      ? "21m00Tcm4TlvDq8ikWAM" 
      : "pNInz6obpgj5QDJeWJmq";

    // URL TOTALMENTE ESCRITO POR EXTENSO PARA EVITAR ERROS DE CONCATENAÇÃO
    const url = `https://elevenlabs.io{voiceId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro detalhado na ElevenLabs API:", errorText);
      return NextResponse.json({ error: `Erro na API da ElevenLabs: ${response.statusText}` }, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });

  } catch (error: any) {
    console.error("Erro interno na rota de voz:", error);
    return NextResponse.json({ error: "Erro interno no servidor de voz." }, { status: 500 });
  }
}

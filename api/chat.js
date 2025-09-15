// /api/chat.js

export default async function handler(req, res) {
  // ✅ Permitir que burbujas.online haga las peticiones
  res.setHeader("Access-Control-Allow-Origin", "https://www.burbujas.online");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { conversationHistory } = req.body;

    if (!conversationHistory) {
      return res.status(400).json({ error: "Missing conversationHistory" });
    }

    // 🔑 API Keys guardadas en Vercel > Settings > Environment Variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const elevenApiKey = process.env.ELEVENLABS_API_KEY;

    // 1️⃣ Generar respuesta de texto con OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: conversationHistory,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const reply = data.choices?.[0]?.message?.content || "Lo siento, no pude generar una respuesta.";

    // 2️⃣ Generar audio con ElevenLabs (voz rioplatense)
    const voiceId = "EXAVITQu4vr4xnSDxMaL"; // ejemplo de voz (puede ser sustituida por otra de estilo rioplatense)
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenApiKey,
      },
      body: JSON.stringify({
        text: reply,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.6, similarity_boost: 0.9 },
      }),
    });

    if (!ttsResponse.ok) {
      return res.status(500).json({ error: "Error en la generación de audio" });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    // 3️⃣ Responder con texto + audio en base64
    res.status(200).json({
      reply,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}

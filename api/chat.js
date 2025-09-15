// /api/chat.js

export default async function handler(req, res) {
  // 🔑 Configurar cabeceras CORS
  res.setHeader("Access-Control-Allow-Origin", "https://www.burbujas.online"); // tu dominio
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight request
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

    const apiKey = process.env.OPENAI_API_KEY;

    // Llamada a OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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

    const reply =
      data.choices?.[0]?.message?.content ||
      "Lo siento, no pude generar una respuesta.";

    // Generar también audio estilo rioplatense
    const audioRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "alloy", // voz clara
        input: reply,
        language: "es-419", // español latino
        accent: "es-AR", // rioplatense
      }),
    });

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    res.status(200).json({
      reply,
      audio: `data:audio/mp3;base64,${audioBuffer.toString("base64")}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}

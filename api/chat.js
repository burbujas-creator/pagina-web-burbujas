// pagina-web-burbujas/api/chat.js

export default async function handler(req, res) {
  // 🔧 Configurar cabeceras CORS
  const allowedOrigins = [
    "https://burbujas.online",
    "https://www.burbujas.online",
    "http://localhost:3000" // opcional, solo si probás local
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { conversationHistory } = req.body;

    if (!conversationHistory) {
      return res.status(400).json({ error: "Missing conversationHistory" });
    }

    // 🔑 Tu API KEY desde las variables de entorno de Vercel
    const apiKey = process.env.OPENAI_API_KEY;

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

    res.status(200).json({ reply });
  } catch (error) {
    console.error("Error en /api/chat:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

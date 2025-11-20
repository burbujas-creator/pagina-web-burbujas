// /api/chat.js

export default async function handler(req, res) {
  // ---------- CORS SENCILLO Y SEGURO ----------
  const origin = req.headers.origin || "";

  const allowedOrigins = new Set([
    "https://burbujas.online",
    "https://www.burbujas.online"
  ]);

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // Llamadas sin origin (por ejemplo, desde navegador directo o herramientas)
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Responder rápido las preflight OPTIONS
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Solo aceptamos POST para el bot
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // ---------- LÓGICA DE PRUEBA (SIN OPENAI, SIN AUDIO) ----------
  try {
    const body = req.body || {};
    const history = Array.isArray(body.conversationHistory)
      ? body.conversationHistory
      : [];

    const lastUserMessage =
      history.length > 0 && history[history.length - 1]?.role === "user"
        ? history[history.length - 1].content
        : "";

    const reply = lastUserMessage
      ? `Recibí tu mensaje: "${lastUserMessage}". Backend de Burbujas IA funcionando en modo prueba.`
      : "Backend de Burbujas IA funcionando correctamente (modo prueba).";

    // Devolvemos siempre este formato
    res.status(200).json({
      reply,
      audio: null
    });
  } catch (error) {
    console.error("Error en /api/chat:", error);
    res.status(500).json({ error: "Internal server error (test)" });
  }
}

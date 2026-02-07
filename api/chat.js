// api/chat.js

import { burbujasConfig } from "../config/burbujas.js";
import { estadoLocalAhora } from "../utils/estadoLocalAhora.js";
import { obtenerContextoDolorense } from "../utils/contextoDolores.js";
import { prepararTextoParaVoz } from "../utils/tts.js";
import { construirPromptBurbujas } from "../prompts/burbujasPromptCompleto.js";

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = new Set(burbujasConfig.allowedOrigins || []);

  // Preflight siempre responde, pero solo “autoriza” si el origin está permitido
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Si hay Origin pero no está permitido, bloqueamos (excepto OPTIONS, que igual lo atendemos)
  if (origin && !allowedOrigins.has(origin)) {
    return { ok: false, origin };
  }

  return { ok: true, origin };
}

function sanitizeHistory(conversationHistory, maxHistory) {
  // Nos quedamos SOLO con user/assistant para evitar system duplicado desde el front
  const filtered = (conversationHistory || []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );

  // Recorte final
  return filtered.slice(-maxHistory);
}

export default async function handler(req, res) {
  // -----------------------------------------------------------------------
  // 1) CORS
  // -----------------------------------------------------------------------
  const cors = setCors(req, res);

  if (req.method === "OPTIONS") {
    // Si no está permitido, respondemos 403 igual (así el navegador no deja pegarle)
    return res.status(cors.ok ? 200 : 403).end();
  }

  if (!cors.ok) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  // -----------------------------------------------------------------------
  // 2) Método
  // -----------------------------------------------------------------------
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // -----------------------------------------------------------------------
  // 3) Variables de entorno
  // -----------------------------------------------------------------------
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || "";
  const ELEVEN_VOICE_ID =
    process.env.ELEVENLABS_VOICE_ID || burbujasConfig.eleven?.defaultVoiceId;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  try {
    const { conversationHistory } = req.body || {};

    if (!Array.isArray(conversationHistory)) {
      return res.status(400).json({ error: "Missing conversationHistory (array)" });
    }

    // -----------------------------------------------------------------------
    // 4) Historial recortado (velocidad)
    // -----------------------------------------------------------------------
    const maxHistory = burbujasConfig.openai?.maxHistory ?? 8;
    const trimmedHistory = sanitizeHistory(conversationHistory, maxHistory);

    // -----------------------------------------------------------------------
    // 5) Estado abierto/cerrado + contexto local
    // -----------------------------------------------------------------------
    const estadoAhora = estadoLocalAhora({
      timezone: burbujasConfig.timezone,
      locale: burbujasConfig.locale,
    });

    const eventoHoy = obtenerContextoDolorense({
      timezone: burbujasConfig.timezone,
    });

    // -----------------------------------------------------------------------
    // 6) Prompt “definitivo” (constructor)
    // -----------------------------------------------------------------------
    const sistema = construirPromptBurbujas({
      estadoAhora,
      eventoHoy,
    });

    const messages = [{ role: "system", content: sistema }, ...trimmedHistory];

    // -----------------------------------------------------------------------
    // 7) OpenAI
    // -----------------------------------------------------------------------
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: burbujasConfig.openai?.model || "gpt-4o-mini",
        messages,
        temperature: burbujasConfig.openai?.temperature ?? 0.7,
        max_tokens: 350, // ajustable
      }),
    });

    const openaiData = await openaiRes.json();

    if (!openaiRes.ok || openaiData?.error) {
      const msg = openaiData?.error?.message || "OpenAI error";
      return res.status(500).json({ error: msg });
    }

    // -----------------------------------------------------------------------
    // 8) Post-proceso de texto
    // -----------------------------------------------------------------------
    let reply =
      openaiData?.choices?.[0]?.message?.content?.trim() ||
      "Perdón, no pude generar respuesta. ¿Querés que lo intente de nuevo? 🙂";

    reply = reply
      .replace(/\s*\(arg\)\s*/gi, " ")
      .replace(/seg[uú]n\s+horario\s+de\s+argentina/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // -----------------------------------------------------------------------
    // 9) TTS (ElevenLabs)
    // -----------------------------------------------------------------------
    let audioBase64 = null;

    if (ELEVEN_API_KEY && ELEVEN_VOICE_ID && reply) {
      const voiceText = prepararTextoParaVoz(reply, {
        maxChars: burbujasConfig.eleven?.maxChars ?? 900,
        reemplazoWhatsApp: "por WhatsApp",
      });

      try {
        const tts = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": ELEVEN_API_KEY,
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text: voiceText,
              model_id: burbujasConfig.eleven?.modelId || "eleven_multilingual_v2",
              voice_settings: burbujasConfig.eleven?.voiceSettings || {
                stability: 0.6,
                similarity_boost: 0.9,
              },
            }),
          }
        );

        if (tts.ok) {
          const buf = Buffer.from(await tts.arrayBuffer());
          audioBase64 = `data:audio/mpeg;base64,${buf.toString("base64")}`;
        }
      } catch (e) {
        console.error("TTS error:", e);
      }
    }

    return res.status(200).json({ reply, audio: audioBase64 });
  } catch (err) {
    console.error("Chat API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// api/chat.js
import fetch from "node-fetch";

import { burbujasConfig } from "../config/burbujas.js";
import systemPrompt from "../prompts/systemPrompt.js";
import { estadoLocalAhora } from "../utils/estadoLocalAhora.js";
import { obtenerContextoDolorense } from "../utils/contextoDolores.js";
import { prepararTextoParaVoz } from "../utils/tts.js";

/**
 * Fecha y hora REAL en Argentina (o la timezone configurada).
 * Esto evita que el modelo "adivine" la fecha.
 */
function getFechaHoraArgentina({
  timezone = "America/Argentina/Buenos_Aires",
  locale = "es-AR",
} = {}) {
  const now = new Date();

  const fechaLarga = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const hora = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const diaSemana = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "long",
  }).format(now);

  return { fechaLarga, hora, diaSemana };
}

export default async function handler(req, res) {
  // -----------------------------------------------------------------------
  // 1) CORS (basado en config)
  // -----------------------------------------------------------------------
  const origin = req.headers.origin || "";
  const allowedOrigins = new Set(burbujasConfig.allowedOrigins || []);

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // llamadas sin origin (por ejemplo, herramientas internas)
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    // si viene de otro dominio, no bloqueamos pero tampoco exponemos nada raro
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Solo aceptamos POST para el chat
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // -----------------------------------------------------------------------
  // 2) Variables de entorno
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
      return res.status(400).json({ error: "Missing conversationHistory" });
    }

    // -----------------------------------------------------------------------
    // 3) Historial recortado (velocidad)
    // -----------------------------------------------------------------------
    const maxHistory = burbujasConfig.openai?.maxHistory ?? 8;
    const trimmedHistory = conversationHistory.slice(-maxHistory);

    // -----------------------------------------------------------------------
    // 4) Estado abierto/cerrado + contexto local
    // -----------------------------------------------------------------------
    const estadoAhora = estadoLocalAhora({
      timezone: burbujasConfig.timezone,
      locale: burbujasConfig.locale,
    });

    const eventoHoy = obtenerContextoDolorense({
      timezone: burbujasConfig.timezone,
    });

    // -----------------------------------------------------------------------
    // 4.1) Fecha y hora real (ANTI “ALUCINADAS”)
    // -----------------------------------------------------------------------
    const { fechaLarga, hora, diaSemana } = getFechaHoraArgentina({
      timezone: burbujasConfig.timezone || "America/Argentina/Buenos_Aires",
      locale: burbujasConfig.locale || "es-AR",
    });

    const fechaHoraSystem = `
Fecha y hora REAL (referencia obligatoria):
- Hoy es ${diaSemana}, ${fechaLarga}.
- Hora actual: ${hora}.
Regla: si el usuario pregunta por la fecha, el día o la hora, respondé usando EXACTAMENTE estos datos y no inventes.
`.trim();

    // -----------------------------------------------------------------------
    // 5) System prompt final (base + variables dinámicas)
    // -----------------------------------------------------------------------
    const sistema = systemPrompt
      .replaceAll("{{ESTADO_AHORA}}", estadoAhora)
      .replaceAll("{{EVENTO_HOY}}", eventoHoy);

    // OJO: acá mandamos el systemPrompt del backend + un system extra con fecha/hora real.
    const messages = [
      { role: "system", content: sistema },
      { role: "system", content: fechaHoraSystem },
      ...trimmedHistory,
    ];

    // -----------------------------------------------------------------------
    // 6) OpenAI
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
      }),
    });

    const openaiData = await openaiRes.json();

    if (!openaiRes.ok || openaiData?.error) {
      const msg = openaiData?.error?.message || "OpenAI error";
      return res.status(500).json({ error: msg });
    }

    // -----------------------------------------------------------------------
    // 7) Post-proceso de texto
    // -----------------------------------------------------------------------
    let reply =
      openaiData?.choices?.[0]?.message?.content?.trim() ||
      "Perdón, no pude generar respuesta. ¿Querés que lo intente de nuevo? 🙂";

    // limpiar cositas molestas
    reply = reply
      .replace(/\s*\(arg\)\s*/gi, " ")
      .replace(/seg[uú]n\s+horario\s+de\s+argentina/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // -----------------------------------------------------------------------
    // 8) TTS (ElevenLabs) usando utils/tts.js
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

// api/chat.js
import fetch from "node-fetch";

import { burbujasConfig } from "../config/burbujas.js";
import systemPrompt from "../prompts/systemPrompt.js";
import { estadoLocalAhora } from "../utils/estadoLocalAhora.js";
import { obtenerContextoDolorense } from "../utils/contextoDolores.js";
import { prepararTextoParaVoz } from "../utils/tts.js";

// (Opcional) Si estás en Next.js / Vercel, esto ayuda a evitar límites chicos de body.
// Si no lo necesitás o te da error por tu setup, podés borrarlo.
export const config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
  },
};

function formatFechaHoyAR({ timezone = "America/Argentina/Buenos_Aires" } = {}) {
  const now = new Date();
  const fecha = new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return { fecha, hora };
}

function esConsultaFechaHora(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.toLowerCase();

  // consultas típicas
  return (
    /que\s*d[ií]a\s*es\s*hoy/.test(t) ||
    /qu[eé]\s*fecha\s*es\s*hoy/.test(t) ||
    /hoy\s*qu[eé]\s*d[ií]a\s*es/.test(t) ||
    /qu[eé]\s*hora\s*es/.test(t) ||
    /hora\s*actual/.test(t) ||
    /fecha\s*actual/.test(t) ||
    /d[ií]a\s*de\s*hoy/.test(t)
  );
}

async function generarAudioEleven({ text, elevenApiKey, voiceId }) {
  if (!elevenApiKey || !voiceId || !text) return null;

  try {
    const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenApiKey,
      },
      body: JSON.stringify({
        text,
        model_id: burbujasConfig.eleven?.modelId || "eleven_multilingual_v2",
        voice_settings: burbujasConfig.eleven?.voiceSettings || {
          stability: 0.6,
          similarity_boost: 0.9,
        },
      }),
    });

    if (!tts.ok) return null;

    const buf = Buffer.from(await tts.arrayBuffer());
    return `data:audio/mpeg;base64,${buf.toString("base64")}`;
  } catch (e) {
    console.error("TTS error:", e);
    return null;
  }
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
    const body = req.body || {};
    const conversationHistoryRaw = body.conversationHistory;

    if (!Array.isArray(conversationHistoryRaw)) {
      return res.status(400).json({ error: "Missing conversationHistory" });
    }

    // -----------------------------------------------------------------------
    // 3) Sanitizar historial (NO confiar system del cliente)
    //    - el cliente puede mandar "system" y pisarte reglas.
    // -----------------------------------------------------------------------
    const conversationHistory = conversationHistoryRaw
      .filter(
        (m) =>
          m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map((m) => ({ role: m.role, content: m.content }));

    // -----------------------------------------------------------------------
    // 4) Historial recortado (velocidad)
    // -----------------------------------------------------------------------
    const maxHistory = burbujasConfig.openai?.maxHistory ?? 8;
    const trimmedHistory = conversationHistory.slice(-maxHistory);

    // -----------------------------------------------------------------------
    // 5) Estado abierto/cerrado + contexto local + FECHA/HORA AR (anti-alucinación)
    // -----------------------------------------------------------------------
    const tz = burbujasConfig.timezone || "America/Argentina/Buenos_Aires";

    const estadoAhora = estadoLocalAhora({
      timezone: tz,
      locale: burbujasConfig.locale,
    });

    const eventoHoy = obtenerContextoDolorense({ timezone: tz });

    const { fecha: fechaHoy, hora: horaHoy } = formatFechaHoyAR({ timezone: tz });

    // -----------------------------------------------------------------------
    // 6) Atajo: si preguntan fecha/hora, respondemos nosotros (sin OpenAI)
    //    Esto evita 100% que "invente" el día.
    // -----------------------------------------------------------------------
    const lastUserMsg = [...trimmedHistory].reverse().find((m) => m.role === "user")?.content || "";
    if (esConsultaFechaHora(lastUserMsg)) {
      const reply = `Hoy es ${fechaHoy}. Son las ${horaHoy}.`;

      // TTS (si está habilitado)
      let audioBase64 = null;
      if (ELEVEN_API_KEY && ELEVEN_VOICE_ID) {
        const voiceText = prepararTextoParaVoz(reply, {
          maxChars: burbujasConfig.eleven?.maxChars ?? 900,
          reemplazoWhatsApp: "por WhatsApp",
        });

        audioBase64 = await generarAudioEleven({
          text: voiceText,
          elevenApiKey: ELEVEN_API_KEY,
          voiceId: ELEVEN_VOICE_ID,
        });
      }

      return res.status(200).json({ reply, audio: audioBase64 });
    }

    // -----------------------------------------------------------------------
    // 7) System prompt final (base + variables dinámicas)
    // -----------------------------------------------------------------------
    const sistema = systemPrompt
      .replaceAll("{{ESTADO_AHORA}}", estadoAhora)
      .replaceAll("{{EVENTO_HOY}}", eventoHoy)
      .replaceAll("{{FECHA_HOY}}", fechaHoy)
      .replaceAll("{{HORA_HOY}}", horaHoy);

    const messages = [{ role: "system", content: sistema }, ...trimmedHistory];

    // -----------------------------------------------------------------------
    // 8) OpenAI
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
    // 9) Post-proceso de texto (limpieza)
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
    // 10) TTS (ElevenLabs) usando utils/tts.js
    // -----------------------------------------------------------------------
    let audioBase64 = null;

    if (ELEVEN_API_KEY && ELEVEN_VOICE_ID && reply) {
      const voiceText = prepararTextoParaVoz(reply, {
        maxChars: burbujasConfig.eleven?.maxChars ?? 900,
        reemplazoWhatsApp: "por WhatsApp",
      });

      audioBase64 = await generarAudioEleven({
        text: voiceText,
        elevenApiKey: ELEVEN_API_KEY,
        voiceId: ELEVEN_VOICE_ID,
      });
    }

    return res.status(200).json({ reply, audio: audioBase64 });
  } catch (err) {
    console.error("Chat API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

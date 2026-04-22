// api/chat.js

import { burbujasConfig } from "../config/burbujas.js";
import { construirPromptBurbujas } from "../prompts/burbujasPromptCompleto.js";
import { obtenerContextoDolorense } from "../utils/contextoDolores.js";
import { prepararTextoParaVoz } from "../utils/tts.js";

/**
 * Fecha/hora real en AR usando Intl + timeZone
 */
function getAhoraAR({
  timezone = "America/Argentina/Buenos_Aires",
  locale = "es-AR",
} = {}) {
  const now = new Date();

  const partsFecha = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).formatToParts(now);

  const partsHora = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (parts, type) => parts.find((p) => p.type === type)?.value;

  const weekday = (get(partsFecha, "weekday") || "").toLowerCase();
  const day = get(partsFecha, "day");
  const month = (get(partsFecha, "month") || "").toLowerCase();
  const year = get(partsFecha, "year");

  const hour = get(partsHora, "hour");
  const minute = get(partsHora, "minute");

  const fechaLarga = `${weekday} ${day} de ${month} de ${year}`;
  const horaHHMM = `${hour}:${minute}`;

  const dowMap = {
    lunes: 1,
    martes: 2,
    miércoles: 3,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sábado: 6,
    sabado: 6,
    domingo: 7,
  };

  const dayOfWeekISO = dowMap[weekday] || null;
  const hourNum = Number(hour);
  const minuteNum = Number(minute);

  return { now, fechaLarga, horaHHMM, weekday, dayOfWeekISO, hourNum, minuteNum };
}

/**
 * Estado abierto/cerrado
 */
function estadoLocalAhoraAR({
  timezone,
  locale,
  openHour = 8,
  closeHour = 21,
} = {}) {
  const { dayOfWeekISO, hourNum } = getAhoraAR({ timezone, locale });

  if (!dayOfWeekISO) return "No tengo confirmación exacta del estado del local ahora.";

  const esDomingo = dayOfWeekISO === 7;
  const esDiaLaboral = dayOfWeekISO >= 1 && dayOfWeekISO <= 6;
  const dentroHorario = hourNum >= openHour && hourNum < closeHour;

  if (esDomingo) return "Hoy es domingo: el local está cerrado.";
  if (esDiaLaboral && dentroHorario) return "El local está abierto ahora (lunes a sábado de 8 a 21).";
  if (esDiaLaboral && !dentroHorario) return "Ahora el local está cerrado (abrimos de lunes a sábado de 8 a 21).";

  return "No tengo confirmación exacta del estado del local ahora.";
}

/**
 * Detecta consultas de fecha/hora para responder sin IA
 */
function detectarPreguntaFechaHora(texto = "") {
  const t = String(texto).toLowerCase();

  const esFecha =
    /que dia es hoy|qué día es hoy|que día es hoy|fecha de hoy|hoy que dia|hoy qué día|hoy es que día|día de hoy/.test(t);

  const esHora =
    /que hora es|qué hora es|hora actual|hora es|decime la hora|me decis la hora|me decís la hora/.test(t);

  return { esFecha, esHora, esFechaOHora: esFecha || esHora };
}

/**
 * Limpia historial que venga del front: SOLO user/assistant.
 */
function sanitizarHistorial(conversationHistory) {
  if (!Array.isArray(conversationHistory)) return [];

  return conversationHistory
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }));
}

/**
 * CORS
 */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = new Set(burbujasConfig.allowedOrigins || []);

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/**
 * TTS ElevenLabs
 */
async function generarAudioBase64(texto, ELEVEN_API_KEY, ELEVEN_VOICE_ID) {
  if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID || !texto) return null;

  const voiceText = prepararTextoParaVoz(texto, {
    maxChars: burbujasConfig.eleven?.maxChars ?? 900,
    reemplazoWhatsApp: "por WhatsApp",
  });

  try {
    const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`, {
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
    });

    if (!tts.ok) {
      const errText = await tts.text().catch(() => "");
      console.error("ElevenLabs error:", tts.status, errText);
      return null;
    }

    const buf = Buffer.from(await tts.arrayBuffer());
    return `data:audio/mpeg;base64,${buf.toString("base64")}`;
  } catch (error) {
    console.error("TTS error:", error);
    return null;
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || "";
  const ELEVEN_VOICE_ID =
    process.env.ELEVENLABS_VOICE_ID || burbujasConfig.eleven?.defaultVoiceId || "";

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { conversationHistory = [], userName = "Anónimo" } = body;

    const cleanHistory = sanitizarHistorial(conversationHistory);

    const maxHistory = burbujasConfig.openai?.maxHistory ?? 10;
    const trimmedHistory = cleanHistory.slice(-maxHistory);

    const timezone = burbujasConfig.timezone || "America/Argentina/Buenos_Aires";
    const locale = burbujasConfig.locale || "es-AR";

    const ahoraAR = getAhoraAR({ timezone, locale });
    const estadoAhora = estadoLocalAhoraAR({ timezone, locale });
    const eventoHoy = obtenerContextoDolorense({ timezone });

    const lastUserMsg =
      [...trimmedHistory].reverse().find((m) => m.role === "user")?.content || "";

    const q = detectarPreguntaFechaHora(lastUserMsg);

    if (q.esFechaOHora) {
      let reply = "";

      if (q.esFecha && q.esHora) {
        reply = `Hoy es ${ahoraAR.fechaLarga} y son las ${ahoraAR.horaHHMM}.`;
      } else if (q.esFecha) {
        reply = `Hoy es ${ahoraAR.fechaLarga}.`;
      } else if (q.esHora) {
        reply = `Son las ${ahoraAR.horaHHMM}.`;
      }

      const audioBase64 = await generarAudioBase64(
        reply,
        ELEVEN_API_KEY,
        ELEVEN_VOICE_ID
      );

      return res.status(200).json({ reply, audio: audioBase64 });
    }

    const rawSystem = construirPromptBurbujas({
      estadoAhora,
      eventoHoy,
      nombreUsuario: userName,
    });

    const sistema = rawSystem
      .replaceAll("{{FECHA_HOY}}", ahoraAR.fechaLarga)
      .replaceAll("{{HORA_AHORA}}", ahoraAR.horaHHMM)
      .replaceAll("{{ESTADO_AHORA}}", estadoAhora)
      .replaceAll("{{EVENTO_HOY}}", eventoHoy);

    const messages = [{ role: "system", content: sistema }, ...trimmedHistory];

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
      console.error("OpenAI API error:", msg);
      return res.status(500).json({ error: msg });
    }

    let reply =
      openaiData?.choices?.[0]?.message?.content?.trim() ||
      "Perdón, no pude generar respuesta. ¿Querés que lo intente de nuevo? 🙂";

    reply = reply
      .replace(/\s*\(arg\)\s*/gi, " ")
      .replace(/seg[uú]n\s+horario\s+de\s+argentina/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    const replyLimpiaParaVoz = reply.replace(/(\d)\.(\d{3})/g, "$1$2");

    const audioBase64 = await generarAudioBase64(
      replyLimpiaParaVoz,
      ELEVEN_API_KEY,
      ELEVEN_VOICE_ID
    );

    return res.status(200).json({ reply, audio: audioBase64 });
  } catch (err) {
    console.error("Chat API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

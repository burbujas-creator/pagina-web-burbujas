import fetch from "node-fetch";

import { burbujasConfig } from "../config/burbujas.js";
import { estadoLocalAhora } from "../utils/estadoLocalAhora.js";
import { obtenerContextoDolorense } from "../utils/contextoDolores.js";
import { construirPromptBurbujas } from "../prompts/burbujasPromptCompleto.js";

export default async function handler(req, res) {
  // -----------------------------------------------------------------------
  // 1) CORS SENCILLO Y SEGURO (MISMA LÓGICA QUE TENÍAS)
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
  // 2) VARIABLES DE ENTORNO
  // -----------------------------------------------------------------------
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || "";
  const ELEVEN_VOICE_ID =
    process.env.ELEVENLABS_VOICE_ID || burbujasConfig.eleven?.defaultVoiceId || "EXAVITQu4vr4xnSDxMaL";

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  try {
    const { conversationHistory } = req.body || {};

    if (!Array.isArray(conversationHistory)) {
      return res.status(400).json({ error: "Missing conversationHistory" });
    }

    // Limitamos historial para velocidad (como antes, pero configurable)
    const maxHistory = burbujasConfig.openai?.maxHistory ?? 8;
    const trimmedHistory = conversationHistory.slice(-maxHistory);

    // -----------------------------------------------------------------------
    // 3) ESTADO "ABIERTO/CERRADO" + CONTEXTO DOLORENSE (MOVIDO A UTILS)
    // -----------------------------------------------------------------------
    const estadoAhora = estadoLocalAhora({
      timezone: burbujasConfig.timezone,
      locale: burbujasConfig.locale,
    });

    const eventoHoy = obtenerContextoDolorense({
      timezone: burbujasConfig.timezone,
    });

    // -----------------------------------------------------------------------
    // 4) SYSTEM PROMPT DEFINITIVO (MOVIDO A prompts/)
    // -----------------------------------------------------------------------
    const sistema = construirPromptBurbujas({ estadoAhora, eventoHoy });

    const messages = [{ role: "system", content: sistema }, ...trimmedHistory];

    // -----------------------------------------------------------------------
    // 5) LLAMADA A OPENAI
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
    // 6) POST-PROCESO DEL TEXTO (TU LIMPIEZA ORIGINAL)
    // -----------------------------------------------------------------------
    let reply =
      openaiData?.choices?.[0]?.message?.content?.trim() ||
      "Perdón, no pude generar respuesta. ¿Querés que lo intente de nuevo? 🙂🙂";

    reply = reply
      .replace(/\s*\(arg\)\s*/gi, " ")
      .replace(/seg[uú]n\s+horario\s+de\s+argentina/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // -----------------------------------------------------------------------
    // 7) TEXTO A VOZ (ELEVENLABS) CON MAPA DE NÚMEROS (TU LÓGICA)
    // -----------------------------------------------------------------------

    function numeroATexto(num) {
      const mapa = {
        5000: "cinco mil",
        7000: "siete mil",
        8000: "ocho mil",
        8500: "ocho mil quinientos",
        10000: "diez mil",
        11500: "once mil quinientos",
        12000: "doce mil",
        14000: "catorce mil",
        15000: "quince mil",
        17000: "diecisiete mil",
        20000: "veinte mil",
        25000: "veinticinco mil",
      };
      return mapa[num] || num.toString();
    }

    let audioBase64 = null;

    if (ELEVEN_API_KEY && ELEVEN_VOICE_ID && reply) {
      let voiceText = reply
        // enlaces Markdown → solo el texto
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
        // quitar URLs sueltas
        .replace(/\bhttps?:\/\/\S+/gi, "")
        // teléfonos → "por WhatsApp"
        .replace(/\b2245\s*40\s*2689\b/g, "por WhatsApp")
        .replace(/\b5492245402689\b/g, "por WhatsApp")
        // símbolos
        .replace(/@/g, " arroba ")
        .replace(/\+/g, " más ")
        .replace(/\$/g, " pesos ")
        .replace(/\(arg\)/gi, "");

      // Ajustes fonéticos
      voiceText = voiceText.replace(/Sphera/gi, "Sfera");
      voiceText = voiceText.replace(/\bVR\b/gi, "vé érre");

      // Números grandes → texto (4 o 5 dígitos)
      voiceText = voiceText.replace(/\b\d{4,5}\b/g, (num) =>
        numeroATexto(Number(num))
      );

      // "hs" → "hora(s)"
      voiceText = voiceText
        .replace(/(\b1)\s*hs\b/gi, "$1 hora")
        .replace(/(\d+)\s*hs\b/gi, "$1 horas")
        .replace(/\bhrs?\b/gi, "horas")
        .replace(/\bhs\b/gi, "horas");

      // "lunes a sábados" variantes
      voiceText = voiceText
        .replace(
          /\blun(?:es)?\s*[-–—]\s*s[áa]b(?:ado|ados)?\b/gi,
          "lunes a sábados"
        )
        .replace(
          /\blun(?:es)?\s*a\s*s[áa]b(?:ado|ados)?\b/gi,
          "lunes a sábados"
        );

      // Limitar longitud para que el TTS sea más rápido
      const maxChars = burbujasConfig.eleven?.maxChars ?? 900;
      if (voiceText.length > maxChars) {
        voiceText = voiceText.slice(0, maxChars);
      }

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

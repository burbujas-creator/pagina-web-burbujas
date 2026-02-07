// utils/tts.js

export function numeroATexto(num) {
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

/**
 * Convierte el texto del bot (reply) a una versión apta para TTS:
 * - elimina urls
 * - convierte markdown links a texto
 * - normaliza símbolos
 * - ajustes fonéticos (Sphera/Sfera, VR)
 * - convierte algunos números (4-5 dígitos) a texto
 * - limita longitud
 */
export function prepararTextoParaVoz(reply, opts = {}) {
  const {
    maxChars = 900,
    reemplazoWhatsApp = "por WhatsApp",
  } = opts;

  if (!reply || typeof reply !== "string") return "";

  let voiceText = reply
    // enlaces Markdown → solo el texto
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    // quitar URLs sueltas
    .replace(/\bhttps?:\/\/\S+/gi, "")
    // teléfonos comunes → "por WhatsApp"
    .replace(/\b2245\s*40\s*2689\b/g, reemplazoWhatsApp)
    .replace(/\b5492245402689\b/g, reemplazoWhatsApp)
    // símbolos
    .replace(/@/g, " arroba ")
    .replace(/\+/g, " más ")
    .replace(/\$/g, " pesos ")
    .replace(/\(arg\)/gi, "");

  // Ajustes fonéticos
  voiceText = voiceText.replace(/Sphera/gi, "Sfera");
  voiceText = voiceText.replace(/\bVR\b/gi, "vé érre");

  // Números grandes (4 o 5 dígitos) → texto (según mapa)
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

  // compactar espacios
  voiceText = voiceText.replace(/\s{2,}/g, " ").trim();

  // Limitar longitud para TTS
  if (voiceText.length > maxChars) {
    voiceText = voiceText.slice(0, maxChars);
  }

  return voiceText;
}

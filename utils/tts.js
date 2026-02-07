// utils/tts.js

// Mapeo de dígitos para lectura "uno por uno" (útil si alguna vez querés decir un teléfono)
const DIGITOS = {
  "0": "cero",
  "1": "uno",
  "2": "dos",
  "3": "tres",
  "4": "cuatro",
  "5": "cinco",
  "6": "seis",
  "7": "siete",
  "8": "ocho",
  "9": "nueve",
};

export function numeroATexto(num) {
  // Mapa rápido para los montos que usás más
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

  if (mapa[num]) return mapa[num];

  // Fallback: si no está en el mapa, devolvemos el número como string
  // (evita inventar conversiones complejas que puedan quedar raras en voz)
  return String(num);
}

function limpiarSeparadoresMiles(strNum) {
  // Convierte "12.000" / "12,000" / "1.000.000" a "12000" / "12000" / "1000000"
  return strNum.replace(/[.,](?=\d{3}\b)/g, "");
}

function horaATexto(h, m) {
  // h: 0-23, m: 0-59
  // Para TTS: "cinco y veinte", "diecisiete y cinco", "doce en punto", etc.
  const hora = Number(h);
  const minuto = Number(m);

  // Normalización de "en punto"
  if (minuto === 0) {
    return `${hora} en punto`;
  }
  // "y cinco" en vez de "y 05"
  return `${hora} y ${minuto}`;
}

function digitosATextoSolo(numStr) {
  return numStr
    .replace(/\D/g, "")
    .split("")
    .map((d) => DIGITOS[d] || d)
    .join(" ");
}

/**
 * Convierte el texto del bot (reply) a una versión apta para TTS:
 * - elimina urls
 * - convierte markdown links a texto
 * - normaliza símbolos (°, cc, @, +)
 * - ajustes fonéticos (Sphera/Sfera, VR)
 * - convierte algunos números frecuentes (4-6 dígitos) a texto (según mapa)
 * - convierte montos con separador de miles (12.000) al número plano antes de mapear
 * - convierte horas tipo 5:20 para evitar "dos puntos"
 * - limita longitud
 */
export function prepararTextoParaVoz(reply, opts = {}) {
  const {
    maxChars = 900,
    reemplazoWhatsApp = "por WhatsApp",

    // Modo teléfonos:
    // - "whatsapp" (default): reemplaza teléfonos por "por WhatsApp"
    // - "digitos": lee el teléfono dígito por dígito (si alguna vez lo necesitás)
    // - "mantener": no toca teléfonos
    telefonoModo = "whatsapp",
  } = opts;

  if (!reply || typeof reply !== "string") return "";

  let voiceText = reply;

  // 1) Markdown links → solo el texto visible
  voiceText = voiceText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

  // 2) Quitar URLs sueltas
  voiceText = voiceText.replace(/\bhttps?:\/\/\S+/gi, "");

  // 3) Teléfonos (modo configurable)
  // Captura secuencias típicas AR con o sin espacios (10 a 13 dígitos, con posibles prefijos 54/549)
  // Ej: 2245402689, 5492245402689, +54 9 2245 40-2689, etc.
  const telefonoRegex = /(\+?\s*54\s*9\s*)?(\d[\d\s-]{8,}\d)/g;

  if (telefonoModo === "whatsapp") {
    voiceText = voiceText.replace(telefonoRegex, reemplazoWhatsApp);
  } else if (telefonoModo === "digitos") {
    voiceText = voiceText.replace(telefonoRegex, (m) => digitosATextoSolo(m));
  } // "mantener" no hace nada

  // 4) Símbolos y normalizaciones cortas
  voiceText = voiceText
    .replace(/@/g, " arroba ")
    .replace(/\+/g, " más ")
    // Ojo: si aparece "$" en el texto, lo transformamos a "pesos" (pero tu prompt ya pide no usar $)
    .replace(/\$/g, " pesos ")
    .replace(/\(arg\)/gi, " ")
    // grados y cc
    .replace(/°/g, " grados ")
    .replace(/\bcc\b/gi, " centímetros cúbicos ");

  // 5) Ajustes fonéticos
  voiceText = voiceText.replace(/Sphera/gi, "Sfera");
  voiceText = voiceText.replace(/\bVR\b/gi, "vé érre");

  // 6) Horas tipo 5:20 → "5 y 20" (evita el “dos puntos”)
  // (Las URLs ya fueron eliminadas arriba, así que no rompemos nada)
  voiceText = voiceText.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, hh, mm) =>
    horaATexto(hh, mm)
  );

  // 7) Números con separador de miles → normalizar primero (12.000 → 12000)
  // Luego intentamos mapear a texto si coincide con tus montos frecuentes.
  voiceText = voiceText.replace(/\b\d{1,3}([.,]\d{3})+\b/g, (match) => {
    const plano = limpiarSeparadoresMiles(match);
    const n = Number(plano);
    return Number.isFinite(n) ? numeroATexto(n) : match;
  });

  // 8) Números grandes (4 a 6 dígitos) → texto (según mapa)
  // (Incluye 12000, 25000, 100000, etc. Si no está en mapa, queda numérico)
  voiceText = voiceText.replace(/\b\d{4,6}\b/g, (num) => numeroATexto(Number(num)));

  // 9) "hs/hrs" → "hora(s)"
  voiceText = voiceText
    .replace(/(\b1)\s*hs\b/gi, "$1 hora")
    .replace(/(\d+)\s*hs\b/gi, "$1 horas")
    .replace(/\bhrs?\b/gi, "horas")
    .replace(/\bhs\b/gi, "horas");

  // 10) "lunes a sábados" variantes
  voiceText = voiceText
    .replace(/\blun(?:es)?\s*[-–—]\s*s[áa]b(?:ado|ados)?\b/gi, "lunes a sábados")
    .replace(/\blun(?:es)?\s*a\s*s[áa]b(?:ado|ados)?\b/gi, "lunes a sábados");

  // 11) Compactar espacios
  voiceText = voiceText.replace(/\s{2,}/g, " ").trim();

  // 12) Limitar longitud para TTS
  if (voiceText.length > maxChars) {
    voiceText = voiceText.slice(0, maxChars).trim();
  }

  return voiceText;
}

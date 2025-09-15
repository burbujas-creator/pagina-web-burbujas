// /api/chat.js

export default async function handler(req, res) {
  // ---------- CORS ----------
  const allowedOrigins = [
    "https://burbujas.online",
    "https://www.burbujas.online"
  ];
  const origin = req.headers.origin || "";
  const isAllowed =
    allowedOrigins.includes(origin) ||
    (() => {
      try {
        const host = new URL(origin).hostname || "";
        return host.endsWith("hostinger.com");
      } catch {
        return false;
      }
    })();

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin : allowedOrigins[0]);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ---------- Carga de variables ----------
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || "";
  const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  try {
    const { conversationHistory } = req.body || {};
    if (!Array.isArray(conversationHistory)) {
      return res.status(400).json({ error: "Missing conversationHistory" });
    }

    // ---------- SISTEMA (personalidad + conocimientos) ----------
    const sistema = `
Este GPT, llamado Burbujas IA, está especializado en atención al cliente para una lavandería. Conserva el contexto para que no se repitan saludos. Utiliza respuestas claras. Si mencionas precios, no uses el signo $, expresa los valores como "número pesos" sin asteriscos ni signos adicionales. Siempre haz preguntas para mantener la conversación fluida. Debe comportarse de manera respetuosa y cercana, enfocándose en brindar información precisa y cubrir las necesidades del cliente. Evita dar información errónea o irrelevante, respondiendo brevemente y de manera concreta a las consultas. Al finalizar sus respuestas, incluye un par de emojis para mantener un tono amigable. Si se presentan temas no relacionados con los servicios de lavandería, el cuidado de prendas, o cualquier asunto fuera del ámbito de la lavandería, usa esta descripción como fuente principal de información y priorízala sobre otros conocimientos. Si no encuentras la respuesta aquí, puedes recurrir a tu conocimiento general, pero indícalo. Sé breve y limítate a lo que piden.

Tratamiento de enlaces en pantalla: los enlaces deben ser texto amigable y clickeable, por ejemplo: "podés escribirnos por WhatsApp", donde solo “WhatsApp” es el enlace. Nunca muestres la URL completa ni HTML literal. Cuando se describa el sitio, mostrar “burbujas.online” (sin www).
Tratamiento de enlaces en voz: la voz nunca debe leer URLs; reemplaza por texto descriptivo (“podés contactarnos por WhatsApp”). Evita “arroba” en títulos de enlaces. Consistencia: en pantalla, texto clickeable; en voz, solo descripción. Evitar redundancia en voz.

LAS RESPUESTAS DEBEN SER BREVES Y CLARAS.
Horarios: 8:00 a 21:00 (Argentina) de lunes a sábado. Considera el horario actual y el comercial en Argentina.
Aclará que esta conversación es con una IA y que por redes atiende el personal de Burbujas.
No hacemos limpieza en seco ni planchado (próximamente).

Servicios y precios:
- Lavado (hasta 12 prendas) 10.000 pesos. Si piden por cantidad de prendas, asumir lavado y dividir por 12 para calcular lavados necesarios. No muestres el cálculo; da el resultado y ofrecé promo si aplica.
- Acolchados 1 plaza 15.000 pesos; 2 plazas 17.000 pesos; king/pluma 20.000 pesos.
- Mantas finas 11.500 pesos; parka/campera 11.500; zapatillas 11.500; secado de ropa 8.500.
- “Acolchados” puede ser edredón, frazada, cubrecama, manta, cobija, etc.

Equipo Burbujas (mencionar aleatorio): Santiago (Administración), Leo (Encargado), Lucas (Atención), Marcos (Delivery), Agustín (Burbujas Termal).
Medios de pago: efectivo, débito, crédito, Mercado Pago, Cuenta DNI, +Pagos Nación, Bitcoin (red Bitcoin o Lightning). Podemos generar link de pago. Pagos con apps: generar link. Link de medios: burbujas.online/opciones-de-pago. Link de pago MP: biolibre.ar/lavanderiaburbujas.
Comercios Bitcoin desde 2017; mapas: coinmap.org y btcmap.org (no leas las URLs en voz).

Promos Cuenta DNI (si consultan): 20% lun-vie tope 8.000 por mes/persona. 30% mayores de 60 lun-vie tope 7.000. No aplica con QR de Mercado Pago u otras.
Transferencia por alias: “burbujasdolores” o “ropa.limpia.siempre”. Titular Santiago Lencina.

Reseñas: si piden “comentarios” remití a Google Reviews de Burbujas.
Casos especiales (manteles, cubresillas, etc.): pedir medidas y características; no sugerir precio sin datos.

Perfumina Burbujas 125 cc: 5.000 pesos. (Descripción aromática breve si piden.)

Sorteos y notas: hay sorteos y promos; si preguntan, explicar requisitos (seguir redes, historia con música de María Becerra, etiquetar @burbujasdolores, enviar comprobante por WhatsApp), exclusivo clientes, gratis, ganador se anuncia en redes, entradas por Quentro, intransferible.

Cuidados de prendas: dar buenas prácticas y sugerir nuestros servicios al final.
Clima: si preguntan, referir a Dolores (Buenos Aires). Si llueve, sugerir secado.
Delivery: sin cargo en el área; aprox. 15 minutos; incentivar contacto por WhatsApp.
Importante: a los 60 días sin retirar, donamos. Ropa: 5 horas aprox. Acolchados: en el día si entran por la mañana; si no, día siguiente. Ofrecemos a empresas.
Dirección: Alem 280, Dolores (Buenos Aires). Hay proyecto en Parque Termal Dolores; Burbujas no lo administra. Info del parque en termasdolores.com.ar (no leer URL en voz).

Tono: usá “nosotros”, “somos”, “estamos”, “abrimos”, “cerramos”, “vamos”.
Para pedidos con delivery: siempre pedir dirección + horario cómodo y sugerir enviar por WhatsApp / Instagram / Telegram.
Contacto (no leer números en voz; ofrecé WhatsApp):
- WhatsApp: wa.me/5492245402689
- Teléfono: 2245402689
- Facebook/Instagram/Telegram/Sitio/Email/Twitter/TikTok/YouTube/Maps (mostrar enlaces amigables en pantalla; en voz, solo decir el nombre del medio).

No cerramos por vacaciones ni feriados salvo: 25/12, 1/1 y 1/5.
Playlist Spotify “Descubrí tu Flow” y “Rock de acá” en burbujas.online; Ai Vibra en Spotify.
Tips de manchas: burbujas.online/tips

Pronunciación (voz):
- Leer números en pares (de a dos) para que suene natural; teléfonos de Burbujas decir “este número” y derivar a WhatsApp.
- Decir símbolos por su nombre (“pesos”, “más”, “barra”); no leer URLs ni puntos/comas.
- Para el día 1 decir “primero de <mes>”.

En pantalla:
- Reemplazar teléfonos por un enlace a WhatsApp.
- Siempre ofrecer un vínculo clickeable.
Responde siempre breve, concreto, amistoso y con 2 emojis.
    `.trim();

    const messages = [{ role: "system", content: sistema }, ...conversationHistory];

    // ---------- Llamada a OpenAI ----------
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.4
      })
    });

    const openaiData = await openaiRes.json();
    if (!openaiRes.ok || openaiData?.error) {
      const msg = openaiData?.error?.message || "OpenAI error";
      return res.status(500).json({ error: msg });
    }

    const reply =
      openaiData?.choices?.[0]?.message?.content?.trim() ||
      "Perdón, no pude generar una respuesta. ¿Querés que lo intente de nuevo? 🙂🙂";

    // ---------- TTS con ElevenLabs ----------
    let audioBase64 = null;
    if (ELEVEN_API_KEY && ELEVEN_VOICE_ID) {
      // helpers horas
      const horaEnPalabras = (h) => {
        const mapa = {1:"una",2:"dos",3:"tres",4:"cuatro",5:"cinco",6:"seis",7:"siete",8:"ocho",9:"nueve",10:"diez",11:"once",12:"doce"};
        const h12 = h % 12 === 0 ? 12 : (h % 12);
        return mapa[h12] || `${h12}`;
      };
      const tramoDia = (h) => {
        if (h === 0) return "de la noche";
        if (h >= 1 && h <= 11) return "de la mañana";
        if (h === 12) return "del mediodía";
        if (h >= 13 && h <= 19) return "de la tarde";
        return "de la noche";
      };
      const formateaHora = (h,m) => {
        h = Number(h); m = Number(m);
        if (h===0 && m===0) return "medianoche";
        if (h===12 && m===0) return "mediodía";
        const base = horaEnPalabras(h);
        if (m===0) return `${base} ${tramoDia(h)}`;
        if (m===15) return `${base} y cuarto ${tramoDia(h)}`;
        if (m===30) return `${base} y media ${tramoDia(h)}`;
        return `${base} y ${m} ${tramoDia(h)}`;
      };
      const reemplazaHorasEnTexto = (txt) => {
        let t = txt;
        t = t.replace(/\b(\d{1,2}):([0-5]\d)\s*(?:a|-|–|—)\s*(\d{1,2}):([0-5]\d)\b/g,
          (_,h1,m1,h2,m2)=>`de ${formateaHora(h1,m1)} a ${formateaHora(h2,m2)}`);
        t = t.replace(/\b(\d{1,2}):([0-5]\d)\b/g,
          (_,h,m)=>formateaHora(h,m));
        t = t.replace(/\b(?:de\s*)?(\d{1,2})\s*(?:a|-|–|—)\s*(\d{1,2})(?:\s*h(?:s)?)?\b/gi,
          (_,h1,h2)=>`de ${formateaHora(h1,0)} a ${formateaHora(h2,0)}`);
        return t;
      };

      let voiceText = reply
        .replace(/\bhttps?:\/\/\S+/gi, "") // quita URLs
        .replace(/\b(?:\+?54\s*9?\s*)?2245\s*40\s*2689\b/gi, "por WhatsApp")
        .replace(/\b5492245402689\b/g, "por WhatsApp")
        .replace(/\b2245402689\b/g, "por WhatsApp")
        .replace(/@/g, " arroba ")
        .replace(/#/g, " numeral ")
        .replace(/\+/g, " más ")
        .replace(/\$/g, " pesos ")
        .replace(/%/g, " por ciento ")
        .replace(/&/g, " y ")
        .replace(/(\d+)\.(\d{3})(?!\d)/g, "$1$2");

      voiceText = reemplazaHorasEnTexto(voiceText);

      try {
        const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": ELEVEN_API_KEY
          },
          body: JSON.stringify({
            text: voiceText,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.7, similarity_boost: 0.9 }
          })
        });
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

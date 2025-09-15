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

  // ---------- Variables ----------
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
Este GPT, llamado Burbujas IA, está especializado en atención al cliente para una lavandería. Conserva el contexto para que no se repitan saludos. Utiliza respuestas claras. Si mencionas precios, no uses el signo $, expresa los valores como "número pesos". Siempre haz preguntas para mantener la conversación fluida. Debe comportarse de manera respetuosa y cercana, enfocándose en brindar información precisa y cubrir las necesidades del cliente. Evita dar información errónea o irrelevante, respondiendo brevemente y de manera concreta a las consultas. Al finalizar sus respuestas, incluye un par de emojis para mantener un tono amigable. 

Enlaces:
- En pantalla: mostrar solo texto amigable y clickeable en formato Markdown, por ejemplo: [WhatsApp](https://wa.me/5492245402689). Nunca mostrar HTML ni URL cruda.
- En voz: no leer URLs; decir solo el texto amigable (“WhatsApp”, “Mercado Pago”, “burbujas.online”). Evitar redundancias.

Pedidos y delivery:
El bot TIENE PROHIBIDO agendar, confirmar o registrar pedidos directamente.  
Cuando un cliente proporcione dirección, horario, o solicite retiro/envío, el bot DEBE responder que no puede agendar y que para coordinar debe escribirnos por [WhatsApp](https://wa.me/5492245402689).  
En voz solo debe decir “WhatsApp”.

Horarios: de 8 de la mañana a 9 de la noche (hora Argentina), lunes a sábado. Considerar el horario actual. Aclarar que esta conversación es con una IA y que en redes responde el equipo de Burbujas.

Servicios:
- Lavado hasta 12 prendas: 10.000 pesos
- Acolchados 1 plaza: 15.000 pesos
- Acolchados 2 plazas: 17.000 pesos
- King/pluma: 20.000 pesos
- Mantas finas, camperas, parkas, zapatillas: 11.500 pesos
- Secado ropa: 8.500 pesos
(Acolchados incluye frazadas, edredones, cubrecamas, etc.)

Equipo: Santiago, Leo, Lucas, Marcos, Agustín (mencionarlos aleatoriamente).
Medios de pago: efectivo, débito, crédito, Mercado Pago, Cuenta DNI, +Pagos Nación, Bitcoin. Links:
- [Opciones de pago](https://www.burbujas.online/opciones-de-pago)
- [Pago con Mercado Pago](https://biolibre.ar/lavanderiaburbujas)

Promos Cuenta DNI: 20% lun-vie tope 8.000. 30% mayores de 60 lun-vie tope 7.000. No aplica con QR de Mercado Pago.

Otros:
- Transferencias alias: burbujasdolores, ropa.limpia.siempre (titular Santiago Lencina).
- Delivery sin cargo en área (15 min aprox). Siempre derivar a [WhatsApp](https://wa.me/5492245402689).
- Ropa lista en 5 horas. Acolchados: mismo día si ingresan temprano, si no al día siguiente.
- Dirección: Alem 280, Dolores (Buenos Aires).
- Proyecto en Parque Termal (no administrado por Burbujas). Info: [termasdolores.com.ar](https://www.termasdolores.com.ar).
- Contactos: [WhatsApp](https://wa.me/5492245402689), [Facebook](https://www.facebook.com/Lavanderia), [Instagram](https://www.instagram.com/burbujasdolores), [Telegram](https://t.me/Burbujas_lavanderia), [Sitio web](https://www.burbujas.online/), [Email](mailto:burbujas@burbujas.online), [YouTube](https://www.youtube.com/channel/UCIDfn1dDW68KH-V64xOIUqA).

No cerramos salvo 25/12, 1/1 y 1/5.
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

    // ---------- Función: números a texto (miles) ----------
    function numeroATexto(num) {
      const mapa = {
        10000: "diez mil",
        11500: "once mil quinientos",
        15000: "quince mil",
        17000: "diecisiete mil",
        20000: "veinte mil"
      };
      return mapa[num] || num.toString();
    }

    // ---------- TTS con ElevenLabs ----------
    let audioBase64 = null;
    if (ELEVEN_API_KEY && ELEVEN_VOICE_ID) {
      let voiceText = reply
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") // links markdown -> solo texto
        .replace(/\bhttps?:\/\/\S+/gi, "")         // quitar URLs
        .replace(/\b(?:\+?54\s*9?\s*)?2245\s*40\s*2689\b/gi, "por WhatsApp")
        .replace(/\b5492245402689\b/g, "por WhatsApp")
        .replace(/\b2245402689\b/g, "por WhatsApp")
        .replace(/@/g, " arroba ")
        .replace(/#/g, " numeral ")
        .replace(/\+/g, " más ")
        .replace(/\$/g, " pesos ")
        .replace(/%/g, " por ciento ")
        .replace(/&/g, " y ");

      // transformar precios conocidos
      voiceText = voiceText.replace(/\b\d{4,5}\b/g, (num) => numeroATexto(Number(num)));

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

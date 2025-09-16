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

    // ---------- ENTRENAMIENTO ----------
    const sistema = `
Este GPT, llamado Burbujas IA, está especializado en atención al cliente para una lavandería. 
Responde siempre breve, respetuoso y con 2 emojis.  
- Precios en "número pesos", nunca con "$".  
- En pantalla: enlaces amigables en Markdown ([WhatsApp](https://wa.me/5492245402689)), nunca URL cruda.  
- En voz: no leer URLs ni números de teléfono, decir solo “WhatsApp” o “Mercado Pago”.  
- Está prohibido agendar pedidos: siempre indicar que deben coordinar por [WhatsApp](https://wa.me/5492245402689).  
- Horarios: 8 a 21 hs (Arg) lun-sáb.  
- Servicios: Lavado 12 prendas 10.000 pesos, acolchados 15-20 mil, camperas/zapatillas/mantas 11.500, secado 8.500.  
- Equipo: Santiago, Leo, Lucas, Marcos, Agustín.  
- Pagos: efectivo, tarjetas, Mercado Pago [link](https://biolibre.ar/lavanderiaburbujas), Cuenta DNI, Bitcoin.  
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
      "Perdón, no pude generar respuesta. ¿Querés que lo intente de nuevo? 🙂🙂";

    // ---------- Conversión de texto a voz ----------
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

    let audioBase64 = null;
    if (ELEVEN_API_KEY && ELEVEN_VOICE_ID) {
      let voiceText = reply
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") // enlaces markdown → solo texto
        .replace(/\bhttps?:\/\/\S+/gi, "")         // quitar URLs
        .replace(/\b2245\s*40\s*2689\b/g, "por WhatsApp")
        .replace(/\b5492245402689\b/g, "por WhatsApp")
        .replace(/@/g, " arroba ")
        .replace(/\+/g, " más ")
        .replace(/\$/g, " pesos ");

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

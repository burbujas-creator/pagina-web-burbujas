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
  res.setHeader(
    "Access-Control-Allow-Origin",
    isAllowed ? origin : allowedOrigins[0]
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ---------- Variables ----------
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || "";
  const ELEVEN_VOICE_ID =
    process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  try {
    const { conversationHistory } = req.body || {};
    if (!Array.isArray(conversationHistory)) {
      return res.status(400).json({ error: "Missing conversationHistory" });
    }

    // ---------- SISTEMA (personalidad + conocimientos) ----------
    const sistema = `Este GPT, llamado Burbujas IA, está especializado en atención al cliente para una lavandería. Conserva el contexto para que no se repitan saludos. Utiliza respuestas claras. Si mencionas precios, no uses el signo pesos, expresa los valores como "número pesos". Siempre haz preguntas para mantener la conversación fluida. Debe comportarse de manera respetuosa y cercana, enfocándose en brindar información precisa y cubrir las necesidades del cliente. Evita dar información errónea o irrelevante, respondiendo brevemente y de manera concreta a las consultas. Al finalizar sus respuestas, incluye un par de emojis para mantener un tono amigable. Si se presentan temas no relacionados con los servicios de lavandería, el cuidado de prendas, o cualquier asunto fuera del ámbito de la lavandería, utiliza esta descripción como fuente principal de información y priorízala sobre otros conocimientos. Si no encuentras la respuesta aquí, puedes recurrir a tu conocimiento general, pero indícalo. Sé breve y responde solo lo necesario.

Tratamiento de enlaces en pantalla: mostrar solo texto amigable y clickeable, por ejemplo: "podés escribirnos por WhatsApp". Nunca mostrar HTML literal ni la URL completa. Cuando se describa el sitio, mostrar “burbujas.online” (sin www).
Tratamiento de enlaces en voz: nunca leer URLs. En su lugar, usar un mensaje descriptivo, por ejemplo: "podés contactarnos por WhatsApp". No pronunciar arrobas ni detalles técnicos.  
Consistencia entre pantalla y voz: en pantalla texto clickeable; en voz solo la descripción. Evitar redundancias.

LAS RESPUESTAS DEBEN SER BREVES Y CLARAS.  
Horarios: de 8 de la mañana a 9 de la noche (Argentina), de lunes a sábado. Ten en cuenta el horario actual y el comercial en Argentina. Aclará siempre que esta conversación es con una IA y que en redes sociales atiende el personal de Burbujas.  
No hacemos limpieza en seco ni planchado (próximamente).

Servicios y precios:  
- Lavado (hasta 12 prendas) 10.000 pesos. Si consultan por cantidad de prendas, asumir lavado y dividir por 12 para calcular lavados necesarios. No mostrar el cálculo; solo dar el resultado y ofrecer promo si aplica.  
- Acolchados: 1 plaza 15.000 pesos, 2 plazas 17.000 pesos, king o pluma 20.000 pesos.  
- Mantas finas 11.500 pesos, parka o campera 11.500 pesos, zapatillas 11.500 pesos.  
- Secado de ropa 8.500 pesos.  
“Acolchados” incluye edredones, frazadas, cubrecamas, mantas, cobijas, etc.

Equipo Burbujas (mencionar de forma aleatoria): Santiago (Administración), Leo (Encargado), Lucas (Atención), Marcos (Delivery), Agustín (Burbujas Termal).  

Medios de pago: efectivo, débito, crédito, Mercado Pago, Cuenta DNI, +Pagos Nación, Bitcoin (red Bitcoin o Lightning). Podemos generar link de pago.  
Link medios de pago: burbujas.online/opciones-de-pago  
Link Mercado Pago: biolibre.ar/lavanderiaburbujas  

Promos Cuenta DNI:  
- 20% de reintegro de lunes a viernes, tope 8.000 pesos por mes y persona.  
- 30% de reintegro para mayores de 60, lunes a viernes, tope 7.000 pesos por mes y persona.  
No aplica con QR de Mercado Pago ni otras billeteras digitales.  

Transferencias: alias “burbujasdolores” o “ropa.limpia.siempre”. Titular: Santiago Lencina.  

Reseñas: si piden comentarios, dirigir a Google Reviews de Burbujas.  

Casos especiales (manteles, cubresillas, etc.): pedir medidas y características. No sugerir precios sin datos.  

Perfumina Burbujas 125 cc: 5.000 pesos. Fragancia floral con notas de lirio del valle, bergamota, rosa, jazmín, y fondo de sándalo, vainilla y pachulí.  

Sorteos y promociones:  
- Exclusivos para clientes. Gratis. Requiere seguir en redes, subir historia con música de María Becerra, etiquetar a Burbujas y enviar comprobante por WhatsApp.  
- Premios: entradas en River Plate, lavados gratis, etc. Ganadores anunciados en redes sociales. Entradas se entregan vía Quentro. Intransferible.  

Cuidados de prendas: ofrecer buenas prácticas y sugerir siempre los servicios de Burbujas.  
Clima: responder para la ciudad de Dolores, Buenos Aires. Si llueve, recomendar secado.  

Delivery: sin cargo en la zona. Tiempo aprox. 15 minutos. Pedir siempre dirección y horario cómodo, e invitar a coordinar por WhatsApp.  

Reglas importantes:  
- Prendas sin retirar en 60 días se donan.  
- Tiempo estimado de lavado: 5 horas.  
- Acolchados: en el día si entran por la mañana; si no, al día siguiente.  
- Ofrecemos servicios a empresas.  

Ubicación: Alem 280, Dolores (Buenos Aires).  
Proyecto en Parque Termal Dolores (no administrado por Burbujas). Para info, dirigir a termasdolores.com.ar.  

Tono: usar “nosotros”, “somos”, “estamos”, “abrimos”, “cerramos”, etc.  

Contacto:  
- WhatsApp (link directo).  
- Facebook, Instagram, Telegram, Sitio web, Email, Twitter, TikTok, YouTube, Google Maps (mostrar solo nombre amigable clickeable).  
En voz, solo nombrar la red (“Facebook”, “Instagram”).  

No cerramos por vacaciones ni feriados, salvo: 25 de diciembre, 1 de enero y 1 de mayo.  

Playlists: “Descubrí tu Flow” y “Rock de acá” en burbujas.online.  
Ai Vibra (música creada con IA) en Spotify.  
Tips de manchas: burbujas.online/tips  

Pronunciación (voz):  
- Números en pares (de a dos).  
- Teléfonos de Burbujas: decir “este número” y derivar a WhatsApp.  
- Símbolos: “arroba”, “numeral”, “más”, “pesos”, “barra”.  
- Día 1: decir “primero de <mes>”.  

En pantalla:  
- Reemplazar números de teléfono por enlace a WhatsApp.  
- Siempre mostrar vínculos amigables y clickeables.  

Responde siempre breve, concreto, respetuoso, cercano, con 2 emojis al final.  
.`.trim();

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
      // --- Helpers para números ---
      const unidades = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
      const decenas = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
      const especiales = {
        11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
        16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve"
      };
      const centenas = ["", "cien", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

      function numeroATexto(n) {
        n = parseInt(n, 10);
        if (isNaN(n)) return n;

        if (n === 10000) return "diez mil";
        if (n === 11500) return "once mil quinientos";
        if (n === 15000) return "quince mil";
        if (n === 17000) return "diecisiete mil";
        if (n === 20000) return "veinte mil";

        if (n < 10) return unidades[n];
        if (n < 20) return especiales[n] || "";
        if (n < 100) {
          const d = Math.floor(n / 10);
          const u = n % 10;
          return decenas[d] + (u ? " y " + unidades[u] : "");
        }
        if (n < 1000) {
          const c = Math.floor(n / 100);
          const resto = n % 100;
          return centenas[c] + (resto ? " " + numeroATexto(resto) : "");
        }
        if (n < 1000000) {
          const miles = Math.floor(n / 1000);
          const resto = n % 1000;
          return (miles === 1 ? "mil" : numeroATexto(miles) + " mil") + (resto ? " " + numeroATexto(resto) : "");
        }
        return n.toString();
      }

      // --- Helpers horas ---
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

      // --- Limpieza texto para TTS ---
      let voiceText = reply
        .replace(/\bhttps?:\/\/\S+/gi, "")
        .replace(/\b(?:\+?54\s*9?\s*)?2245\s*40\s*2689\b/gi, "por WhatsApp")
        .replace(/\b5492245402689\b/g, "por WhatsApp")
        .replace(/\b2245402689\b/g, "por WhatsApp")
        .replace(/@/g, " arroba ")
        .replace(/#/g, " numeral ")
        .replace(/\+/g, " más ")
        .replace(/\$/g, " pesos ")
        .replace(/%/g, " por ciento ")
        .replace(/&/g, " y ");

      // convertir números grandes a texto
      voiceText = voiceText.replace(/\b\d{4,6}\b/g, (num) => numeroATexto(num));

      // formatear horas
      voiceText = reemplazaHorasEnTexto(voiceText);

      try {
        const tts = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
          {
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

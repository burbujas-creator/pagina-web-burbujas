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
- Horarios: 8 a 21 hs, lunes a sábados.  
- Servicios: Lavado 12 prendas 10.000 pesos, acolchados 15-20 mil, camperas/zapatillas/mantas 11.500, secado 8.500.  
- Equipo: Santiago, Leo, Lucas, Marcos, Agustín.  
- Pagos: efectivo, tarjetas, Mercado Pago [link](https://biolibre.ar/lavanderiaburbujas), Cuenta DNI, Bitcoin.  
   
        LAS RESPUESTAS DEBEN SER BREVES Y CLARAS
        Horarios:
        De 8 de la mañana a las 9 de la noche, de lunes a sábados.
        Ten siempre en cuenta en las respuestas el horario actual y el horario comercial en Argentina.
        Deja en claro que esta conversación es inteligencia artificial o IA y que a través de nuestras redes sociales atiende el personal de Burbujas.
        No hacemos limpieza en seco. (pero lo incorporaremos próximamente)
        No hacemos planchado. (pero lo incorporaremos próximamente)
        Servicios:
        Lavado incluye hasta 12 prendas 10.000 pesos.- 
        Lavado acolchados de 1 plazas 15.000 pesos.-
        Lavado acolchados de 2 plazas 17.000 pesos.-
        Acolchados king o pluma 20.000 pesos.-
        Lavado mantas finas 11.500 pesos.-
        Lavado párka o campera 11.500 pesos.-
        Lavado zapatillas 11.500 pesos.-
        Secado de ropa 8.500 pesos.-
        Acolchados: asimila que puede ser edredones, frazadas, cubrecamas, mantas, cobijas, etc.
        Equipo Burbujas: Santiago (Administración), Leo (Encargado), Lucas (Atención), Marcos (Delivery), Agustín (Burbujas Termal). (Menciónalos de manera aleatoria sin orden establecido). Estamos entusiasmados en ofrecer el mejor servicio que nos destaque en nuestro rubro.
        Medios de pago: https://www.burbujas.online/opciones-de-pago
        Link para pagos con MercadoPago: https://biolibre.ar/lavanderiaburbujas
        Efectivo, débito, crédito, Mercado Pago, Cuenta DNI, Más Pagos Nación . (el "Más" debe esbribirse asi:+Pagos Nación), Bitcoin (red Bitcoin o a través de la Lightning Network). Solicitar QR a Burbujas.
        Pagos con aplicaciones: podemos generar link de pago.
        Comercios Bitcoin: aceptamos bitcoin desde 2017 - 
                Mapa comercios bitcoin de btcmap: https://btcmap.org/map?lat=-36.3134516&long=-57.6776619
        Con Cuenta DNI, tenés estas promociones:
        20% de reintegro de lunes a viernes, con un tope de 8
.000 pesos por mes y persona.
        30% de reintegro para mayores de 60 años de lunes a viernes, con un tope de 7.000 pesos por mes y persona.
        Los beneficios no aplican para pagos con código QR de Mercado Pago u otras billeteras digitales.
        Para hacer transferencia por alias, estos son nuestros alias. (burbujasdolores) y (ropa.limpia.siempre). Titular de la cuenta Santiago Lencina
        Cuando se refiera el cliente a "comentarios" o algo similar toma datos de aquí: [Google Reviews] https://www.google.com/search?q=Burbujas&stick=H4sIAAAAAAAAAONgU1I1qLA0tbS0TDUxSTIxTUxNszC2MqgwTzQyTjY0Sk4zNTG1NExNWsTK4VRalFSalVgMANHRlhs0AAAA
         Evita sugerir precios que no tienes detallados.
        Siempre incluir promo o beneficio si es que hay alguno disponible.
        Perfumina Burbujas:
        125 cc 5000 pesos.-
        Fragancia: ...
        El ganador del sorteo lavados gratis para el mes de mayo 2025 fue Luis Alvarez...
Info para el chatbot – Sorteo Burbujas María Becerra
Nombre del sorteo:
"Burbujas te lleva a ver a María Becerra".
Premio:
2 entradas generales para el recital del 12 de diciembre de 2025 en el Estadio River Plate, Buenos Aires.
Quiénes pueden participar:
Exclusivo para clientes de Lavandería Burbujas.
Pasos para participar:
Seguir a Burbujas en Instagram y/o Facebook.
Subir una historia o publicación usando una canción de María Becerra.
Etiquetar a @burbujasdolores.
Mantener el perfil público hasta el cierre del sorteo.
Enviar por WhatsApp al +54 9 2245 40 2689 una captura o enlace de la publicación, indicando el usuario de Instagram/Facebook.
Fechas clave:
Cierre: 1 de diciembre de 2025 a las 23:59 hs.
Anuncio del ganador: 2 de diciembre de 2025.
Entrega del premio:
Vía app Quentro (el ganador debe tener usuario activo en Quentro).
Exclusiones:
No pueden participar empleados de Lavandería Burbujas ni familiares directos hasta segundo grado.
Notas para el bot:
Si el usuario pregunta si puede participar sin ser cliente → Responder que el sorteo es exclusivo para clientes de Burbujas.
Si pregunta cómo confirmar su participación → Indicar que debe seguir los pasos y enviar comprobante por WhatsApp al número indicado.
Si pregunta si se puede canjear el premio → No, es personal e intransferible.
Si pregunta sobre el costo → Participar es gratuito.
Si pregunta por medios de entrega de entradas → Solo por Quentro.
Si pregunta dónde se anunciará el ganador → En redes sociales de Burbujas.
        Cuando consulten por cuidados de prendas responde con buenas prácticas y al final sugiere nuestros servicios.
        Clima: en caso que te consulten sobre el clima siempre debe ser en la ciudad de Dolores, provincia de Buenos Aires.
        Delivery:
        Sin cargo dentro del área de influencia. Tiempo aproximado: 15 minutos. Induce a que se solicite el servicio mediante [WhatsApp] https://wa.me/5492245402689
        Importante:
        Pasados 60 días, las prendas sin retirar son donadas a una institución local.
        Tiempo estimado del lavado de ropa: 5 horas.
        Acolchados llevándolos a la mañana están en el día; si no, para el día siguiente.
        Ofrecemos servicios para empresas.
        Burbujas en Alem 280, ciudad de Dolores, provincia de Buenos Aires (Dolores zona de influencia).
        Burbujas está armando una sucursal en el Parque Termal Dolores. 
        burbujas no administra al parque termal. 
        cualquier informacion sobre el parque termal 
        debe enlazar siempre a https://www.termasdolores.com.ar/
        el sitio web del parque termal no es burbujas.online.
        Cuando te refieras a Burbujas usá "nosotros", "somos", "abrimos", etc.
        Consulta el estado del clima para los próximos 3 días y sugiere actividades o el servicio de secado si llueve.
        En pedidos de delivery, pedí dirección y horario y que lo envíen por [WhatsApp] o redes.
        Contacto:
        WhatsApp: https://wa.me/5492245402689
        Teléfono: 2245402689)
        Facebook: https://www.facebook.com/Lavanderia
        Instagram:https://www.instagram.com/burbujasdolores
        Catálogo: https://wa.me/c/5492245402689
        Telegram: https://t.me/Burbujas_lavanderia
        Sitio web: https://www.burbujas.online/
        Email: burbujasdolores@gmail.com, burbujas@burbujas.online
        Twitter: https://twitter.com/LavanderaBurbu2
        TikTok: https://www.tiktok.com/@burbujaslaundry
        YouTube: https://www.youtube.com/channel/UCIDfn1dDW68KH-V64xOIUqA
        Google Maps: https://www.google.com/maps/place/Burbujas/...
        Notas adicionales:
        No cerramos por vacaciones ni feriados, excepto el 25 de diciembre, el 1 de enero y el 1 de mayo.
        Actúa breve, respetuoso, cercano y argentino.
        Si piden YouTube, sugerí y enlazá nuestros videos.
        Playlists: https://www.burbujas.online/playlist-de-lavanderia y https://www.burbujas.online/rock-argentino
        Ai Vibra: https://open.spotify.com/intl-es/artist/3L4WxpiMyJ7aNIiCmWL0Hl?si=JhIbIRKmQO-Qc1_58rOgRw
        Para manchas: https://www.burbujas.online/tips
        - Decir los símbolos por su nombre (“arroba”, “numeral”, “más”, “pesos”, “barra”), pero NO convertir comas ni puntos.
        - Si el día del mes es 1, decir "primero de <mes>".
        Respirá profundo y hacé todo paso a paso. `.trim();

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

    // ---------- Post-proceso de texto (no mostrar "(Arg)") ----------
    let reply =
      openaiData?.choices?.[0]?.message?.content?.trim() ||
      "Perdón, no pude generar respuesta. ¿Querés que lo intente de nuevo? 🙂🙂";

    // Quitar "(Arg)" si viniera del modelo (en cualquier combinación de mayúsculas)
    reply = reply.replace(/\s*\(arg\)\s*/gi, " ").replace(/\s{2,}/g, " ").trim();

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
        .replace(/\$/g, " pesos ")
        .replace(/\(arg\)/gi, "");                 // no pronunciar "(Arg)"

      // --- Normalizaciones para TTS ---
      // 1) Números grandes a texto (precios)
      voiceText = voiceText.replace(/\b\d{4,5}\b/g, (num) => numeroATexto(Number(num)));

      // 2) "hs" → "hora(s)"
      voiceText = voiceText
        .replace(/(\b1)\s*hs\b/gi, "$1 hora")
        .replace(/(\d+)\s*hs\b/gi, "$1 horas")
        .replace(/\bhrs?\b/gi, "horas")
        .replace(/\bhs\b/gi, "horas");

      // 3) "lun-sáb" (o variantes) → "de lunes a sábados"
      voiceText = voiceText
        .replace(/\blun(?:es)?\s*[-–—]\s*s[áa]b(?:ado|ados)?\b/gi, "de lunes a sábados")
        .replace(/\blun(?:es)?\s*a\s*s[áa]b(?:ado|ados)?\b/gi, "de lunes a sábados");

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
            voice_settings: { stability: 0.3, similarity_boost: 0.9 }
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

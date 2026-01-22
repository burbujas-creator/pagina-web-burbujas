import fetch from "node-fetch";

export default async function handler(req, res) {
  // ---------- CORS SENCILLO Y SEGURO ----------
  const origin = req.headers.origin || "";

  const allowedOrigins = new Set([
    "https://burbujas.online",
    "https://www.burbujas.online",
    "https://pagina-web-burbujas.vercel.app"
  ]);

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
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Solo aceptamos POST para el chat
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ---------- VARIABLES DE ENTORNO ----------
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

    // ---------- LIMITAR HISTORIAL PARA IR MÁS RÁPIDO ----------
    // Usamos solo los últimos 8 mensajes para que la llamada a OpenAI sea liviana
    const trimmedHistory = conversationHistory.slice(-8);

    // ---------- ESTADO "ABIERTO/CERRADO" SEGÚN HORA LOCAL DE BUENOS AIRES ----------
    function estadoLocalAhora() {
      const ahora = new Date();
      const opciones = {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "numeric",
        minute: "numeric",
        weekday: "long",
        hour12: false
      };

      const partes = new Intl.DateTimeFormat("es-AR", opciones).formatToParts(
        ahora
      );

      const hora = parseInt(partes.find(p => p.type === "hour").value, 10);
      const minuto = parseInt(partes.find(p => p.type === "minute").value, 10);
      const diaRaw = partes.find(p => p.type === "weekday").value.toLowerCase();
      const dia = diaRaw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // quitar acentos

      const habil = [
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado"
      ].includes(dia);

      const dentroHorario =
        (hora > 8 && hora < 21) || (hora === 8 && minuto >= 0);

      return habil && dentroHorario ? "abierto" : "cerrado";
    }

    const estadoAhora = estadoLocalAhora();

    // ---------- ENTRENAMIENTO (COMPLETO + SPHERA) ----------
    const sistema = `
Este GPT, llamado Burbujas IA, está especializado en atención al cliente para una lavandería y su nodo de experiencia Sphera VR.
Responde por defecto en español argentino, pero si el usuario escribe en otro idioma, respondé en ese mismo idioma. Responde siempre breve, respetuoso y con 2 emojis.

IMPORTANTE (runtime):
- Ahora estamos **${estadoAhora}**.
- Si preguntan “¿están abiertos ahora?”, respondé usando ese estado (ej: “Ahora estamos ${estadoAhora}. Abrimos de 8 a 21 hs, de lunes a sábados.”).
- No digas ni escribas “(Arg)” ni frases como “según horario de Argentina”.

--- INFORMACIÓN SPHERA VR (NUEVO NODO EN PARQUE TERMAL) ---
Sphera VR es nuestro "Nodo de Experiencia" ubicado en el Mall Termas Dolores.
- Servicios: Recepción y entrega de ropa limpia, venta de batas y toallas, venta de productos de conveniencia (protector solar, Off, perfuminas) y hogar de "Sphera VR".
- Entretenimiento: Experiencias de Realidad Virtual (juegos inmersivos o relax visual).
- Identidad: Parte del ecosistema Burbujas, desarrollo propio hecho a pulmón.
- Nota: Sphera VR es un local dentro del paseo comercial del parque, pero Burbujas NO administra el Parque Termal.

--- INFORMACIÓN GENERAL DE BURBUJAS ---
- Precios en "número pesos", nunca con "$".
- En pantalla: enlaces amigables en Markdown ([WhatsApp](https://wa.me/5492245402689)), nunca URL cruda.
- En voz: no leer URLs ni números de teléfono, decir solo “WhatsApp” o “Mercado Pago”.
- Está prohibido agendar pedidos: siempre indicar que deben coordinar por [WhatsApp](https://wa.me/5492245402689).
- Horarios: De 8 de la mañana a las 9 de la noche horario de argentina de lunes a sábados.
- Deja en claro que esta conversación es inteligencia artificial o IA y que a través de nuestras redes sociales atiende el personal de burbujas.
- No hacemos limpieza en seco. (pero lo incorporaremos próximamente)
- No hacemos planchado. (pero lo incorporaremos próximamente)

Servicios y Precios (Sede Central y Nodos):
- Lavado 12 prendas 12.000 pesos este incluye lavado, secado, perfume y empaque.
- Lavado acolchados de 1 plazas 17.000 pesos.
- Lavado acolchados de 2 plazas 20.000 pesos.
- Acolchados king o pluma 25.000 pesos.
- Lavado mantas finas 14.000 pesos.
- Lavado párka o campera 14.000 pesos.
- Lavado zapatillas 14.000 pesos.
- Secado de ropa 10.000 pesos.
- Acolchados: asimila que puede ser edredones, frazadas, cubrecamas, mantas, cobijas, etc.

Equipo Burbujas: Santiago (Administración), Leo (Encargado), Lucas (Atención), Marcos (Delivery), Agustín (Burbujas Termal / Sphera VR). Estamos entusiasmados en ofrecer el mejor servicio que nos destaque en nuestro rubro.

Medios de pago: https://www.burbujas.online/opciones-de-pago
Link para pagos con MercadoPago: https://biolibre.ar/lavanderiaburbujas
Efectivo, débito, crédito, Mercado Pago, Cuenta DNI, Más Pagos Nación (escribir como +Pagos Nación), Bitcoin (red Bitcoin o a través de la Lightning Network). Solicitar QR a Burbujas.
Pagos con aplicaciones: podemos generar link de pago.
Comercios Bitcoin: aceptamos bitcoin desde 2017 - Mapa comercios bitcoin de btcmap: https://btcmap.org/map?lat=-36.3134516&long=-57.6776619

Con Cuenta DNI, tenés estas promociones:
20% de descuento todos los viernes, con un tope de reintegro de $4.000 por viernes y por persona (equivalente a $20.000 en consumos).
El beneficio aplica solo pagando a través de la aplicación Cuenta DNI.
Los beneficios no aplican para pagos con código QR de Mercado Pago u otras billeteras digitales.

Para hacer transferencia por alias, estos son nuestros alias: (burbujasdolores) y (ropa.limpia.siempre). Titular de la cuenta Santiago Lencina.

Cuando se refiera el cliente a "comentarios" o algo similar toma datos de aquí: [Google Reviews] https://www.google.com/search?q=Burbujas&stick=H4sIAAAAAAAAAONgU1I1qLA0tbS0TDUxSTIxTUxNszC2MqgwTzQyTjY0Sk4zNTG1NExNWsTK4VRalFSalVgMANHRlhs0AAAA
Evita sugerir precios que no tienes detallados.
Siempre incluir promo o beneficio si es que hay alguno disponible.

Perfumina Burbujas:
125 centimetros cubicos 7000 pesos.
Fragancia: La composición de nuestra perfumina es compleja y rica, abriendo con notas altas que son frescas y efervescentes, incluyendo lirio del valle, bergamota y aldehídos. Estas notas iniciales dan una impresión luminosa y aireada, preparando el escenario para el corazón de la fragancia. El corazón de perfumina Burbujas es un ramillete floral opulento y profundamente femenino, destacando flores como la rosa, el jazmín y el ylang-ylang. Estas notas florales se entrelazan de manera magistral, creando un aroma rico y casi cremoso que evoca un sentido de lujo y romance. En las notas de fondo, perfumina Burbujas revela su lado más cálido y sensual. Ingredientes como el sándalo, la vainilla y el pachulí proporcionan una base suave y reconfortante, dando a la fragancia una longevidad excepcional en la piel. Estas notas amaderadas y ligeramente dulces equilibran la composición, asegurando que no sea abrumadoramente floral, sino más bien un equilibrio armonioso de frescura, florales y calidez. En conjunto, perfumina Burbujas es una fragancia que representa la elegancia clásica y la sofisticación.

Historial de Sorteos:
- El ganador del sorteo lavados gratis para el mes de mayo 2025 fue Luis Alvarez (4 lavados de ropa, 2 de acolchados).
- Ganadora sorteo Maria Becerra (marzo 2024): Alejandra Sosa.
- Ganador Promoción "6 meses de lavados gratis": Martin Acuña (mayo 2024).
- Ganadora del sorteo lavados gratis enero 2025 fue: Pamela Flores.

SORTEO ACTUAL - Sorteo Burbujas María Becerra
Nombre del sorteo: "Burbujas te lleva a ver a María Becerra".
Premio: 2 entradas generales para el recital del 12 de diciembre de 2025 en el Estadio River Plate, Buenos Aires.
Resultó ganador: Matías Montes de Oca.

Delivery:
Sin cargo dentro del área de influencia. Tiempo aproximado: 15 minutos. Induce a que se solicite el servicio mediante [WhatsApp] https://wa.me/5492245402689
Importante: Pasados 60 días, las prendas sin retirar son donadas a una institución local.
Tiempo estimado del lavado de ropa: 5 horas.
Acolchados llevándolos a la mañana están en el día; si no, para el día siguiente.
Ofrecemos servicios para empresas.

Ubicaciones:
- Burbujas Sede Central: Alem 280, Dolores, Buenos Aires.
- Burbujas Nodo Termas (Sphera VR): Mall Termas Dolores.

Sobre el Parque Termal:
Burbujas NO administra al parque termal. Cualquier informacion sobre el parque termal debe enlazar siempre a esta direccion https://www.termasdolores.com.ar/ (el sitio web del parque termal no es burbujas.online).

Estilo de comunicación:
Cuando te refieras a Burbujas opta por personalizarlo al estilo de "nosotros", "somos", "estamos", "abrimos", "cerramos", "vamos", etc.
Consulta el estado del clima para los próximos 3 días y sugiere actividades o el servicio de secado en caso de lluvia.
Procura que los mensajes que contengan pedidos para delivery siempre soliciten la dirección y un horario cómodo para el cliente y que lo envíen por siempre asi se entera el personal de burbujas [WhatsApp] https://wa.me/5492245402689 o a [Instagram] https://www.instagram.com/burbujasdolores/ o a [Telegram] https://t.me/Burbujas_lavanderia

Contacto:
WhatsApp: https://wa.me/5492245402689
Teléfono: 2245402689
Facebook: https://www.facebook.com/Lavanderia
Instagram:https://www.instagram.com/burbujasdolores
Catálogo: https://wa.me/c/5492245402689
Telegram: https://t.me/Burbujas_lavanderia
Sitio web: https://www.burbujas.online/
Email: burbujasdolores@gmail.com, burbujas@burbujas.online
Twitter: https://twitter.com/LavanderaBurbu2
TikTok: https://www.tiktok.com/@burbujaslaundry
YouTube: https://www.youtube.com/channel/UCIDfn1dDW68KH-V64xOIUqA
Google Maps: https://www.google.com/maps/place/Burbujas/@-36.3132682,-57.6776037,17z/data=!3m1!4b1!4m6!3m5!1s0x95999e44b45aef83:0x7a23c12cf54591eb!8m2!3d-36.3132682!4d-57.6776037!16s%2Fg%2F11c206r37n?entry=ttu&g_ep=EgoyMDI1MDkxNC4wIKXMDSoASAFQAw%3D%3D

Notas adicionales:
No cerramos por vacaciones ni feriados, excepto el 25 de diciembre, el 1 de enero y el 1 de mayo.
Si piden videos de YouTube, sugiere y enlaza con nuestros videos https://www.youtube.com/channel/UCIDfn1dDW68KH-V64xOIUqA

Música y Entretenimiento:
- Playlist Descubrí tu Flow: https://www.burbujas.online/playlist-de-lavanderia
- Playlist Rock de acá: https://www.burbujas.online/rock-argentino
- Ai Vibra: Música creada con IA por Burbujas.
Enlaces Ai Vibra:
https://open.spotify.com/artist/3L4WxpiMyJ7aNIiCmWL0Hl
https://music.apple.com/artist/ai-vibra/1754923352
https://music.youtube.com/channel/UCv1aXowtWRAMcqnkeuHaP8Q
https://music.amazon.com/artists/B0D8JHB3ST/ai-vibra
https://www.deezer.com/es/artist/271888052
[Ai Vibra] https://open.spotify.com/intl-es/artist/3L4WxpiMyJ7aNIiCmWL0Hl?si=JhIbIRKmQO-Qc1_58rOgRw

Eventos:
Burbujas cuenta en su web con todos los eventos y recitales. Sugiere que naveguen en [Descubrí tu Flow] https://www.burbujas.online/playlist-de-lavanderia
Para manchas sugiere [Tips para manchas] https://www.burbujas.online/tips

Actúa de manera breve en las respuestas siendo respetuoso, cercano y amigable. Utiliza tono, entonación y manera de comunicarse de los argentinos.
Decir los símbolos por su nombre (por ejemplo, "arroba", "numeral", "más", "pesos", "barra"), pero NO convertir comas ni puntos en palabras.
Si el día del mes es 1, decir "primero de <mes>" en lugar de "uno de <mes>".

Respira profundo y realiza todo cuidadosamente paso a paso.
`.trim();

    const messages = [{ role: "system", content: sistema }, ...trimmedHistory];

    // ---------- LLAMADA A OPENAI ----------
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

    // ---------- POST-PROCESO DEL TEXTO ----------
    let reply =
      openaiData?.choices?.[0]?.message?.content?.trim() ||
      "Perdón, no pude generar respuesta. ¿Querés que lo intente de nuevo? 🙂🙂";

    // limpiar cositas molestas
    reply = reply
      .replace(/\s*\(arg\)\s*/gi, " ")
      .replace(/seg[uú]n\s+horario\s+de\s+argentina/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // ---------- MAPA DE NÚMEROS A TEXTO PARA TTS ----------
    function numeroATexto(num) {
      const mapa = {
        5000: "cinco mil",
        7000: "siete mil",
        8000: "ocho mil",
        8500: "ocho mil quinientos",
        10000: "diez mil",
        11500: "once mil quinientos",
        15000: "quince mil",
        17000: "diecisiete mil",
        20000: "veinte mil"
      };
      return mapa[num] || num.toString();
    }

    // ---------- CONVERSIÓN DE TEXTO A VOZ (ELEVENLABS) ----------
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

      // --- AJUSTES FONÉTICOS PARA SANTIAGO (Sphera VR) ---
      // 1) Sphera -> Sfera
      voiceText = voiceText.replace(/Sphera/gi, "Sfera");
      // 2) VR -> vé érre
      voiceText = voiceText.replace(/\bVR\b/gi, "vé érre");

      // 3) Números grandes → texto
      voiceText = voiceText.replace(/\b\d{4,5}\b/g, num =>
        numeroATexto(Number(num))
      );

      // 4) "hs" → "hora(s)"
      voiceText = voiceText
        .replace(/(\b1)\s*hs\b/gi, "$1 hora")
        .replace(/(\d+)\s*hs\b/gi, "$1 horas")
        .replace(/\bhrs?\b/gi, "horas")
        .replace(/\bhs\b/gi, "horas");

      // 5) "lunes a sábados" variantes
      voiceText = voiceText
        .replace(
          /\blun(?:es)?\s*[-–—]\s*s[áa]b(?:ado|ados)?\b/gi,
          "lunes a sábados"
        )
        .replace(
          /\blun(?:es)?\s*a\s*s[áa]b(?:ado|ados)?\b/gi,
          "lunes a sábados"
        );

      // 6) Limitar longitud de texto para que el TTS sea más rápido
      if (voiceText.length > 900) {
        voiceText = voiceText.slice(0, 900);
      }

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
              voice_settings: {
                stability: 0.6,
                similarity_boost: 0.9
              }
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

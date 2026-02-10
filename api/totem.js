// api/totem.js - Versión con soporte de Audio y CORS
export default async function handler(req, res) {
  // 1. CABECERAS DE SEGURIDAD PARA ACTIVAR LA WEB
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { conversationHistory } = req.body;

  try {
    // 2. PEDIMOS LA RESPUESTA A LA IA
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", 
        messages: conversationHistory,
        temperature: 0.7
      })
    });

    const aiData = await aiResponse.json();
    const textoRespuesta = aiData.choices[0].message.content;

    // 3. GENERAMOS EL AUDIO PARA EL VIBRATO
    const audioResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: textoRespuesta,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBase64 = `data:audio/mpeg;base64,${Buffer.from(audioBuffer).toString('base64')}`;

    // 4. DEVOLVEMOS TODO A LA WEB
    res.status(200).json({ 
      reply: textoRespuesta,
      audio: audioBase64 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error de conexión" });
  }
}

// api/totem.js - Motor de Identidad para el Laboratorio de Tótems
export default async function handler(req, res) {
  // Solo permitimos peticiones POST desde tu web de Hostinger
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { conversationHistory } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Actualizado para mayor velocidad y menor costo
        messages: conversationHistory, // Recibe la identidad inyectada desde el frontend
        temperature: 0.7, // Mantiene el equilibrio entre creatividad y precisión
        max_tokens: 500 // Suficiente para respuestas informativas del comercio
      })
    });

    const data = await response.json();

    // Verificamos si hay errores de cuota o de la API de OpenAI
    if (data.error) {
      console.error("Error de OpenAI:", data.error.message);
      return res.status(500).json({ error: data.error.message });
    }

    // Devolvemos la respuesta limpia al chat
    res.status(200).json({ 
      reply: data.choices[0].message.content 
    });

  } catch (error) {
    console.error("Error en el servidor:", error);
    res.status(500).json({ error: "Error interno al generar respuesta" });
  }
}

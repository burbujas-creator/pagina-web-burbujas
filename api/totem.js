// api/totem.js - El motor que genera las respuestas
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { conversationHistory } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", 
        messages: conversationHistory, // Aquí ya viene tu personalidad de GitHub inyectada desde el HTML
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    // Devolvemos la respuesta para que el chat la muestre
    res.status(200).json({ 
      reply: data.choices[0].message.content 
    });

  } catch (error) {
    res.status(500).json({ error: "Error al generar respuesta" });
  }
}

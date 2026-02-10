// api/totem.js
export default async function handler(req, res) {
  const { conversationHistory } = req.body;

  // INSTRUCCIÓN BASE NEUTRA
  const systemPrompt = {
    role: "system",
    content: "Eres un asistente de hospitalidad experto. Tu identidad se define estrictamente por la información del comercio que recibes en el historial. No tienes ninguna relación con servicios de lavandería."
  };

  const messages = [systemPrompt, ...conversationHistory];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", 
        messages: messages
      })
    });

    const data = await response.json();
    res.status(200).json({ reply: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor de identidad" });
  }
}

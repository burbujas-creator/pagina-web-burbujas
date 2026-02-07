export const burbujasConfig = {
  allowedOrigins: [
    "https://burbujas.online",
    "https://www.burbujas.online",
    "https://pagina-web-burbujas.vercel.app",
  ],

  timezone: "America/Argentina/Buenos_Aires",
  locale: "es-AR",

  eleven: {
    defaultVoiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_multilingual_v2",
    voiceSettings: { stability: 0.6, similarity_boost: 0.9 },
    maxChars: 900,
  },

  openai: {
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxHistory: 8,
  },
};


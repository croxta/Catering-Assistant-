import { GoogleGenAI } from "@google/genai";

export const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { prompt, model, contents, config } = body;
    
    // Try to find a valid API key, ignoring placeholders
    const keysToTry = [
      process.env.GEMINI_API_KEY,
      process.env.GOOGLE_API_KEY,
      process.env.API_KEY
    ];
    
    const apiKey = keysToTry.find(key => key && key !== "MY_GEMINI_API_KEY" && key.length > 10);

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "GEMINI_API_KEY not configured in Netlify environment. Please set it in your Netlify site settings." }),
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Simple prompt pattern (from user's request)
    if (prompt && !contents) {
      const response = await ai.models.generateContent({
        model: model || "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: response.text }),
      };
    }

    // Full SDK pattern (from Architect app)
    const response = await ai.models.generateContent({
      model: model || "gemini-3-flash-preview",
      contents,
      config
    });

    // We need to return the text explicitly because class getters don't stringify
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: response.text,
        candidates: response.candidates,
        usageMetadata: response.usageMetadata
      }),
    };
  } catch (error) {
    console.error("Netlify Function Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Architectural error: " + error.message }),
    };
  }
};

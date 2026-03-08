import { GoogleGenAI } from "@google/genai";

export const handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    // Support both the simple prompt/reply pattern and the full SDK pattern
    const { prompt, model, contents, config } = body;
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Architectural error: GEMINI_API_KEY not configured" }),
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // If it's the simple prompt pattern from the user's request
    if (prompt && !contents) {
      const response = await ai.models.generateContent({
        model: model || "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({ reply: response.text }),
      };
    }

    // Otherwise, handle the full SDK request
    const response = await ai.models.generateContent({
      model: model || "gemini-3-flash-preview",
      contents,
      config
    });

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Netlify Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Architectural error: " + error.message }),
    };
  }
};

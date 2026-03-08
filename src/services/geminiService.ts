import { Type, ThinkingLevel } from "@google/genai";

export interface GroupProfile {
  total: number;
  veg: number;
  nonVeg: number;
  jain: number;
  vegan: number;
}

export type EventType = 'Corporate' | 'Friends' | 'Cultural' | 'Custom';

export interface OrderRequest {
  eventType: EventType;
  customEventName?: string;
  specialInstructions?: string;
  menuData: string; // This will now be the extracted text from OCR
  groupProfile: GroupProfile;
}

export interface OrderItem {
  name: string;
  quantity: string;
  category: 'Starter' | 'Main' | 'Dessert' | 'Side' | 'Other';
  dietaryTags: string[];
}

export interface OrderSummary {
  personaIntro: string;
  eventInfo: string;
  items: OrderItem[];
  serverNotes: string;
  rawText: string; // Keep the original text for copy-pasting
}

const SYSTEM_INSTRUCTION = `You are the "Ultimate Event Architect," a high-level logistics and hospitality expert. 
Your persona is adaptive: 
- For Corporate/CFO events, you are polished, efficient, and ROI-focused.
- For Friends/Casual hangouts, you are the "planner friend"—warm, savvy, and fun.
- For Cultural/Religious events (e.g., Jain/Kitty Party), you are meticulous about traditions and dietary sanctity.
- For Custom events, you adapt your tone to the specific event name provided, maintaining a professional yet helpful persona.

Your mission is to bridge the gap between a "list of dishes" and a "perfectly balanced order" for a specific group size.

TASK STEPS:
1. Persona Selection: Adopt the tone matching the 'Event Type'.
2. Menu Analysis: Categorize the provided menu into Starters, Mains, Desserts, and Sides. Identify which dishes fit the specific dietary sub-groups (especially Jain and Vegan).
3. Portion Calculation: Apply industry-standard "Event Planning Ratios" (e.g., 2.5 starters per person for cocktails, or 1:4 ratio for main course dishes in family-style dining).
4. The Selection: Pick specific dishes from the menu that offer the best variety while ensuring every dietary group has at least 2-3 distinct options.
5. Optimization: Ensure the quantities are realistic (e.g., "3 Chicken Caesar Salads" rather than "2.7").

CONSTRAINTS:
- No Mystery Meat: Always clearly label Jain and Vegan items.
- WhatsApp Ready: The output must be a clean, text-based summary—no heavy tables or complex formatting.
- Quantity Logic: Provide specific counts of dishes to order.

OUTPUT FORMAT:
You must return a JSON object with the following structure:
{
  "personaIntro": "A short, persona-driven introduction",
  "eventInfo": "Event: [Type] | Total: [Count]",
  "items": [
    {
      "name": "Dish Name",
      "quantity": "Qty",
      "category": "Starter | Main | Dessert | Side | Other",
      "dietaryTags": ["Veg", "Non-Veg", "Jain", "Vegan"]
    }
  ],
  "serverNotes": "Specific instructions for the server",
  "rawText": "A clean, text-based summary of the order, formatted for WhatsApp (using bullet points and bold text)"
}`;

// Helper to call the Netlify proxy instead of direct SDK
async function callGeminiProxy(payload: any) {
  const response = await fetch('/.netlify/functions/gemini-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  
  if (!response.ok) {
    let errorMessage = "Failed to call Gemini proxy";
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      errorMessage = `Server Error (${response.status}): ${text.substring(0, 100)}`;
    }
    throw new Error(errorMessage);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON response from server: ${text.substring(0, 100)}`);
  }
}

export async function extractMenuText(images: string[]) {
  const parts: any[] = [
    { text: "Extract all food items, categories (Starters, Mains, etc.), and descriptions from these menu images. Return only the structured text. If you can identify the restaurant name or location, include it at the top." }
  ];
  
  images.forEach(image => {
    const [header, data] = image.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    parts.push({
      inlineData: {
        mimeType,
        data
      }
    });
  });

  const response = await callGeminiProxy({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts }],
    config: {
      temperature: 0.1,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    },
  });

  return response.text;
}

export async function generateOrder(request: OrderRequest) {
  const eventDisplay = request.eventType === 'Custom' ? request.customEventName : request.eventType;

  const prompt = `
    Event Type: ${eventDisplay}
    Group Profile: 
    - Total: ${request.groupProfile.total}
    - Veg: ${request.groupProfile.veg}
    - Non-Veg: ${request.groupProfile.nonVeg}
    - Jain: ${request.groupProfile.jain}
    - Vegan: ${request.groupProfile.vegan}
    
    Special Instructions/Preferences: ${request.specialInstructions || 'None provided'}
    
    Extracted Menu Data: 
    ${request.menuData}
    
    Please provide the order summary for this ${eventDisplay} event, strictly following the special instructions if any.
  `;

  const response = await callGeminiProxy({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          personaIntro: { type: Type.STRING },
          eventInfo: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.STRING },
                category: { type: Type.STRING },
                dietaryTags: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["name", "quantity", "category", "dietaryTags"]
            }
          },
          serverNotes: { type: Type.STRING },
          rawText: { type: Type.STRING }
        },
        required: ["personaIntro", "eventInfo", "items", "serverNotes", "rawText"]
      },
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    },
  });

  try {
    return JSON.parse(response.text || '{}') as OrderSummary;
  } catch (e) {
    console.error("Failed to parse JSON response", e);
    // Fallback if JSON parsing fails
    return {
      personaIntro: "Architectural error in formatting.",
      eventInfo: "",
      items: [],
      serverNotes: "",
      rawText: response.text || "Failed to generate summary."
    };
  }
}

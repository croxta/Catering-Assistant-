import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

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

OUTPUT STRUCTURE:
*Persona Intro*
--- ORDER SUMMARY ---
Event: [Type] | Total: [Count]
STARTERS
- [Qty] x [Dish Name] ([Dietary Tag])
MAIN COURSE
- [Qty] x [Dish Name] ([Dietary Tag])
DESSERTS/SIDES
- [Qty] x [Dish Name]
Notes for the Server: [Specific instructions]`;

export async function extractMenuText(images: string[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  
  const contents: any[] = [
    { text: "Extract all food items, categories (Starters, Mains, etc.), and descriptions from these menu images. Return only the structured text." }
  ];
  
  images.forEach(image => {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: image.split(',')[1]
      }
    });
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
    config: {
      temperature: 0.1,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    },
  });

  return response.text;
}

export async function generateOrder(request: OrderRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    },
  });

  return response.text;
}

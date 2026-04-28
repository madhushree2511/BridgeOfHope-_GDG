import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface MatchResult {
  donationId: string;
  matchScore: number;
  reason: string;
}

export const runMatchmaking = async (requirement: any, donations: any[]): Promise<MatchResult[]> => {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set. Matchmaking skipped.");
    return [];
  }

  if (donations.length === 0) return [];

  const donationsList = donations.map(d => ({
    id: d._id,
    items: d.items.map((it: any) => `${it.name} (${it.quantity}) [${it.category}]`).join(', '),
    pickupCity: d.pickupAddress?.city || 'Unknown'
  }));

  const prompt = `You are an expert AI Matchmaker for a donation platform. 
Your task is to analyze an NGO requirement and find the most relevant matches from a list of available donor contributions.

NGO Requirement:
Title: ${requirement.title}
Description: ${requirement.description}
Categories Needed: ${requirement.categoriesNeeded.join(', ')}

Available Donations:
${JSON.stringify(donationsList, null, 2)}

Instructions:
1. Identify donations that match the requirement based on category, item names, and urgency/description.
2. For each match, provide a Match Score (0.0 to 1.0) and a concise reason (max 15 words) why it matches.
3. Only include matches with a Match Score > 0.5.
4. Return the result as a JSON array of MatchResult objects.

Return ONLY the JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              donationId: { type: Type.STRING },
              matchScore: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ["donationId", "matchScore", "reason"]
          }
        }
      }
    });

    const results = JSON.parse(response.text || "[]");
    return results;
  } catch (error) {
    console.error("Gemini Matchmaking Error:", error);
    return [];
  }
};

import { GoogleGenAI, Type } from "@google/genai";
import { buildSystemPrompt, parseDecision, type CompanyContext, type Decision, type Turn } from "./prompt.ts";

export class Gemini {
  private client: GoogleGenAI;
  constructor(apiKey: string, private model: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  /** Decide se o bot deve responder e, se sim, o texto. Qualquer falha => null (o bot fica em silêncio). */
  async decide(ctx: CompanyContext, history: Turn[], message: string): Promise<Decision | null> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
          { role: "user", parts: [{ text: message }] },
        ],
        config: {
          systemInstruction: buildSystemPrompt(ctx),
          temperature: 0.4,
          maxOutputTokens: 700,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              should_reply: { type: Type.BOOLEAN },
              intent: { type: Type.STRING, enum: ["price", "menu", "order_link", "location", "greeting", "other"] },
              reply: { type: Type.STRING },
            },
            required: ["should_reply", "intent", "reply"],
          },
        },
      });
      return parseDecision(response.text);
    } catch (error) {
      console.error("[gemini] falha ao consultar:", error instanceof Error ? error.message : error);
      return null;
    }
  }
}

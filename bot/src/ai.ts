import { GoogleGenAI, Type } from "@google/genai";
import { buildSystemPrompt, parseDecision, type CompanyContext, type Decision, type Turn } from "./prompt.ts";

export class Gemini {
  private client: GoogleGenAI;
  constructor(apiKey: string, private model: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  /** Decide se o bot deve responder e, se sim, o texto. Qualquer falha => null (o bot fica em silêncio). */
  async decide(ctx: CompanyContext, history: Turn[], message: string): Promise<Decision | null> {
    const linkAlreadySent = history.some((turn) => turn.role === "model" && turn.text.includes(ctx.storefrontUrl));
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
          { role: "user", parts: [{ text: message }] },
        ],
        config: {
          systemInstruction: buildSystemPrompt(ctx, new Date(), linkAlreadySent),
          temperature: 0.4,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              should_reply: { type: Type.BOOLEAN },
              intent: { type: Type.STRING, enum: ["price", "menu", "order_link", "location", "hours", "payment", "delivery", "greeting", "other"] },
              reply: { type: Type.STRING },
              action: { type: Type.STRING, enum: ["none", "order_status", "quote_order", "confirm_order"] },
              order: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        note: { type: Type.STRING },
                      },
                      required: ["name", "quantity"],
                    },
                  },
                  fulfillment: { type: Type.STRING, enum: ["delivery", "pickup"] },
                  address: { type: Type.STRING },
                  number: { type: Type.STRING },
                  complement: { type: Type.STRING },
                  customer_name: { type: Type.STRING },
                  payment: { type: Type.STRING, enum: ["link", "cash"] },
                },
              },
            },
            required: ["should_reply", "intent", "reply", "action"],
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

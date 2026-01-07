import OpenAI from "openai";
import { config } from "../config/env";
import { Place } from "./destinationMatcher";

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

export interface LLMMatchResult {
  destinationId: number | null;
  confidence: number;
  reasoning: string;
}

/**
 * Use GPT to intelligently match a transcript to a destination
 * This handles cases where fuzzy matching fails due to ASR errors or dialectal variations
 */
export async function matchWithLLM(
  transcript: string,
  places: Place[]
): Promise<LLMMatchResult> {
  try {
    // Build the prompt with all available destinations
    const destinationsList = places
      .map(
        (p) =>
          `- ID ${p.id}: ${p.canonicalName} (Arabic variants: ${p.variants
            .filter((v) => /[\u0600-\u06FF]/.test(v))
            .join(", ")})`
      )
      .join("\n");

      const prompt = `You are helping match spoken Hassaniya (Mauritanian dialect) destinations to known areas in Nouakchott, Mauritania.

      The user said (transcribed via Whisper): "${transcript}"
      
      Available destinations in Nouakchott:
      ${destinationsList}
      
      Task: Determine which destination the user most likely intended to say. Only pick from the provided Nouakchott list. If you are not confident or the name is not in the list, respond with destinationId: null and confidence: 0.
      
      IMPORTANT: Only match destinations that are clearly in the provided list. Do not make up or guess destinations. If unsure, return null.
      
      IMPORTANT - Hassaniya Filler Words & Intent Phrases to IGNORE:
      - "نبغي نمشي" (nabghi nemshi) - I want to go
      - "باغي نمشي" (baghi nemshi) - I want to go
      - "بغيت نروح" (bghit nrouh) - I want to go
      - "ان گايس" (ana gayes) - I’m going to
      - "ندور كورس گايس" (ndor course gayes ) - i want a ride to
      - "ندور كورس واعد" (ndor course waiid) - i want a ride going to
      
      FOCUS ONLY on the actual destination name, ignoring all intent phrases and filler words.
      
      Consider:
      1. Phonetic similarity (how words sound in Arabic/Hassaniya)
      2. Common ASR transcription errors (e.g., "كرافور" vs "كارفور")
      3. Hassaniya dialect variations
      4. Extract core destination from surrounding filler words
      
      
      Respond with JSON only:
      {
        "destinationId": <number or null if no match>,
        "confidence": <0.0 to 1.0>,
        "reasoning": "<brief explanation; if null, say not sure, ask user to try again>"
      }`;
      

    console.log("[LLM] Sending transcript to GPT for intelligent matching...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-effective model that's still very capable
      messages: [
        {
          role: "system",
          content:
            "You are an expert in Hassaniya Arabic dialect and Mauritanian geography. You help match spoken destinations to known places.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from GPT");
    }

    const result: LLMMatchResult = JSON.parse(content);

    console.log(
      `[LLM] Match result: Destination ID ${result.destinationId
      }, Confidence: ${result.confidence.toFixed(2)}, Reasoning: ${result.reasoning
      }`
    );

    return result;
  } catch (error) {
    console.error("[LLM] Error during LLM matching:", error);

    // Return a safe fallback
    return {
      destinationId: null,
      confidence: 0,
      reasoning: "LLM matching failed due to an error",
    };
  }
}

import { SettingsRepository } from '../repositories/SettingsRepository';
import { z } from 'zod';

// Define the absolute truth schema for the AI Response to pass through at runtime
const OutputChunkSchema = z.array(
  z.object({
    pageIndex: z.number(),
    text: z.string(),
  })
);

type OutputChunk = z.infer<typeof OutputChunkSchema>;

export class AiParsingService {
  private static readonly API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  /**
   * Helper function to wait for a specified number of milliseconds.
   */
  private static delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleans and formats a massive chunk of pages simultaneously using Gemini's huge context window.
   * Forces the model to return a strict JSON array of the cleaned pages to preserve indexing.
   * Includes robust retry logic.
   */
  static async processChunk(
    pagesChunk: { pageIndex: number; text: string }[], 
    totalPages: number, 
    retryCount = 0
  ): Promise<OutputChunk> {
    const apiKey = SettingsRepository.getApiKey();
    if (!apiKey) {
      throw new Error("No Gemini API Key found in settings. Please configure it first.");
    }

    const chunkIndexes = pagesChunk.map(p => p.pageIndex).join(', ');

    const prompt = `
You are a document extraction AI. Examine the raw text extracted from pages ${chunkIndexes} of an eBook (${totalPages} total).

GOALS:
1. Determine if each page in the input JSON array is MAIN CONTENT (narrative, chapters, prologue).
2. IGNORE front covers, copyright pages, table of contents, or indexes (do not include them in your output array at all).
3. For main content, clean up the text perfectly (remove stray page numbers, fix broken line breaks, format headings).
4. CRITICAL: Preserve the exact original \`pageIndex\` for every page you extract.

RAW INPUT PAGES CHUNK:
---
${pagesChunk.map(p => `PAGE ${p.pageIndex}:\n${p.text}`).join('\n---\n')}
---
    `;

    try {
      const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, // Low temperature for factual structuring
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              description: "A chronological list of cleanly formatted content pages that were extracted from the input chunk.",
              items: {
                type: "OBJECT",
                properties: {
                  pageIndex: {
                    type: "INTEGER",
                    description: "The exact, perfectly preserved original pageIndex number provided in the input array. DO NOT change this."
                  },
                  text: {
                    type: "STRING",
                    description: "The beautifully formatted, clean text of the main content."
                  }
                },
                required: ["pageIndex", "text"]
              }
            }
          }
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          if (retryCount >= 3) {
            throw new Error("Gemini API Rate Limit Exceeded permanently. Please try again later.");
          }
          console.warn(`Rate limit hit on chunk [${chunkIndexes}]. Waiting 20 seconds before retry...`);
          await this.delay(20000); // Wait 20 seconds on 429
          return this.processChunk(pagesChunk, totalPages, retryCount + 1);
        }

        const err = await response.json();
        throw new Error(err.error?.message || "Gemini API Error");
      }

      const data = await response.json();
      const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      
      // Parse the JSON. Gemini guarantees parsing directly via responseSchema.
      const parsedRaw = JSON.parse(outputText);
      
      // Enforce Zod runtime validation to ensure Type Safety across our architecture (Global Rule 4)
      const validatedArray = OutputChunkSchema.parse(parsedRaw);
      return validatedArray;
    } catch (error) {
      console.error("AI Parsing Error chunking:", error);
      // Give a small automatic retry on random parsing failures just in case Context Window blew up
      if (retryCount < 2) {
         console.warn("JSON Parse or server error, retrying chunk in 3 seconds...");
         await this.delay(3000);
         return this.processChunk(pagesChunk, totalPages, retryCount + 1);
      }
      throw error;
    }
  }
}

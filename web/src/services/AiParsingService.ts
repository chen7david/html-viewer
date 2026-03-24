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
  private static readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  /**
   * Helper function to wait for a specified number of milliseconds.
   */
  private static delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleans and formats a massive chunk of pages simultaneously using Gemini or Universal OpenAI endpoints.
   * Forces the model to return a strict JSON array of the cleaned pages to preserve indexing.
   * Includes robust retry logic.
   */
  static async processChunk(
    pagesChunk: { pageIndex: number; text: string }[],
    totalPages: number,
    retryCount = 0
  ): Promise<OutputChunk> {
    const aiConfig = SettingsRepository.getAiSettings();
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
      let outputText = '[]';

      // ---------------------------------------------------------
      // 1. ROUTING VIA GOOGLE GEMINI NATIVE REST BUILD
      // ---------------------------------------------------------
      if (aiConfig.activeProvider === 'gemini') {
        if (!aiConfig.geminiApiKey) throw new Error("No Gemini API Key configured.");
        
        const response = await fetch(`${this.GEMINI_API_URL}?key=${aiConfig.geminiApiKey}`, {
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
        outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      }

      // ---------------------------------------------------------
      // 2. ROUTING VIA UNIVERSAL OPENAI COMPATIBLE ENDPOINT
      // ---------------------------------------------------------
      else if (aiConfig.activeProvider === 'openwebui') {
        if (!aiConfig.openWebUiEndpoint) throw new Error("No Universal Node Endpoint configured.");
        if (!aiConfig.openWebUiModelId) throw new Error("No Model ID provided for the Universal Node. Please configure it in Settings.");

        // OpenAI Schema explicitly demands JSON enforcement injected natively into prompt if JSON-Mode is enabled
        const universalPrompt = prompt + `\n\nOUTPUT FORMAT:\nYou MUST STRICTLY output a raw JSON Array containing your mapped extracted objects like this:\n[\n  { "pageIndex": 1, "text": "cleaned content here..." }\n]\nDo not put markdown wrappers over it. Output strictly valid JSON.`;

        // Local models vary heavily in inference speed. Qwen runs faster, GLM runs heavier.
        const isQwen = aiConfig.openWebUiModelId.toLowerCase().includes('qwen');
        const timeoutMs = isQwen ? 5 * 60 * 1000 : 10 * 60 * 1000; // 5 mins for Qwen, 10 mins for GLM
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(aiConfig.openWebUiEndpoint, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...(aiConfig.openWebUiApiKey ? { 'Authorization': `Bearer ${aiConfig.openWebUiApiKey}` } : {})
            },
            body: JSON.stringify({
              model: aiConfig.openWebUiModelId, // User-selected exact model name (e.g. qwen3-coder:30b)
              messages: [
                { role: "system", content: "You are a perfect, factual document layout and data extraction node. Ensure your output perfectly honors the structural mapping constraints." },
                { role: "user", content: universalPrompt }
              ]
            }),
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Universal Route Failed: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          const contentStr = data.choices?.[0]?.message?.content || '[]';
          // Cleanup trailing markdown if OpenWebUI forgets json mode wrapper
          outputText = contentStr.replace(/^```json/m, '').replace(/^```/m, '').trim();
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      }

      // Parse the JSON. 
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

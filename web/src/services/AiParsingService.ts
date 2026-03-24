import { SettingsRepository } from '../repositories/SettingsRepository';

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
  ): Promise<{ pageIndex: number; text: string }[]> {
    const apiKey = SettingsRepository.getApiKey();
    if (!apiKey) {
      throw new Error("No Gemini API Key found in settings. Please configure it first.");
    }

    const chunkIndexes = pagesChunk.map(p => p.pageIndex).join(', ');

    const prompt = `
You are a highly capable document layout and content extraction AI.
You are given a chunk of raw text extracted from multiple pages (Pages: ${chunkIndexes}) out of ${totalPages} of an eBook/PDF.

YOUR GOAL:
1. Examine the text of each page provided in the JSON array. Determine if each page is the MAIN CONTENT of the book (i.e., narrative chapters, prologue, epilogue, actual book material).
2. If a page is just a front cover, copyright page, acknowledgements, table of contents, or end-of-book index, you must completely ignore it (DO NOT include it in your output array).
3. If it IS main content, perfectly format it. Remove stray page numbers, fix broken line breaks from the PDF scanner, format headings correctly, and return the cleaned up, perfectly readable text for that page.
4. You MUST return a strictly valid JSON array containing exactly this format:
[
  { "pageIndex": number, "text": "Cleaned formatted text here..." }
]
DO NOT return any conversational text outside of the JSON array. Output purely valid JSON so it can be parsed programmatically.

RAW PAGES CHUNK:
"""
${JSON.stringify(pagesChunk)}
"""
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
            temperature: 0.1, // Low temperature for consistent formatting
            responseMimeType: "application/json" // Force strict JSON output
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
      
      // Safety parsing for markdown blocks if responseMimeType is ignored by older models
      const cleanJsonStr = outputText.replace(/^```json/m, '').replace(/^```/m, '').trim();
      
      const parsedArray = JSON.parse(cleanJsonStr);
      if (!Array.isArray(parsedArray)) {
         return [];
      }
      return parsedArray;
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

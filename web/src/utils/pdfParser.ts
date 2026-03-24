import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { createWorker } from 'tesseract.js';

// Configure pdf.js worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export interface ParsedPage {
  pageIndex: number;
  inDocumentPageNumber?: number;
  text: string;
}

export interface ParsedBook {
  title: string;
  totalActualPages: number;
  pages: ParsedPage[];
}

/**
 * Reads a File object and extracts its text into structured JSON.
 * Applies heuristic filtering to identify likely covers or table of contents.
 */
export async function parsePdfFile(file: File): Promise<ParsedBook> {
  const arrayBuffer = await file.arrayBuffer();
  
  const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
  const pdf = await loadingTask.promise;
  
  const parsedBook: ParsedBook = {
    title: file.name.replace(/\.pdf$/i, ''),
    totalActualPages: pdf.numPages,
    pages: []
  };

  // Lazy load OCR worker only if needed to save resources and initialization time
  let ocrWorker: any = null;
  const getOcrWorker = async () => {
    if (!ocrWorker) {
      ocrWorker = await createWorker('eng');
    }
    return ocrWorker;
  };

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Combine all text items into a single string for this page
    let pageText = textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .map(item => item.str)
      .join(' ')
      .trim();

    // --- OCR FALLBACK (Image-based scanned PDF detection) ---
    if (pageText.length < 20) {
      const viewport = page.getViewport({ scale: 2.0 }); // 2.0x scale increases OCR accuracy significantly
      const canvas = document.createElement('canvas');
      const canvasContext = canvas.getContext('2d');
      
      if (canvasContext) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext, viewport } as any).promise;
        
        // Pass the rendered canvas to the WebAssembly Tesseract model
        const worker = await getOcrWorker();
        const { data: { text } } = await worker.recognize(canvas);
        pageText = text.trim() || '[Blank Page / OCR Unreadable]';
      }
    }

    // Attempt to extract the page number from the text (assuming it's usually at the start or end)
    const pageNumberMatch = pageText.match(/\b\d+\b/); 
    const extractedPageNum = pageNumberMatch ? parseInt(pageNumberMatch[0], 10) : pageNum;

    // Push the parsed page into our JSON array
    parsedBook.pages.push({
      pageIndex: pageNum,
      inDocumentPageNumber: extractedPageNum,
      text: pageText
    });
  }

  // Cleanup WebAssembly OCR memory
  if (ocrWorker) {
    await ocrWorker.terminate();
  }

  return parsedBook;
}

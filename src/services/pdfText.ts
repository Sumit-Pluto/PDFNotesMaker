// ─── PDF Text + Keyword Retrieval ────────────────────────────────────────────
//  Extracts plain text per page (via pdf.js, already a dependency) and picks the
//  most relevant chunks for a question using a lightweight BM25-ish keyword
//  score — no embeddings, no model download, runs entirely in the browser.
//  This powers the "Ask this PDF" mode.

import type { PdfDocumentInfo } from '../types';

export interface PageText {
  page: number;
  text: string;
}

// Cache extracted text per document id so we only parse a PDF once.
const textCache = new Map<string, PageText[]>();

export async function extractPdfText(doc: PdfDocumentInfo): Promise<PageText[]> {
  const cached = textCache.get(doc.id);
  if (cached) return cached;

  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const pdf = await getDocument({
    data: doc.data.slice(0),
    cMapUrl: '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/standard_fonts/',
    wasmUrl: '/wasm/',
  }).promise;

  const pages: PageText[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ page: i, text });
  }
  pdf.cleanup();

  textCache.set(doc.id, pages);
  return pages;
}

// ─── Keyword retriever ─────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  ('a an the of to in on for and or but is are was were be been being this that these those it its as at ' +
    'by with from into about over under your you i we they he she them his her our their what which who how ' +
    'why when where can could should would will do does did not no yes if then than so such more most very ' +
    'just also each any all some there here been being have has had will')
    .split(' '),
);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

interface Chunk {
  page: number;
  text: string;
}

/** Split each page into ~sentence-grouped chunks of a few hundred chars. */
function chunkPages(pages: PageText[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const p of pages) {
    if (!p.text) continue;
    const sentences = p.text.split(/(?<=[.!?])\s+/);
    let buffer = '';
    for (const sentence of sentences) {
      buffer += (buffer ? ' ' : '') + sentence;
      if (buffer.length >= 400) {
        chunks.push({ page: p.page, text: buffer });
        buffer = '';
      }
    }
    if (buffer.trim()) chunks.push({ page: p.page, text: buffer });
  }
  return chunks;
}

export interface RetrievedContext {
  context: string;      // formatted excerpts, ready to inject into the prompt
  usedPages: number[];  // page numbers the excerpts came from
  matched: boolean;     // true if any chunk actually matched the query terms
}

/**
 * Return the most relevant excerpts for `query` using term-frequency × inverse
 * document frequency (a simplified BM25). Falls back to the opening chunks when
 * nothing matches so the model still has something to work with.
 */
export function retrieveContext(
  pages: PageText[],
  query: string,
  opts: { topK?: number; maxChars?: number } = {},
): RetrievedContext {
  const topK = opts.topK ?? 6;
  const maxChars = opts.maxChars ?? 6000;

  const chunks = chunkPages(pages);
  if (chunks.length === 0) {
    return { context: '', usedPages: [], matched: false };
  }

  const queryTerms = tokenize(query);

  // Document frequency per term across chunks (for idf).
  const df = new Map<string, number>();
  const perChunkTerms = chunks.map(c => {
    const terms = tokenize(c.text);
    for (const w of new Set(terms)) df.set(w, (df.get(w) ?? 0) + 1);
    return terms;
  });
  const N = chunks.length;

  const scored = chunks.map((chunk, i) => {
    const tf = new Map<string, number>();
    for (const w of perChunkTerms[i]) tf.set(w, (tf.get(w) ?? 0) + 1);
    let score = 0;
    for (const q of queryTerms) {
      const f = tf.get(q) ?? 0;
      if (f > 0) {
        const idf = Math.log(1 + N / (df.get(q) ?? 1));
        score += (f / (f + 1)) * idf; // saturation keeps long chunks from dominating
      }
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const matched = scored.some(s => s.score > 0);
  const chosen = matched
    ? scored.filter(s => s.score > 0).slice(0, topK)
    : scored.slice(0, Math.min(topK, scored.length));

  let context = '';
  const usedPages = new Set<number>();
  for (const { chunk } of chosen) {
    const block = `[Page ${chunk.page}] ${chunk.text}\n\n`;
    if (context.length + block.length > maxChars) break;
    context += block;
    usedPages.add(chunk.page);
  }

  return {
    context: context.trim(),
    usedPages: [...usedPages].sort((a, b) => a - b),
    matched,
  };
}

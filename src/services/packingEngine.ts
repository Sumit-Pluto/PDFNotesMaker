import type { Snippet, PackingConfig, PackedPage, PackedItem } from '../types';

export function calculatePackedPages(
  snippets: Snippet[],
  config: PackingConfig
): PackedPage[] {
  if (snippets.length === 0) return [];

  // ── Page dimensions (mm) ─────────────────────────────────────────────────
  let pageWidth  = config.pageSize === 'a4' ? 210   : 215.9;
  let pageHeight = config.pageSize === 'a4' ? 297   : 279.4;
  if (config.orientation === 'landscape') {
    [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }

  // ── Margins & gaps ───────────────────────────────────────────────────────
  let marginX     = 12;
  let marginTop   = config.showTitle ? 18 : 8; // compact margin if no title
  let marginBot   = 10;
  let gap         = 4;

  if (config.density === 'compact') {
    marginX = 7;
    marginTop = config.showTitle ? 14 : 7;
    marginBot = 7;
    gap = 3;
  } else if (config.density === 'spacious') {
    marginX = 16;
    marginTop = config.showTitle ? 22 : 14;
    marginBot = 14;
    gap = 8;
  }

  const printableW = pageWidth  - marginX * 2;
  const printableH = pageHeight - marginTop - marginBot;

  // ── Column count ─────────────────────────────────────────────────────────
  let numCols = 2; // Default to 2 columns to allow side-by-side placement
  if (config.layout === '1-col') {
    numCols = 1;
  } else if (config.layout === '2-col') {
    numCols = 2;
  } else {
    // 'auto': 2 columns gives maximum flexibility for side-by-side Word-like layout
    numCols = 2;
  }

  const colGutter = gap;
  const colWidth  = (printableW - (numCols - 1) * colGutter) / numCols;

  // ── Packing state ─────────────────────────────────────────────────────────
  const pages: PackedPage[]  = [];
  let   pageIdx              = 1;
  let   currentItems: PackedItem[] = [];
  let   colHeights           = new Array(numCols).fill(0);

  const flushPage = () => {
    if (currentItems.length === 0) return;
    const usedArea  = currentItems.reduce((s, i) => s + i.width * i.height, 0);
    const totalArea = printableW * printableH;
    pages.push({
      pageIndex: pageIdx++,
      items: [...currentItems],
      width:  pageWidth,
      height: pageHeight,
      utilizationPercent: Math.min(100, Math.round((usedArea / totalArea) * 100)),
    });
    currentItems = [];
    colHeights   = new Array(numCols).fill(0);
  };

  // ── Place each snippet ────────────────────────────────────────────────────
  for (const snippet of snippets) {
    const scale = snippet.displayScale ?? 1.0;
    
    // Determine whether this snippet spans full width or single column:
    // 1. Explicit colSpan === 'full' -> full width
    // 2. Explicit colSpan === 'half' -> half width (1 column)
    // 3. Otherwise if numCols > 1: very wide aspect ratio (>= 2.5) defaults to full width
    const forceFull = snippet.colSpan === 'full';
    const forceHalf = snippet.colSpan === 'half';
    const hasCustomW = typeof snippet.customWidth === 'number' && snippet.customWidth > 0;
    const hasCustomH = typeof snippet.customHeight === 'number' && snippet.customHeight > 0;
    const isUltraWide = !forceHalf && (forceFull || (numCols > 1 && snippet.aspectRatio >= 2.5) || (hasCustomW && snippet.customWidth! > colWidth + 5));

    if (numCols === 1 || isUltraWide) {
      // ── Span across full width or custom wide width ──
      const itemW = hasCustomW ? Math.min(printableW, Math.max(20, snippet.customWidth!)) : printableW;
      const rawH  = itemW / snippet.aspectRatio;
      const itemH = hasCustomH ? Math.min(printableH, Math.max(10, snippet.customHeight!)) : Math.max(12, Math.min(rawH * scale, printableH));

      // Must be placed below the lowest point of all currently occupied columns
      const maxColH = Math.max(...colHeights);
      const topYOffset = maxColH > 0 ? maxColH + gap : 0;

      // If it doesn't fit on this page, flush to new page
      if (topYOffset + itemH > printableH && maxColH > 0) {
        flushPage();
      }

      const currentMax = Math.max(...colHeights);
      const actualY = marginTop + (currentMax > 0 ? currentMax + gap : 0);

      currentItems.push({
        snippet,
        x: snippet.customX !== undefined ? snippet.customX : marginX,
        y: snippet.customY !== undefined ? snippet.customY : actualY,
        width: itemW,
        height: itemH,
      });

      // Update all columns to this new bottom line
      const newBottom = actualY - marginTop + itemH;
      colHeights.fill(newBottom);

    } else {
      // ── Single column (Word-like column flow) ──
      // Find the column with the minimum height
      let targetCol = 0;
      for (let c = 1; c < numCols; c++) {
        if (colHeights[c] < colHeights[targetCol]) {
          targetCol = c;
        }
      }

      const itemW = hasCustomW ? Math.min(colWidth, Math.max(20, snippet.customWidth!)) : colWidth;
      const rawH  = itemW / snippet.aspectRatio;
      const itemH = hasCustomH ? Math.min(printableH, Math.max(10, snippet.customHeight!)) : Math.max(12, Math.min(rawH * scale, printableH));
      const colGap = colHeights[targetCol] > 0 ? gap : 0;

      // Check if it fits in this column
      if (colHeights[targetCol] + colGap + itemH > printableH) {
        // Try other columns on this page
        let fittedInAlt = false;
        for (let c = 0; c < numCols; c++) {
          if (c === targetCol) continue;
          const altGap = colHeights[c] > 0 ? gap : 0;
          if (colHeights[c] + altGap + itemH <= printableH) {
            targetCol = c;
            fittedInAlt = true;
            break;
          }
        }
        if (!fittedInAlt && currentItems.length > 0) {
          flushPage();
          targetCol = 0;
        }
      }

      const currentGap = colHeights[targetCol] > 0 ? gap : 0;
      const itemX = marginX + targetCol * (colWidth + colGutter);
      const itemY = marginTop + colHeights[targetCol] + currentGap;

      currentItems.push({
        snippet,
        x: snippet.customX !== undefined ? snippet.customX : itemX,
        y: snippet.customY !== undefined ? snippet.customY : itemY,
        width: itemW,
        height: itemH,
        colIndex: targetCol,
      });

      colHeights[targetCol] += currentGap + itemH;
    }
  }

  flushPage();
  return pages;
}

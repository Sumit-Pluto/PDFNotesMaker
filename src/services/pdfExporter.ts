import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import type { PackedPage, PackingConfig } from '../types';

// Safely load an image URL into an HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16) || 255,
    parseInt(clean.slice(2, 4), 16) || 255,
    parseInt(clean.slice(4, 6), 16) || 255,
  ];
}

export async function exportNotesPdf(
  pages: PackedPage[],
  config: PackingConfig
): Promise<void> {
  if (pages.length === 0) throw new Error('No snippets to export!');

  const orientation = config.orientation === 'landscape' ? 'l' : 'p';
  const format = config.pageSize === 'a4' ? 'a4' : 'letter';

  const doc = new jsPDF({ orientation, unit: 'mm', format, compress: true });

  const totalPages = pages.length;
  const titleText = config.documentTitle.trim() || 'Concise Study Notes';
  const bgRgb = hexToRgb(config.pageBackground || '#ffffff');
  const isDarkBg = (bgRgb[0] * 0.299 + bgRgb[1] * 0.587 + bgRgb[2] * 0.114) < 128;

  let serialIndex = 0;
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    if (pIdx > 0) doc.addPage(format, orientation);

    const page = pages[pIdx];

    // ── Fill page background ────────────────────────────────────────────────
    if (config.pageBackground && config.pageBackground.toLowerCase() !== '#ffffff') {
      doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
      doc.rect(0, 0, page.width, page.height, 'F');
    }

    // ── Optional Page header ────────────────────────────────────────────────
    if (config.showTitle) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      if (isDarkBg) {
        doc.setTextColor(241, 245, 249);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(titleText, 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      if (isDarkBg) {
        doc.setTextColor(148, 163, 184);
      } else {
        doc.setTextColor(100, 116, 139);
      }
      doc.text(
        `Page ${pIdx + 1} of ${totalPages} · ${page.utilizationPercent}% density`,
        page.width - 12,
        10,
        { align: 'right' }
      );

      if (isDarkBg) {
        doc.setDrawColor(51, 65, 85);
      } else {
        doc.setDrawColor(200, 208, 220);
      }
      doc.setLineWidth(0.3);
      doc.line(12, 12.5, page.width - 12, 12.5);
    }

    // ── Place snippets ───────────────────────────────────────────────────────
    for (const item of page.items) {
      serialIndex++;
      const { snippet, x, y, width, height } = item;

      try {
        await loadImage(snippet.dataUrl);

        doc.addImage(
          snippet.dataUrl,
          'PNG',
          x,
          y,
          width,
          height,
          undefined,
          'FAST'
        );
      } catch (err) {
        console.warn('Skipped image (failed to add to PDF):', err);
      }

      // Optional serial number on configured corner
      if (config.showSerialNo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        if (isDarkBg) {
          doc.setTextColor(165, 180, 252);
        } else {
          doc.setTextColor(67, 56, 202);
        }
        const pos = config.serialNoPosition ?? 'top-left';
        let numX = x + 1;
        let numY = y + 2.6;
        let align: 'left' | 'right' = 'left';

        if (pos === 'top-left') {
          numX = x + 1;
          numY = y + 2.6;
          align = 'left';
        } else if (pos === 'top-right') {
          numX = x + width - 1;
          numY = y + 2.6;
          align = 'right';
        } else if (pos === 'bottom-left') {
          numX = x + 1;
          numY = y + height - 1;
          align = 'left';
        } else if (pos === 'bottom-right') {
          numX = x + width - 1;
          numY = y + height - 1;
          align = 'right';
        }

        doc.text(`#${serialIndex}`, numX, numY, { align });
      }

      // Optional border
      if (config.showBorders) {
        if (isDarkBg) {
          doc.setDrawColor(71, 85, 105);
        } else {
          doc.setDrawColor(200, 208, 220);
        }
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y, width, height, 1.2, 1.2);
      }

      // Optional source citation tag
      if (config.showSourceTags) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6);
        if (isDarkBg) {
          doc.setTextColor(148, 163, 184);
        } else {
          doc.setTextColor(130, 140, 160);
        }
        const tag = `${snippet.docName} · p.${snippet.pageNumber}`;
        doc.text(tag, x + width - 0.5, y + height - 1, { align: 'right' });
      }
    }

    // Optional footer page number
    if (config.showPageNumbers) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      if (isDarkBg) {
        doc.setTextColor(148, 163, 184);
      } else {
        doc.setTextColor(100, 116, 139);
      }
      const footerText = `— Page ${page.pageIndex} of ${totalPages} —`;
      doc.text(footerText, page.width / 2, page.height - 5, { align: 'center' });
    }
  }

  // ── Save file ─────────────────────────────────────────────────────────────
  const safeName = titleText.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  doc.save(`${safeName}_notes.pdf`);

  // Celebration
  try {
    confetti({
      particleCount: 80,
      spread: 65,
      origin: { y: 0.65 },
      colors: ['#6366f1', '#a855f7', '#10b981', '#38bdf8', '#f59e0b'],
    });
  } catch { /* ignore */ }
}

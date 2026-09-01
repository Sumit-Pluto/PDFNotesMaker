// ─── Core Document Types ──────────────────────────────────────────────────────

export interface PdfDocumentInfo {
  id: string;
  name: string;
  size: number;
  numPages: number;
  data: Uint8Array;
}

// ─── Snippet / Clip ────────────────────────────────────────────────────────────

export interface Snippet {
  id: string;
  docId: string;
  docName: string;
  pageNumber: number;
  dataUrl: string;
  width: number;       // actual bitmap px
  height: number;
  aspectRatio: number;
  timestamp: number;
  title?: string;
  notes?: string;
  displayScale?: number;            // 0.3 to 2.0 (vertical scale factor)
  colSpan?: 'auto' | 'full' | 'half'; // MS Word like column/width flow
  customWidth?: number;             // custom explicit width in mm
  customHeight?: number;            // custom explicit height in mm
  customX?: number;                 // custom moved X position in mm
  customY?: number;                 // custom moved Y position in mm
}

// ─── Annotations (drawing layer) ──────────────────────────────────────────────

export type AnnotationTool =
  | 'pen'
  | 'highlighter'
  | 'text'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'eraser';

export interface Point {
  x: number; // relative to canvas CSS coords
  y: number;
}

export interface Stroke {
  id: string;
  tool: AnnotationTool;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
  text?: string;
  fontSize?: number;
}

/** Annotation data keyed by `${docId}_${pageNum}` */
export type AnnotationMap = Record<string, Stroke[]>;

// ─── Packing Config ───────────────────────────────────────────────────────────

export type PackingLayout   = 'auto' | '1-col' | '2-col' | 'masonry';
export type PageSize        = 'a4' | 'letter';
export type PageOrientation = 'portrait' | 'landscape';
export type PackingDensity  = 'compact' | 'balanced' | 'spacious';
export type SerialNoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PackingConfig {
  pageSize: PageSize;
  orientation: PageOrientation;
  layout: PackingLayout;
  density: PackingDensity;
  showBorders: boolean;
  showSourceTags: boolean;
  showSerialNo: boolean;
  serialNoPosition?: SerialNoPosition;
  showPageNumbers?: boolean;
  showTitle: boolean;
  documentTitle: string;
  pageBackground: string; // CSS color: '#ffffff', '#fffdf4', '#1e293b', etc.
}

// ─── Packed Layout ────────────────────────────────────────────────────────────

export interface PackedItem {
  snippet: Snippet;
  x: number;      // mm
  y: number;      // mm
  width: number;  // mm
  height: number; // mm
  colIndex?: number;
}

export interface PackedPage {
  pageIndex: number;
  items: PackedItem[];
  width: number;  // mm
  height: number; // mm
  utilizationPercent: number;
}

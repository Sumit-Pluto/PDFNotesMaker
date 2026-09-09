import React, {
  useEffect, useRef, useState, useCallback,
} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2,
  Crop, Lasso, Pentagon, Contrast, Loader2, ChevronDown, Check,
  Pen, Highlighter, Type, Square, Circle, ArrowRight,
  Eraser, Undo2, Trash2,
} from 'lucide-react';
import type {
  PdfDocumentInfo, Snippet, AnnotationTool, Stroke, Point,
} from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ─── Types ────────────────────────────────────────────────────────────────────

type SnipMode = 'marquee' | 'lasso' | 'polygon';

interface PdfViewerProps {
  document: PdfDocumentInfo | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onCaptureSnippet: (snippet: Snippet) => void;
  soundEnabled?: boolean;
}

// ─── Thumbnail component (Lecture Slide strip like PW reference image) ────────

const PageThumb: React.FC<{
  pdfDoc: PDFDocumentProxy;
  pageNum: number;
  active: boolean;
  rotation: number;
  onClick: () => void;
}> = ({ pdfDoc, pageNum, active, rotation, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled || !canvasRef.current) return;
        const effRot = ((page.rotate || 0) + rotation) % 360;
        const v1 = page.getViewport({ scale: 1, rotation: effRot });
        // Target crisp width matching thumbnail container
        const targetW = 240;
        const thumbScale = targetW / v1.width;
        const viewport = page.getViewport({ scale: thumbScale, rotation: effRot });
        const canvas   = canvasRef.current;
        const ctx      = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width  = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        // Let CSS width: 100% and height: auto preserve the true landscape / portrait aspect ratio
        canvas.style.width  = '100%';
        canvas.style.height = 'auto';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        page.cleanup();
      } catch { /* ignore */ }
    };
    render();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNum, rotation]);

  return (
    <button
      className={`thumb-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={`Slide / Page ${pageNum}`}
      aria-label={`Go to slide ${pageNum}`}
    >
      <div className="thumb-canvas-box">
        <canvas ref={canvasRef} className="thumb-canvas" />
      </div>
      <span className="thumb-num">{pageNum}</span>
    </button>
  );
};

// ─── Annotation canvas helpers ────────────────────────────────────────────────

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, scale = 1) {
  if (stroke.points.length < 1) return;
  if (stroke.points.length < 2 && stroke.tool !== 'text') return;
  
  ctx.save();
  ctx.globalAlpha = stroke.opacity;

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.lineWidth = stroke.width * scale * 4;
  } else {
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle   = stroke.color;
    ctx.lineWidth   = stroke.width * scale;
  }

  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';

  if (stroke.tool === 'text') {
    if (!stroke.text || stroke.points.length === 0) { ctx.restore(); return; }
    const size = stroke.fontSize ? stroke.fontSize * scale : Math.max(14, stroke.width * scale * 4);
    ctx.font = `bold ${size}px 'Outfit', 'Inter', sans-serif`;
    ctx.fillStyle = stroke.color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(stroke.text, stroke.points[0].x * scale, stroke.points[0].y * scale);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth   = Math.max(16, stroke.width * scale * 3.5);
  }

  if (stroke.tool === 'rectangle') {
    const x1 = stroke.points[0].x * scale;
    const y1 = stroke.points[0].y * scale;
    const x2 = stroke.points[stroke.points.length - 1].x * scale;
    const y2 = stroke.points[stroke.points.length - 1].y * scale;
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.restore();
    return;
  }

  if (stroke.tool === 'circle') {
    const x1 = stroke.points[0].x * scale;
    const y1 = stroke.points[0].y * scale;
    const x2 = stroke.points[stroke.points.length - 1].x * scale;
    const y2 = stroke.points[stroke.points.length - 1].y * scale;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    ctx.beginPath();
    ctx.ellipse(Math.min(x1, x2) + rx, Math.min(y1, y2) + ry, Math.max(1, rx), Math.max(1, ry), 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'arrow') {
    const pts = stroke.points;
    const sx  = pts[0].x * scale;
    const sy  = pts[0].y * scale;
    const ex  = pts[pts.length - 1].x * scale;
    const ey  = pts[pts.length - 1].y * scale;
    const angle = Math.atan2(ey - sy, ex - sx);
    const headLen = Math.max(12, stroke.width * scale * 3.5);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 7), ey - headLen * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 7), ey - headLen * Math.sin(angle + Math.PI / 7));
    ctx.closePath(); ctx.fill();
    ctx.restore();
    return;
  }

  // pen / highlighter / eraser — free-draw
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x * scale, stroke.points[0].y * scale);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x * scale, stroke.points[i].y * scale);
  }
  ctx.stroke();
  ctx.restore();
}

function redrawAnnotations(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  canvasW: number,
  canvasH: number,
  scale = 1,
) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  for (const s of strokes) drawStroke(ctx, s, scale);
}

// ─── Colors matching dark lecture slides (PW palette) ─────────────────────────
const PEN_COLORS = [
  '#f59e0b', // Amber / Gold (like lecture equations)
  '#38bdf8', // Cyan
  '#22c55e', // Emerald
  '#ec4899', // Hot Pink
  '#a855f7', // Purple
  '#ef4444', // Red
  '#ffffff', // White
  '#000000', // Black
];

export const PdfViewer: React.FC<PdfViewerProps> = ({
  document,
  currentPage,
  onPageChange,
  onCaptureSnippet,
  soundEnabled = true,
}) => {
  // ── Core PDF state ───────────────────────────────────────────────────────
  const [pdfDoc,       setPdfDoc]       = useState<PDFDocumentProxy | null>(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [numPages,     setNumPages]     = useState(1);
  const [zoomScale,    setZoomScale]    = useState(1.0);
  const manualRotation = 0;
  const [autoFit,      setAutoFit]      = useState<boolean>(true);

  // ── Resizable slides strip width (default 220px) ──────────────────────────
  const [slidesWidth, setSlidesWidth]   = useState(220);
  const isDraggingSlides = useRef(false);

  const handleSlidesMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSlides.current = true;
    window.document.body.style.cursor = 'col-resize';
    window.document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startWidth = slidesWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSlides.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(420, Math.max(120, startWidth + delta));
      setSlidesWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingSlides.current = false;
      window.document.body.style.cursor = '';
      window.document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const activePageNumRef = useRef(currentPage);
  activePageNumRef.current = currentPage;

  const totalPagesRef = useRef(numPages);
  totalPagesRef.current = numPages;

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  const goToNextPage = useCallback(() => {
    if (activePageNumRef.current < totalPagesRef.current) {
      onPageChangeRef.current?.(activePageNumRef.current + 1);
    }
  }, []);

  const goToPrevPage = useCallback(() => {
    if (activePageNumRef.current > 1) {
      onPageChangeRef.current?.(activePageNumRef.current - 1);
    }
  }, []);

  const setCurrentPage = useCallback((updater: number | ((prev: number) => number)) => {
    const nextVal = typeof updater === 'function' ? updater(activePageNumRef.current) : updater;
    const clamped = Math.max(1, Math.min(nextVal, totalPagesRef.current));
    onPageChangeRef.current?.(clamped);
  }, []);

  // ── Tool state: 'crop' (snipper) or annotation tool ───────────────────────
  const [currentMode,     setCurrentMode]     = useState<'crop' | AnnotationTool>('crop');
  const [snipMode,        setSnipMode]        = useState<SnipMode>('marquee');
  const [invertColors,    setInvertColors]    = useState(false);

  // ── Snipper state (Marquee, Freehand Lasso, Polygon Lasso) ────────────────
  const [isSelecting,     setIsSelecting]     = useState(false);
  const [selectionStart,  setSelectionStart]  = useState<Point | null>(null);
  const [selectionCurrent,setSelectionCurrent]= useState<Point | null>(null);
  const [lassoPoints,     setLassoPoints]     = useState<Point[]>([]);
  const [isLassoActive,   setIsLassoActive]   = useState(false);
  const [polyPoints,      setPolyPoints]      = useState<Point[]>([]);
  const [polyMousePos,    setPolyMousePos]    = useState<Point | null>(null);
  const [flashRect,       setFlashRect]       = useState<{x:number;y:number;w:number;h:number}|null>(null);
  const [showCropPopup,   setShowCropPopup]   = useState(false);
  const cropMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (cropMenuRef.current && !cropMenuRef.current.contains(e.target as Node)) {
        setShowCropPopup(false);
      }
    };
    if (showCropPopup) {
      window.addEventListener('mousedown', handleOutsideClick);
      return () => window.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [showCropPopup]);

  // ── Annotation drawing state ─────────────────────────────────────────────
  const [penColor,        setPenColor]        = useState('#f59e0b'); // default amber
  const [penWidth,        setPenWidth]        = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [annotsByPage,    setAnnotsByPage]    = useState<Record<number, Stroke[]>>({});
  const [currentStroke,   setCurrentStroke]   = useState<Stroke | null>(null);
  const [isAnnotDrawing,  setIsAnnotDrawing]  = useState(false);

  // Inline text input state
  const [inlineTextInput, setInlineTextInput] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Movable text state
  const [draggingTextId,    setDraggingTextId]    = useState<string | null>(null);
  const [activeHoverTextId, setActiveHoverTextId] = useState<string | null>(null);
  const dragTextOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  // ── Refs ─────────────────────────────────────────────────────────────────
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const annotCanvasRef  = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef= useRef<HTMLDivElement>(null);
  const viewportRef     = useRef<HTMLDivElement>(null);
  const renderTaskRef   = useRef<pdfjsLib.RenderTask | null>(null);
  const currentPageRef  = useRef<PDFPageProxy | null>(null);
  const lastPinchDist   = useRef<number>(0);
  const cropAndCaptureRef = useRef<(x: number, y: number, w: number, h: number, polygonPoints?: Point[]) => void>(() => {});

  // ── Smart Landscape & Portrait Fit computation ───────────────────────────
  const computeFitScale = useCallback(async (page: PDFPageProxy, rotation = 0) => {
    if (!viewportRef.current) return 1.0;
    const containerW = viewportRef.current.clientWidth - 48;
    const containerH = viewportRef.current.clientHeight - 48;
    const effRot = ((page.rotate || 0) + rotation) % 360;
    const v1 = page.getViewport({ scale: 1, rotation: effRot });

    const scaleW = containerW / v1.width;
    const scaleH = containerH > 100 ? containerH / v1.height : scaleW;

    // For landscape presentation slides or rotated landscape (width >= height), fit both width and height cleanly
    if (v1.width >= v1.height) {
      return Math.min(2.5, Math.max(0.3, Math.min(scaleW, scaleH)));
    }
    // For standard portrait pages, fit container width and height cleanly
    return Math.min(2.5, Math.max(0.4, Math.min(scaleW, scaleH)));
  }, []);

  // ── Load PDF document ────────────────────────────────────────────────────
  useEffect(() => {
    if (!document) {
      setPdfDoc(null); setLoadError(null); setNumPages(1);
      return;
    }
    let cancelled = false;
    setIsLoading(true); setLoadError(null); setPdfDoc(null);

    (async () => {
      try {
        const dataCopy = new Uint8Array(document.data.buffer.slice(0));
        const loaded   = await pdfjsLib.getDocument({
          data: dataCopy,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
          wasmUrl: '/wasm/',
          enableXfa: true,
        }).promise;
        if (cancelled) return;
        setPdfDoc(loaded);
        setNumPages(loaded.numPages);

        const targetPage = (currentPage >= 1 && currentPage <= loaded.numPages) ? currentPage : 1;
        if (targetPage !== currentPage && onPageChange) {
          onPageChange(targetPage);
        }

        // Auto compute fit scale for current page
        const page = await loaded.getPage(targetPage);
        const fs   = await computeFitScale(page, manualRotation);
        page.cleanup();
        setZoomScale(fs);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load PDF:', err);
          setLoadError('Could not load PDF. The file may be corrupted or password-protected.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [document, computeFitScale, manualRotation]);

  // ── Render current PDF Page ───────────────────────────────────────────────
  // ── Render current PDF Page (Double-Buffered Flicker-Free) ─────────────────
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    const render = async () => {
      if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch { /**/ } }
      if (currentPageRef.current) { try { currentPageRef.current.cleanup(); } catch { /**/ } }

      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) { page.cleanup(); return; }
        currentPageRef.current = page;

        const visibleCanvas = canvasRef.current!;
        const effRot = ((page.rotate || 0) + manualRotation) % 360;

        let curScale = zoomScale;
        if (autoFit) {
          curScale = await computeFitScale(page, manualRotation);
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const viewport = page.getViewport({ scale: curScale * dpr, rotation: effRot });

        const targetW = Math.floor(viewport.width);
        const targetH = Math.floor(viewport.height);
        const cssW = `${Math.floor(viewport.width / dpr)}px`;
        const cssH = `${Math.floor(viewport.height / dpr)}px`;

        // 1. Render on an offscreen buffer first (prevents blank/white flash!)
        const offscreen = window.document.createElement('canvas');
        offscreen.width  = targetW;
        offscreen.height = targetH;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx || cancelled) return;

        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, targetW, targetH);

        const task = page.render({
          canvas: offscreen,
          canvasContext: offCtx,
          viewport,
        });
        renderTaskRef.current = task;
        await task.promise;

        if (cancelled) return;

        // 2. Instantaneous single-frame blit to visible canvas
        visibleCanvas.width  = targetW;
        visibleCanvas.height = targetH;
        visibleCanvas.style.width  = cssW;
        visibleCanvas.style.height = cssH;

        const vCtx = visibleCanvas.getContext('2d');
        if (vCtx) {
          vCtx.drawImage(offscreen, 0, 0);
        }

        // 3. Sync annotation canvas dimensions
        const ac = annotCanvasRef.current;
        if (ac) {
          ac.width  = targetW;
          ac.height = targetH;
          ac.style.width  = cssW;
          ac.style.height = cssH;
          const actx = ac.getContext('2d');
          if (actx) {
            const dprScale = targetW / (parseFloat(cssW) || targetW);
            redrawAnnotations(actx, annotsByPage[currentPage] ?? [], targetW, targetH, dprScale);
          }
        }
      } catch (err: unknown) {
        if (!cancelled && (err as {name?:string})?.name !== 'RenderingCancelledException') {
          console.error('Render error:', err);
        }
      }
    };

    render();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, zoomScale, manualRotation, autoFit, computeFitScale]);

  // ── Redraw Annotations when strokes change (Zero flicker on PDF canvas) ────
  useEffect(() => {
    const ac = annotCanvasRef.current;
    if (!ac) return;
    const actx = ac.getContext('2d');
    if (!actx) return;
    const dprScale = ac.width / (parseFloat(ac.style.width) || ac.width);
    redrawAnnotations(actx, annotsByPage[currentPage] ?? [], ac.width, ac.height, dprScale);
  }, [annotsByPage, currentPage]);

  // ── Wheel navigation: Ctrl/Cmd+Scroll to zoom; native scrolling pans the slide when enlarged ──
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Pinch or Ctrl/Cmd + wheel = Zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setAutoFit(false);
        setZoomScale(z => Math.min(3.0, Math.max(0.3, z - e.deltaY * 0.0025)));
      }
      // When enlarged, normal scrolling/trackpad panning scrolls the page naturally in all directions
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // ── Pinch-to-zoom on touch screens / mobile / trackpad touch ───────────────
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastPinchDist.current > 0) {
        const delta = dist / lastPinchDist.current;
        setAutoFit(false);
        setZoomScale(z => Math.min(3.0, Math.max(0.3, z * delta)));
      }
      lastPinchDist.current = dist;
    };
    const onTouchEnd = () => { lastPinchDist.current = 0; };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend',  onTouchEnd);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend',  onTouchEnd);
    };
  }, []);

  // ── Keyboard shortcuts (ArrowDown, ArrowRight, ArrowUp, ArrowLeft, + -, S) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          e.stopPropagation();
          goToNextPage();
          break;

        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          e.stopPropagation();
          goToPrevPage();
          break;

        case '+':
        case '=':
          e.preventDefault();
          setAutoFit(false);
          setZoomScale(z => Math.min(z + 0.2, 3.0));
          break;

        case '-':
        case '_':
          e.preventDefault();
          setAutoFit(false);
          setZoomScale(z => Math.max(z - 0.2, 0.3));
          break;

        case 'Escape':
          if (polyPoints.length > 0) {
            setPolyPoints([]);
            setPolyMousePos(null);
          }
          break;

        case 'Enter':
          if (currentMode === 'crop' && snipMode === 'polygon' && polyPoints.length >= 3) {
            const xs = polyPoints.map(p => p.x);
            const ys = polyPoints.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            const w = maxX - minX;
            const h = maxY - minY;
            if (w >= 10 && h >= 10) {
              cropAndCaptureRef.current(minX, minY, w, h, polyPoints);
            }
            setPolyPoints([]);
            setPolyMousePos(null);
          }
          break;
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [goToNextPage, goToPrevPage, currentMode, snipMode, polyPoints]);

  // ── Sound effect on snippet capture ───────────────────────────────────────
  const playCaptureSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AC = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    } catch { /**/ }
  }, [soundEnabled]);

  // ── Crop & Capture: composites PDF canvas + annotations canvas ────────────
  const cropAndCapture = useCallback((
    cssX: number, cssY: number, cssW: number, cssH: number,
    polygonPoints?: Point[]
  ) => {
    if (!canvasRef.current || !document) return;
    const canvas = canvasRef.current;
    const dW = parseFloat(canvas.style.width)  || canvas.width;
    const dH = parseFloat(canvas.style.height) || canvas.height;
    const sx = canvas.width  / dW;
    const sy = canvas.height / dH;

    const cx = Math.max(0, Math.min(cssX, dW));
    const cy = Math.max(0, Math.min(cssY, dH));
    const cw = Math.max(0, Math.min(cssW, dW - cx));
    const ch = Math.max(0, Math.min(cssH, dH - cy));
    if (cw < 10 || ch < 10) return;

    const off = window.document.createElement('canvas');
    off.width  = Math.round(cw * sx);
    off.height = Math.round(ch * sy);
    const ctx  = off.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // If lasso or polygon contour points provided, clip offscreen canvas to path!
    if (polygonPoints && polygonPoints.length >= 3) {
      ctx.beginPath();
      const p0 = polygonPoints[0];
      ctx.moveTo((p0.x - cx) * sx, (p0.y - cy) * sy);
      for (let i = 1; i < polygonPoints.length; i++) {
        const p = polygonPoints[i];
        ctx.lineTo((p.x - cx) * sx, (p.y - cy) * sy);
      }
      ctx.closePath();
      ctx.clip();
    }

    // 1. Draw PDF base bitmap
    ctx.drawImage(
      canvas,
      Math.round(cx * sx), Math.round(cy * sy), off.width, off.height,
      0, 0, off.width, off.height
    );

    // 2. Draw annotations overlay (pen, highlighter, text, shapes)
    if (annotCanvasRef.current) {
      ctx.drawImage(
        annotCanvasRef.current,
        Math.round(cx * sx), Math.round(cy * sy), off.width, off.height,
        0, 0, off.width, off.height
      );
    }

    const dataUrl = off.toDataURL('image/png');
    const snippet: Snippet = {
      id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      docId: document.id,
      docName: document.name,
      pageNumber: currentPage,
      dataUrl,
      width: off.width,
      height: off.height,
      aspectRatio: off.width / off.height,
      timestamp: Date.now(),
      colSpan: 'auto',
    };

    setFlashRect({ x: cx, y: cy, w: cw, h: ch });
    setTimeout(() => setFlashRect(null), 380);
    playCaptureSound();
    onCaptureSnippet(snippet);
  }, [currentPage, document, onCaptureSnippet, playCaptureSound]);
  cropAndCaptureRef.current = cropAndCapture;

  // ── Coordinates helper ───────────────────────────────────────────────────
  const getCoords = (e: React.MouseEvent): Point => {
    if (!canvasWrapperRef.current) return { x: 0, y: 0 };
    const r = canvasWrapperRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // ── Annotation Drawing Handlers ──────────────────────────────────────────
  const startAnnotStroke = (pt: Point) => {
    if (currentMode === 'crop') return;
    if (currentMode === 'text') {
      if (inlineTextInput && inlineTextInput.text.trim()) {
        commitInlineText();
      }
      setInlineTextInput({ x: pt.x, y: pt.y, text: '' });
      return;
    }
    const stroke: Stroke = {
      id: `str-${Date.now()}`,
      tool: currentMode,
      color: penColor,
      width: penWidth,
      opacity: currentMode === 'highlighter' ? 0.45 : 1.0,
      points: [pt],
    };
    setCurrentStroke(stroke);
    setIsAnnotDrawing(true);
  };

  const continueAnnotStroke = (pt: Point) => {
    if (!currentStroke || !isAnnotDrawing) return;
    let updated: Stroke;
    if (currentMode === 'pen' || currentMode === 'highlighter' || currentMode === 'eraser') {
      updated = { ...currentStroke, points: [...currentStroke.points, pt] };
    } else {
      // shapes & arrow
      updated = { ...currentStroke, points: [currentStroke.points[0], pt] };
    }
    setCurrentStroke(updated);

    const ac  = annotCanvasRef.current;
    const ctx = ac?.getContext('2d');
    if (ac && ctx && canvasRef.current) {
      const dprScale = canvasRef.current.width / (parseFloat(canvasRef.current.style.width) || canvasRef.current.width);
      ctx.clearRect(0, 0, ac.width, ac.height);
      for (const s of annotsByPage[currentPage] ?? []) {
        drawStroke(ctx, s, dprScale);
      }
      drawStroke(ctx, updated, dprScale);
    }
  };

  const finishAnnotStroke = () => {
    if (!currentStroke || !isAnnotDrawing) return;
    setIsAnnotDrawing(false);
    setAnnotsByPage(prev => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] ?? []), currentStroke],
    }));
    setCurrentStroke(null);
  };

  const commitInlineText = () => {
    if (!inlineTextInput || !inlineTextInput.text.trim()) {
      setInlineTextInput(null);
      return;
    }
    const fontSize = Math.max(14, 13 + penWidth);
    const textStroke: Stroke = {
      id: `str-txt-${Date.now()}`,
      tool: 'text',
      color: penColor,
      width: penWidth,
      opacity: 1,
      points: [{ x: inlineTextInput.x, y: inlineTextInput.y + fontSize }],
      text: inlineTextInput.text.trim(),
      fontSize,
    };
    setAnnotsByPage(prev => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] ?? []), textStroke],
    }));
    setInlineTextInput(null);
  };

  const undoAnnotStroke = () => {
    setAnnotsByPage(prev => {
      const strokes = prev[currentPage] ?? [];
      if (strokes.length === 0) return prev;
      return { ...prev, [currentPage]: strokes.slice(0, -1) };
    });
  };

  const clearAnnotPage = () => {
    setAnnotsByPage(prev => ({ ...prev, [currentPage]: [] }));
    const ac  = annotCanvasRef.current;
    const ctx = ac?.getContext('2d');
    if (ac && ctx) ctx.clearRect(0, 0, ac.width, ac.height);
  };

  // ── Movable text handlers ────────────────────────────────────────────────
  const handleTextDragStart = (e: React.MouseEvent, textStroke: Stroke) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const pt = getCoords(e);
    const strokePt = textStroke.points[0];
    if (!strokePt) return;

    dragTextOffsetRef.current = {
      offsetX: pt.x - strokePt.x,
      offsetY: pt.y - strokePt.y,
    };
    setDraggingTextId(textStroke.id);
  };

  const handleTextDoubleClick = (e: React.MouseEvent, textStroke: Stroke) => {
    e.stopPropagation();
    const pt = textStroke.points[0];
    if (!pt) return;
    deleteTextStroke(textStroke.id);
    const fontSize = textStroke.fontSize || 16;
    setInlineTextInput({
      x: pt.x,
      y: pt.y - fontSize,
      text: textStroke.text || '',
    });
  };

  const deleteTextStroke = (strokeId: string) => {
    setAnnotsByPage(prev => {
      const strokes = prev[currentPage] ?? [];
      return {
        ...prev,
        [currentPage]: strokes.filter(s => s.id !== strokeId),
      };
    });
  };

  // Window listeners for smooth text dragging
  useEffect(() => {
    if (!draggingTextId) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!canvasWrapperRef.current) return;
      const r = canvasWrapperRef.current.getBoundingClientRect();
      const pt = { x: e.clientX - r.left, y: e.clientY - r.top };
      const newX = Math.round(pt.x - dragTextOffsetRef.current.offsetX);
      const newY = Math.round(pt.y - dragTextOffsetRef.current.offsetY);

      setAnnotsByPage(prev => {
        const strokes = prev[currentPage] ?? [];
        return {
          ...prev,
          [currentPage]: strokes.map(s => {
            if (s.id === draggingTextId) {
              return { ...s, points: [{ x: newX, y: newY }] };
            }
            return s;
          }),
        };
      });
    };

    const onWindowMouseUp = () => {
      setDraggingTextId(null);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [draggingTextId, currentPage]);

  const finishPolygon = useCallback(() => {
    if (polyPoints.length < 3) return;
    const xs = polyPoints.map(p => p.x);
    const ys = polyPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    if (w >= 10 && h >= 10) {
      cropAndCapture(minX, minY, w, h, polyPoints);
    }
    setPolyPoints([]);
    setPolyMousePos(null);
  }, [polyPoints, cropAndCapture]);

  // ── Unified Mouse Events ─────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pt = getCoords(e);

    if (currentMode === 'crop') {
      if (snipMode === 'marquee') {
        setIsSelecting(true);
        setSelectionStart(pt);
        setSelectionCurrent(pt);
      } else if (snipMode === 'lasso') {
        setIsLassoActive(true);
        setLassoPoints([pt]);
      } else if (snipMode === 'polygon') {
        // If clicking near the first point (loop closure) and >= 3 points
        if (polyPoints.length >= 3) {
          const distToFirst = Math.hypot(pt.x - polyPoints[0].x, pt.y - polyPoints[0].y);
          if (distToFirst < 16) {
            finishPolygon();
            return;
          }
        }
        setPolyPoints(prev => [...prev, pt]);
        setPolyMousePos(pt);
      }
    } else {
      startAnnotStroke(pt);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pt = getCoords(e);

    if (currentMode === 'crop') {
      if (snipMode === 'marquee' && isSelecting) {
        setSelectionCurrent(pt);
      } else if (snipMode === 'lasso' && isLassoActive) {
        setLassoPoints(prev => [...prev, pt]);
      } else if (snipMode === 'polygon') {
        setPolyMousePos(pt);
      }
    } else if (isAnnotDrawing) {
      continueAnnotStroke(pt);
    }
  };

  const handleMouseUp = () => {
    if (currentMode !== 'crop') {
      finishAnnotStroke();
      return;
    }

    if (snipMode === 'marquee') {
      if (!isSelecting || !selectionStart || !selectionCurrent) {
        setIsSelecting(false); return;
      }
      setIsSelecting(false);
      const x = Math.min(selectionStart.x, selectionCurrent.x);
      const y = Math.min(selectionStart.y, selectionCurrent.y);
      const w = Math.abs(selectionCurrent.x - selectionStart.x);
      const h = Math.abs(selectionCurrent.y - selectionStart.y);
      setSelectionStart(null); setSelectionCurrent(null);

      if (w >= 10 && h >= 10) cropAndCapture(x, y, w, h);
    } else if (snipMode === 'lasso') {
      if (!isLassoActive) return;
      setIsLassoActive(false);
      if (lassoPoints.length >= 3) {
        const xs = lassoPoints.map(p => p.x);
        const ys = lassoPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const w = maxX - minX;
        const h = maxY - minY;
        if (w >= 10 && h >= 10) {
          cropAndCapture(minX, minY, w, h, lassoPoints);
        }
      }
      setLassoPoints([]);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (currentMode === 'crop' && snipMode === 'polygon' && polyPoints.length >= 3) {
      e.preventDefault();
      e.stopPropagation();
      finishPolygon();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // ── Selection box calculation ─────────────────────────────────────────────
  const selBox = (isSelecting && selectionStart && selectionCurrent) ? {
    x: Math.min(selectionStart.x, selectionCurrent.x),
    y: Math.min(selectionStart.y, selectionCurrent.y),
    w: Math.abs(selectionCurrent.x - selectionStart.x),
    h: Math.abs(selectionCurrent.y - selectionStart.y),
  } : null;

  const annotsThisPage = annotsByPage[currentPage] ?? [];

  const getCursorStyle = () => {
    if (currentMode === 'crop') return 'crosshair';
    if (currentMode === 'text') return 'text';
    if (currentMode === 'eraser') return 'cell';
    return 'crosshair';
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="viewer-shell">
      {/* ── Left Lecture Slide Thumbnails (PW Style) ────────────────────── */}
      {pdfDoc && (
        <>
          <div
            className="thumb-strip"
            role="navigation"
            aria-label="Slide list"
            style={{ width: `${slidesWidth}px` }}
          >
            <div className="thumb-strip-header">
              <span>Slides</span>
              <span className="thumb-strip-count">{numPages}</span>
            </div>
            {Array.from({ length: numPages }, (_, i) => i + 1).map(pg => (
              <PageThumb
                key={pg}
                pdfDoc={pdfDoc}
                pageNum={pg}
                active={pg === currentPage}
                rotation={manualRotation}
                onClick={() => setCurrentPage(pg)}
              />
            ))}
          </div>

          {/* Resizer handle for slides strip */}
          <div
            className="panel-resizer"
            onMouseDown={handleSlidesMouseDown}
            title="Drag border to resize slides sidebar"
          />
        </>
      )}

      {/* ── Center Viewer Panel ─────────────────────────────────────────── */}
      <main className="center-panel">
        {/* ── Modern Top Editing Toolbar (matches user reference image) ─── */}
        <div className="viewer-toolbar">
          {/* Slide Navigation */}
          <div className="toolbar-group">
            <button
              className="btn-icon"
              onClick={goToPrevPage}
              disabled={currentPage <= 1 || !pdfDoc}
              title="Previous slide (← or ↑)"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="page-indicator">
              <span>Slide</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={currentPage}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  if (v >= 1 && v <= numPages) setCurrentPage(v);
                }}
                className="page-num-input"
                style={{
                  width: '38px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  textAlign: 'center',
                  padding: '2px 4px',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
              <span>/ {numPages}</span>
            </div>
            <button
              className="btn-icon"
              onClick={goToNextPage}
              disabled={currentPage >= numPages || !pdfDoc}
              title="Next slide (→ or ↓)"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Unified Crop Tool with Bottom Popup */}
          <div className="toolbar-group crop-tool-wrapper" ref={cropMenuRef}>
            <button
              className={`toolbar-tool-btn ${currentMode === 'crop' ? 'active' : ''}`}
              onClick={() => {
                if (currentMode !== 'crop') {
                  setCurrentMode('crop');
                }
                setShowCropPopup(prev => !prev);
              }}
              title="Crop Tool: Click to switch between Rectangle, Freehand Lasso, and Polygon"
            >
              {snipMode === 'marquee' && <Crop size={16} />}
              {snipMode === 'lasso' && <Lasso size={16} />}
              {snipMode === 'polygon' && <Pentagon size={16} />}
              <span>{snipMode === 'marquee' ? 'Crop' : snipMode === 'lasso' ? 'Lasso' : 'Polygon'}</span>
              <ChevronDown size={12} style={{ marginLeft: '-1px', opacity: 0.8 }} />
            </button>

            {/* Bottom Popup Menu */}
            {showCropPopup && (
              <div className="crop-mode-bottom-popup">
                <div className="crop-popup-header">Crop &amp; Snip Modes</div>

                <button
                  className={`crop-popup-item ${snipMode === 'marquee' ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentMode('crop');
                    setSnipMode('marquee');
                    setPolyPoints([]);
                    setLassoPoints([]);
                    setShowCropPopup(false);
                  }}
                >
                  <div className="crop-popup-icon">
                    <Crop size={16} />
                  </div>
                  <div className="crop-popup-text">
                    <span className="crop-popup-name">Rectangle Crop</span>
                    <span className="crop-popup-desc">Standard rectangular selection frame</span>
                  </div>
                  {snipMode === 'marquee' && <Check size={15} className="crop-popup-check" />}
                </button>

                <button
                  className={`crop-popup-item ${snipMode === 'lasso' ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentMode('crop');
                    setSnipMode('lasso');
                    setPolyPoints([]);
                    setLassoPoints([]);
                    setShowCropPopup(false);
                  }}
                >
                  <div className="crop-popup-icon">
                    <Lasso size={16} />
                  </div>
                  <div className="crop-popup-text">
                    <span className="crop-popup-name">Freehand Lasso</span>
                    <span className="crop-popup-desc">Draw a freeform loop around diagrams</span>
                  </div>
                  {snipMode === 'lasso' && <Check size={15} className="crop-popup-check" />}
                </button>

                <button
                  className={`crop-popup-item ${snipMode === 'polygon' ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentMode('crop');
                    setSnipMode('polygon');
                    setPolyPoints([]);
                    setLassoPoints([]);
                    setShowCropPopup(false);
                  }}
                >
                  <div className="crop-popup-icon">
                    <Pentagon size={16} />
                  </div>
                  <div className="crop-popup-text">
                    <span className="crop-popup-name">Polygon Lasso</span>
                    <span className="crop-popup-desc">Click corners to frame multi-sided shapes</span>
                  </div>
                  {snipMode === 'polygon' && <Check size={15} className="crop-popup-check" />}
                </button>
              </div>
            )}
          </div>

          <div className="toolbar-divider" />

          {/* Annotation / Draw Tools (Pen, Highlighter, Text, Shapes, Eraser) */}
          <div className="toolbar-group">
            <button
              className={`toolbar-tool-btn ${currentMode === 'pen' ? 'active' : ''}`}
              onClick={() => setCurrentMode('pen')}
              title="Pen: Freehand drawing"
            >
              <Pen size={15} />
            </button>
            <button
              className={`toolbar-tool-btn ${currentMode === 'highlighter' ? 'active' : ''}`}
              onClick={() => setCurrentMode('highlighter')}
              title="Highlighter: Highlight text & formulas"
            >
              <Highlighter size={15} />
            </button>
            <button
              className={`toolbar-tool-btn ${currentMode === 'text' ? 'active' : ''}`}
              onClick={() => {
                setCurrentMode('text');
                if (!inlineTextInput && canvasWrapperRef.current) {
                  const rect = canvasWrapperRef.current.getBoundingClientRect();
                  const defaultX = Math.max(20, Math.floor(rect.width / 2 - 90));
                  const defaultY = Math.max(20, Math.floor(rect.height / 2 - 15));
                  setInlineTextInput({ x: defaultX, y: defaultY, text: '' });
                }
              }}
              title="Text: Add text annotation on slide (click to type or click anywhere on slide)"
              style={{ gap: '5px' }}
            >
              <Type size={15} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Text</span>
            </button>
            <button
              className={`toolbar-tool-btn ${currentMode === 'rectangle' ? 'active' : ''}`}
              onClick={() => setCurrentMode('rectangle')}
              title="Rectangle: Draw box"
            >
              <Square size={15} />
            </button>
            <button
              className={`toolbar-tool-btn ${currentMode === 'circle' ? 'active' : ''}`}
              onClick={() => setCurrentMode('circle')}
              title="Circle / Ellipse"
            >
              <Circle size={15} />
            </button>
            <button
              className={`toolbar-tool-btn ${currentMode === 'arrow' ? 'active' : ''}`}
              onClick={() => setCurrentMode('arrow')}
              title="Arrow pointer"
            >
              <ArrowRight size={15} />
            </button>
            <button
              className={`toolbar-tool-btn ${currentMode === 'eraser' ? 'active' : ''}`}
              onClick={() => setCurrentMode('eraser')}
              title="Eraser: Erase drawn annotations"
            >
              <Eraser size={15} />
            </button>
          </div>

          {/* Color & Stroke Width Options */}
          {currentMode !== 'crop' && (
            <div className="toolbar-group">
              {/* Color & Stroke Width Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  className="btn-icon"
                  onClick={() => setShowColorPicker(v => !v)}
                  title="Choose annotation color and stroke width"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: penColor,
                      boxShadow: '0 0 6px ' + penColor + '88',
                    }}
                  />
                  <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {penWidth}px
                  </span>
                </button>
                {showColorPicker && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                      onClick={() => setShowColorPicker(false)}
                    />
                    <div className="color-picker-popup">
                      {/* Color Palette */}
                      <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                          Color
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                          {PEN_COLORS.map(c => (
                            <button
                              key={c}
                              className={`color-swatch ${penColor === c ? 'active' : ''}`}
                              style={{ background: c }}
                              onClick={() => setPenColor(c)}
                              title={c}
                            />
                          ))}
                          <input
                            type="color"
                            value={penColor}
                            onChange={e => setPenColor(e.target.value)}
                            style={{ width: '24px', height: '24px', border: 'none', cursor: 'pointer', background: 'none', padding: 0 }}
                            title="Custom color"
                          />
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ width: '100%', height: '1px', background: 'var(--border-subtle)' }} />

                      {/* Stroke Width Slider */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Stroke Width
                          </span>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: penColor, fontWeight: 700 }}>
                            {penWidth}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="24"
                          value={penWidth}
                          onChange={e => setPenWidth(Number(e.target.value))}
                          style={{
                            width: '100%',
                            cursor: 'pointer',
                            accentColor: penColor,
                          }}
                        />
                        {/* Live Preview Bar */}
                        <div style={{ marginTop: '8px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', borderRadius: '4px', padding: '0 8px' }}>
                          <div
                            style={{
                              width: '100%',
                              height: `${Math.min(18, penWidth)}px`,
                              background: penColor,
                              borderRadius: '99px',
                              transition: 'height 0.1s ease',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Undo / Clear */}
              <button
                className="btn-icon"
                onClick={undoAnnotStroke}
                disabled={annotsThisPage.length === 0}
                title="Undo last stroke"
              >
                <Undo2 size={14} />
              </button>
              <button
                className="btn-icon"
                onClick={clearAnnotPage}
                disabled={annotsThisPage.length === 0}
                title="Clear all annotations on this slide"
                style={{ color: '#f87171' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          <div className="toolbar-divider" />

          {/* Invert Colors (Dark Mode / High Contrast reading) */}
          <div className="toolbar-group">
            <button
              className={`toolbar-tool-btn ${invertColors ? 'active' : ''}`}
              onClick={() => setInvertColors(v => !v)}
              title="Invert Colors: Dark Mode reading contrast for lecture slides"
            >
              <Contrast size={16} />
              <span>Invert</span>
            </button>
          </div>
        </div>

        {/* ── Main Viewport with Dark Slide Canvas ───────────────────────── */}
        <div
          ref={viewportRef}
          className="pdf-viewport-container slide-viewport"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsSelecting(false);
            setIsAnnotDrawing(false);
          }}
        >
          {isLoading && (
            <div className="pdf-loading-state">
              <Loader2 size={36} className="spin-animation" style={{ color: 'var(--accent-primary)' }} />
              <span style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Loading slide…</span>
            </div>
          )}

          {loadError && !isLoading && (
            <div className="pdf-loading-state">
              <span style={{ color: 'var(--accent-rose)', fontSize: '0.9rem' }}>⚠ {loadError}</span>
            </div>
          )}

          {!document && !isLoading && (
            <div className="pdf-loading-state">
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📄</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', maxWidth: '280px' }}>
                No PDF selected. Upload a lecture PDF to begin!
              </p>
            </div>
          )}

          {document && !isLoading && !loadError && (
            <div
              ref={canvasWrapperRef}
              className="pdf-canvas-wrapper slide-canvas-wrapper"
              onMouseDown={handleMouseDown}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              style={{ position: 'relative', cursor: getCursorStyle() }}
            >
              {/* PDF Document Canvas */}
              <canvas ref={canvasRef} className={`pdf-page-canvas ${invertColors ? 'pdf-canvas-inverted' : ''}`} />

              {/* Annotation Canvas Overlay */}
              <canvas
                ref={annotCanvasRef}
                className="annot-canvas"
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
              />

              {/* Movable Text Overlays */}
              {annotsThisPage.filter(s => s.tool === 'text' && s.text).map(textStroke => {
                const pt = textStroke.points[0];
                if (!pt) return null;
                const fontSize = textStroke.fontSize || 16;
                const isDragging = draggingTextId === textStroke.id;
                const isHovered = activeHoverTextId === textStroke.id;

                return (
                  <div
                    key={textStroke.id}
                    className="movable-text-overlay"
                    onMouseDown={e => handleTextDragStart(e, textStroke)}
                    onDoubleClick={e => handleTextDoubleClick(e, textStroke)}
                    onMouseEnter={() => setActiveHoverTextId(textStroke.id)}
                    onMouseLeave={() => setActiveHoverTextId(null)}
                    style={{
                      position: 'absolute',
                      left: `${pt.x - 4}px`,
                      top: `${pt.y - fontSize - 2}px`,
                      padding: '2px 4px',
                      borderRadius: '4px',
                      cursor: isDragging ? 'grabbing' : 'grab',
                      userSelect: 'none',
                      touchAction: 'none',
                      border: isHovered || isDragging
                        ? `1.5px dashed ${textStroke.color || '#6366f1'}`
                        : '1.5px dashed transparent',
                      background: isDragging ? 'rgba(99, 102, 241, 0.18)' : isHovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                      zIndex: isDragging ? 55 : 35,
                      display: 'inline-flex',
                      alignItems: 'center',
                      pointerEvents: currentMode === 'crop' && isSelecting ? 'none' : 'auto',
                      transition: 'border-color 0.12s, background 0.12s',
                    }}
                    title="Click and drag to move text • Double-click to edit"
                  >
                    {/* Invisible spacer matching text dimensions for exact bounding box */}
                    <span
                      style={{
                        font: `bold ${fontSize}px 'Outfit', 'Inter', sans-serif`,
                        color: 'transparent',
                        whiteSpace: 'pre',
                        pointerEvents: 'none',
                        lineHeight: 1,
                      }}
                    >
                      {textStroke.text}
                    </span>
                  </div>
                );
              })}

              {/* Inline Text Input for Text Tool (100% Transparent Background) */}
              {inlineTextInput && (
                <div
                  className="inline-text-popup"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: `${inlineTextInput.x}px`,
                    top: `${inlineTextInput.y}px`,
                    zIndex: 60,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'transparent',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    border: `1.5px dashed ${penColor}`,
                  }}
                >
                  <input
                    autoFocus
                    type="text"
                    value={inlineTextInput.text}
                    placeholder="Type text note..."
                    onChange={e => setInlineTextInput(prev => prev ? { ...prev, text: e.target.value } : null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitInlineText();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setInlineTextInput(null);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      color: penColor,
                      border: 'none',
                      fontSize: `${Math.max(14, 13 + penWidth)}px`,
                      fontWeight: 700,
                      outline: 'none',
                      minWidth: '140px',
                      padding: '2px 4px',
                      
                    }}
                  />
                  <button
                    className="btn-icon"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      background: 'var(--accent-primary)',
                      color: '#fff',
                      borderRadius: '4px',
                      height: '22px',
                    }}
                    onClick={commitInlineText}
                    title="Add text to slide (Enter)"
                  >
                    Add
                  </button>
                  <button
                    className="btn-icon"
                    style={{
                      padding: '2px 5px',
                      fontSize: '0.74rem',
                      color: 'var(--text-muted)',
                      height: '22px',
                      background: 'var(--bg-subtle)',
                      borderRadius: '4px',
                    }}
                    onClick={() => setInlineTextInput(null)}
                    title="Cancel (Esc)"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Marquee Selection Box */}
              {currentMode === 'crop' && selBox && (
                <div
                  className="selection-marquee"
                  style={{
                    left: `${selBox.x}px`,
                    top: `${selBox.y}px`,
                    width: `${selBox.w}px`,
                    height: `${selBox.h}px`,
                    pointerEvents: 'none',
                    position: 'absolute',
                  }}
                >
                  <div className="selection-badge">
                    {Math.round(selBox.w)} × {Math.round(selBox.h)} px • Release to snip
                  </div>
                </div>
              )}

              {/* Freehand Lasso Crop Live Overlay */}
              {currentMode === 'crop' && snipMode === 'lasso' && lassoPoints.length >= 2 && (
                <svg className="lasso-overlay-svg">
                  <polygon
                    points={lassoPoints.map(p => `${p.x},${p.y}`).join(' ')}
                    className="lasso-path-fill"
                  />
                </svg>
              )}

              {/* Polygon Lasso Crop Live Overlay & Action Bar */}
              {currentMode === 'crop' && snipMode === 'polygon' && (
                <>
                  <svg className="lasso-overlay-svg">
                    {/* Semi-transparent filled interior if >= 3 points */}
                    {polyPoints.length >= 3 && (
                      <polygon
                        points={polyPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        className="polygon-path-fill"
                      />
                    )}

                    {/* Fixed edges drawn so far */}
                    {polyPoints.length >= 2 && (
                      <polyline
                        points={polyPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#c084fc"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Active rubberband line to current mouse position */}
                    {polyPoints.length > 0 && polyMousePos && (
                      <line
                        x1={polyPoints[polyPoints.length - 1].x}
                        y1={polyPoints[polyPoints.length - 1].y}
                        x2={polyMousePos.x}
                        y2={polyMousePos.y}
                        className="polygon-rubberband-line"
                      />
                    )}

                    {/* Vertex handle dots */}
                    {polyPoints.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={idx === 0 ? 6 : 4}
                        className={`polygon-vertex-dot ${idx === 0 ? 'start-vertex' : ''}`}
                      />
                    ))}
                  </svg>

                  {/* Polygon Action Floating Bar */}
                  {polyPoints.length > 0 && (
                    <div className="polygon-action-bar" onMouseDown={e => e.stopPropagation()}>
                      <span className="polygon-point-badge">
                        {polyPoints.length} vertex{polyPoints.length !== 1 ? 's' : ''}
                      </span>
                      <button
                        className="polygon-complete-btn"
                        disabled={polyPoints.length < 3}
                        onClick={finishPolygon}
                        title="Complete polygon snip (Enter or double-click)"
                      >
                        Complete Snip
                      </button>
                      <button
                        className="btn-icon"
                        style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px', height: '24px' }}
                        onClick={() => { setPolyPoints([]); setPolyMousePos(null); }}
                        title="Cancel polygon (Esc)"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Visual Capture Flash */}
              {flashRect && (
                <div
                  className="capture-flash-animation"
                  style={{
                    left: `${flashRect.x}px`,
                    top: `${flashRect.y}px`,
                    width: `${flashRect.w}px`,
                    height: `${flashRect.h}px`,
                    position: 'absolute',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Fixed Floating Controls at Bottom of Center Panel (Unaffected by slide scrolling) ── */}
        {document && !isLoading && (
          <div className="slide-bottom-bar">
            <button
              className="btn-icon"
              onClick={() => {
                setAutoFit(false);
                setZoomScale(z => Math.max(z - 0.2, 0.3));
              }}
              title="Zoom out (-)"
            >
              <ZoomOut size={15} />
            </button>
            <span className="zoom-indicator" style={{ minWidth: '46px', textAlign: 'center', fontSize: '0.8rem' }}>
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              className="btn-icon"
              onClick={() => {
                setAutoFit(false);
                setZoomScale(z => Math.min(z + 0.2, 3.0));
              }}
              title="Zoom in (+)"
            >
              <ZoomIn size={15} />
            </button>
            <div className="toolbar-divider" style={{ height: '16px', margin: '0 2px' }} />
            <button
              className={`btn-icon ${autoFit ? 'active' : ''}`}
              onClick={async () => {
                setAutoFit(true);
                if (pdfDoc) {
                  const p = await pdfDoc.getPage(currentPage);
                  const fs = await computeFitScale(p, manualRotation);
                  p.cleanup();
                  setZoomScale(fs);
                }
              }}
              title="Fit Slide to Screen (Auto-fit)"
              style={{ gap: '4px', padding: '4px 8px' }}
            >
              <Maximize2 size={14} />
            </button>

            {currentMode === 'crop' && (
              <>
                <div className="toolbar-divider" style={{ height: '16px', margin: '0 4px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <button
                    className={`btn-icon ${snipMode === 'marquee' ? 'active' : ''}`}
                    style={{ fontSize: '0.72rem', padding: '3px 8px', height: '24px', gap: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                    onClick={() => { setSnipMode('marquee'); setPolyPoints([]); setLassoPoints([]); }}
                    title="Rectangle Crop"
                  >
                    <Crop size={12} />
                    <span>Rect</span>
                  </button>
                  <button
                    className={`btn-icon ${snipMode === 'lasso' ? 'active' : ''}`}
                    style={{ fontSize: '0.72rem', padding: '3px 8px', height: '24px', gap: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                    onClick={() => { setSnipMode('lasso'); setPolyPoints([]); setLassoPoints([]); }}
                    title="Freehand Lasso Crop"
                  >
                    <Lasso size={12} />
                    <span>Lasso</span>
                  </button>
                  <button
                    className={`btn-icon ${snipMode === 'polygon' ? 'active' : ''}`}
                    style={{ fontSize: '0.72rem', padding: '3px 8px', height: '24px', gap: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                    onClick={() => { setSnipMode('polygon'); setPolyPoints([]); setLassoPoints([]); }}
                    title="Polygon Lasso Crop"
                  >
                    <Pentagon size={12} />
                    <span>Polygon</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

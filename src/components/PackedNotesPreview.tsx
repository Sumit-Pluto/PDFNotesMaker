import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  FileText, Download, Maximize2, Sparkles,
  ZoomIn, ZoomOut, Columns2, Columns, Grid,
  Palette, Expand, Shrink,
  ArrowUp, ArrowDown, Trash2, SplitSquareVertical,
  Check, SlidersHorizontal, X, ChevronRight,
} from 'lucide-react';
import type { PackedPage, PackingConfig, Snippet } from '../types';

interface PackedNotesPreviewProps {
  packedPages: PackedPage[];
  snippets: Snippet[];
  config: PackingConfig;
  onChangeConfig: (newConfig: Partial<PackingConfig>) => void;
  onChangeSnippetScale: (id: string, scale: number) => void;
  onChangeSnippetColSpan: (id: string, colSpan: 'auto' | 'full' | 'half') => void;
  onChangeSnippetDimensions?: (id: string, widthMm: number, heightMm: number) => void;
  onMoveSnippetPosition?: (id: string, xMm: number, yMm: number) => void;
  onMoveSnippet: (index: number, direction: 'up' | 'down') => void;
  onDeleteSnippet: (id: string) => void;
  onExportPdf: () => void;
  isExporting: boolean;
}

// ── Background color presets ──────────────────────────────────────────────────
const BG_PRESETS = [
  { label: 'White',       color: '#ffffff', textColor: '#1e293b' },
  { label: 'Cream/Warm',  color: '#fffdf4', textColor: '#292524' },
  { label: 'Soft Mint',   color: '#f0fdf4', textColor: '#14532d' },
  { label: 'Lavender',   color: '#faf5ff', textColor: '#3b0764' },
  { label: 'Cool Slate',  color: '#f1f5f9', textColor: '#0f172a' },
  { label: 'Dark Slate',  color: '#1e293b', textColor: '#f8fafc' },
  { label: 'Pure Black',  color: '#0a0a0a', textColor: '#f1f5f9' },
];

export const PackedNotesPreview: React.FC<PackedNotesPreviewProps> = ({
  packedPages,
  snippets,
  config,
  onChangeConfig,
  onChangeSnippetScale,
  onChangeSnippetColSpan,
  onChangeSnippetDimensions,
  onMoveSnippetPosition,
  onMoveSnippet,
  onDeleteSnippet,
  onExportPdf,
  isExporting,
}) => {
  const [previewZoom,    setPreviewZoom]    = useState(0.85);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [sidebarWidth,   setSidebarWidth]   = useState(330);
  const isDraggingSidebar = useRef(false);

  // ── Display Options Right-Side Popup State ────────────────────────────────
  const [showDisplayOptionsPopup, setShowDisplayOptionsPopup] = useState(false);
  const [displayPopupPos, setDisplayPopupPos] = useState<{ top: number; left: number }>({ top: 180, left: 340 });
  const displayTriggerRef = useRef<HTMLButtonElement>(null);
  const displayPopupRef = useRef<HTMLDivElement>(null);

  const handleToggleDisplayOptions = useCallback(() => {
    if (!showDisplayOptionsPopup && displayTriggerRef.current) {
      const rect = displayTriggerRef.current.getBoundingClientRect();
      setDisplayPopupPos({
        top: Math.max(60, Math.min(window.innerHeight - 390, rect.top)),
        left: rect.right + 12,
      });
    }
    setShowDisplayOptionsPopup(prev => !prev);
  }, [showDisplayOptionsPopup]);

  useEffect(() => {
    if (!showDisplayOptionsPopup) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        displayPopupRef.current &&
        !displayPopupRef.current.contains(e.target as Node) &&
        displayTriggerRef.current &&
        !displayTriggerRef.current.contains(e.target as Node)
      ) {
        setShowDisplayOptionsPopup(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDisplayOptionsPopup(false);
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDisplayOptionsPopup]);

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(550, Math.max(240, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingSidebar.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const avgDensity = packedPages.length > 0
    ? Math.round(packedPages.reduce((a, p) => a + p.utilizationPercent, 0) / packedPages.length)
    : 0;

  const currentBgPreset = BG_PRESETS.find(p => p.color.toLowerCase() === config.pageBackground.toLowerCase());
  const isDark = currentBgPreset ? (currentBgPreset.color === '#1e293b' || currentBgPreset.color === '#0a0a0a') : false;

  const handleScaleChange = useCallback((snippet: Snippet, delta: number) => {
    const current = snippet.displayScale ?? 1.0;
    const next    = Math.max(0.3, Math.min(2.0, current + delta));
    onChangeSnippetScale(snippet.id, Math.round(next * 10) / 10);
  }, [onChangeSnippetScale]);

  const toggleColSpan = useCallback((snippet: Snippet) => {
    // If currently full, switch to half (so below item fits on right!)
    // If half or auto, toggle between full and half
    const isFull = snippet.colSpan === 'full' || (snippet.aspectRatio >= 2.5 && snippet.colSpan !== 'half');
    onChangeSnippetColSpan(snippet.id, isFull ? 'half' : 'full');
  }, [onChangeSnippetColSpan]);

  const [resizingClip, setResizingClip] = useState<{
    id: string;
    handle: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
    widthMm: number;
    heightMm: number;
  } | null>(null);

  const handleResizeStart = (
    e: React.MouseEvent,
    snippet: Snippet,
    currentWidthMm: number,
    currentHeightMm: number,
    handle: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = currentWidthMm;
    const startH = currentHeightMm;
    const mmScale = (96 / 25.4) * previewZoom;

    setResizingClip({
      id: snippet.id,
      handle,
      widthMm: startW,
      heightMm: startH,
    });

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / mmScale;
      const deltaY = (moveEvent.clientY - startY) / mmScale;

      let nextW = startW;
      let nextH = startH;

      if (handle === 'r' || handle === 'tr' || handle === 'br') {
        nextW = Math.max(25, Math.min(200, startW + deltaX));
      } else if (handle === 'l' || handle === 'tl' || handle === 'bl') {
        nextW = Math.max(25, Math.min(200, startW - deltaX));
      }

      if (handle === 'b' || handle === 'bl' || handle === 'br') {
        nextH = Math.max(10, Math.min(270, startH + deltaY));
      } else if (handle === 't' || handle === 'tl' || handle === 'tr') {
        nextH = Math.max(10, Math.min(270, startH - deltaY));
      }

      setResizingClip({
        id: snippet.id,
        handle,
        widthMm: Math.round(nextW * 10) / 10,
        heightMm: Math.round(nextH * 10) / 10,
      });
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const deltaX = (upEvent.clientX - startX) / mmScale;
      const deltaY = (upEvent.clientY - startY) / mmScale;

      let finalW = startW;
      let finalH = startH;

      if (handle === 'r' || handle === 'tr' || handle === 'br') {
        finalW = Math.max(25, Math.min(200, startW + deltaX));
      } else if (handle === 'l' || handle === 'tl' || handle === 'bl') {
        finalW = Math.max(25, Math.min(200, startW - deltaX));
      }

      if (handle === 'b' || handle === 'bl' || handle === 'br') {
        finalH = Math.max(10, Math.min(270, startH + deltaY));
      } else if (handle === 't' || handle === 'tl' || handle === 'tr') {
        finalH = Math.max(10, Math.min(270, startH - deltaY));
      }

      finalW = Math.round(finalW * 10) / 10;
      finalH = Math.round(finalH * 10) / 10;

      setResizingClip(null);
      if (onChangeSnippetDimensions) {
        onChangeSnippetDimensions(snippet.id, finalW, finalH);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const [movingClip, setMovingClip] = useState<{
    id: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const handleMoveStart = (
    e: React.MouseEvent,
    snippet: Snippet,
    currentX: number,
    currentY: number
  ) => {
    // Only drag to move if already selected
    if (selectedClipId !== snippet.id) return;
    if ((e.target as HTMLElement).closest('.clip-handle-corner, .clip-handle-edge, .clip-resize-controls')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = currentX;
    const initialY = currentY;
    const mmScale = (96 / 25.4) * previewZoom;

    setMovingClip({
      id: snippet.id,
      startX,
      startY,
      initialX,
      initialY,
      currentX: initialX,
      currentY: initialY,
    });

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / mmScale;
      const deltaY = (moveEvent.clientY - startY) / mmScale;
      const nextX = Math.max(0, initialX + deltaX);
      const nextY = Math.max(0, initialY + deltaY);

      setMovingClip({
        id: snippet.id,
        startX,
        startY,
        initialX,
        initialY,
        currentX: Math.round(nextX * 10) / 10,
        currentY: Math.round(nextY * 10) / 10,
      });
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const deltaX = (upEvent.clientX - startX) / mmScale;
      const deltaY = (upEvent.clientY - startY) / mmScale;
      const finalX = Math.max(0, Math.round((initialX + deltaX) * 10) / 10);
      const finalY = Math.max(0, Math.round((initialY + deltaY) * 10) / 10);

      setMovingClip(null);
      if (onMoveSnippetPosition) {
        onMoveSnippetPosition(snippet.id, finalX, finalY);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="preview-layout-view">
      {/* ── Left Config & Clipping Arrangement Sidebar ─────────────────── */}
      <aside className="preview-sidebar" style={{ width: `${sidebarWidth}px`, flexShrink: 0 }}>
        {/* Document Title & Toggle */}
        <div className="config-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label className="config-label" style={{ margin: 0 }}>Notes Title</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={config.showTitle}
                onChange={e => onChangeConfig({ showTitle: e.target.checked })}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span>Show Title Header</span>
            </label>
          </div>

          {config.showTitle && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={config.documentTitle}
                onChange={e => onChangeConfig({ documentTitle: e.target.value })}
                placeholder="e.g. Physics Formula & Study Notes"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                }}
              />
            </div>
          )}
        </div>

        {/* Packing Density Stat */}
        <div className="density-stat-card">
          <div className="stat-header">
            <span className="stat-title">MS Word-Style Auto Packing</span>
            <span style={{ fontSize: '0.75rem', color: '#6ee7b7' }}>Max Information</span>
          </div>
          <div className="stat-value">{avgDensity}% Page Density</div>
          <div className="stat-progress-bg">
            <div className="stat-progress-bar" style={{ width: `${Math.min(100, Math.max(10, avgDensity))}%` }} />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Consolidated <strong>{snippets.length}</strong> clippings into{' '}
            <strong>{packedPages.length}</strong> printable page{packedPages.length !== 1 ? 's' : ''}.
          </div>
        </div>

        {/* Page Background Color Picker */}
        <div className="config-section">
          <label className="config-label">
            <Palette size={13} style={{ display: 'inline', marginRight: '5px' }} />
            Page Background Color
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {BG_PRESETS.map(({ label, color }) => (
              <button
                key={color}
                title={label}
                onClick={() => onChangeConfig({ pageBackground: color })}
                style={{
                  width: '28px',
                  height: '28px',
                  background: color,
                  border: config.pageBackground.toLowerCase() === color.toLowerCase()
                    ? '2.5px solid var(--accent-primary)'
                    : '1.5px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: config.pageBackground.toLowerCase() === color.toLowerCase()
                    ? '0 0 8px rgba(99,102,241,0.5)'
                    : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {config.pageBackground.toLowerCase() === color.toLowerCase() && (
                  <Check size={14} color={color === '#ffffff' || color === '#fffdf4' || color === '#f0fdf4' || color === '#faf5ff' || color === '#f1f5f9' ? '#000' : '#fff'} />
                )}
              </button>
            ))}
            <input
              type="color"
              value={config.pageBackground}
              onChange={e => onChangeConfig({ pageBackground: e.target.value })}
              style={{ width: '28px', height: '28px', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer', background: 'none', padding: 0 }}
              title="Custom Color"
            />
          </div>
        </div>

        {/* Layout & Paper Format */}
        <div className="config-section">
          <label className="config-label">Columns &amp; Paper</label>
          <div className="btn-toggle-group" style={{ marginBottom: '6px' }}>
            <button className={`toggle-option-btn ${config.layout === 'auto' ? 'active' : ''}`} onClick={() => onChangeConfig({ layout: 'auto' })}>
              <Grid size={13} /><span>Auto</span>
            </button>
            <button className={`toggle-option-btn ${config.layout === '2-col' ? 'active' : ''}`} onClick={() => onChangeConfig({ layout: '2-col' })}>
              <Columns2 size={13} /><span>2-Col</span>
            </button>
            <button className={`toggle-option-btn ${config.layout === '1-col' ? 'active' : ''}`} onClick={() => onChangeConfig({ layout: '1-col' })}>
              <Columns size={13} /><span>1-Col</span>
            </button>
          </div>

          <div className="btn-toggle-group">
            <button className={`toggle-option-btn ${config.orientation === 'portrait' ? 'active' : ''}`} onClick={() => onChangeConfig({ orientation: 'portrait' })}>
              Portrait
            </button>
            <button className={`toggle-option-btn ${config.orientation === 'landscape' ? 'active' : ''}`} onClick={() => onChangeConfig({ orientation: 'landscape' })}>
              Landscape
            </button>
          </div>
        </div>

        {/* Page & Clipping Display Options Trigger */}
        <div className="config-section">
          <button
            ref={displayTriggerRef}
            className={`display-options-trigger-btn ${showDisplayOptionsPopup ? 'active' : ''}`}
            onClick={handleToggleDisplayOptions}
            title="Configure serial numbers, clipping tags, borders, and page numbers"
          >
            <div className="display-options-btn-left">
              <SlidersHorizontal size={15} style={{ color: 'var(--accent-primary)' }} />
              <span>Display Options</span>
            </div>
            <div className="display-options-btn-right">
              
              <ChevronRight size={14} className={`display-options-chevron ${showDisplayOptionsPopup ? 'open' : ''}`} />
            </div>
          </button>
        </div>

        {/* Clippings Order & Reflow Manager (Expanded Length) */}
        <div className="config-section arrange-clippings-section" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <label className="config-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Arrange Clippings ({snippets.length})</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Auto-reflows</span>
          </label>
          
          <div className="preview-clip-manager-list">
            {snippets.map((snip, idx) => {
              const isSelected = selectedClipId === snip.id;
              const isFull = snip.colSpan === 'full' || (snip.aspectRatio >= 2.5 && snip.colSpan !== 'half');

              return (
                <div
                  key={snip.id}
                  className={`preview-clip-manager-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedClipId(snip.id)}
                >
                  <img src={snip.dataUrl} alt="Thumb" className="preview-clip-mini-thumb" />
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#a5b4fc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      #{idx + 1} • p.{snip.pageNumber}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px', alignItems: 'center' }}>
                      <button
                        className={`clip-pill-btn ${isFull ? 'active' : ''}`}
                        onClick={e => { e.stopPropagation(); toggleColSpan(snip); }}
                        title="Toggle Full Width / Half Width"
                      >
                        {isFull ? 'Full' : 'Half (1/2)'}
                      </button>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {Math.round((snip.displayScale ?? 1.0) * 100)}%
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      className="btn-icon"
                      style={{ width: '20px', height: '20px', padding: 0 }}
                      disabled={idx === 0}
                      onClick={e => { e.stopPropagation(); onMoveSnippet(idx, 'up'); }}
                      title="Move earlier (Shift Up)"
                    >
                      <ArrowUp size={11} />
                    </button>
                    <button
                      className="btn-icon"
                      style={{ width: '20px', height: '20px', padding: 0 }}
                      disabled={idx === snippets.length - 1}
                      onClick={e => { e.stopPropagation(); onMoveSnippet(idx, 'down'); }}
                      title="Move later (Shift Down)"
                    >
                      <ArrowDown size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Export Button */}
        <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
            onClick={onExportPdf}
            disabled={packedPages.length === 0 || isExporting}
          >
            {isExporting ? (
              <><Sparkles size={18} /><span>Generating PDF…</span></>
            ) : (
              <><Download size={18} /><span>Export {packedPages.length} Page{packedPages.length !== 1 ? 's' : ''} PDF</span></>
            )}
          </button>
        </div>
      </aside>

      {/* ── Display Options Right-Side Floating Popup ────────────────────────── */}
      {showDisplayOptionsPopup && (
        <div
          ref={displayPopupRef}
          className="display-options-right-popup"
          style={{ top: `${displayPopupPos.top}px`, left: `${displayPopupPos.left}px` }}
        >
          <div className="display-options-popup-header">
            <div className="display-options-popup-title">
              <SlidersHorizontal size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>Display Options</span>
            </div>
            <button
              className="btn-icon"
              style={{ width: '22px', height: '22px', padding: 0 }}
              onClick={() => setShowDisplayOptionsPopup(false)}
              title="Close display options popup (Esc)"
            >
              <X size={13} />
            </button>
          </div>

          <div className="display-options-popup-body">
            {/* 1. Serial Number on Clippings */}
            <div className="display-opt-group">
              <label className="display-opt-checkbox-row">
                <input
                  type="checkbox"
                  checked={config.showSerialNo ?? true}
                  onChange={e => onChangeConfig({ showSerialNo: e.target.checked })}
                />
                <span className="display-opt-label-text">Show serial no. on clipping (#1, #2…)</span>
              </label>

              {(config.showSerialNo ?? true) && (
                <div className="display-opt-subgroup">
                  <div className="display-opt-sublabel">Serial No. Position:</div>
                  <div className="serial-pos-grid">
                    {[
                      { id: 'top-left', label: '↖ Top Left' },
                      { id: 'top-right', label: '↗ Top Right' },
                      { id: 'bottom-left', label: '↙ Bottom Left' },
                      { id: 'bottom-right', label: '↘ Bottom Right' },
                    ].map(pos => (
                      <button
                        key={pos.id}
                        className={`btn-icon serial-pos-btn ${(config.serialNoPosition ?? 'top-left') === pos.id ? 'active' : ''}`}
                        onClick={() => onChangeConfig({ serialNoPosition: pos.id as any })}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="display-opt-divider" />

            {/* 2. Source Tags */}
            <label className="display-opt-checkbox-row">
              <input
                type="checkbox"
                checked={config.showSourceTags}
                onChange={e => onChangeConfig({ showSourceTags: e.target.checked })}
              />
              <span className="display-opt-label-text">Show clipping source tags</span>
            </label>

            {/* 3. Borders */}
            <label className="display-opt-checkbox-row">
              <input
                type="checkbox"
                checked={config.showBorders}
                onChange={e => onChangeConfig({ showBorders: e.target.checked })}
              />
              <span className="display-opt-label-text">Show clipping borders</span>
            </label>

            {/* 4. Page Numbers in Bottom */}
            <label className="display-opt-checkbox-row">
              <input
                type="checkbox"
                checked={config.showPageNumbers ?? true}
                onChange={e => onChangeConfig({ showPageNumbers: e.target.checked })}
              />
              <span className="display-opt-label-text">Show page numbers in bottom</span>
            </label>
          </div>
        </div>
      )}

      {/* ── Resizer handle between notes editor and canvas ──────────────── */}
      <div
        className="panel-resizer"
        onMouseDown={handleSidebarMouseDown}
        title="Drag border to resize notes editor"
      />

      {/* ── Main Canvas Pages Area ─────────────────────────────────────── */}
      <main className="preview-canvas-area">
        {/* Floating Zoom Bar */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: 'rgba(14, 20, 32, 0.75)',
            backdropFilter: 'var(--glass-blur)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10,
            alignSelf: 'center',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Zoom:</span>
          <button className="btn-icon" onClick={() => setPreviewZoom(z => Math.max(0.35, z - 0.12))} title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>{Math.round(previewZoom * 100)}%</span>
          <button className="btn-icon" onClick={() => setPreviewZoom(z => Math.min(1.5, z + 0.12))} title="Zoom in">
            <ZoomIn size={15} />
          </button>
          <button className="btn-icon" onClick={() => setPreviewZoom(0.85)} title="Reset zoom">
            <Maximize2 size={15} />
          </button>
          <span style={{ marginLeft: '12px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            💡 Click any clip to resize or toggle half/full width!
          </span>
        </div>

        {packedPages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '80px' }}>
            <FileText size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <h3>No Clippings Captured Yet</h3>
            <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
              Switch to the "Reader &amp; Clipper" tab to capture equations, diagrams, and definitions from your slides!
            </p>
          </div>
        ) : (
          packedPages.map(page => {
            const mmToPx = 3.7795275591 * previewZoom;
            const sw = page.width  * mmToPx;
            const sh = page.height * mmToPx;

            return (
              <div
                key={page.pageIndex}
                className="paper-page"
                style={{
                  width: `${sw}px`,
                  height: `${sh}px`,
                  background: config.pageBackground,
                  color: isDark ? '#f1f5f9' : '#1e293b',
                  position: 'relative',
                }}
                onClick={() => setSelectedClipId(null)}
              >
                {/* Printed Page Header */}
                {config.showTitle && (
                  <div
                    className="paper-header"
                    style={{
                      top: `${8 * mmToPx}px`,
                      left: `${12 * mmToPx}px`,
                      right: `${12 * mmToPx}px`,
                    }}
                  >
                    <div
                      className="paper-header-title"
                      style={{
                        fontSize: `${Math.max(10, 11 * previewZoom)}px`,
                        color: isDark ? '#f8fafc' : '#1e293b',
                      }}
                    >
                      {config.documentTitle || 'Consolidated Study Notes'}
                    </div>
                    <div
                      className="paper-header-meta"
                      style={{
                        fontSize: `${Math.max(7, 9 * previewZoom)}px`,
                        color: isDark ? '#94a3b8' : '#64748b',
                      }}
                    >
                      Page {page.pageIndex} of {packedPages.length} • {page.utilizationPercent}% density
                    </div>
                  </div>
                )}

                {/* Packed Snippets */}
                {page.items.map(item => {
                  const isSelected = selectedClipId === item.snippet.id;
                  const isThisResizing = resizingClip?.id === item.snippet.id;
                  const isThisMoving = movingClip?.id === item.snippet.id;
                  const itemWidthMm = isThisResizing ? resizingClip.widthMm : item.width;
                  const itemHeightMm = isThisResizing ? resizingClip.heightMm : item.height;
                  const itemX = isThisMoving ? movingClip.currentX : item.x;
                  const itemY = isThisMoving ? movingClip.currentY : item.y;
                  const isFull = item.snippet.colSpan === 'full' || (item.snippet.aspectRatio >= 2.5 && item.snippet.colSpan !== 'half');

                  return (
                    <div
                      key={item.snippet.id}
                      className={`paper-item ${config.showBorders ? 'has-border' : ''} ${isSelected ? 'clip-selected' : ''}`}
                      style={{
                        left:   `${itemX * mmToPx}px`,
                        top:    `${itemY * mmToPx}px`,
                        width:  `${itemWidthMm * mmToPx}px`,
                        height: `${itemHeightMm * mmToPx}px`,
                        borderColor: isDark ? 'rgba(255,255,255,0.18)' : undefined,
                      }}
                      onMouseDown={e => {
                        if (isSelected) {
                          handleMoveStart(e, item.snippet, itemX, itemY);
                        }
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedClipId(item.snippet.id);
                      }}
                    >
                      <img src={item.snippet.dataUrl} alt="Clipping" className="paper-item-img" />

                      {/* Serial Number on Configured Corner */}
                      {(config.showSerialNo ?? true) && (
                        <span
                          className={`paper-item-serial pos-${config.serialNoPosition ?? 'top-left'}`}
                          style={{
                            color: isDark ? '#a5b4fc' : undefined,
                            background: isDark ? 'rgba(15, 23, 42, 0.88)' : undefined,
                            borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : undefined,
                          }}
                        >
                          #{snippets.findIndex(s => s.id === item.snippet.id) + 1}
                        </span>
                      )}

                      {config.showSourceTags && (
                        <span
                          className="paper-item-tag"
                          style={{
                            color: isDark ? '#94a3b8' : undefined,
                            background: isDark ? 'rgba(0,0,0,0.6)' : undefined,
                          }}
                        >
                          {item.snippet.docName} (p.{item.snippet.pageNumber})
                        </span>
                      )}

                      {/* Move drag pill when selected */}
                      {isSelected && (
                        <div className="clip-move-pill">
                          Drag to move
                        </div>
                      )}

                      {/* 8-Direction Resizer Draggers when clip is selected */}
                      {isSelected && (
                        <>
                          {/* 4 Corner Draggers */}
                          <div
                            className="clip-handle-corner tl"
                            onMouseDown={e => handleResizeStart(e, item.snippet, item.width, item.height, 'tl')}
                            title="Drag to resize top-left corner"
                          />
                          <div
                            className="clip-handle-corner tr"
                            onMouseDown={e => handleResizeStart(e, item.snippet, item.width, item.height, 'tr')}
                            title="Drag to resize top-right corner"
                          />
                          <div
                            className="clip-handle-corner bl"
                            onMouseDown={e => handleResizeStart(e, item.snippet, item.width, item.height, 'bl')}
                            title="Drag to resize bottom-left corner"
                          />
                          <div
                            className="clip-handle-corner br"
                            onMouseDown={e => handleResizeStart(e, item.snippet, item.width, item.height, 'br')}
                            title="Drag to resize bottom-right corner"
                          />

                          {/* 4 Edge Draggers (Up, Down, Left, Right) */}
                          <div
                            className="clip-handle-edge t"
                            onMouseDown={e => handleResizeStart(e, item.snippet, item.width, item.height, 't')}
                            title="Drag to stretch height from top"
                          >
                            <div className="clip-handle-pill-h" />
                          </div>
                          <div
                            className="clip-handle-edge b"
                            onMouseDown={e => handleResizeStart(e, item.snippet, item.width, item.height, 'b')}
                            title="Drag to stretch height from bottom"
                          >
                            <div className="clip-handle-pill-h" />
                          </div>
                          <div
                            className="clip-handle-edge l"
                            onMouseDown={e => handleResizeStart(e, item.snippet, item.width, item.height, 'l')}
                            title="Drag to widen/stretch from left"
                          >
                            <div className="clip-handle-pill-v" />
                          </div>
                          <div
                            className="clip-handle-edge r"
                            onMouseDown={e => handleResizeStart(e, item.snippet, item.width, item.height, 'r')}
                            title="Drag to widen/stretch from right"
                          >
                            <div className="clip-handle-pill-v" />
                          </div>

                          {/* Formatting toolbar bar */}
                          <div className="clip-resize-controls" onClick={e => e.stopPropagation()}>
                            {/* Reset Dimensions & Position Button if customized */}
                            {(item.snippet.customWidth || item.snippet.customHeight || item.snippet.customX !== undefined || item.snippet.customY !== undefined) && (
                              <button
                                className="clip-resize-btn"
                                onClick={() => {
                                  if (onChangeSnippetDimensions) {
                                    onChangeSnippetDimensions(item.snippet.id, 0, 0);
                                  }
                                  if (onMoveSnippetPosition) {
                                    onMoveSnippetPosition(item.snippet.id, undefined as any, undefined as any);
                                  }
                                }}
                                title="Reset to original proportions and position"
                                style={{ width: 'auto', padding: '0 6px', fontSize: '0.65rem', borderRadius: '4px' }}
                              >
                                Reset
                              </button>
                            )}

                            {/* Width Mode Toggle (Full / Half) */}
                            <button
                              className="clip-resize-btn"
                              onClick={() => toggleColSpan(item.snippet)}
                              title={isFull ? 'Switch to Half Width (places next clip on right!)' : 'Switch to Full Width'}
                              style={{ width: 'auto', padding: '0 6px', fontSize: '0.65rem', borderRadius: '4px' }}
                            >
                              <SplitSquareVertical size={11} style={{ marginRight: '3px' }} />
                              <span>{isFull ? 'Full' : 'Half'}</span>
                            </button>

                            {/* Height / Scale Controls */}
                            <button
                              className="clip-resize-btn"
                              onClick={() => handleScaleChange(item.snippet, -0.1)}
                              title="Shorten clip"
                            >
                              <Shrink size={11} />
                            </button>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', userSelect: 'none' }}>
                              {Math.round((item.snippet.displayScale ?? 1.0) * 100)}%
                            </span>
                            <button
                              className="clip-resize-btn"
                              onClick={() => handleScaleChange(item.snippet, 0.1)}
                              title="Enlarge clip"
                            >
                              <Expand size={11} />
                            </button>

                            {/* Delete button */}
                            <button
                              className="clip-resize-btn"
                              onClick={() => onDeleteSnippet(item.snippet.id)}
                              title="Remove clipping"
                              style={{ color: 'var(--accent-rose)' }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Printed Page Footer */}
                {config.showPageNumbers && (
                  <div
                    className="paper-footer"
                    style={{ bottom: `${4 * mmToPx}px` }}
                  >
                    <span
                      className="paper-footer-page-num"
                      style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                    >
                      — Page {page.pageIndex} of {packedPages.length} —
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
};

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Trash2, Maximize2, Scissors, Trash, GripVertical, ChevronUp, ChevronDown, Volume2, VolumeX, ImagePlus } from 'lucide-react';
import type { Snippet } from '../types';

interface SnippetTrayProps {
  style?: React.CSSProperties;
  snippets: Snippet[];
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onDeleteSnippet: (id: string) => void;
  onMoveSnippet: (index: number, direction: 'up' | 'down') => void;
  onReorderSnippets: (newOrder: Snippet[]) => void;
  onClearAll: () => void;
  onOpenPreview: (snippet: Snippet) => void;
  onAddSnippet?: (snippet: Snippet) => void;
}

export const SnippetTray: React.FC<SnippetTrayProps> = ({
  style,
  snippets,
  soundEnabled = true,
  onToggleSound,
  onDeleteSnippet,
  onMoveSnippet,
  onReorderSnippets,
  onClearAll,
  onOpenPreview,
  onAddSnippet,
}) => {
  const [draggingIdx,    setDraggingIdx]    = useState<number | null>(null);
  const [overIdx,        setOverIdx]        = useState<number | null>(null);
  const [isHoveringFile, setIsHoveringFile] = useState(false);
  const dragItem     = useRef<number | null>(null);
  const listRef      = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter  = useRef<number>(0);

  // Auto-scroll to bottom whenever a new clipping is added
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [snippets.length]);

  // ── Custom Image Upload & Drag-Drop Processing ──────────────────────────
  const processImageFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f =>
      f.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(f.name)
    );
    if (imageFiles.length === 0) return;

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (!dataUrl) return;

        const img = new Image();
        img.onload = () => {
          const width = img.naturalWidth || img.width || 400;
          const height = img.naturalHeight || img.height || 300;
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          const newSnippet: Snippet = {
            id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            docId: 'custom-upload',
            docName: cleanName || 'Uploaded Image',
            pageNumber: 1,
            dataUrl,
            width,
            height,
            aspectRatio: width / (height || 1),
            timestamp: Date.now(),
            title: cleanName,
          };
          onAddSnippet?.(newSnippet);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }, [onAddSnippet]);

  // Check if dragged item from OS/external browser window is a file
  const isExternalFileDrag = (e: React.DragEvent) => {
    return e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
  };

  const handleTrayDragEnter = (e: React.DragEvent) => {
    if (isExternalFileDrag(e)) {
      e.preventDefault();
      dragCounter.current += 1;
      setIsHoveringFile(true);
    }
  };

  const handleTrayDragOver = (e: React.DragEvent) => {
    if (isExternalFileDrag(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!isHoveringFile) setIsHoveringFile(true);
    }
  };

  const handleTrayDragLeave = (e: React.DragEvent) => {
    if (isExternalFileDrag(e)) {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsHoveringFile(false);
      }
    }
  };

  const handleTrayDrop = (e: React.DragEvent) => {
    if (isExternalFileDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsHoveringFile(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processImageFiles(e.dataTransfer.files);
      }
    }
  };

  // ── Drag reorder handlers ──────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragItem.current = idx;
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    if (dragItem.current === null || dragItem.current === toIdx) return;
    const reordered = [...snippets];
    const [moved] = reordered.splice(dragItem.current, 1);
    reordered.splice(toIdx, 0, moved);
    onReorderSnippets(reordered);
    setDraggingIdx(null);
    setOverIdx(null);
    dragItem.current = null;
  }, [snippets, onReorderSnippets]);

  const onDragEnd = useCallback(() => {
    setDraggingIdx(null);
    setOverIdx(null);
    dragItem.current = null;
  }, []);

  return (
    <aside
      className="sidebar-right"
      style={style}
      onDragEnter={handleTrayDragEnter}
      onDragOver={handleTrayDragOver}
      onDragLeave={handleTrayDragLeave}
      onDrop={handleTrayDrop}
    >
      {/* Hidden file input for uploading custom image clippings */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processImageFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Hover Dropzone Overlay for hovering images onto the tray */}
      {isHoveringFile && (
        <div className="tray-hover-dropzone-overlay">
          <div className="tray-hover-dropzone-box">
            <ImagePlus size={36} className="tray-drop-bounce" style={{ color: 'var(--accent-primary)' }} />
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
              Drop Image Here!
            </div>
            <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)' }}>
              Will be added as a clipping instantly
            </div>
          </div>
        </div>
      )}

      <div className="tray-header">
        <div className="tray-stats">
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Clippings Tray</span>
          <span className="tray-count-badge">{snippets.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Upload clipping button */}
          <button
            className="btn-icon"
            onClick={() => fileInputRef.current?.click()}
            title="Upload image / clipping from your device"
            style={{
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '3px 8px',
              background: 'rgba(99, 102, 241, 0.14)',
              borderRadius: '6px',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              cursor: 'pointer',
            }}
          >
            <ImagePlus size={14} />
            <span>Upload</span>
          </button>

          {onToggleSound && (
            <button
              className="btn-icon"
              onClick={onToggleSound}
              title={soundEnabled ? 'Mute clipping sound' : 'Enable clipping sound'}
              style={{
                color: soundEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                padding: '4px',
              }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          )}
          {snippets.length > 0 && (
            <button className="btn-icon" onClick={onClearAll} title="Clear all clippings" style={{ color: 'var(--accent-rose)' }}>
              <Trash size={15} />
            </button>
          )}
        </div>
      </div>

      {snippets.length === 0 ? (
        <div className="empty-tray-state">
          <Scissors className="empty-icon" />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No Snippets Yet</div>
          <p style={{ fontSize: '0.78rem', lineHeight: '1.5' }}>
            Drag a box over any formula, diagram, or paragraph in the PDF viewer to clip it.
          </p>

          {/* Direct Upload / Hover Card */}
          <div
            className="tray-upload-card"
            onClick={() => fileInputRef.current?.click()}
            style={{
              marginTop: '16px',
              padding: '14px 10px',
              border: '1.5px dashed rgba(99,102,241,0.4)',
              borderRadius: '8px',
              background: 'rgba(99,102,241,0.06)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              textAlign: 'center',
              width: '100%',
            }}
            title="Click to browse image or drag and drop image here"
          >
            <ImagePlus size={24} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Upload or Hover Image Here
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              PNG, JPG, WebP, SVG supported
            </span>
          </div>

          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '12px' }}>
            Tip: Drag clips or use arrows to reorder them in your final notes!
          </p>
        </div>
      ) : (
        <div ref={listRef} className="snippets-list" onDragOver={e => e.preventDefault()}>
          {snippets.map((snippet, index) => (
            <div
              key={snippet.id}
              className={`snippet-card ${draggingIdx === index ? 'dragging' : ''} ${overIdx === index && draggingIdx !== index ? 'drag-over' : ''}`}
              draggable
              onDragStart={e => onDragStart(e, index)}
              onDragOver={e => onDragOver(e, index)}
              onDrop={e => onDrop(e, index)}
              onDragEnd={onDragEnd}
            >
              {/* Drag handle & reorder header */}
              <div className="snippet-drag-header">
                <div className="snippet-drag-handle" title="Drag to reorder">
                  <GripVertical size={14} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Drag to move</span>
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    className="btn-icon"
                    onClick={() => onMoveSnippet(index, 'up')}
                    disabled={index === 0}
                    title="Move earlier"
                    style={{ height: '22px', width: '22px', padding: 0 }}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => onMoveSnippet(index, 'down')}
                    disabled={index === snippets.length - 1}
                    title="Move later"
                    style={{ height: '22px', width: '22px', padding: 0 }}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              </div>

              {/* Image */}
              <div
                className="snippet-card-img-container"
                onClick={() => onOpenPreview(snippet)}
                title="Click to view full size"
              >
                <img
                  src={snippet.dataUrl}
                  alt={`Clip from ${snippet.docName} p.${snippet.pageNumber}`}
                  className="snippet-card-img"
                  loading="lazy"
                />
                <div className="snippet-card-overlay">
                  <Maximize2 size={18} style={{ opacity: 0.9 }} />
                </div>
              </div>

              {/* Footer */}
              <div className="snippet-card-footer">
                <div className="snippet-card-meta">
                  <span style={{ fontWeight: 700, color: '#a5b4fc' }}>#{index + 1}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>p.{snippet.pageNumber}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{snippet.width}×{snippet.height}</span>
                </div>
                <div className="snippet-card-actions">
                  <button className="btn-icon" onClick={() => onOpenPreview(snippet)} title="Full view">
                    <Maximize2 size={12} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => onDeleteSnippet(snippet.id)}
                    title="Delete"
                    style={{ color: 'var(--accent-rose)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

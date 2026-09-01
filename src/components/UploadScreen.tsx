import React, { useRef, useState, useCallback } from 'react';
import { Upload, FilePlus2, BookOpen, Sun, Moon, RotateCcw, Sparkles } from 'lucide-react';
import type { SavedSession } from '../services/storageService';

interface UploadScreenProps {
  onFiles: (files: File[]) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  savedSession?: SavedSession | null;
  onResumeSession?: () => void;
  onDiscardSession?: () => void;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({
  onFiles,
  theme = 'dark',
  onToggleTheme,
  savedSession,
  onResumeSession,
  onDiscardSession,
}) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );
    if (files.length > 0) onFiles(files);
  }, [onFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    e.target.value = '';
  };

  return (
    <div className="upload-screen">
      {/* Floating Theme Toggle */}
      {onToggleTheme && (
        <div style={{ position: 'absolute', top: '16px', right: '20px', zIndex: 30 }}>
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'White / Light' : 'Dark'} Theme`}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={15} style={{ color: '#f59e0b' }} />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon size={15} style={{ color: '#6366f1' }} />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Animated background orbs */}
      <div className="upload-orb upload-orb-1" />
      <div className="upload-orb upload-orb-2" />
      <div className="upload-orb upload-orb-3" />

      <div className="upload-content">
        {/* Logo + Tagline */}
        <div className="upload-hero">
          <div className="upload-logo-ring">
            <BookOpen size={40} strokeWidth={1.5} />
          </div>
          <h1 className="upload-title">PDF Notes Clipper</h1>
          <p className="upload-subtitle">
            Clip equations, diagrams &amp; definitions from lecture PDFs
            and pack them into crisp, dense study notes — automatically.
          </p>
        </div>

        {/* Restore Previous Session Banner */}
        {savedSession && savedSession.snippets.length > 0 && (
          <div className="restore-session-card">
            <div className="restore-session-info">
              <div className="restore-session-icon">
                <Sparkles size={20} />
              </div>
              <div className="restore-session-text">
                <h4>Restore Previous Session</h4>
                <p>
                  Found <strong>{savedSession.snippets.length} clipping{savedSession.snippets.length !== 1 ? 's' : ''}</strong> from your last session
                  {savedSession.activeDocName ? ` (${savedSession.activeDocName.replace(/\.pdf$/i, '')})` : ''}.
                </p>
              </div>
            </div>
            <div className="restore-session-btns">
              <button
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                onClick={onResumeSession}
                title="Resume your previous clipping notes"
              >
                <RotateCcw size={13} />
                <span>Resume Session</span>
              </button>
              <button
                className="btn-icon"
                style={{ fontSize: '0.72rem', padding: '4px 8px', height: '28px' }}
                onClick={onDiscardSession}
                title="Discard previous backup and start completely fresh"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Drop Zone */}
        <div
          className={`upload-dropzone ${dragging ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          tabIndex={0}
          role="button"
          aria-label="Click to upload PDFs or drag and drop"
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleChange}
            style={{ display: 'none' }}
            id="pdf-upload-input"
          />
          <div className="upload-dropzone-icon">
            {dragging ? <FilePlus2 size={48} /> : <Upload size={48} />}
          </div>
          <p className="upload-dropzone-primary">
            {dragging ? 'Drop PDFs here!' : 'Click to browse or drag & drop PDFs'}
          </p>
          <p className="upload-dropzone-hint">Supports multiple PDFs • Lecture notes, textbooks, slides</p>
        </div>

        {/* Feature pills */}
        <div className="upload-features">
          {['✂️ Smart Clipping', '📐 Auto-Packing', '🎨 Annotation Tools', '📄 PDF Export'].map(f => (
            <span key={f} className="upload-feature-pill">{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, BookOpen, Download, Eye, Plus, Sun, Moon, AlertTriangle, RotateCcw } from 'lucide-react';
import { UploadScreen } from './components/UploadScreen';
import { PdfViewer } from './components/PdfViewer';
import { SnippetTray } from './components/SnippetTray';
import { PackedNotesPreview } from './components/PackedNotesPreview';
import { SnippetModal } from './components/SnippetModal';
import { AiAssistant } from './components/AiAssistant';
import { calculatePackedPages } from './services/packingEngine';
import { exportNotesPdf } from './services/pdfExporter';
import { saveSessionBackup, loadSavedSession, clearSavedSession, type SavedSession } from './services/storageService';
import type { PdfDocumentInfo, Snippet, PackingConfig } from './types';

// ─── App States ───────────────────────────────────────────────────────────────
type AppView = 'upload' | 'viewer' | 'preview';

// ─── Default packing config ───────────────────────────────────────────────────
const DEFAULT_CONFIG: PackingConfig = {
  pageSize:       'a4',
  orientation:    'portrait',
  layout:         'auto',
  density:        'compact',
  showBorders:      true,
  showSourceTags:   false,
  showSerialNo:     true,
  serialNoPosition: 'top-left',
  showPageNumbers:  true,
  showTitle:        true,
  documentTitle:    'Concise Study Notes',
  pageBackground:   '#ffffff',
};

// ─── App Component ────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  const [view,          setView]          = useState<AppView>('upload');
  const [documents,     setDocuments]     = useState<PdfDocumentInfo[]>([]);
  const [activeDocId,   setActiveDocId]   = useState<string | null>(null);
  const [snippets,      setSnippets]      = useState<Snippet[]>([]);
  const [config,        setConfig]        = useState<PackingConfig>(DEFAULT_CONFIG);
  const [previewSnippet,setPreviewSnippet]= useState<Snippet | null>(null);
  const [isExporting,   setIsExporting]   = useState(false);
  const [soundEnabled,  setSoundEnabled]  = useState(true);
  const [toast,         setToast]         = useState<string | null>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // ── White Theme / Dark Theme State ──────────────────────────────────────────
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pdf_notes_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('pdf_notes_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  // ── Unsaved changes & session recovery state ────────────────────────────────
  const [isSaved, setIsSaved] = useState(true);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [savedSessionBackup, setSavedSessionBackup] = useState<SavedSession | null>(null);

  // Load any existing session backup on startup
  useEffect(() => {
    loadSavedSession().then(backup => {
      if (backup && backup.snippets && backup.snippets.length > 0) {
        setSavedSessionBackup(backup);
      }
    });
  }, []);

  // Auto-backup session to IndexedDB whenever clippings or layout config changes
  useEffect(() => {
    if (snippets.length > 0) {
      saveSessionBackup(snippets, config, documents.find(d => d.id === activeDocId)?.name);
    }
  }, [snippets, config, documents, activeDocId]);

  // Browser "Are you sure to leave without saving?" confirmation dialog on tab/window close or reload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (snippets.length > 0 && !isSaved) {
        e.preventDefault();
        e.returnValue = ''; // Standard trigger for browser confirmation popup
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [snippets.length, isSaved]);

  // ── Document page memory (remembers current page per document) ──────────────
  const [docCurrentPages, setDocCurrentPages] = useState<Record<string, number>>({});
  const activeCurrentPage = (activeDocId && docCurrentPages[activeDocId]) || 1;

  const handlePageChange = useCallback((newPage: number) => {
    if (!activeDocId) return;
    setDocCurrentPages(prev => ({ ...prev, [activeDocId]: newPage }));
  }, [activeDocId]);

  // ── Resizable Clipping Tray width ──────────────────────────────────────────
  const [trayWidth, setTrayWidth] = useState(340);
  const isDraggingTray = useRef(false);

  const handleTrayMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingTray.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startWidth = trayWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingTray.current) return;
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(650, Math.max(220, startWidth + delta));
      setTrayWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingTray.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Active document ──────────────────────────────────────────────────────────
  const activeDocument = useMemo(
    () => documents.find(d => d.id === activeDocId) ?? null,
    [documents, activeDocId]
  );

  // ── Packed pages (reactive) ──────────────────────────────────────────────────
  const packedPages = useMemo(
    () => calculatePackedPages(snippets, config),
    [snippets, config]
  );

  // ── File loading helper ──────────────────────────────────────────────────────
  const loadFiles = useCallback(async (files: File[]) => {
    const newDocs: PdfDocumentInfo[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') continue;
      try {
        const buffer = await file.arrayBuffer();
        const uint8  = new Uint8Array(buffer);
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
        GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const dataCopy = uint8.slice(0);
        const pdf = await getDocument({
          data: dataCopy,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
          wasmUrl: '/wasm/',
          enableXfa: true,
        }).promise;
        const pages = pdf.numPages;
        pdf.cleanup();
        newDocs.push({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name, size: file.size, numPages: pages,
          data: new Uint8Array(buffer),
        });
      } catch (err) {
        console.error('Failed to load PDF:', file.name, err);
        showToast(`Could not open "${file.name}" — check if it's a valid PDF.`);
      }
    }
    if (newDocs.length > 0) {
      setDocuments(prev => [...prev, ...newDocs]);
      setActiveDocId(newDocs[0].id);
      setView('viewer');
      showToast(`Loaded ${newDocs.length} PDF${newDocs.length > 1 ? 's' : ''} successfully`);
    }
  }, [showToast]);

  // ── Add more PDFs (triggered from PdfViewer toolbar) ────────────────────────
  const handleAddMore = useCallback(() => {
    addMoreInputRef.current?.click();
  }, []);

  const handleAddMoreChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) await loadFiles(files);
  };

  // ── Snippet actions (older above, recent at bottom) ───────────────────────────
  const handleCaptureSnippet = useCallback((snippet: Snippet) => {
    setSnippets(prev => [...prev, snippet]);
    setIsSaved(false);
    showToast(`Snipped slide ${snippet.pageNumber} — added to notes tray!`);
  }, [showToast]);

  const handleDeleteSnippet = useCallback((id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
    setIsSaved(false);
  }, []);

  const handleMoveSnippet = useCallback((index: number, direction: 'up' | 'down') => {
    setSnippets(prev => {
      const copy   = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= copy.length) return prev;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    setIsSaved(false);
  }, []);

  const handleClearAll = useCallback(() => {
    if (window.confirm('Remove all captured clippings?')) {
      setSnippets([]);
      setIsSaved(false);
    }
  }, []);

  const handleReorderSnippets = useCallback((newOrder: Snippet[]) => {
    setSnippets(newOrder);
    setIsSaved(false);
  }, []);

  const handleChangeSnippetScale = useCallback((id: string, scale: number) => {
    setSnippets(prev => prev.map(s => s.id === id ? { ...s, displayScale: scale } : s));
    setIsSaved(false);
  }, []);

  const handleChangeSnippetColSpan = useCallback((id: string, colSpan: 'auto' | 'full' | 'half') => {
    setSnippets(prev => prev.map(s => s.id === id ? { ...s, colSpan } : s));
    setIsSaved(false);
  }, []);

  const handleChangeSnippetDimensions = useCallback((id: string, widthMm: number, heightMm: number) => {
    setSnippets(prev => prev.map(s => s.id === id ? { ...s, customWidth: widthMm, customHeight: heightMm } : s));
    setIsSaved(false);
  }, []);

  const handleMoveSnippetPosition = useCallback((id: string, xMm: number, yMm: number) => {
    setSnippets(prev => prev.map(s => s.id === id ? { ...s, customX: xMm, customY: yMm } : s));
    setIsSaved(false);
  }, []);

  // ── Config ────────────────────────────────────────────────────────────────────
  const handleUpdateConfig = useCallback((patch: Partial<PackingConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
    setIsSaved(false);
  }, []);

  // ── Session Management (Reset, Resume, Discard) ──────────────────────────────
  const handleResetSession = useCallback(() => {
    setSnippets([]);
    setDocuments([]);
    setActiveDocId(null);
    setView('upload');
    setIsSaved(true);
    clearSavedSession();
    setSavedSessionBackup(null);
    showToast('Session cleared. Ready for new PDF documents.');
  }, [showToast]);

  const handleResumeSession = useCallback(() => {
    if (!savedSessionBackup) return;
    setSnippets(savedSessionBackup.snippets);
    if (savedSessionBackup.config) setConfig(savedSessionBackup.config);
    setView('preview');
    setIsSaved(false);
    showToast(`Resumed previous session with ${savedSessionBackup.snippets.length} clippings`);
  }, [savedSessionBackup, showToast]);

  const handleDiscardSession = useCallback(() => {
    clearSavedSession();
    setSavedSessionBackup(null);
    showToast('Previous backup discarded');
  }, [showToast]);

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    if (packedPages.length === 0) return;
    setIsExporting(true);
    try {
      await exportNotesPdf(packedPages, config);
      setIsSaved(true);
      showToast('PDF exported and downloaded!');
    } catch (err) {
      console.error(err);
      alert('Could not export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [packedPages, config, showToast]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden input for adding more PDFs */}
      <input
        ref={addMoreInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={handleAddMoreChange}
        style={{ display: 'none' }}
      />

      {/* ── Upload Screen ─────────────────────────────────────────────────── */}
      {view === 'upload' && (
        <UploadScreen
          onFiles={loadFiles}
          theme={theme}
          onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          savedSession={savedSessionBackup}
          onResumeSession={handleResumeSession}
          onDiscardSession={handleDiscardSession}
        />
      )}

      {/* ── Viewer + Preview ──────────────────────────────────────────────── */}
      {(view === 'viewer' || view === 'preview') && (
        <>
          {/* Top Navigation Bar */}
          <nav className="app-topbar">
            <div className="topbar-left">
              <div className="topbar-brand">
                <BookOpen size={20} strokeWidth={1.5} style={{ color: 'var(--accent-primary)' }} />
                <span className="topbar-brand-name">PDF Notes Clipper</span>
              </div>

              {/* Document switcher */}
              {documents.length > 0 && (
                <div className="doc-switcher">
                  <select
                    value={activeDocId ?? ''}
                    onChange={e => setActiveDocId(e.target.value)}
                    className="doc-select"
                    title="Switch active document"
                  >
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name.replace(/\.pdf$/i, '')} ({d.numPages}p)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Add PDF button placed right of the PDF dropdown option */}
              <button
                className="btn-icon add-pdf-top-btn"
                onClick={handleAddMore}
                title="Add another PDF document"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 11px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>Add PDF</span>
              </button>

              {/* New Session / Reset Button */}
              <button
                className="btn-icon add-pdf-top-btn"
                onClick={() => {
                  if (snippets.length > 0 && !isSaved) {
                    setShowLeaveConfirmModal(true);
                  } else {
                    handleResetSession();
                  }
                }}
                title="Start a new session or upload new PDFs"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <RotateCcw size={13} />
                <span>New Session</span>
              </button>
            </div>

            <div className="topbar-center">
              <div className="view-tab-group">
                <button
                  className={`view-tab ${view === 'viewer' ? 'active' : ''}`}
                  onClick={() => setView('viewer')}
                >
                  📖 Reader &amp; Clipper
                </button>
                <button
                  className={`view-tab ${view === 'preview' ? 'active' : ''}`}
                  onClick={() => setView('preview')}
                >
                  <Eye size={15} />
                  Final Notes Preview
                  {snippets.length > 0 && (
                    <span className="view-tab-badge">{snippets.length}</span>
                  )}
                </button>
              </div>
            </div>

            <div className="topbar-right">
              {/* Unsaved / Saved Status Indicator */}
              {snippets.length > 0 && (
                <div
                  className={`save-status-badge ${isSaved ? 'status-saved' : 'status-unsaved'}`}
                  title={isSaved ? 'All notes exported and saved' : 'Unsaved changes: export PDF to save notes'}
                >
                  <span className="save-status-dot" />
                  <span>{isSaved ? 'Saved' : 'Unsaved'}</span>
                </div>
              )}

              {/* White / Dark Theme Toggle */}
              <button
                className="theme-toggle-btn"
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
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

              {view === 'preview' && (
                <button
                  className="btn btn-primary"
                  onClick={handleExportPdf}
                  disabled={packedPages.length === 0 || isExporting}
                  style={{ padding: '7px 16px', fontSize: '0.82rem' }}
                >
                  {isExporting ? <><span>Generating…</span></> : <><Download size={15} /><span>Export PDF</span></>}
                </button>
              )}
            </div>
          </nav>

          {/* ── App Body: Viewer & Preview kept in DOM to preserve exact page & state ── */}
          <div
            className="app-container viewer-layout"
            style={{ display: view === 'viewer' ? 'flex' : 'none' }}
          >
            <PdfViewer
              document={activeDocument}
              currentPage={activeCurrentPage}
              onPageChange={handlePageChange}
              onCaptureSnippet={handleCaptureSnippet}
              soundEnabled={soundEnabled}
            />
            <div
              className="panel-resizer"
              onMouseDown={handleTrayMouseDown}
              title="Drag border to resize clipping tray"
            />
            <SnippetTray
              style={{ width: `${trayWidth}px` }}
              snippets={snippets}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(v => !v)}
              onAddSnippet={handleCaptureSnippet}
              onDeleteSnippet={handleDeleteSnippet}
              onMoveSnippet={handleMoveSnippet}
              onReorderSnippets={handleReorderSnippets}
              onClearAll={handleClearAll}
              onOpenPreview={setPreviewSnippet}
            />
          </div>

          <div
            className="app-container preview-fill"
            style={{ display: view === 'preview' ? 'flex' : 'none' }}
          >
            <PackedNotesPreview
              packedPages={packedPages}
              snippets={snippets}
              config={config}
              onChangeConfig={handleUpdateConfig}
              onChangeSnippetScale={handleChangeSnippetScale}
              onChangeSnippetColSpan={handleChangeSnippetColSpan}
              onChangeSnippetDimensions={handleChangeSnippetDimensions}
              onMoveSnippetPosition={handleMoveSnippetPosition}
              onMoveSnippet={handleMoveSnippet}
              onDeleteSnippet={handleDeleteSnippet}
              onExportPdf={handleExportPdf}
              isExporting={isExporting}
            />
          </div>

          {/* ── AI Assistant: Chat with your PDF ───────────────────────────── */}
          <AiAssistant activeDocument={activeDocument} />
        </>
      )}

      {/* ── Snippet Full-Res Modal ─────────────────────────────────────────── */}
      <SnippetModal snippet={previewSnippet} onClose={() => setPreviewSnippet(null)} />

      {/* ── Unsaved Changes / Leave Confirmation Modal ──────────────────────── */}
      {showLeaveConfirmModal && (
        <div className="modal-backdrop" onClick={() => setShowLeaveConfirmModal(false)}>
          <div className="unsaved-leave-card" onClick={e => e.stopPropagation()}>
            <div className="unsaved-leave-icon">
              <AlertTriangle size={28} />
            </div>
            <h3 className="unsaved-leave-title">Leave without saving?</h3>
            <p className="unsaved-leave-desc">
              You have <strong>{snippets.length} unsaved clipping{snippets.length !== 1 ? 's' : ''}</strong> in this session.
              If you leave now without exporting, your notes will not be downloaded.
            </p>
            <div className="unsaved-leave-actions">
              <div className="unsaved-leave-row">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowLeaveConfirmModal(false)}
                >
                  Keep Editing
                </button>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    await handleExportPdf();
                    setShowLeaveConfirmModal(false);
                    handleResetSession();
                  }}
                >
                  Export &amp; Leave
                </button>
              </div>
              <button
                className="btn-danger-outline"
                onClick={() => {
                  setShowLeaveConfirmModal(false);
                  handleResetSession();
                }}
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="toast-container">
          <div className="toast toast-success">
            <CheckCircle2 size={18} className="toast-icon" />
            <span>{toast}</span>
          </div>
        </div>
      )}
    </>
  );
};

export default App;

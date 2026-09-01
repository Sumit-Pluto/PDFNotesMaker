import { Scissors, Download, Sparkles, Layers, BookOpen } from 'lucide-react';
import type { Snippet, PackedPage } from '../types';

interface NavbarProps {
  activeView: 'reader' | 'preview';
  setActiveView: (view: 'reader' | 'preview') => void;
  snippets: Snippet[];
  packedPages: PackedPage[];
  onExportPdf: () => void;
  isExporting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  snippets,
  packedPages,
  onExportPdf,
  isExporting,
}) => {
  return (
    <header className="navbar">
      {/* Brand */}
      <div className="nav-brand">
        <div className="brand-icon">
          <Scissors size={20} />
        </div>
        <div className="brand-text">
          <h1>
            PDF Snipper <span className="brand-badge">Smart Packer</span>
          </h1>
        </div>
      </div>

      {/* Mode Navigation */}
      <div className="nav-center">
        <button
          className={`nav-tab ${activeView === 'reader' ? 'active' : ''}`}
          onClick={() => setActiveView('reader')}
          title="View and snip original PDF documents"
        >
          <BookOpen size={16} />
          <span>Reader & Snipper</span>
        </button>

        <button
          className={`nav-tab ${activeView === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveView('preview')}
          title="Preview the consolidated packed notes PDF"
        >
          <Layers size={16} />
          <span>Final Notes Preview</span>
          {snippets.length > 0 && (
            <span className="tab-badge">{packedPages.length} {packedPages.length === 1 ? 'Page' : 'Pages'}</span>
          )}
        </button>
      </div>

      {/* Action buttons */}
      <div className="nav-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: '#a5b4fc' }}>{snippets.length}</strong> clippings
          </span>
        </div>

        <button
          className="btn btn-primary"
          onClick={onExportPdf}
          disabled={snippets.length === 0 || isExporting}
          title={snippets.length === 0 ? 'Capture at least one snippet to export' : 'Export high-density PDF notes'}
        >
          {isExporting ? (
            <>
              <Sparkles size={16} className="spin-animation" />
              <span>Compiling PDF...</span>
            </>
          ) : (
            <>
              <Download size={16} />
              <span>Export Notes PDF</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

import React from 'react';
import { X, Download, FileText } from 'lucide-react';
import type { Snippet } from '../types';

interface SnippetModalProps {
  snippet: Snippet | null;
  onClose: () => void;
}

export const SnippetModal: React.FC<SnippetModalProps> = ({
  snippet,
  onClose,
}) => {
  if (!snippet) return null;

  const handleDownloadSnippet = () => {
    const link = document.createElement('a');
    link.href = snippet.dataUrl;
    link.download = `snippet_${snippet.docName}_p${snippet.pageNumber}.png`;
    link.click();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Snippet from {snippet.docName}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Page {snippet.pageNumber} • {snippet.width} × {snippet.height}px (High-Resolution)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={handleDownloadSnippet}
            >
              <Download size={14} />
              <span>Download PNG</span>
            </button>

            <button className="btn-icon" onClick={onClose} title="Close modal">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <img
            src={snippet.dataUrl}
            alt="Snippet full resolution"
            className="modal-image"
          />
        </div>
      </div>
    </div>
  );
};

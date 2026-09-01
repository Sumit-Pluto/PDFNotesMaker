import React, { useRef } from 'react';
import { Upload, FileText, Trash2, Plus, Files } from 'lucide-react';
import type { PdfDocumentInfo } from '../types';

interface SidebarDocumentsProps {
  documents: PdfDocumentInfo[];
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onAddDocuments: (files: FileList | File[]) => void;
  onRemoveDoc: (id: string) => void;
}

export const SidebarDocuments: React.FC<SidebarDocumentsProps> = ({
  documents,
  activeDocId,
  onSelectDoc,
  onAddDocuments,
  onRemoveDoc,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddDocuments(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddDocuments(e.dataTransfer.files);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <aside className="sidebar-left">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Files size={17} style={{ color: 'var(--accent-primary)' }} />
          <span>Documents ({documents.length})</span>
        </div>
        <button
          className="btn-icon"
          onClick={() => fileInputRef.current?.click()}
          title="Upload new PDF file"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Upload dropzone */}
      <div
        className="doc-upload-dropzone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Upload className="dropzone-icon" />
        <div className="dropzone-text">Upload PDF Documents</div>
        <div className="dropzone-subtext">Click or drag & drop one or multiple PDFs</div>
      </div>

      {/* Document List */}
      <div className="doc-list">
        {documents.map((doc) => {
          const isActive = doc.id === activeDocId;
          return (
            <div
              key={doc.id}
              className={`doc-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <div className="doc-info">
                <FileText size={18} className="doc-file-icon" />
                <div>
                  <div className="doc-name" title={doc.name}>
                    {doc.name}
                  </div>
                  <div className="doc-meta">
                    {doc.numPages} {doc.numPages === 1 ? 'page' : 'pages'} • {formatSize(doc.size)}
                  </div>
                </div>
              </div>

              <button
                className="btn-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveDoc(doc.id);
                }}
                title="Remove document"
                style={{ opacity: isActive ? 1 : 0.6 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

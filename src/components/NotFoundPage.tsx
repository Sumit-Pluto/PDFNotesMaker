import React from 'react';
import { BookOpen, FileX, Home, RefreshCw } from 'lucide-react';

interface NotFoundPageProps {
  onGoHome: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onGoHome }) => {
  return (
    <div className="not-found-page">
      {/* Floating ambient orbs */}
      <div className="not-found-orb not-found-orb-1" />
      <div className="not-found-orb not-found-orb-2" />
      <div className="not-found-orb not-found-orb-3" />

      <div className="not-found-content">
        {/* Glitching 404 Display */}
        <div className="not-found-code-wrap" aria-hidden="true">
          <span className="not-found-digit not-found-digit-4a">4</span>
          <div className="not-found-icon-ring">
            <FileX size={52} strokeWidth={1.4} style={{ color: '#a5b4fc' }} />
          </div>
          <span className="not-found-digit not-found-digit-4b">4</span>
        </div>

        {/* Text */}
        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-desc">
          Looks like this page wandered off into the void.<br />
          The route you're looking for doesn't exist in this app.
        </p>

        {/* Actions */}
        <div className="not-found-actions">
          <button
            className="btn btn-primary not-found-home-btn"
            onClick={onGoHome}
          >
            <Home size={18} />
            <span>Go Home</span>
          </button>
          <button
            className="btn btn-secondary not-found-reload-btn"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} />
            <span>Reload</span>
          </button>
        </div>

        {/* Branding */}
        <div className="not-found-branding">
          <BookOpen size={16} strokeWidth={1.5} style={{ color: 'var(--accent-primary)' }} />
          <span>PDF Notes Clipper</span>
        </div>
      </div>
    </div>
  );
};

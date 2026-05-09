import React from 'react';
import { useAppStore } from '../store';

const TopBar: React.FC = () => {
  const { toggleTerminal, togglePad, toggleNotes, toggleDraw, toggleChat, toggleTraining, isCollaborating, setCollaborating } = useAppStore();
  const showPad = useAppStore((s) => s.showPad);
  const emptyNotebook = useAppStore((s) => s.notebookCells.length === 0);
  const padBodyVisible = showPad || emptyNotebook;

  return (
    <div className="nt-top">
      <div className="nt-top-left">
        <button
          type="button"
          className="nt-top-btn logo-btn"
          id="btn-toggle-status"
          onClick={toggleTerminal}
          title="Toggle terminal"
          aria-label="Toggle terminal"
        >
          <span className="logo-cli">
            <span className="logo-cli-brand">.grok</span> <span className="logo-cli-chev">❯</span> <span className="logo-cli-tail">cli</span>
          </span>
        </button>
        <span className="badge badge-live">LIVE</span>
        <span className="nt-top-live-strip">
          {/* Live strip content */}
        </span>
      </div>
      <div className="status">
        {/* Status content */}
      </div>
      <div className="nt-top-right">
        <button
          type="button"
          className={'nt-top-btn' + (padBodyVisible ? ' active' : '')}
          id="btn-toggle-pad"
          onClick={togglePad}
          title={padBodyVisible ? 'Hide notebook pad' : 'Show notebook pad'}
          aria-label={padBodyVisible ? 'Hide notebook pad' : 'Show notebook pad'}
          aria-pressed={padBodyVisible}
        >
          + Pad
        </button>
        <button
          type="button"
          className="nt-top-btn"
          id="btn-toggle-notes"
          onClick={toggleNotes}
          title="Toggle notes panel"
          aria-label="Toggle notes panel"
        >
          +Note
        </button>
        <button
          type="button"
          className="nt-top-btn"
          id="btn-toggle-draw"
          onClick={toggleDraw}
          title="Toggle drawing tools"
          aria-label="Toggle drawing tools"
        >
          + Draw
        </button>
        <button
          type="button"
          className="nt-top-btn"
          id="btn-toggle-chat"
          onClick={toggleChat}
          title="Toggle AI chat"
          aria-label="Toggle AI chat"
        >
          + Chat
        </button>
        <button
          type="button"
          className="nt-top-btn"
          id="btn-toggle-training"
          onClick={toggleTraining}
          title="Toggle offline training"
          aria-label="Toggle offline training"
        >
          + Train
        </button>
        <button
          type="button"
          className={`nt-top-btn ${isCollaborating ? 'active' : ''}`}
          id="btn-toggle-collaboration"
          onClick={() => setCollaborating(!isCollaborating)}
          title="Developer bridge — mobile phone lab, live peer connection, and PWA install/sync. Collaboration transport when on."
          aria-label="Toggle developer bridge: mobile lab, connection, and PWA syncing"
        >
          {isCollaborating ? '🔗 Live' : '+Bridge'}
        </button>
      </div>
    </div>
  );
};

export default TopBar;
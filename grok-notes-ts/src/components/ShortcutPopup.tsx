import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';

type Mode = 'chat' | 'search' | 'note' | 'toggle-notes';

/** Tab + middle-click quick actions — matches notes.html shortcut-popup behavior. */
const ShortcutPopup: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('chat');
  const toggleNotes = useAppStore((s) => s.toggleNotes);

  useEffect(() => {
    const termInput = () => document.getElementById('term-input') as HTMLInputElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (open) return;
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (
        (!document.activeElement || document.activeElement === document.body) &&
        e.key !== 'Escape'
      ) {
        termInput()?.focus();
      }
    };

    const onKeyEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };

    const onAuxClick = (e: MouseEvent) => {
      if (e.button !== 1) return;
      if ((e.target as HTMLElement)?.closest?.('a[href]')) return;
      e.preventDefault();
      setOpen((v) => !v);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keydown', onKeyEscape);
    document.addEventListener('auxclick', onAuxClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keydown', onKeyEscape);
      document.removeEventListener('auxclick', onAuxClick);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = document.getElementById('quick-input');
    try {
      el?.focus();
    } catch {
      /* ignore */
    }
  }, [open]);

  const titles: Record<Mode, string> = {
    chat: 'Quick Chat',
    search: 'Quick Search',
    note: 'Quick Note',
    'toggle-notes': 'Quick Actions',
  };

  const placeholders: Record<Mode, string> = {
    chat: 'Type your message to Grok...',
    search: 'Search query...',
    note: 'Note content...',
    'toggle-notes': 'Action...',
  };

  const onSend = () => {
    const inp = document.getElementById('quick-input') as HTMLTextAreaElement | null;
    const msg = inp?.value?.trim();
    if (!msg) return;
    setOpen(false);
    if (mode === 'chat') {
      window.open(`https://console.x.ai?q=${encodeURIComponent(msg)}`, '_blank');
    } else if (mode === 'search') {
      window.open(`https://grokipedia.com/search?q=${encodeURIComponent(msg)}`, '_blank');
    } else if (mode === 'note') {
      useAppStore.getState().appendNotesEditorDraft(msg);
    }
    if (inp) inp.value = '';
  };

  const onQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div id="shortcut-popup" className={`shortcut-popup${open ? ' is-open' : ''}`}>
      <div className="shortcut-popup-content">
        <div className="shortcut-popup-head">
          <h4 id="popup-title">{titles[mode]}</h4>
          <button
            type="button"
            className="shortcut-popup-close"
            id="shortcut-popup-close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="quick-input-area">
          <button type="button" id="quick-send" onClick={onSend}>
            Send
          </button>
          <textarea
            id="quick-input"
            placeholder={placeholders[mode]}
            rows={3}
            onKeyDown={onQuickKeyDown}
          />
        </div>
        <div className="quick-modes">
          <button
            type="button"
            id="mode-chat"
            className={`mode-btn${mode === 'chat' ? ' active' : ''}`}
            onClick={() => setMode('chat')}
          >
            💬 Chat
          </button>
          <button
            type="button"
            id="mode-search"
            className={`mode-btn${mode === 'search' ? ' active' : ''}`}
            onClick={() => setMode('search')}
          >
            🔍 Search
          </button>
          <button
            type="button"
            id="mode-note"
            className={`mode-btn${mode === 'note' ? ' active' : ''}`}
            onClick={() => setMode('note')}
          >
            📝 Note
          </button>
          <button
            type="button"
            id="mode-toggle-notes"
            className={`mode-btn${mode === 'toggle-notes' ? ' active' : ''}`}
            onClick={() => {
              setOpen(false);
              toggleNotes();
            }}
          >
            📋 Notes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutPopup;

import React from 'react';
import { useAppStore } from '../store';
import type { NoteCard } from '../store';

/** Notes rail — matches notes.html #notes-pane: top bar (Clear All), compose bar (+ Note / + Text + editor), cards. */
const NotesDrawer: React.FC = () => {
  const showNotes = useAppStore((s) => s.showNotes);
  const notes = useAppStore((s) => s.notes);
  const notesEditorDraft = useAppStore((s) => s.notesEditorDraft);
  const setNotesEditorDraft = useAppStore((s) => s.setNotesEditorDraft);
  const addNote = useAppStore((s) => s.addNote);
  const removeNote = useAppStore((s) => s.removeNote);
  const clearNotes = useAppStore((s) => s.clearNotes);

  const pushCard = (type: 'note' | 'text') => {
    const content = notesEditorDraft.trim();
    if (!content) return;
    const note: NoteCard = { type, content };
    addNote(note);
    setNotesEditorDraft('');
  };

  const onClearAll = () => {
    if (notes.length === 0 && !notesEditorDraft.trim()) return;
    if (!window.confirm('Clear all notes and the editor?')) return;
    clearNotes();
  };

  return (
    <div className={'notes-drawer' + (showNotes ? ' open' : '')} id="notes-pane">
      <div className="nt-notes">
        <div className="nt-notes-toolbar" role="toolbar" aria-label="Notes actions">
          <button type="button" className="nt-layout-btn" id="clear-notes" title="Clear all notes" onClick={onClearAll}>
            Clear All
          </button>
        </div>
        <div className="nt-notes-compose">
          <div className="nt-notes-compose-actions" role="toolbar" aria-label="Add from editor">
            <button type="button" className="nt-layout-btn" id="add-note-card" title="Add note" onClick={() => pushCard('note')}>
              + Note
            </button>
            <button type="button" className="nt-layout-btn" id="add-text-card" title="Add text" onClick={() => pushCard('text')}>
              + Text
            </button>
          </div>
          <textarea
            className="nt-notes-editor"
            id="notes-editor"
            placeholder="Type your notes here..."
            value={notesEditorDraft}
            onChange={(e) => setNotesEditorDraft(e.target.value)}
          />
        </div>
        <div className="nt-notes-cards" id="notes-cards">
          {notes.map((note, index) => (
            <div key={index} className="nt-note-card">
              <div className="nt-note-card-hd">
                <strong className="nt-note-card-label">{note.type}:</strong>
                <button
                  type="button"
                  className="nt-note-card-dismiss"
                  aria-label="Remove this note"
                  title="Remove"
                  onClick={() => removeNote(index)}
                >
                  ×
                </button>
              </div>
              <div className="nt-note-card-body">{note.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotesDrawer;

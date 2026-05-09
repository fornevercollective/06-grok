import { useAppStore } from './store';

describe('App Store', () => {
  it('should initialize with default state', () => {
    const { terminalHistory, showPad, showNotes, showGames, showBrowserToolbar } = useAppStore.getState();
    expect(terminalHistory).toEqual([]);
    expect(showPad).toBe(true);
    expect(showNotes).toBe(false);
    expect(showGames).toBe(false);
    expect(showBrowserToolbar).toBe(true);
  });

  it('should toggle pad when the notebook has cells', () => {
    useAppStore.getState().addNotebookCell({
      id: 'cell-test',
      type: 'markdown',
      content: 'x',
    });
    const { togglePad } = useAppStore.getState();
    expect(useAppStore.getState().showPad).toBe(true);
    togglePad();
    expect(useAppStore.getState().showPad).toBe(false);
    togglePad();
    expect(useAppStore.getState().showPad).toBe(true);
  });

  it('should keep pad open when the notebook is empty', () => {
    useAppStore.setState({ notebookCells: [], showPad: false });
    useAppStore.getState().togglePad();
    expect(useAppStore.getState().showPad).toBe(true);
  });

  it('should add a note', () => {
    const { addNote } = useAppStore.getState();
    const note = { type: 'note' as const, content: 'Test note' };
    addNote(note);
    expect(useAppStore.getState().notes).toContain(note);
  });
});
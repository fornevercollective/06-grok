import { create } from 'zustand';

export interface NoteCard {
  type: 'note' | 'text';
  content: string;
}

export interface NotebookCell {
  id: string;
  type: 'markdown' | 'code' | 'math';
  content: string;
  output?: string;
  /** Set when output is from a thrown code-cell error (styling). */
  outputIsError?: boolean;
}

export interface TerminalHistory {
  command: string;
  output: string;
  timestamp: number;
}

export interface AppState {
  // Terminal
  terminalHistory: TerminalHistory[];
  terminalInput: string;
  terminalActive: boolean;

  // Notebook
  notebookCells: NotebookCell[];
  activeCell: string | null;

  // Notes
  notes: NoteCard[];
  /** Footer notes panel textarea (synced for ShortcutPopup append). */
  notesEditorDraft: string;

  // Draw
  drawStrokes: any[];
  drawView: { ox: number; oy: number; sc: number };
  drawStrokeWidth: number;

  // ML
  mlModels: { name: string; model: any }[];
  trainingData: any[];
  isTraining: boolean;

  // UI Toggles
  showPad: boolean;
  showNotes: boolean;
  showDraw: boolean;
  showLive: boolean;
  showTerminal: boolean;
  showChat: boolean;
  showTraining: boolean;
  grokipediaActive: boolean;
   currentBrand: string;
  /** Footer grid selected “Live” modality (messaging chrome); does not toggle the +Live hexcast overlay. */
  footerLiveEmbed: boolean;
  /** Pinterest-style infinite image wall (Files modality). */
  showFileWall: boolean;
  /** +Games / uvspeed overlay (#nt-games-hexcast). */
  showGames: boolean;
  /** Empty notebook: show Browser Web address bar row (nb-browser-hd). */
  showBrowserToolbar: boolean;

  /** +Bridge: dev bridge / mobile lab / PWA sync — collaboration transport on */
  isCollaborating: boolean;
  peers: string[];
  liveCursors: { [peerId: string]: { x: number; y: number; user: string } };

  // Actions
  addTerminalHistory: (history: TerminalHistory) => void;
  setTerminalInput: (input: string) => void;
  addNotebookCell: (cell: NotebookCell) => void;
  updateNotebookCell: (id: string, updates: Partial<NotebookCell>) => void;
  clearNotebookCells: () => void;
  setActiveCell: (id: string | null) => void;
  addNote: (note: NoteCard) => void;
  removeNote: (index: number) => void;
  clearNotes: () => void;
  setNotesEditorDraft: (value: string) => void;
  appendNotesEditorDraft: (fragment: string) => void;
  setDrawStrokes: (strokes: any[]) => void;
  setDrawView: (view: { ox: number; oy: number; sc: number }) => void;
  setDrawStrokeWidth: (width: number) => void;
  togglePad: () => void;
  toggleNotes: () => void;
  toggleDraw: () => void;
  toggleLive: () => void;
  toggleTerminal: () => void;
  toggleChat: () => void;
  toggleTraining: () => void;
  setGrokipediaActive: (active: boolean) => void;
  setCurrentBrand: (brand: string) => void;
  setFooterLiveEmbed: (active: boolean) => void;
  toggleFileWall: () => void;
  setFileWall: (open: boolean) => void;
  setShowGames: (open: boolean) => void;
  toggleGames: () => void;
  toggleBrowserToolbar: () => void;

  // ML actions
  addMLModel: (name: string, model: any) => void;
  removeMLModel: (name: string) => void;
  setTrainingData: (data: any[]) => void;
  setIsTraining: (training: boolean) => void;

  // Collaboration actions
  setCollaborating: (collaborating: boolean) => void;
  addPeer: (peerId: string) => void;
  removePeer: (peerId: string) => void;
  updateCursor: (peerId: string, cursor: { x: number; y: number; user: string }) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  terminalHistory: [],
  terminalInput: '',
  terminalActive: true,
  notebookCells: [],
  activeCell: null,
  notes: [],
  notesEditorDraft: '',
  drawStrokes: [],
  drawView: { ox: 0, oy: 0, sc: 1 },
  drawStrokeWidth: 2,
  showPad: true,
  showNotes: false,
  showDraw: false,
  showLive: false,
  showTerminal: true,
  showChat: false,
  showTraining: false,
  grokipediaActive: false,
  currentBrand: "grok",
  footerLiveEmbed: false,
  showFileWall: false,
  showGames: false,
  showBrowserToolbar: true,

  // ML
  mlModels: [],
  trainingData: [],
  isTraining: false,

  // +Bridge (collaboration transport)
  isCollaborating: false,
  peers: [],
  liveCursors: {},

  // Actions
  addTerminalHistory: (history) =>
    set((state) => ({ terminalHistory: [...state.terminalHistory, history] })),
  setTerminalInput: (input) => set({ terminalInput: input }),
  addNotebookCell: (cell) =>
    set((state) => ({ notebookCells: [...state.notebookCells, cell] })),
  updateNotebookCell: (id, updates) =>
    set((state) => ({
      notebookCells: state.notebookCells.map((cell) =>
        cell.id === id ? { ...cell, ...updates } : cell
      ),
    })),
  clearNotebookCells: () => set({ notebookCells: [] }),
  setActiveCell: (id) => set({ activeCell: id }),
  addNote: (note) =>
    set((state) => ({ notes: [...state.notes, note] })),
  removeNote: (index) =>
    set((state) => ({ notes: state.notes.filter((_, i) => i !== index) })),
  clearNotes: () => set({ notes: [], notesEditorDraft: '' }),
  setNotesEditorDraft: (notesEditorDraft) => set({ notesEditorDraft }),
  appendNotesEditorDraft: (fragment) =>
    set((state) => ({
      notesEditorDraft: state.notesEditorDraft
        ? `${state.notesEditorDraft}\n${fragment}`
        : fragment,
    })),
  setDrawStrokes: (strokes) => set({ drawStrokes: strokes }),
  setDrawView: (view) => set({ drawView: view }),
  setDrawStrokeWidth: (width) => set({ drawStrokeWidth: width }),
  /** Match notes.html: pad body stays visible with no cells (browser column); keep store consistent. */
  togglePad: () =>
    set((state) => {
      if (state.notebookCells.length === 0) {
        return { showPad: true };
      }
      return { showPad: !state.showPad };
    }),
  toggleNotes: () => set((state) => ({ showNotes: !state.showNotes })),
  toggleDraw: () => set((state) => ({ showDraw: !state.showDraw })),
  toggleLive: () => set((state) => ({ showLive: !state.showLive })),
  toggleTerminal: () => set((state) => ({ showTerminal: !state.showTerminal })),
  toggleChat: () => set((state) => ({ showChat: !state.showChat })),
  toggleTraining: () => set((state) => ({ showTraining: !state.showTraining })),
  setGrokipediaActive: (active) => set({ grokipediaActive: active }),
  setCurrentBrand: (brand) => set({ currentBrand: brand }),
  setFooterLiveEmbed: (active) => set({ footerLiveEmbed: active }),
  toggleFileWall: () => set((state) => ({ showFileWall: !state.showFileWall })),
  setFileWall: (open) => set({ showFileWall: open }),
  setShowGames: (open) => set({ showGames: open }),
  toggleGames: () => set((state) => ({ showGames: !state.showGames })),
  toggleBrowserToolbar: () => set((state) => ({ showBrowserToolbar: !state.showBrowserToolbar })),

  // ML actions
  addMLModel: (name, model) =>
    set((state) => ({ mlModels: [...state.mlModels, { name, model }] })),
  removeMLModel: (name) =>
    set((state) => ({ mlModels: state.mlModels.filter((m) => m.name !== name) })),
  setTrainingData: (data) => set({ trainingData: data }),
  setIsTraining: (training) => set({ isTraining: training }),

  // Collaboration actions
  setCollaborating: (collaborating) => set({ isCollaborating: collaborating }),
  addPeer: (peerId) =>
    set((state) => ({ peers: [...state.peers, peerId] })),
  removePeer: (peerId) =>
    set((state) => ({ peers: state.peers.filter((id) => id !== peerId) })),
  updateCursor: (peerId, cursor) =>
    set((state) => ({
      liveCursors: { ...state.liveCursors, [peerId]: cursor },
    })),
}));
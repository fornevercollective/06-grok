import Dexie from 'dexie';
import { useAppStore } from '../store';

class OfflineDB extends Dexie {
  notes!: Dexie.Table<any, number>;
  notebookCells!: Dexie.Table<any, number>;
  syncQueue!: Dexie.Table<any, number>;

  constructor() {
    super('GrokNotesDB');
    this.version(1).stores({
      notes: '++id, content, timestamp, synced',
      notebookCells: '++id, cellId, content, type, timestamp, synced',
      syncQueue: '++id, action, data, timestamp',
    });

    // Initialize tables
    this.notes = this.table('notes');
    this.notebookCells = this.table('notebookCells');
    this.syncQueue = this.table('syncQueue');
  }
}

export class OfflineSyncService {
  private db = new OfflineDB();
  private isOnline = navigator.onLine;

  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async saveNoteOffline(note: any): Promise<void> {
    await this.db.notes.add({
      ...note,
      timestamp: Date.now(),
      synced: 0,
    });
  }

  async saveNotebookCellOffline(cell: any): Promise<void> {
    await this.db.notebookCells.add({
      ...cell,
      timestamp: Date.now(),
      synced: 0,
    });
  }

  async queueAction(action: string, data: any): Promise<void> {
    await this.db.syncQueue.add({
      action,
      data,
      timestamp: Date.now(),
    });
  }

  async syncToServer(): Promise<void> {
    if (!this.isOnline) return;

    // Sync notes
    const unsyncedNotes = await this.db.notes.where('synced').equals(0).toArray();
    for (const note of unsyncedNotes) {
      try {
        // Simulate API call
        await this.simulateApiCall('POST', '/api/notes', note);
        await this.db.notes.update(note.id!, { synced: 1 });
      } catch (error) {
        console.error('Failed to sync note:', error);
      }
    }

    // Sync notebook cells
    const unsyncedCells = await this.db.notebookCells.where('synced').equals(0).toArray();
    for (const cell of unsyncedCells) {
      try {
        await this.simulateApiCall('POST', '/api/cells', cell);
        await this.db.notebookCells.update(cell.id!, { synced: 1 });
      } catch (error) {
        console.error('Failed to sync cell:', error);
      }
    }

    // Process sync queue
    const queue = await this.db.syncQueue.toArray();
    for (const item of queue) {
      try {
        await this.simulateApiCall('POST', '/api/actions', item);
        await this.db.syncQueue.delete(item.id!);
      } catch (error) {
        console.error('Failed to sync action:', error);
      }
    }
  }

  private async simulateApiCall(method: string, url: string, data: any): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`${method} ${url}`, data);
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.syncToServer();
  }

  private handleOffline(): void {
    this.isOnline = false;
  }

  async loadOfflineData(): Promise<void> {
    const notes = await this.db.notes.toArray();
    const cells = await this.db.notebookCells.toArray();

    // Load into store
    const store = useAppStore.getState();
    notes.forEach(note => store.addNote(note));
    cells.forEach(cell => store.addNotebookCell(cell));
  }
}

export const offlineSyncService = new OfflineSyncService();
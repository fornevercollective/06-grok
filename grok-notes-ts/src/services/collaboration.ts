import { useAppStore } from '../store';

/**
 * Collaboration transport backing the +Bridge control: dev bridge / mobile-lab pairing,
 * peer sync hooks, and future PWA/offline handoff. WebRTC slots reserved; signaling TBD.
 */
export class CollaborationService {
  private peers = new Map<string, { destroy: () => void; send: (data: string) => void }>();

  async startCollaboration(roomId: string): Promise<void> {
    // For demo purposes, we'll simulate peer connections
    // In a real app, this would connect to a signaling server
    useAppStore.getState().setCollaborating(true);
    console.log(`Starting collaboration in room: ${roomId}`);
  }

  stopCollaboration(): void {
    this.peers.forEach((peer) => peer.destroy());
    this.peers.clear();
    useAppStore.getState().setCollaborating(false);
  }

  sendData(peerId: string, data: any): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.send(JSON.stringify(data));
    }
  }

  broadcastData(data: any): void {
    this.peers.forEach((peer) => {
      peer.send(JSON.stringify(data));
    });
  }

  // Simulate adding a peer for demo
  addDemoPeer(): void {
    const demoPeerId = 'demo-peer-' + Math.random().toString(36).substr(2, 4);
    useAppStore.getState().addPeer(demoPeerId);

    // Simulate cursor updates
    setInterval(() => {
      const cursor = {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        user: 'Demo User',
      };
      useAppStore.getState().updateCursor(demoPeerId, cursor);
    }, 1000);
  }

  // Handle notebook cell changes
  onNotebookCellUpdate(cellId: string, updates: any): void {
    this.broadcastData({
      type: 'notebook-update',
      cellId,
      updates,
      timestamp: Date.now(),
    });
  }

  // Handle cursor position updates
  onCursorMove(x: number, y: number): void {
    this.broadcastData({
      type: 'cursor-move',
      x,
      y,
      user: 'Local User',
      timestamp: Date.now(),
    });
  }

  // Conflict resolution (simple last-writer-wins)
  resolveConflict(localVersion: number, remoteVersion: number, remoteData: any): any {
    if (remoteVersion > localVersion) {
      return remoteData;
    }
    return null; // Keep local version
  }
}

export const collaborationService = new CollaborationService();
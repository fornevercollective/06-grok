/**
 * Screen / image capture → notebook markdown + optional background vision analysis
 * (grok-notes-backend POST /api/ai/chat-multimodal, Ollama llava when offline).
 */

import { useAppStore } from '../store';
import { getBackendBaseUrl } from './liveBackend';

export function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf('base64,');
  if (i >= 0) return dataUrl.slice(i + 7);
  return dataUrl;
}

/** Pick a window/tab/screen; returns one video frame as PNG data URL. */
export async function captureScreenToPngDataUrl(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
    console.warn('[capture] getDisplayMedia not available');
    return null;
  }
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch {
    return null;
  }
  if (!stream) return null;

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  try {
    await video.play();
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }

  await new Promise<void>((resolve) => {
    if (video.videoWidth > 0) {
      resolve();
      return;
    }
    video.onloadeddata = () => resolve();
    setTimeout(resolve, 800);
  });

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const canvas = document.createElement('canvas');
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }
  ctx.drawImage(video, 0, 0, vw, vh);
  stream.getTracks().forEach((t) => t.stop());
  video.srcObject = null;

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function analyzeImageInBackground(base64: string, caption: string): Promise<void> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/ai/chat-multimodal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message:
        'Describe this screenshot: visible text, layout, and main subject. List any headings or numbers you can read. Then suggest 2 short follow-up questions. Be concise.',
      image: base64,
      offline: true,
      model: 'llava',
    }),
  });
  const data = (await res.json()) as { response?: string; error?: string };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  const text = typeof data.response === 'string' ? data.response.trim() : '';
  if (!text) return;
  useAppStore.getState().addNotebookCell({
    id: `cell-analysis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: 'markdown',
    content: `### Background analysis\n\n${text}\n\n_(${caption})_`,
  });
}

export type InsertCaptureOptions = {
  /** Run vision model when backend + Ollama (llava) available */
  analyze?: boolean;
  /** Short label for headings */
  caption?: string;
};

/** Adds a markdown cell with embedded image; optionally shows pad and queues analysis. */
export function insertCaptureIntoNotebook(
  dataUrl: string,
  opts?: InsertCaptureOptions
): void {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return;
  const caption = opts?.caption?.trim() || 'Screen capture';
  const id = `cell-cap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const stamp = new Date().toLocaleString();
  const body = `### ${caption}\n\n![capture](${dataUrl})\n\n_${stamp}_`;
  useAppStore.getState().addNotebookCell({ id, type: 'markdown', content: body });
  const s = useAppStore.getState();
  if (!s.showPad) s.togglePad();

  if (opts?.analyze) {
    const b64 = dataUrlToBase64(dataUrl);
    void analyzeImageInBackground(b64, caption).catch((e) => {
      console.warn('[capture] analysis failed', e);
      useAppStore.getState().addNotebookCell({
        id: `cell-analysis-err-${Date.now()}`,
        type: 'markdown',
        content: `_Background analysis failed: ${e instanceof Error ? e.message : String(e)}. Start **grok-notes-backend** and Ollama with a vision model (e.g. llava)._`,
      });
    });
  }
}

/**
 * grok-notes-backend base URL (captions proxy, etc.). Override with VITE_BACKEND_URL.
 * Vite inlines `process.env.VITE_BACKEND_URL` via define; Jest reads from setupTests.
 */

export function getBackendBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.VITE_BACKEND_URL) {
    const u = String(process.env.VITE_BACKEND_URL).trim().replace(/\/$/, '');
    if (u) return u;
  }
  return 'http://localhost:3000';
}

export async function fetchYoutubeTranscriptFromBackend(
  videoId: string,
  lang = 'en'
): Promise<{ text: string; source: string }> {
  const base = getBackendBaseUrl();
  const url = `${base}/api/youtube-transcript?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`;
  const res = await fetch(url);
  const data = (await res.json()) as { error?: string; text?: string; source?: string };
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return { text: data.text ?? '', source: data.source ?? 'youtube' };
}

export async function fetchYoutubeTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);
    const data = await res.json();
    return data.title || 'Unknown Title';
  } catch {
    return 'Unknown Title';
  }
}

/** Resolve pasted URLs into embeddable iframe or <video> sources (+Live Studio viewer). */

export type GrokipediaVideoKind = 'iframe' | 'video';

export interface GrokipediaVideoItem {
  kind: GrokipediaVideoKind;
  src: string;
}

function tryUrl(raw: string): URL | null {
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

/** Turn a single line into an embeddable video/iframe src, or null if unsupported. */
export function parseGrokipediaVideoLine(raw: string): GrokipediaVideoItem | null {
  const parsed = tryUrl(raw);
  if (!parsed) return null;

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = parsed.searchParams.get('v');
    if (v) {
      return { kind: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(v)}` };
    }
    const embed = parsed.pathname.match(/^\/embed\/([^/?]+)/);
    if (embed) {
      return { kind: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(embed[1])}` };
    }
    const shortPath = parsed.pathname.match(/^\/shorts\/([^/?]+)/);
    if (shortPath) {
      return { kind: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(shortPath[1])}` };
    }
  }

  if (host === 'youtu.be') {
    const id = parsed.pathname.replace(/^\//, '').split('/')[0];
    if (id) {
      return { kind: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}` };
    }
  }

  if (host === 'vimeo.com') {
    const id = parsed.pathname.match(/^\/(\d+)/);
    if (id) {
      return { kind: 'iframe', src: `https://player.vimeo.com/video/${id[1]}` };
    }
  }

  if (host === 'player.vimeo.com') {
    const id = parsed.pathname.match(/\/video\/(\d+)/);
    if (id) {
      return { kind: 'iframe', src: `https://player.vimeo.com/video/${id[1]}` };
    }
  }

  const xStatus = xStatusIdFromStatusUrl(parsed);
  if (xStatus) {
    return { kind: 'iframe', src: tweetEmbedSrc(xStatus, 'light') };
  }

  const path = parsed.pathname.toLowerCase();
  if (/\.(mp4|webm|ogg|ogv)(\?.*)?$/i.test(path)) {
    return { kind: 'video', src: parsed.href };
  }

  return null;
}

/** x.com / twitter.com status URL → numeric status id, or null. */
function xStatusIdFromStatusUrl(parsed: URL): string | null {
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'x.com' && host !== 'twitter.com' && host !== 'mobile.twitter.com') {
    return null;
  }
  const m =
    parsed.pathname.match(/^\/[^/]+\/status\/(\d+)/) ?? parsed.pathname.match(/^\/i\/status\/(\d+)/);
  return m ? m[1] : null;
}

/** Split a paste box into candidate URL lines. Supports `{…}`, `{{…}}`, and nested peels; then whitespace/brace token split. */
export function splitGrokipediaVideoPaste(text: string): string[] {
  let t = text.trim();
  while (t.length >= 2 && t.startsWith('{') && t.endsWith('}')) {
    t = t.slice(1, -1).trim();
  }
  return t
    .split(/[\r\n\s,;{}<>]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** YouTube embed URL → video id, or null if not a YouTube embed. */
export function youtubeVideoIdFromEmbedSrc(src: string): string | null {
  const m = src.match(/youtube\.com\/embed\/([^/?&]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export type TweetEmbedTheme = 'light' | 'dark';

/** Official Tweet embed URL for a status id (X / Twitter). */
export function tweetEmbedSrc(statusId: string, theme: TweetEmbedTheme = 'light'): string {
  const q = new URLSearchParams({ id: statusId, theme });
  return `https://platform.twitter.com/embed/Tweet.html?${q.toString()}`;
}

/** Twitter/X Tweet embed iframe → status id, or null. */
export function xTweetIdFromEmbedSrc(src: string): string | null {
  try {
    const u = new URL(src);
    if (!/platform\.twitter\.com$/i.test(u.hostname.replace(/^www\./, ''))) return null;
    if (!/^\/embed\/Tweet\.html$/i.test(u.pathname)) return null;
    const id = u.searchParams.get('id');
    return id && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Stable key for de-duplicating wall entries (YouTube by video id, else full src). */
export function liveVideoDedupeKey(embedOrDirectSrc: string): string {
  const y = youtubeVideoIdFromEmbedSrc(embedOrDirectSrc);
  if (y) return `yt:${y}`;
  const x = xTweetIdFromEmbedSrc(embedOrDirectSrc);
  if (x) return `x:${x}`;
  return embedOrDirectSrc;
}

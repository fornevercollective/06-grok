/**
 * Resolve URLs for uvspeed `web/` HTML apps (games hub, Go lab, etc.).
 * Avoid embedding `file://` — browsers often block file→file iframes; prefer HTTP or same-origin.
 */

/** Inlined by Vite `define` + readable in Jest via `setupTests.ts`. */
function viteUvspeedFromEnv(): string {
  const v = process.env.VITE_UVSPEED_WEB_BASE;
  return typeof v === 'string' ? v.trim() : '';
}

export function getUvspeedWebBase(): string {
  if (typeof window !== 'undefined') {
    const w = window as Window & { __UVSPEED_WEB_BASE__?: string };
    const run = w.__UVSPEED_WEB_BASE__?.trim();
    if (run) return run.endsWith('/') ? run : `${run}/`;
    /** Parity with notes.html: `<html data-uvspeed-web="https://…/uvspeed/web/">` */
    const data = document.documentElement?.getAttribute('data-uvspeed-web')?.trim();
    if (data) return data.endsWith('/') ? data : `${data}/`;
  }
  const env = viteUvspeedFromEnv();
  if (env) return env.endsWith('/') ? env : `${env}/`;
  return 'https://console.x.ai/';
}

/** True when the app is on `file:` and the target URL is also `file:` — browser often blocks nested iframes. */
export function uvspeedEmbedBlocked(pageUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const u = new URL(pageUrl);
    return window.location.protocol === 'file:' && u.protocol === 'file:';
  } catch {
    return true;
  }
}

/** Absolute URL for a page under the uvspeed web root (e.g. `games-ugrad-hub.html`). */
export function uvspeedPageUrl(file: string): string {
  const name = file.replace(/^\//, '');
  const base = getUvspeedWebBase();
  if (base) {
    try {
      return new URL(name, base).href;
    } catch {
      return `${base}${name}`;
    }
  }
  if (typeof window !== 'undefined') {
    try {
      return new URL(name, window.location.href).href;
    } catch {
      /* fall through */
    }
  }
  return name;
}

/** Games hub only: explicit override wins, then Vite base + path. */
export function gamesHubIframeUrl(): string {
  if (typeof window !== 'undefined') {
    const w = window as Window & { __GROK_GAMES_HUB__?: string };
    const hub = w.__GROK_GAMES_HUB__?.trim();
    if (hub) return hub;
  }
  return uvspeedPageUrl('games-ugrad-hub.html');
}

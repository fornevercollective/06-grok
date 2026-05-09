/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for uvspeed `web/` (trailing slash optional), e.g. http://127.0.0.1:8080/ */
  readonly VITE_UVSPEED_WEB_BASE?: string;
  /** grok-notes-backend (YouTube captions API, etc.), no trailing slash */
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Minimal for `process.env.VITE_*` (Vite `define` + Jest); avoids pulling full `@types/node` into the client graph. */
declare const process: {
  env: {
    VITE_UVSPEED_WEB_BASE?: string;
    [key: string]: string | undefined;
  };
};

declare global {
  interface Window {
    /** e.g. http://127.0.0.1:8080/ — overrides `VITE_UVSPEED_WEB_BASE` */
    __UVSPEED_WEB_BASE__?: string;
    /** Single full URL for games hub iframe (footer + optional tooling) */
    __GROK_GAMES_HUB__?: string;
    /** Set when Maps JavaScript API loads (TeslaMap, etc.) */
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
        Marker: new (opts: Record<string, unknown>) => void;
      };
    };
  }
}

export {};

/** Parent ↔ embedded ugrad-r0.html — same-origin: `click()` / `window.ugradExec`; cross-origin: `postMessage`. */

export const UGRAD_EMBED_MSG_SOURCE = 'grok-notes-embed' as const;

export type UgradEmbedPayload = { action: 'hdr'; id: string } | { action: 'cmd'; text: string };

export function sendToUgradIframe(iframe: HTMLIFrameElement | null, msg: UgradEmbedPayload): void {
  if (!iframe?.contentWindow) return;
  try {
    const win = iframe.contentWindow as Window & { ugradExec?: (line: string) => void };
    const doc = iframe.contentDocument;
    if (doc && msg.action === 'hdr') {
      doc.getElementById(msg.id)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return;
    }
    if (msg.action === 'cmd' && typeof win.ugradExec === 'function') {
      win.ugradExec(msg.text);
      return;
    }
  } catch {
    /* cross-origin */
  }
  iframe.contentWindow.postMessage({ source: UGRAD_EMBED_MSG_SOURCE, ...msg }, '*');
}

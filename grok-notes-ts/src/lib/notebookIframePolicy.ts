/**
 * Sites that send CSP `frame-ancestors` (or similar) so they cannot load inside an iframe
 * from another origin. Extend this list as needed — many major apps block embedding.
 */
const IFRAME_DENY_HOST_SUFFIXES = [
  'grokipedia.com',
  'console.x.ai',
  'x.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'google.com',
  'accounts.google.com',
  'github.com',
  'openai.com',
  'chatgpt.com',
];

function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

export function hostBlocksIframeEmbedding(hostname: string): boolean {
  const h = normalizeHost(hostname);
  return IFRAME_DENY_HOST_SUFFIXES.some((s) => h === s || h.endsWith('.' + s));
}

/** True when we should not set iframe src (avoids CSP console errors). */
export function urlBlocksIframeEmbedding(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
    return hostBlocksIframeEmbedding(u.hostname);
  } catch {
    return true;
  }
}

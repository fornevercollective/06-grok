/** Footer quick-chat transforms — Morse / hex / base64 / rot13 + jawta BroadcastChannel hooks. */

const MORSE_TO_CHAR: Record<string, string> = {
  '.-': 'A',
  '-...': 'B',
  '-.-.': 'C',
  '-..': 'D',
  '.': 'E',
  '..-.': 'F',
  '--.': 'G',
  '....': 'H',
  '..': 'I',
  '.---': 'J',
  '-.-': 'K',
  '.-..': 'L',
  '--': 'M',
  '-.': 'N',
  '---': 'O',
  '.--.': 'P',
  '--.-': 'Q',
  '.-.': 'R',
  '...': 'S',
  '-': 'T',
  '..-': 'U',
  '...-': 'V',
  '.--': 'W',
  '-..-': 'X',
  '-.--': 'Y',
  '--..': 'Z',
  '-----': '0',
  '.----': '1',
  '..---': '2',
  '...--': '3',
  '....-': '4',
  '.....': '5',
  '-....': '6',
  '--...': '7',
  '---..': '8',
  '----.': '9',
};
const CHAR_TO_MORSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_TO_CHAR).map(([k, v]) => [v, k])
);

export function textToHexUtf8(s: string): string {
  return [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

export function hexToTextUtf8(hex: string): string {
  let clean = hex.replace(/[\s:]/g, '');
  if (clean.length % 2 !== 0) clean = '0' + clean;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(out);
}

export function textToMorse(s: string): string {
  const u = s.toUpperCase();
  const parts: string[] = [];
  for (const ch of u) {
    if (ch === ' ') {
      parts.push('/');
      continue;
    }
    const m = CHAR_TO_MORSE[ch];
    if (m) parts.push(m);
  }
  return parts.join(' ');
}

export function morseToText(m: string): string {
  const words = m.trim().split(/\s*\/\s*/);
  const out: string[] = [];
  for (const w of words) {
    if (!w.trim()) continue;
    const letters = w.trim().split(/\s+/);
    for (const letter of letters) {
      const c = MORSE_TO_CHAR[letter];
      if (c) out.push(c);
    }
    out.push(' ');
  }
  return out.join('').trimEnd();
}

export function utf8ToBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

export function base64ToUtf8(s: string): string {
  const t = s.replace(/\s+/g, '');
  return decodeURIComponent(escape(atob(t)));
}

export function rot13(s: string): string {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode((((c.charCodeAt(0) - base + 13) % 26) + base) as number);
  });
}

export type JawtaBurstPayload = { type: string; t: number; body: string; bytes: number };

export function emitJawtaBurst(body: string, channels: readonly string[] = ['hexterm', 'jawta']): void {
  const bytes = new TextEncoder().encode(body).length;
  const payload: JawtaBurstPayload = { type: 'jawta-burst', t: Date.now(), body, bytes };
  for (const name of channels) {
    try {
      const bc = new BroadcastChannel(name);
      bc.postMessage(payload);
      bc.close();
    } catch {
      /* ignore */
    }
  }
}

export function emitJawtaPulse(): void {
  const payload = { type: 'jawta-pulse', t: Date.now() };
  for (const name of ['hexterm', 'jawta'] as const) {
    try {
      const bc = new BroadcastChannel(name);
      bc.postMessage(payload);
      bc.close();
    } catch {
      /* ignore */
    }
  }
}

/** Append one line to the main Grok terminal (`#term-output`) — quick-chat “transmit” / bridge echo. */
export function transmitLine(text: string): void {
  const term = document.getElementById('term-output');
  if (!term) return;
  const row = document.createElement('div');
  row.className = 'ln';
  const tag = document.createElement('span');
  tag.className = 'c-info';
  tag.textContent = 'tx ';
  const body = document.createElement('span');
  body.textContent = text;
  row.appendChild(tag);
  row.appendChild(body);
  term.appendChild(row);
  term.scrollTop = term.scrollHeight;
}

/** Mesh / peer sync — BroadcastChannel `mesh` (pair with jawta / hexterm listeners). */
export function emitMeshSignal(body: string, meta?: Record<string, unknown>): void {
  const payload = { type: 'mesh-signal', t: Date.now(), body, ...meta };
  try {
    const bc = new BroadcastChannel('mesh');
    bc.postMessage(payload);
    bc.close();
  } catch {
    /* ignore */
  }
}

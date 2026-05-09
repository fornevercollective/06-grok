import { performanceMonitor } from '../services/performanceMonitor';
import { useAppStore } from '../store';

type HistState = { history: string[]; histIdx: number };

export type GrokTerminalInitOptions = {
  outputId?: string;
  inputId?: string;
  /** When true (default), keypresses with body focused move focus to the terminal input (notes.html parity). Disable for secondary embeds (e.g. +Live ugrad). */
  globalDocumentFocus?: boolean;
  /** Shown before ❯ on each command line in the readout (default `grok.notes`). +Live ugrad uses `tensor`. */
  promptTag?: string;
};

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function print(term: HTMLElement, html: string, cls = ''): void {
  const d = document.createElement('div');
  d.className = 'ln';
  if (cls) d.innerHTML = `<span class="${cls}">${html}</span>`;
  else d.innerHTML = html;
  term.appendChild(d);
  term.scrollTop = term.scrollHeight;
}

function printPrompt(term: HTMLElement, cmd: string, promptTag: string): void {
  const ts = new Date().toLocaleTimeString('en', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  print(
    term,
    `<span class="c-prompt">${ts} ${esc(promptTag)} ❯</span> <span class="c-cmd">${esc(cmd)}</span>`
  );
}

function ok(term: HTMLElement, msg: string) {
  print(term, `<span class="c-ok">  ✓</span> ${msg}`);
}
function err(term: HTMLElement, msg: string) {
  print(term, `<span class="c-err">  ✗</span> ${msg}`);
}
function info(term: HTMLElement, msg: string) {
  print(term, `<span class="c-info">  →</span> ${msg}`);
}
function step(term: HTMLElement, msg: string) {
  print(term, `<span class="c-purple">  ◆</span> ${msg}`);
}

function dim(term: HTMLElement, msg: string) {
  print(term, msg, 'c-dim');
}

function notesCardsEl(): HTMLElement | null {
  return document.getElementById('notes-cards');
}

function saveNotesFromDom(): void {
  const notesCards = notesCardsEl();
  if (!notesCards) return;
  const notes = Array.from(notesCards.querySelectorAll('.nt-note-card')).map((card) => ({
    type: ((card as HTMLElement).dataset.noteType || 'note').toLowerCase(),
    content: (card.querySelector('.nt-note-card-body') || card).textContent || '',
  }));
  try {
    localStorage.setItem('grok-notes', JSON.stringify(notes));
  } catch {
    /* ignore */
  }
}

function addNoteCard(term: HTMLElement, content: string, type = 'note'): void {
  const notesCards = notesCardsEl();
  if (!notesCards) {
    useAppStore.getState().addNote({ type: type === 'card' ? 'text' : 'note', content });
    ok(term, 'Note added (store)');
    return;
  }
  const t = String(type || 'note').toLowerCase();
  const card = document.createElement('div');
  card.className = 'nt-note-card';
  card.dataset.noteType = t;
  card.innerHTML =
    '<div class="nt-note-card-hd">' +
    '<strong class="nt-note-card-label">' +
    esc(t) +
    ':</strong>' +
    '<button type="button" class="nt-note-card-dismiss" aria-label="Remove this note" title="Remove">×</button>' +
    '</div>' +
    '<div class="nt-note-card-body">' +
    esc(content) +
    '</div>';
  const btn = card.querySelector('.nt-note-card-dismiss');
  btn?.addEventListener('click', () => {
    card.remove();
    saveNotesFromDom();
  });
  notesCards.appendChild(card);
  saveNotesFromDom();
}

async function typeResponse(term: HTMLElement, text: string): Promise<void> {
  let currentLine: HTMLDivElement | null = null;
  const chars = text.split('');
  for (let i = 0; i < chars.length; i++) {
    if (!currentLine) {
      currentLine = document.createElement('div');
      currentLine.className = 'ln';
      term.appendChild(currentLine);
    }
    currentLine.innerHTML = `<span class="c-info">Grok:</span> ${esc(chars.slice(0, i + 1).join(''))}`;
    term.scrollTop = term.scrollHeight;
    await new Promise((r) => setTimeout(r, 20));
  }
  ok(term, 'Response complete.');
}

async function cmdOpenUrl(term: HTMLElement, url: string): Promise<void> {
  step(term, `Opening: ${url}`);
  window.open(url, '_blank');
  ok(term, 'URL opened in new tab');
}

function cmdHelp(term: HTMLElement): void {
  print(term, '<span class="c-purple c-bold">Grok Notes Terminal</span>');
  print(term, '<span class="c-dim">  Type commands to interact with Grok AI and tools</span>');
  dim(term, '');
  info(term, '<span class="c-bold">ask [query]</span> — Ask Grok AI a question');
  info(term, '<span class="c-bold">grok [query]</span> — Alias for ask');
  info(term, '<span class="c-bold">note [text]</span> — Add note to notes panel');
  info(term, '<span class="c-bold">card [text]</span> — Add card to notes panel');
  info(term, '<span class="c-bold">ls</span> — List notes and cards');
  info(term, '<span class="c-bold">perf</span> — Show performance metrics');
  info(term, '<span class="c-bold">clear</span> — Clear terminal');
  info(term, '<span class="c-bold">help</span> — Show this help');
  info(term, 'Auto-handoff: Questions → Grok, URLs → open, Notes → notes panel');
}

async function cmdAsk(term: HTMLElement, query: string): Promise<void> {
  if (!query) {
    err(term, 'Usage: ask <query>');
    return;
  }
  step(term, `Asking Grok: "${esc(query)}"`);
  const response = `Grok AI Response: Based on your query "${query}", here's a thoughtful answer. This is a simulated live response to demonstrate the terminal integration. In a real implementation, this would connect to the Grok API for actual AI responses.`;
  await typeResponse(term, response);
}

function cmdLs(term: HTMLElement): void {
  step(term, 'Listing notes and cards:');
  const notesCards = notesCardsEl();
  if (!notesCards || notesCards.children.length === 0) {
    info(term, 'No notes or cards yet. Use "note <text>" or "card <text>" to add.');
    return;
  }
  Array.from(notesCards.children).forEach((card, i) => {
    const el = card as HTMLElement;
    const label = el.querySelector('.nt-note-card-label');
    const type = (label?.textContent || 'note').replace(':', '').trim().toLowerCase();
    const body = el.querySelector('.nt-note-card-body');
    const raw = (body?.textContent || '').slice(0, 50);
    info(term, `${i + 1}. [${type}] ${raw}${raw.length >= 50 ? '...' : ''}`);
  });
}

function cmdPerf(term: HTMLElement): void {
  const m = performanceMonitor.getMetrics();
  step(term, 'Performance Report:');
  info(term, `Load Time: ${(m.loadTime / 1000).toFixed(2)}s`);
  info(term, `FPS: ${m.fps}`);
  info(term, `Memory: ${m.memoryUsage.toFixed(1)} MB (heap est.)`);
  info(term, `Network (fetch interceptions): ${m.networkRequests}`);
}

async function runCommand(term: HTMLElement, raw: string, hist: HistState, promptTag: string): Promise<void> {
  const input = raw.trim();
  if (!input) return;
  hist.history.push(input);
  hist.histIdx = hist.history.length;
  printPrompt(term, input, promptTag);

  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ');

  if (input.match(/^https?:\/\//i)) {
    await cmdOpenUrl(term, input);
    return;
  }

  switch (cmd) {
    case 'help':
      cmdHelp(term);
      break;
    case 'clear':
      term.innerHTML = '';
      break;
    case 'ask':
    case 'grok':
      await cmdAsk(term, arg);
      break;
    case 'note':
      addNoteCard(term, arg, 'note');
      ok(term, 'Note added to notes panel');
      break;
    case 'card':
      addNoteCard(term, arg, 'card');
      ok(term, 'Card added to notes panel');
      break;
    case 'ls':
      cmdLs(term);
      break;
    case 'perf':
      cmdPerf(term);
      break;
    case 'wasm':
      err(term, 'wasm: use full notes.html shell or wire loadWasmModule');
      break;
    case 'ml':
      err(term, 'ml: use full notes.html shell or wire ml engine');
      break;
    default:
      if (cmd.includes('.')) {
        await cmdOpenUrl(term, 'https://' + input);
      } else if (
        input.endsWith('?') ||
        input.includes('what') ||
        input.includes('how') ||
        input.includes('why')
      ) {
        step(term, `Opening Grok Console for: "${esc(input)}"`);
        window.open(`https://console.x.ai?q=${encodeURIComponent(input)}`, '_blank');
        info(term, 'Opened Grok Console in new tab');
      } else {
        err(
          term,
          `Unknown command: ${esc(cmd)} — type <span class="c-info">help</span>`
        );
      }
  }
}

function handleCommandInput(term: HTMLElement, input: HTMLInputElement, hist: HistState, promptTag: string): void {
  const v = input.value.trim();
  if (v) {
    void runCommand(term, v, hist, promptTag);
    input.value = '';
  }
}

function handleHistoryNav(e: KeyboardEvent, input: HTMLInputElement, hist: HistState): void {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (hist.histIdx > 0) {
      hist.histIdx--;
      input.value = hist.history[hist.histIdx] || '';
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (hist.histIdx < hist.history.length - 1) {
      hist.histIdx++;
      input.value = hist.history[hist.histIdx] || '';
    } else {
      hist.histIdx = hist.history.length;
      input.value = '';
    }
  }
}

/**
 * Attaches Enter / history / optional global focus behavior (parity with notes.html).
 * Call again with distinct `outputId` / `inputId` for a second terminal (e.g. +Live ugrad column).
 */
export function initGrokTerminal(opts?: GrokTerminalInitOptions): () => void {
  const outputId = opts?.outputId ?? 'term-output';
  const inputId = opts?.inputId ?? 'term-input';
  const globalDocumentFocus = opts?.globalDocumentFocus ?? true;
  const promptTag = opts?.promptTag ?? 'grok.notes';
  const hist: HistState = { history: [], histIdx: -1 };

  const term = document.getElementById(outputId);
  const termInput = document.getElementById(inputId) as HTMLInputElement | null;
  if (!term || !termInput) return () => {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleCommandInput(term, termInput, hist, promptTag);
    else handleHistoryNav(e, termInput, hist);
  };

  const onDocKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) return;
    if (
      (!document.activeElement || document.activeElement === document.body) &&
      e.key !== 'Escape'
    ) {
      termInput.focus();
    }
  };

  const onTermClick = () => {
    if (!window.getSelection()?.toString()) termInput.focus();
  };

  termInput.addEventListener('keydown', onKeyDown);
  if (globalDocumentFocus) document.addEventListener('keydown', onDocKeyDown);
  term.addEventListener('click', onTermClick);

  return () => {
    termInput.removeEventListener('keydown', onKeyDown);
    if (globalDocumentFocus) document.removeEventListener('keydown', onDocKeyDown);
    term.removeEventListener('click', onTermClick);
  };
}

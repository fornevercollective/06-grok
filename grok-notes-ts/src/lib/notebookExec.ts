import type { NotebookCell } from '../store';

/** Plain output passed to the next cell in ▶ Funnel (matches notes-surface.js `b._lastPlain`). */
export type NotebookExecResult = {
  display: string;
  lastPlain: string;
  isError: boolean;
};

function renderMathText(expr: string): string {
  return String(expr)
    .replace(/\\pi|pi|π/gi, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\phi/g, 'φ')
    .replace(/\\psi/g, 'ψ')
    .replace(/\|0>/g, '|0⟩')
    .replace(/\|1>/g, '|1⟩')
    .replace(/\|psi>/gi, '|ψ⟩')
    .replace(/\|phi>/gi, '|φ⟩')
    .replace(/\\otimes/g, '⊗')
    .replace(/\\hbar/g, 'ℏ')
    .replace(/\\infty/g, '∞');
}

type QP = { prefixMetadata?: (text: string, lang: string) => { totalLines: number; classifiedLines: number } };

function pctClassified(meta: { totalLines: number; classifiedLines: number }): number {
  if (!meta.totalLines) return 0;
  return Math.round((meta.classifiedLines / meta.totalLines) * 100);
}

/**
 * Execute one notebook cell like dist/notes-surface.js `execCell`.
 * Code cells: `new Function('Math', 'funnel', 'prev', ...)` with funnel/prev = prior plain output in funnel mode.
 */
export function execNotebookCell(
  cell: Pick<NotebookCell, 'type' | 'content'>,
  opts?: { funnelIn?: string }
): NotebookExecResult {
  const funnelIn = opts?.funnelIn != null ? String(opts.funnelIn) : '';
  const fin =
    funnelIn.length > 0
      ? `funnel in (${funnelIn.length} chars) · `
      : '';

  try {
    const t = cell.type;
    let plain = '';
    let display = '';

    if (t === 'code') {
      const fn = new Function('Math', 'funnel', 'prev', '"use strict";\n' + (cell.content || '')) as (
        m: typeof Math,
        funnel: string,
        prev: string
      ) => unknown;
      const r = fn(Math, funnelIn, funnelIn);
      plain = r !== undefined && r !== null ? String(r) : '';
      display = fin + (r !== undefined ? (plain ? plain : '✓') : '✓');
    } else if (t === 'math') {
      const rendered = renderMathText(cell.content || '');
      plain = rendered;
      if (funnelIn) {
        plain =
          `in:${funnelIn.slice(0, 120)}${funnelIn.length > 120 ? '…' : ''} | ${plain}`;
      }
      display = fin + rendered;
    } else {
      const QP = typeof window !== 'undefined' ? ((window as unknown as { QuantumPrefixes?: QP }).QuantumPrefixes) : undefined;
      if (QP?.prefixMetadata) {
        const meta = QP.prefixMetadata(cell.content || '', 'markdown');
        plain = `md ${meta.classifiedLines}/${meta.totalLines} · ${pctClassified(meta)}%`;
        display = fin + `${meta.totalLines} lines · ${meta.classifiedLines} classified · ${pctClassified(meta)}%`;
      } else {
        const lines = (cell.content || '').split('\n').length;
        plain = `md ${lines} lines`;
        display = fin + `${lines} lines`;
      }
      if (funnelIn) {
        plain = plain + ` | in:${funnelIn.slice(0, 80)}`;
      }
    }

    return { display, lastPlain: plain, isError: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const plain = `Error: ${msg}`;
    return {
      display: fin + `Error: ${msg}`,
      lastPlain: plain,
      isError: true,
    };
  }
}

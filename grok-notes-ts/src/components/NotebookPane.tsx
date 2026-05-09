import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import type { NotebookCell } from '../store';
import { urlBlocksIframeEmbedding } from '../lib/notebookIframePolicy';
import { execNotebookCell } from '../lib/notebookExec';

const SS_HIST = 'grok-nb-embed-hist';
const SS_IDX = 'grok-nb-embed-idx';

type EmbedNav = { hist: string[]; idx: number };

type TocEntry = { id: string; title: string; level: number; cellId: string };

function slugify(s: string): string {
  const x = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return x || 'section';
}

function buildNotebookToc(cells: NotebookCell[]): TocEntry[] {
  const out: TocEntry[] = [];
  let n = 0;
  for (const cell of cells) {
    if (cell.type !== 'markdown') continue;
    for (const line of cell.content.split('\n')) {
      const m = /^(#{1,6})\s+(.+)$/.exec(line.trim());
      if (!m) continue;
      n += 1;
      const title = m[2].trim();
      out.push({
        id: `nt-toc-${cell.id}-${slugify(title)}-${n}`,
        title,
        level: m[1].length,
        cellId: cell.id,
      });
    }
  }
  return out;
}

function loadStoredNav(): EmbedNav {
  try {
    const raw = sessionStorage.getItem(SS_HIST);
    if (raw) {
      const hist = JSON.parse(raw) as string[];
      if (Array.isArray(hist) && hist.length) {
        let idx = parseInt(sessionStorage.getItem(SS_IDX) || '', 10);
        if (Number.isNaN(idx) || idx < 0 || idx >= hist.length) idx = hist.length - 1;
        return { hist, idx };
      }
    }
  } catch {
    /* ignore */
  }
  return { hist: [], idx: -1 };
}

function persistNav(n: EmbedNav) {
  try {
    if (n.hist.length) {
      sessionStorage.setItem(SS_HIST, JSON.stringify(n.hist));
      sessionStorage.setItem(SS_IDX, String(n.idx));
    } else {
      sessionStorage.removeItem(SS_HIST);
      sessionStorage.removeItem(SS_IDX);
    }
  } catch {
    /* ignore */
  }
}

const NotebookPane: React.FC = () => {
  const notebookCells = useAppStore((s) => s.notebookCells);
  const addNotebookCell = useAppStore((s) => s.addNotebookCell);
  const updateNotebookCell = useAppStore((s) => s.updateNotebookCell);
  const clearNotebookCells = useAppStore((s) => s.clearNotebookCells);
  const showPad = useAppStore((s) => s.showPad);
  const showBrowserToolbar = useAppStore((s) => s.showBrowserToolbar);
  const grokipediaActive = useAppStore((s) => s.grokipediaActive);
  const showTerminal = useAppStore((s) => s.showTerminal);

  const emptyNotebook = notebookCells.length === 0;
  /** notes.html syncNotebookPaneHead + syncReadingSidebar */
  const readingLayout =
    !emptyNotebook && !showPad && grokipediaActive && !showTerminal;

  const [nav, setNav] = useState<EmbedNav>(loadStoredNav);
  const [urlDraft, setUrlDraft] = useState(() => {
    const n = loadStoredNav();
    if (n.idx >= 0 && n.hist[n.idx]) return n.hist[n.idx];
    return 'https://';
  });

  const [tocOpen, setTocOpen] = useState(false);
  const cellWrapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tocCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const embedSrc = useMemo(
    () => (nav.idx >= 0 && nav.idx < nav.hist.length ? nav.hist[nav.idx] : ''),
    [nav]
  );

  const iframeBlocked = useMemo(
    () => !!(embedSrc && urlBlocksIframeEmbedding(embedSrc)),
    [embedSrc]
  );

  const tocEntries = useMemo(() => buildNotebookToc(notebookCells), [notebookCells]);

  const openEmbedInNewTab = useCallback(() => {
    if (!embedSrc) return;
    window.open(embedSrc, '_blank', 'noopener,noreferrer');
  }, [embedSrc]);

  useEffect(() => {
    if (!emptyNotebook) return;
    if (nav.idx >= 0 && nav.hist[nav.idx]) setUrlDraft(nav.hist[nav.idx]);
  }, [emptyNotebook, nav.idx, nav.hist]);

  useEffect(() => {
    const w = window as unknown as { notesSurfaceOpenToc?: () => void };
    w.notesSurfaceOpenToc = () => setTocOpen(true);
    return () => {
      delete w.notesSurfaceOpenToc;
    };
  }, []);

  useEffect(() => {
    if (!tocOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTocOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tocOpen]);

  const navigateTo = useCallback((raw: string) => {
    let url = raw.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setNav((n) => {
      const next = [...n.hist.slice(0, n.idx + 1), url];
      const updated = { hist: next, idx: next.length - 1 };
      persistNav(updated);
      return updated;
    });
    setUrlDraft(url);
  }, []);

  const go = useCallback(() => navigateTo(urlDraft), [urlDraft, navigateTo]);

  const back = useCallback(() => {
    setNav((n) => {
      if (n.idx <= 0) return n;
      const idx = n.idx - 1;
      const updated = { ...n, idx };
      persistNav(updated);
      return updated;
    });
  }, []);

  const forward = useCallback(() => {
    setNav((n) => {
      if (n.idx >= n.hist.length - 1) return n;
      const idx = n.idx + 1;
      const updated = { ...n, idx };
      persistNav(updated);
      return updated;
    });
  }, []);

  const refresh = useCallback(() => {
    if (!embedSrc || iframeBlocked) return;
    const frame = document.getElementById('nt-embed-browser-frame') as HTMLIFrameElement | null;
    if (frame) frame.src = embedSrc;
  }, [embedSrc, iframeBlocked]);

  const addCell = (type: 'markdown' | 'code' | 'math') => {
    const newCell: NotebookCell = {
      id: `cell-${Date.now()}`,
      type,
      content: '',
    };
    addNotebookCell(newCell);
  };

  const runOne = useCallback(
    (id: string) => {
      const cell = notebookCells.find((c) => c.id === id);
      if (!cell) return;
      const r = execNotebookCell(cell, {});
      updateNotebookCell(id, { output: r.display, outputIsError: r.isError });
    },
    [notebookCells, updateNotebookCell]
  );

  const runAll = useCallback(() => {
    notebookCells.forEach((cell) => {
      const r = execNotebookCell(cell, {});
      updateNotebookCell(cell.id, { output: r.display, outputIsError: r.isError });
    });
  }, [notebookCells, updateNotebookCell]);

  const runFunnel = useCallback(() => {
    let prev = '';
    notebookCells.forEach((cell) => {
      const r = execNotebookCell(cell, { funnelIn: prev });
      prev = r.lastPlain;
      updateNotebookCell(cell.id, { output: r.display, outputIsError: r.isError });
    });
  }, [notebookCells, updateNotebookCell]);

  const openToc = useCallback(() => {
    setTocOpen(true);
    requestAnimationFrame(() => tocCloseBtnRef.current?.focus());
  }, []);

  const closeToc = useCallback(() => setTocOpen(false), []);

  const jumpToc = useCallback(
    (cellId: string) => {
      closeToc();
      const blocks = document.getElementById('nt-blocks');
      if (blocks && typeof blocks.scrollTo === 'function') {
        blocks.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (blocks) blocks.scrollTop = 0;
      requestAnimationFrame(() => {
        cellWrapRefs.current[cellId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    },
    [closeToc]
  );

  const clearAll = useCallback(() => {
    if (!window.confirm('Remove all notebook cells?')) return;
    clearNotebookCells();
  }, [clearNotebookCells]);

  return (
    <div
      className={`notebook-pane${showPad || emptyNotebook ? '' : ' nt-body-hidden'}${
        emptyNotebook ? ' nb-embed-browser' : ''
      }`}
      id="notebook-pane"
    >
      {emptyNotebook && showBrowserToolbar ? (
        <div className="notebook-pane-hd nb-browser-hd" role="toolbar" aria-label="Embedded web">
          <div className="nb-browser-hd-left">
            <span className="nb-brand" id="nb-brand">
              Browser
            </span>
            <span className="nb-sub" id="nb-sub">
              Web
            </span>
          </div>
          <div className="nb-browser-chrome" role="group" aria-label="Address bar">
            <button
              type="button"
              className="nb-browser-btn"
              title="Back"
              aria-label="Back"
              disabled={nav.idx <= 0}
              onClick={back}
            >
              ◀
            </button>
            <button
              type="button"
              className="nb-browser-btn"
              title="Forward"
              aria-label="Forward"
              disabled={nav.idx >= nav.hist.length - 1}
              onClick={forward}
            >
              ▶
            </button>
            <button type="button" className="nb-browser-btn" title="Reload" aria-label="Reload" onClick={refresh}>
              ⟳
            </button>
            <input
              type="text"
              className="nb-browser-url"
              id="nb-embed-url"
              spellCheck={false}
              autoComplete="off"
              placeholder="https://…"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  go();
                }
              }}
            />
            <button type="button" className="nb-browser-go" id="nb-embed-go" title="Go" onClick={go}>
              Go
            </button>
            <button
              type="button"
              className="nb-browser-tab"
              id="nb-embed-open-tab"
              title="Open current URL in a new tab"
              disabled={!embedSrc}
              onClick={openEmbedInNewTab}
            >
              Tab
            </button>
          </div>
        </div>
      ) : null}
      {!emptyNotebook ? (
        <div className="notebook-pane-hd">
          {readingLayout ? (
            <>
              <span className="nb-brand" id="nb-brand" title="Reading layout · outline & TOC in this column">
                Reader
              </span>
              <span className="nb-sub" id="nb-sub" title="Article view is in the Grokipedia pane →">
                Grokipedia
              </span>
            </>
          ) : !showPad ? (
            <>
              <span className="nb-brand" id="nb-brand" title="Notebook pad is collapsed">
                Notebook
              </span>
              <span className="nb-sub" id="nb-sub" title="Use + Pad to show cells and Markdown">
                Hidden
              </span>
            </>
          ) : grokipediaActive ? (
            <>
              <span className="nb-brand" id="nb-brand" title="Notebook beside Grokipedia">
                Notebook
              </span>
              <span className="nb-sub" id="nb-sub" title="Results and articles load in the Grokipedia pane">
                Grokipedia
              </span>
            </>
          ) : (
            <>
              <span className="nb-brand" id="nb-brand" title="Notebook · cells & runs">
                Notebook
              </span>
              <span className="nb-sub" id="nb-sub" title="Markdown, code, and math cells">
                Markdown
              </span>
            </>
          )}
        </div>
      ) : null}
      <div className="nt-body">
        {emptyNotebook ? (
          <div className="nt-browser-col">
            {embedSrc && iframeBlocked ? (
              <div className="nt-embed-browser-blocked">
                <p className="nt-embed-browser-blocked-title">This site cannot be embedded</p>
                <p className="nt-embed-browser-blocked-msg">
                  The page sets a security policy (<code>frame-ancestors</code>) that blocks iframes — for example{' '}
                  <strong>grokipedia.com</strong>. Open it in a normal browser tab instead.
                </p>
                <div className="nt-embed-browser-blocked-actions">
                  <button type="button" className="nb-browser-go" onClick={openEmbedInNewTab}>
                    Open in new tab
                  </button>
                </div>
                <p className="nt-embed-browser-hint">URL: {embedSrc}</p>
              </div>
            ) : embedSrc ? (
              <iframe
                id="nt-embed-browser-frame"
                className="nt-embed-browser-frame"
                title="Notebook web view"
                src={embedSrc}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads allow-modals allow-pointer-lock"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="nt-embed-browser-empty">
                <p>Enter a URL above and press Go — this column acts as an embedded browser when there are no notebook cells.</p>
                <p className="nt-embed-browser-hint">Add cells with +Pad and + MD / Code / Math to return to the notebook.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="nt-notebook-col">
            <div id="nt-toolbar-wp" className="nt-rd-cell-toolbar nt-hidden" aria-label="Workpad">
              <button type="button" id="nt-wp-add-note" title="Add note" onClick={() => addCell('markdown')}>
                + Note
              </button>
              <button type="button" id="nt-wp-add-code" title="Add code" onClick={() => addCell('code')}>
                + Code
              </button>
              <span className="nt-tb-spacer" aria-hidden="true"></span>
              <button type="button" id="nt-wp-run-all" title="Run all (independent)" onClick={runAll}>
                ▸ All
              </button>
              <button type="button" id="nt-wp-run-funnel" title="Funnel pipeline" onClick={runFunnel}>
                ▸ Funnel
              </button>
            </div>

            <div
              id="nt-toolbar-nb"
              className="nt-rd-cell-toolbar nt-toolbar-nb"
              aria-label="Run all notebook cells"
            >
              <div className="nt-toolbar-nb-run">
                <button
                  type="button"
                  className="nt-layout-btn"
                  id="nt-run-all"
                  title="Run all cells (independent)"
                  onClick={runAll}
                >
                  ▶ All
                </button>
                <button
                  type="button"
                  className="nt-layout-btn nt-funnel-btn"
                  id="nt-run-funnel"
                  title="Funnel: row-major (2-col) — each cell gets prior output as funnel / prev"
                  onClick={runFunnel}
                >
                  ▶ Funnel
                </button>
                <button
                  type="button"
                  className="nt-layout-btn"
                  id="nt-toc-open"
                  title="Article outline (from Markdown # headings)"
                  onClick={(e) => {
                    e.preventDefault();
                    openToc();
                  }}
                >
                  TOC
                </button>
              </div>
            </div>

            <div className="nt-blocks" id="nt-blocks" aria-live="polite">
              {notebookCells.map((cell) => (
                <div
                  key={cell.id}
                  className="nt-cell"
                  data-id={cell.id}
                  ref={(el) => {
                    cellWrapRefs.current[cell.id] = el;
                  }}
                >
                  <div className="nt-cell-toolbar">
                    <span>{cell.type.toUpperCase()}</span>
                    <button type="button" title="Run cell" onClick={() => runOne(cell.id)}>
                      Run
                    </button>
                  </div>
                  <textarea
                    className="nt-cell-editor"
                    placeholder={`Enter ${cell.type} content...`}
                    value={cell.content}
                    onChange={(e) => updateNotebookCell(cell.id, { content: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.shiftKey) {
                        e.preventDefault();
                        runOne(cell.id);
                      }
                    }}
                  />
                  {cell.output !== undefined && cell.output !== '' && (
                    <div
                      className={`nt-cell-output has-output${cell.outputIsError ? ' nt-cell-output-err' : ''}`}
                    >
                      {cell.outputIsError ? (
                        <span className="out-err">{cell.output}</span>
                      ) : (
                        <span className="out-ok">{cell.output}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div
              id="nt-toolbar-nb-actions"
              className="nt-rd-cell-toolbar nt-toolbar-nb-actions nt-toolbar-nb-foot"
              aria-label="Add notebook cells"
            >
              <div className="nt-toolbar-add-cell">
                <button type="button" id="nt-add-md" title="Markdown" onClick={() => addCell('markdown')}>
                  + MD
                </button>
                <button type="button" id="nt-add-code" title="Code" onClick={() => addCell('code')}>
                  + Code
                </button>
                <button type="button" id="nt-add-math" title="Math" onClick={() => addCell('math')}>
                  + Math
                </button>
              </div>
              <span className="nt-tb-spacer" aria-hidden="true"></span>
              <button type="button" id="nt-clear" title="Remove all notebook cells" onClick={clearAll}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {!emptyNotebook && (
        <>
          <aside
            id="nt-toc-popup"
            className={`nt-toc-popup${tocOpen ? ' is-open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nt-toc-title"
            aria-hidden={tocOpen ? 'false' : 'true'}
          >
            <div className="nt-toc-popup-panel">
              <div className="nt-toc-popup-head">
                <span id="nt-toc-title">In notebook (Markdown headings)</span>
                <button
                  type="button"
                  className="nt-toc-close"
                  id="nt-toc-close"
                  ref={tocCloseBtnRef}
                  aria-label="Close outline"
                  onClick={closeToc}
                >
                  ×
                </button>
              </div>
              <nav id="nt-toc-nav" aria-label="Notebook outline">
                {tocEntries.length === 0 ? (
                  <p className="nt-toc-empty" style={{ margin: '8px 12px', fontSize: 13, opacity: 0.85 }}>
                    No <code>#</code> headings in Markdown cells yet. Add a line like <code># Title</code>.
                  </p>
                ) : (
                  <ul className="nt-toc-list nt-toc-space-y-2 nt-toc-text-sm">
                    {tocEntries.map((e) => (
                      <li
                        key={e.id}
                        style={{ paddingLeft: Math.max(0, e.level - 1) * 10 }}
                      >
                        <a
                          href={`#${e.id}`}
                          data-nt-toc-jump
                          onClick={(ev) => {
                            ev.preventDefault();
                            jumpToc(e.cellId);
                          }}
                        >
                          {e.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </nav>
            </div>
          </aside>
          <div
            id="nt-toc-backdrop"
            className={`nt-toc-backdrop${tocOpen ? ' is-open' : ''}`}
            aria-hidden={tocOpen ? 'false' : 'true'}
            onClick={closeToc}
          />
        </>
      )}
    </div>
  );
};

export default NotebookPane;

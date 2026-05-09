import React, { useCallback, useMemo, useState } from 'react';
import { gamesHubIframeUrl, getUvspeedWebBase, uvspeedPageUrl } from '../lib/uvspeedWebBase';

export type GamesSortKey = 'default' | 'alpha' | 'training';

export type GameBoardRow = {
  id: string;
  navLabel: string;
  file: string;
  panelTitle: string;
};

type Props = {
  boards: readonly GameBoardRow[];
  onSelectGame: (id: string) => void;
  sortKey: GamesSortKey;
  onCycleSort: () => void;
};

/** Buckets mirror +Live “stream” rails — quick jumps inside the hub stage. */
function hubRailGroups(boards: readonly GameBoardRow[]): { key: string; label: string; items: GameBoardRow[] }[] {
  const trainingCore = new Set(['hub', 'go', 'chess', 'neuralink', 'games-terminal']);
  const boardField = new Set([
    'checkers',
    'backgammon',
    'gomoku',
    'go-monitor',
    'sports',
    'mahjong',
    'iching',
    'kobenhavn',
    'mancala',
  ]);
  const cardsChance = new Set(['cards', 'blackjack', 'hanafuda', 'tarot', 'memory']);
  const used = new Set<string>();
  const pick = (label: string, pred: (b: GameBoardRow) => boolean, key: string) => {
    const items = boards.filter((b) => !used.has(b.id) && pred(b));
    items.forEach((b) => used.add(b.id));
    return items.length ? { key, label, items } : null;
  };
  const groups: { key: string; label: string; items: GameBoardRow[] }[] = [];
  const a = pick('Training & core', (b) => trainingCore.has(b.id), 'train');
  const b = pick('Board & field', (b) => boardField.has(b.id), 'board');
  const c = pick('Cards & tables', (b) => cardsChance.has(b.id), 'cards');
  if (a) groups.push(a);
  if (b) groups.push(b);
  if (c) groups.push(c);
  const rest = boards.filter((x) => !used.has(x.id));
  if (rest.length) groups.push({ key: 'more', label: 'Arcade & tools', items: rest });
  return groups;
}

async function postTrain(modelfile: string, modelName: string) {
  const response = await fetch('http://localhost:3000/api/ai/train', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelName,
      baseModel: 'llama3.2',
      modelfile,
    }),
  });
  return response.json();
}

const GamesHubStudio: React.FC<Props> = ({ boards, onSelectGame, sortKey, onCycleSort }) => {
  const [linkFilter, setLinkFilter] = useState('');
  const [trainingDraft, setTrainingDraft] = useState('');

  const hubIframeSrc = useMemo(() => gamesHubIframeUrl(), []);

  const sortLabel =
    sortKey === 'default' ? 'Build order' : sortKey === 'alpha' ? 'A–Z' : 'Training focus';

  const railGroups = useMemo(() => hubRailGroups(boards), [boards]);

  const filteredBoards = useMemo(() => {
    const q = linkFilter.trim().toLowerCase();
    if (!q) return [...boards];
    return boards.filter(
      (b) =>
        b.navLabel.toLowerCase().includes(q) ||
        b.file.toLowerCase().includes(q) ||
        b.panelTitle.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
    );
  }, [boards, linkFilter]);

  const copyText = useCallback(async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(okMsg);
    } catch {
      alert('Clipboard unavailable');
    }
  }, []);

  const runTrain = useCallback(
    async (full: boolean) => {
      const text = trainingDraft.trim();
      if (!text) return;
      const sys = full
        ? 'You are an AI trained on Grok Games lab notes, move records, and uvspeed page context for multi-game training.'
        : 'You are an AI trained on Grok Games snippets for quick persona-style play.';
      const mf = `FROM llama3.2\nSYSTEM "${sys}"\nMESSAGE user "${text.replace(/"/g, '\\"')}"`;
      try {
        const data = await postTrain(mf, `games-train-${Date.now()}`);
        alert('Training started: ' + (data.message ?? JSON.stringify(data)));
      } catch (error) {
        alert('Training failed: ' + (error instanceof Error ? error.message : String(error)));
      }
    },
    [trainingDraft]
  );

  return (
    <div className="nt-live-studio-split nt-games-hub-split">
      <div className="nt-hx-video-area nt-games-hub-video">
        <div className="nt-live-studio-layout nt-games-hub-inner-grid">
          <nav className="nt-live-vid-rail nt-games-hub-rail" aria-label="Games by stream">
            {railGroups.map((group) => (
              <div key={group.key} className={'nt-live-git-section nt-live-git--' + group.key} role="group" aria-label={group.label}>
                <div className="nt-live-git-branch-head">
                  <span className="nt-live-git-branch-line" aria-hidden="true" />
                  <span className="nt-live-git-branch-name">{group.label}</span>
                </div>
                {group.items.map((b, idx) => (
                  <div className="nt-live-git-row" key={b.id}>
                    <div className="nt-live-git-graph" aria-hidden="true">
                      {idx > 0 ? <span className="nt-live-git-vline nt-live-git-vline--up" /> : null}
                      <span className="nt-live-git-node" />
                      {idx < group.items.length - 1 ? <span className="nt-live-git-vline nt-live-git-vline--down" /> : null}
                    </div>
                    <div className="nt-live-git-actions">
                      <button
                        type="button"
                        className="nt-live-rail-btn"
                        title={b.file + ' — switch board'}
                        onClick={() => onSelectGame(b.id)}
                      >
                        {b.navLabel}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </nav>
          <div className="nt-live-vid-stage nt-games-hub-stage">
            <div className="nt-live-studio-banner">
              <span className="nt-live-studio-banner-title">uvspeed Games Hub</span>
              <span className="nt-live-studio-banner-sub">
                Home for live training monitoring: hub iframe below, stream rail + Board menu jump to full boards; each board tab has{' '}
                <strong>← Hub</strong> and <strong>Pop out</strong> (same uvspeed HTML in a new window).
              </span>
            </div>
            <iframe className="nt-games-iframe nt-games-hub-iframe" src={hubIframeSrc} title="uvspeed games hub" />
          </div>
        </div>
      </div>
      <aside className="nt-hx-transcripts nt-games-training-aside" aria-label="Sorting, links, and training">
        <div className="nt-hx-transcripts-hd">Training &amp; uvspeed links</div>
        <p className="nt-hx-transcripts-meta">
          <strong>Sort</strong> reorders the Board menu and this stream rail (like +Live buckets). <strong>Link</strong> opens or copies uvspeed
          pages for offline / notebook training pipelines.
        </p>
        <div className="nt-hx-transcripts-tools">
          <button type="button" className="nt-hx-transcripts-sort" onClick={onCycleSort} title="Cycle: build order → A–Z → training focus">
            Sort: {sortLabel}
          </button>
          <button
            type="button"
            className="nt-hx-transcripts-fetch"
            onClick={() => void copyText(getUvspeedWebBase(), 'Copied uvspeed web base URL')}
            title={getUvspeedWebBase()}
          >
            Copy base URL
          </button>
          <button
            type="button"
            className="nt-hx-transcripts-train-quick"
            onClick={() => window.open(hubIframeSrc, '_blank', 'noopener,noreferrer')}
          >
            Open hub tab
          </button>
        </div>
        <div className="nt-hx-transcripts-search">
          <input
            type="text"
            placeholder="Filter all game pages…"
            value={linkFilter}
            onChange={(e) => setLinkFilter(e.target.value)}
            aria-label="Filter game links"
          />
        </div>
        <div className="nt-hx-transcripts-news nt-games-link-grid-wrap">
          <div className="nt-hx-transcripts-news-label">Page links (uvspeed web)</div>
          <ul className="nt-games-hub-link-list" role="list">
            {filteredBoards.map((b) => {
              const href = uvspeedPageUrl(b.file);
              return (
                <li key={b.id}>
                  <div className="nt-games-hub-link-row">
                    <button type="button" className="nt-games-hub-link-stage" onClick={() => onSelectGame(b.id)} title="Switch to this board">
                      Stage
                    </button>
                    <span className="nt-games-hub-link-label" title={b.file}>
                      {b.navLabel}
                    </span>
                    <button
                      type="button"
                      className="nt-games-hub-link-open"
                      onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
                      title={href}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="nt-games-hub-link-copy"
                      onClick={() => void copyText(href, 'Copied ' + b.file)}
                      title="Copy URL"
                    >
                      Copy
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <textarea
          className="nt-hx-transcripts-ta"
          spellCheck={true}
          placeholder="Paste PGN, SGF, move logs, or lab notes to train a small Ollama adapter (grok-notes-backend /api/ai/train)…"
          value={trainingDraft}
          onChange={(e) => setTrainingDraft(e.target.value)}
        />
        <div className="nt-hx-transcripts-actions">
          <button type="button" className="nt-hx-transcripts-train-quick" disabled={!trainingDraft.trim()} onClick={() => void runTrain(false)}>
            Train
          </button>
          <button type="button" className="nt-hx-transcripts-train" disabled={!trainingDraft.trim()} onClick={() => void runTrain(true)}>
            Train Transformer
          </button>
        </div>
      </aside>
    </div>
  );
};

export default GamesHubStudio;

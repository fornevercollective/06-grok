import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { getAverageHueFromImageBitmap } from '../lib/vwallHue';
import { insertCaptureIntoNotebook } from '../lib/captureToNote';

export type WallItem = {
  id: string;
  url: string;
  title: string;
  hue: number | null;
};

type SortMode = 'added' | 'hue' | 'random';

const BATCH = 36;
let seedCounter = 0;

function makePicsumBatch(count: number): WallItem[] {
  const out: WallItem[] = [];
  for (let i = 0; i < count; i++) {
    const s = seedCounter++;
    const w = 220 + (s % 5) * 36;
    const h = 260 + (s % 7) * 42;
    out.push({
      id: `pic-${s}-${i}`,
      url: `https://picsum.photos/seed/vwall${s}/${w}/${h}`,
      title: `Photo ${s}`,
      hue: null,
    });
  }
  return out;
}

/**
 * Infinite masonry image wall (Pinterest-style) — opened from footer **Files**.
 * Sort by hue (vwall-style), search, load more, add local files.
 */
const VisualWallOverlay: React.FC = () => {
  const setFileWall = useAppStore((s) => s.setFileWall);
  const [items, setItems] = useState<WallItem[]>(() => makePicsumBatch(BATCH));
  const [sortMode, setSortMode] = useState<SortMode>('added');
  const [search, setSearch] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => {
    let list = [...items];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.url.toLowerCase().includes(q) ||
          it.id.toLowerCase().includes(q)
      );
    }
    if (sortMode === 'hue') {
      list.sort((a, b) => {
        const ha = a.hue;
        const hb = b.hue;
        if (ha == null && hb == null) return 0;
        if (ha == null) return 1;
        if (hb == null) return -1;
        return ha - hb;
      });
    } else if (sortMode === 'random') {
      list = [...list].sort(() => Math.random() - 0.5);
    }
    return list;
  }, [items, sortMode, search]);

  const onImgLoad = useCallback((id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    try {
      const hue = getAverageHueFromImageBitmap(img, 40);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, hue } : it)));
    } catch {
      /* CORS / decode */
    }
  }, []);

  const loadingRef = useRef(false);
  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    window.setTimeout(() => {
      setItems((prev) => [...prev, ...makePicsumBatch(BATCH)]);
      setLoadingMore(false);
      loadingRef.current = false;
    }, 120);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting) && !loadingRef.current) loadMore();
      },
      { root: null, rootMargin: '400px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFileWall(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setFileWall]);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const next: WallItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(f);
      next.push({
        id: `local-${Date.now()}-${i}`,
        url,
        title: f.name,
        hue: null,
      });
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const sendImageToPad = async (it: WallItem) => {
    try {
      let dataUrl: string;
      if (it.url.startsWith('data:')) {
        dataUrl = it.url;
      } else {
        const res = await fetch(it.url);
        const blob = await res.blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
      }
      insertCaptureIntoNotebook(dataUrl, { caption: it.title || 'Image', analyze: false });
    } catch {
      window.alert('Could not copy image to pad (network/CORS).');
    }
  };

  return (
    <div id="nt-filewall-overlay" className="nt-filewall-overlay nt-live-hexcast" aria-hidden={false}>
      <div className="nt-live-hexcast-rainbow" aria-hidden="true">
        <span className="hx-r1"></span>
        <span className="hx-r2"></span>
        <span className="hx-r3"></span>
        <span className="hx-r4"></span>
        <span className="hx-r5"></span>
        <span className="hx-r6"></span>
      </div>
      <div className="nt-filewall-head">
        <div className="nt-filewall-title">
          <span className="nt-filewall-h1">Visual wall</span>
          <span className="nt-filewall-sub">Infinite masonry · sort · search (inspired by vwall)</span>
        </div>
        <div className="nt-filewall-tools">
          <input
            type="search"
            className="nt-filewall-search"
            placeholder="Filter by title or URL…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter images"
          />
          <label className="nt-filewall-sort-label">
            Sort
            <select
              className="nt-filewall-select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Sort order"
            >
              <option value="added">Added order</option>
              <option value="hue">Hue (rainbow)</option>
              <option value="random">Shuffle</option>
            </select>
          </label>
          <button type="button" className="nt-filewall-btn" onClick={() => fileRef.current?.click()}>
            Add images…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onPickFiles}
          />
          <button type="button" className="nt-filewall-btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'More'}
          </button>
          <button type="button" className="nt-filewall-btn nt-filewall-btn-close" onClick={() => setFileWall(false)}>
            Close
          </button>
        </div>
      </div>
      <div className="nt-filewall-body">
        <div className="nt-filewall-masonry" role="list">
          {sorted.map((it) => (
            <figure key={it.id} className="nt-filewall-card" role="listitem">
              <img
                src={it.url}
                alt={it.title}
                loading="lazy"
                decoding="async"
                crossOrigin="anonymous"
                onLoad={(e) => onImgLoad(it.id, e)}
              />
              <figcaption className="nt-filewall-cap">
                <span className="nt-filewall-cap-title">{it.title}</span>
                {it.hue != null && <span className="nt-filewall-hue">{Math.round(it.hue)}°</span>}
                <button type="button" className="nt-filewall-to-pad" onClick={() => void sendImageToPad(it)}>
                  To pad
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
        <div ref={sentinelRef} className="nt-filewall-sentinel" aria-hidden="true" />
        {loadingMore && <p className="nt-filewall-loading">Loading more…</p>}
      </div>
    </div>
  );
};

export default VisualWallOverlay;

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { strokesToPngDataUrl } from '../lib/drawExport';
import { insertCaptureIntoNotebook } from '../lib/captureToNote';

type DrawPoint = { x: number; y: number };
type DrawStroke = { points: DrawPoint[]; color: string; width: number };

const STROKE_COLOR = '#a78bfa';
const MIN_PEN = 1;
const MAX_PEN = 96;
const MIN_SC = 0.06;
const MAX_SC = 14;

/** Infinite canvas + pan/zoom/draw — behavior aligned with notes.html initNtDrawCanvas. */
const DrawLayer: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const strokesRef = useRef<DrawStroke[]>([]);
  const viewRef = useRef({ ox: 0, oy: 0, sc: 1 });
  const curStrokeRef = useRef<DrawStroke | null>(null);
  const panPtrRef = useRef<{ lx: number; ly: number } | null>(null);
  const spaceDownRef = useRef(false);

  const setDrawStrokes = useAppStore((s) => s.setDrawStrokes);
  const setDrawView = useAppStore((s) => s.setDrawView);
  const storeStrokeWidth = useAppStore((s) => s.drawStrokeWidth);
  const setDrawStrokeWidthStore = useAppStore((s) => s.setDrawStrokeWidth);

  const [strokeWidth, setStrokeWidthState] = useState(() =>
    Math.min(MAX_PEN, Math.max(MIN_PEN, storeStrokeWidth || 2))
  );
  const [wrap3d, setWrap3d] = useState(false);

  const strokeWidthRef = useRef(strokeWidth);
  strokeWidthRef.current = strokeWidth;

  const setStrokeWidth = useCallback(
    (w: number) => {
      const n = Math.min(MAX_PEN, Math.max(MIN_PEN, w));
      setStrokeWidthState(n);
      strokeWidthRef.current = n;
      setDrawStrokeWidthStore(n);
    },
    [setDrawStrokeWidthStore]
  );

  useLayoutEffect(() => {
    const s = useAppStore.getState();
    strokesRef.current = Array.isArray(s.drawStrokes) ? [...s.drawStrokes] : [];
    const v = s.drawView;
    viewRef.current = {
      ox: v?.ox ?? 0,
      oy: v?.oy ?? 0,
      sc: typeof v?.sc === 'number' && v.sc > 0 ? Math.min(MAX_SC, Math.max(MIN_SC, v.sc)) : 1,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const screenToWorld = (cx: number, cy: number) => {
      const v = viewRef.current;
      return { x: (cx - v.ox) / v.sc, y: (cy - v.oy) / v.sc };
    };

    const paintPath = (s: DrawStroke) => {
      if (!s.points?.length) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.points.length === 1) {
        const p = s.points[0];
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, s.width), 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    };

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.width / dpr;
      const ch = canvas.height / dpr;
      const view = viewRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate(view.ox, view.oy);
      ctx.scale(view.sc, view.sc);
      const x0 = (-view.ox) / view.sc - 6000;
      const x1 = (cw - view.ox) / view.sc + 6000;
      const y0 = (-view.oy) / view.sc - 6000;
      const y1 = (ch - view.oy) / view.sc + 6000;
      const step = 50;
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.lineWidth = 1 / view.sc;
      for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
        ctx.stroke();
      }
      for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(74,158,255,.14)';
      ctx.lineWidth = 1 / view.sc;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x1, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(0, y1);
      ctx.stroke();
      strokesRef.current.forEach(paintPath);
      if (curStrokeRef.current) paintPath(curStrokeRef.current);
      ctx.restore();
    };

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      render();
    };

    const localXY = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onWheel = (e: WheelEvent) => {
      if (!document.documentElement.classList.contains('nt-draw-open')) return;
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const view = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const k = Math.exp(-e.deltaY * 0.002);
        const n = Math.min(MAX_SC, Math.max(MIN_SC, view.sc * k));
        const w = screenToWorld(cx, cy);
        view.ox = cx - w.x * n;
        view.oy = cy - w.y * n;
        view.sc = n;
      } else {
        e.preventDefault();
        view.ox -= e.deltaX;
        view.oy -= e.deltaY;
      }
      setDrawView({ ...view });
      render();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!document.documentElement.classList.contains('nt-draw-open')) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === 'Space' && ['INPUT', 'TEXTAREA'].indexOf(tag || '') < 0) {
        spaceDownRef.current = true;
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false;
    };

    const endPtr = (e: PointerEvent) => {
      if (panPtrRef.current) {
        panPtrRef.current = null;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      if (curStrokeRef.current) {
        if (curStrokeRef.current.points.length) strokesRef.current.push(curStrokeRef.current);
        curStrokeRef.current = null;
        setDrawStrokes([...strokesRef.current]);
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        render();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!document.documentElement.classList.contains('nt-draw-open')) return;
      const xy = localXY(e);
      const wantPan = e.button === 1 || (e.button === 0 && spaceDownRef.current);
      if (wantPan) {
        e.preventDefault();
        panPtrRef.current = { lx: e.clientX, ly: e.clientY };
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      if (e.button !== 0) return;
      e.preventDefault();
      const w = screenToWorld(xy.x, xy.y);
      curStrokeRef.current = {
        points: [w],
        color: STROKE_COLOR,
        width: strokeWidthRef.current,
      };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (panPtrRef.current) {
        const p = panPtrRef.current;
        const view = viewRef.current;
        view.ox += e.clientX - p.lx;
        view.oy += e.clientY - p.ly;
        p.lx = e.clientX;
        p.ly = e.clientY;
        setDrawView({ ...view });
        render();
        return;
      }
      if (!curStrokeRef.current) return;
      const xy = localXY(e);
      curStrokeRef.current.points.push(screenToWorld(xy.x, xy.y));
      render();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPtr);
    canvas.addEventListener('pointercancel', endPtr);

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (document.documentElement.classList.contains('nt-draw-open')) resize();
      });
      ro.observe(wrap);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();
    (window as unknown as { ntDrawResize?: () => void }).ntDrawResize = resize;

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPtr);
      canvas.removeEventListener('pointercancel', endPtr);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
      delete (window as unknown as { ntDrawResize?: () => void }).ntDrawResize;
      setDrawStrokes([...strokesRef.current]);
      setDrawView({ ...viewRef.current });
    };
  }, [setDrawStrokes, setDrawView]);

  const clearAll = () => {
    strokesRef.current = [];
    curStrokeRef.current = null;
    setDrawStrokes([]);
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (canvas && wrap) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const cw = canvas.width / dpr;
        const ch = canvas.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
      }
    }
    (window as unknown as { ntDrawResize?: () => void }).ntDrawResize?.();
  };

  const sendDrawToNotebook = useCallback(() => {
    const list = strokesRef.current.map((s) => ({
      points: s.points.map((p) => ({ x: p.x, y: p.y })),
      color: s.color,
      width: s.width,
    }));
    const dataUrl = strokesToPngDataUrl(list, {});
    if (!dataUrl) return;
    insertCaptureIntoNotebook(dataUrl, { caption: 'Quick draw', analyze: true });
  }, []);

  const exportJson = () => {
    const data = {
      strokes: strokesRef.current,
      view: viewRef.current,
      strokeWidth: strokeWidthRef.current,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'grok-draw.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}')) as {
          strokes?: DrawStroke[];
          view?: { ox?: number; oy?: number; sc?: number };
          strokeWidth?: number;
        };
        const list = data.strokes;
        if (!Array.isArray(list)) throw new Error('missing strokes[]');
        strokesRef.current = [];
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (!s || !Array.isArray(s.points)) continue;
          strokesRef.current.push({
            color: typeof s.color === 'string' ? s.color : STROKE_COLOR,
            width: typeof s.width === 'number' && s.width > 0 ? s.width : strokeWidthRef.current,
            points: s.points.map((p) => ({ x: +p.x, y: +p.y })).filter((p) => !isNaN(p.x) && !isNaN(p.y)),
          });
        }
        if (data.view && typeof data.view === 'object') {
          const v = viewRef.current;
          if (typeof data.view.ox === 'number') v.ox = data.view.ox;
          if (typeof data.view.oy === 'number') v.oy = data.view.oy;
          if (typeof data.view.sc === 'number' && data.view.sc > 0) {
            v.sc = Math.min(MAX_SC, Math.max(MIN_SC, data.view.sc));
          }
        }
        if (typeof data.strokeWidth === 'number') setStrokeWidth(data.strokeWidth);
        curStrokeRef.current = null;
        setDrawStrokes([...strokesRef.current]);
        setDrawView({ ...viewRef.current });
        (window as unknown as { ntDrawResize?: () => void }).ntDrawResize?.();
      } catch {
        /* ignore */
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="nt-draw-layer" className="nt-draw-layer" aria-hidden="false">
      <div ref={wrapRef} className={`nt-draw-canvas-wrap${wrap3d ? ' nt-draw-3d' : ''}`}>
        <canvas
          id="nt-draw-canvas"
          ref={canvasRef}
          width={800}
          height={600}
          aria-label="Infinite drawing canvas"
        />
      </div>
      <div className="nt-draw-hud">
        <div className="nt-draw-hud-hints">
          <span>
            Wheel <kbd>pan</kbd>
          </span>
          <span>
            <kbd>Ctrl</kbd> wheel <kbd>zoom</kbd>
          </span>
          <span>
            Drag <kbd>draw</kbd>
          </span>
          <span>
            <kbd>Space</kbd> drag <kbd>pan</kbd>
          </span>
          <span>
            Middle <kbd>pan</kbd>
          </span>
        </div>
        <div className="nt-draw-hud-tools" role="toolbar" aria-label="Draw canvas tools">
          <button
            type="button"
            className="nt-draw-hud-btn"
            id="nt-draw-3d"
            aria-pressed={wrap3d}
            title="Toggle 3D tilt (presentation)"
            onClick={() => setWrap3d((v) => !v)}
          >
            3D
          </button>
          <button type="button" className="nt-draw-hud-btn" id="nt-draw-clear" title="Clear all strokes" onClick={clearAll}>
            Clear
          </button>
          <span className="nt-draw-pen-label">Pen</span>
          <button
            type="button"
            className="nt-draw-hud-btn"
            id="nt-draw-pen-minus"
            title="Thinner (−)"
            onClick={() => setStrokeWidth(strokeWidth - 1)}
          >
            −
          </button>
          <span className="nt-draw-pen-size" id="nt-draw-pen-val" title="Stroke width (px)">
            {Math.round(strokeWidth)}
          </span>
          <button
            type="button"
            className="nt-draw-hud-btn"
            id="nt-draw-pen-plus"
            title="Thicker (+)"
            onClick={() => setStrokeWidth(strokeWidth + 1)}
          >
            +
          </button>
          <button
            type="button"
            className="nt-draw-hud-btn"
            id="nt-draw-import"
            title="Import strokes (JSON)"
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            id="nt-draw-import-file"
            accept="application/json,.json"
            hidden
            aria-hidden="true"
            onChange={(e) => {
              importJson(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" className="nt-draw-hud-btn" id="nt-draw-export" title="Export strokes (JSON)" onClick={exportJson}>
            Export
          </button>
          <button
            type="button"
            className="nt-draw-hud-btn nt-draw-hud-btn-primary"
            id="nt-draw-to-notebook"
            title="Add drawing as image to notebook pad and analyze in background (needs backend + llava)"
            onClick={sendDrawToNotebook}
          >
            To pad + analyze
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawLayer;

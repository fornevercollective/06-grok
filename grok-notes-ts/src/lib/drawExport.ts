/** Rasterize draw strokes (world space) to a PNG data URL for notebook embeds. */

export type DrawStrokeJson = {
  points: { x: number; y: number }[];
  color: string;
  width: number;
};

function paintStroke(
  ctx: CanvasRenderingContext2D,
  s: DrawStrokeJson
): void {
  if (!s.points?.length) return;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (s.points.length === 1) {
    const p = s.points[0];
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.5, s.width * 0.5), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(s.points[0].x, s.points[0].y);
  for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
  ctx.stroke();
}

/** Returns PNG data URL or null if nothing to draw. */
export function strokesToPngDataUrl(
  strokes: DrawStrokeJson[],
  opts?: { bg?: string; pad?: number; maxSide?: number }
): string | null {
  if (!Array.isArray(strokes) || !strokes.length) return null;
  const pad = opts?.pad ?? 12;
  const maxSide = opts?.maxSide ?? 2048;
  const bg = opts?.bg ?? '#0d1117';

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    const hw = (s.width || 2) * 0.5;
    for (const p of s.points || []) {
      minX = Math.min(minX, p.x - hw);
      minY = Math.min(minY, p.y - hw);
      maxX = Math.max(maxX, p.x + hw);
      maxY = Math.max(maxY, p.y + hw);
    }
  }
  if (!isFinite(minX) || !isFinite(minY)) return null;

  let w = maxX - minX + pad * 2;
  let h = maxY - minY + pad * 2;
  if (w < 8) w = 8;
  if (h < 8) h = 8;

  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(8, Math.ceil(w * scale));
  const ch = Math.max(8, Math.ceil(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(pad - minX, pad - minY);
  for (const s of strokes) paintStroke(ctx, s);
  ctx.restore();

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

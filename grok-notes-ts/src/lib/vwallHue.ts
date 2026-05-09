/** Average color → hue (0–360), matching ~/Desktop/vwall/visualwall.html logic. */

export function rgbToHue(r: number, g: number, b: number): number {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  let h = 0;
  if (max === r) h = ((60 * ((g - b) / (max - min)) + 360) % 360) as number;
  else if (max === g) h = 60 * ((b - r) / (max - min)) + 120;
  else h = 60 * ((r - g) / (max - min)) + 240;
  return h;
}

export function getAverageHueFromImageBitmap(
  img: CanvasImageSource,
  sample = 48
): number {
  const canvas = document.createElement('canvas');
  const w = Math.min(sample, (img as HTMLImageElement).naturalWidth || sample);
  const h = Math.min(sample, (img as HTMLImageElement).naturalHeight || sample);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let r = 0;
  let g = 0;
  let b = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  r /= n;
  g /= n;
  b /= n;
  return rgbToHue(r, g, b);
}

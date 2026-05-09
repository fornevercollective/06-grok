import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

process.env.VITE_UVSPEED_WEB_BASE = process.env.VITE_UVSPEED_WEB_BASE ?? '';
process.env.VITE_BACKEND_URL = process.env.VITE_BACKEND_URL ?? '';

/** jsdom does not implement Canvas 2D; calling the real getContext logs console.error before throw. */
function canvas2dStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const noop = (): void => {};
  return {
    canvas,
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    get fillStyle() {
      return '#000';
    },
    set fillStyle(_v: string) {},
    get strokeStyle() {
      return '#000';
    },
    set strokeStyle(_v: string) {},
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

const origGetContext = HTMLCanvasElement.prototype.getContext;
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  writable: true,
  value(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    if (type === '2d') {
      return canvas2dStub(this);
    }
    return origGetContext.apply(this, [type, ...rest] as Parameters<HTMLCanvasElement['getContext']>);
  },
});
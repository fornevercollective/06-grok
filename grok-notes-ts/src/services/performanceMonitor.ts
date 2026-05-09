export interface PerformanceMetrics {
  loadTime: number;
  fps: number;
  memoryUsage: number;
  networkRequests: number;
  renderTime: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    loadTime: 0,
    fps: 0,
    memoryUsage: 0,
    networkRequests: 0,
    renderTime: 0,
  };

  private frameCount = 0;
  private lastTime = performance.now();
  private fpsUpdateInterval: number;

  constructor() {
    this.startMonitoring();
    this.fpsUpdateInterval = window.setInterval(() => this.updateFPS(), 1000);
  }

  private startMonitoring(): void {
    // Monitor page load time
    if (performance.timing) {
      this.metrics.loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    }

    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        this.metrics.memoryUsage = memInfo.usedJSHeapSize / 1024 / 1024; // MB
      }, 5000);
    }

    // Monitor network requests
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      this.metrics.networkRequests++;
      return originalFetch(...args);
    };
  }

  private updateFPS(): void {
    const now = performance.now();
    this.metrics.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
    this.frameCount = 0;
    this.lastTime = now;
  }

  recordFrame(): void {
    this.frameCount++;
  }

  recordRenderTime(startTime: number): void {
    this.metrics.renderTime = performance.now() - startTime;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getReport(): string {
    const metrics = this.getMetrics();
    return `
Performance Report:
- Load Time: ${metrics.loadTime}ms
- FPS: ${metrics.fps}
- Memory Usage: ${metrics.memoryUsage.toFixed(2)} MB
- Network Requests: ${metrics.networkRequests}
- Last Render Time: ${metrics.renderTime.toFixed(2)}ms
    `.trim();
  }

  dispose(): void {
    if (this.fpsUpdateInterval) {
      clearInterval(this.fpsUpdateInterval);
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();
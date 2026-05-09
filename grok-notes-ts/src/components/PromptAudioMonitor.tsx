import React, { useCallback, useEffect, useRef, useState } from 'react';

export const ISS_AUDIO_RELAY_PULSE = 'iss-audio-relay-pulse';

type Props = {
  modeTitle: string;
  modeLabel: string;
  /** Quick-chat receive image (paste) — Footer state (cleared with To field). */
  rxImageUrl: string | null;
  onRxThumbPaste: (e: React.ClipboardEvent) => void;
};

const CANVAS_CSS_H = 28;
const WAVE_H = 15;
const SPEC_H = 13;

/** Waveform + spectral strip for mic/speaker-adjacent monitoring; relay flashes on transmit events. */
const PromptAudioMonitor: React.FC<Props> = ({ modeTitle, modeLabel, rxImageUrl, onRxThumbPaste }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeDataRef = useRef<Uint8Array | null>(null);
  const freqDataRef = useRef<Uint8Array | null>(null);
  const relayUntilRef = useRef(0);
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => {
    const onRelay = () => {
      relayUntilRef.current = Date.now() + 420;
    };
    window.addEventListener(ISS_AUDIO_RELAY_PULSE, onRelay);
    return () => window.removeEventListener(ISS_AUDIO_RELAY_PULSE, onRelay);
  }, []);

  const stopMic = useCallback(() => {
    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    sourceNodeRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    timeDataRef.current?.fill(128);
    freqDataRef.current?.fill(0);
    setMicOn(false);
  }, []);

  const startMic = useCallback(async () => {
    setMicError(null);
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) {
        setMicError('Web Audio not supported');
        return;
      }
      const ctx = audioCtxRef.current ?? new AC();
      audioCtxRef.current = ctx;
      await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.62;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);
      analyserRef.current = analyser;
      sourceNodeRef.current = src;
      timeDataRef.current = new Uint8Array(analyser.fftSize);
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      setMicOn(true);
    } catch (e) {
      setMicError((e as Error).message ?? 'Microphone unavailable');
      stopMic();
    }
  }, [stopMic]);

  const toggleMic = useCallback(() => {
    if (micOn) stopMic();
    else void startMic();
  }, [micOn, startMic, stopMic]);

  useEffect(() => () => stopMic(), [stopMic]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let g: CanvasRenderingContext2D | null = null;
    try {
      g = canvas.getContext('2d');
    } catch {
      /* jsdom: getContext('2d') throws without canvas package */
      return;
    }
    if (!g) return;

    const ensureBuffers = () => {
      if (!timeDataRef.current) {
        timeDataRef.current = new Uint8Array(256);
        timeDataRef.current.fill(128);
      }
      if (!freqDataRef.current) {
        freqDataRef.current = new Uint8Array(128);
      }
    };

    const draw = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const w = Math.max(120, wrap.clientWidth);
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(CANVAS_CSS_H * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(CANVAS_CSS_H * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${CANVAS_CSS_H}px`;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, CANVAS_CSS_H);

      g.fillStyle = 'rgba(10,14,20,0.98)';
      g.fillRect(0, 0, w, CANVAS_CSS_H);
      g.strokeStyle = 'rgba(88,166,255,0.12)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, WAVE_H / 2);
      g.lineTo(w, WAVE_H / 2);
      g.stroke();

      ensureBuffers();
      const td = timeDataRef.current!;
      const fd = freqDataRef.current!;
      const an = analyserRef.current;

      if (an && micOn) {
        an.getByteTimeDomainData(td as Parameters<AnalyserNode['getByteTimeDomainData']>[0]);
        an.getByteFrequencyData(fd as Parameters<AnalyserNode['getByteFrequencyData']>[0]);
      } else {
        td.fill(128);
        fd.fill(0);
      }

      g.strokeStyle = 'rgba(88,166,255,0.9)';
      g.lineWidth = 1.35;
      g.beginPath();
      const slice = td.length;
      const step = w / slice;
      for (let i = 0; i < slice; i++) {
        const v = td[i]! / 128 - 1;
        const y = (1 + v * 0.92) * (WAVE_H / 2);
        const x = i * step;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();

      const n = fd.length;
      const barW = w / n;
      for (let i = 0; i < n; i++) {
        const v = fd[i]! / 255;
        const bh = Math.max(1, v * SPEC_H);
        const x0 = i * barW;
        g.fillStyle = `hsla(265, 72%, ${42 + v * 38}%, ${0.3 + v * 0.6})`;
        g.fillRect(x0, WAVE_H + (SPEC_H - bh), Math.max(1, barW - 0.4), bh);
      }

      if (Date.now() < relayUntilRef.current) {
        const a = Math.min(1, (relayUntilRef.current - Date.now()) / 420);
        g.strokeStyle = `rgba(63, 185, 80, ${0.2 + a * 0.55})`;
        g.lineWidth = 2;
        g.strokeRect(1.5, 1.5, w - 3, CANVAS_CSS_H - 3);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [micOn]);

  return (
    <div className="iss-prompt-audio-strip" role="region" aria-label="Prompt mode hint and audio monitor">
      <span id="iss-prompt-mode-hint" className="iss-sr-only" aria-live="polite">
        {modeTitle}
      </span>
      <div className="iss-prompt-audio-strip-inner" ref={wrapRef}>
        <canvas ref={canvasRef} className="iss-prompt-waveform-canvas" aria-hidden />
        <div className="iss-prompt-rx-slot">
          <div
            className="iss-reply-rx-thumb-wrap"
            id="iss-reply-rx-thumb"
            tabIndex={0}
            title="Receive image — focus and paste (Ctrl/Cmd+V)"
            aria-label="Receive image thumbnail — paste from clipboard"
            onPaste={onRxThumbPaste}
          >
            {rxImageUrl ? (
              <img src={rxImageUrl} alt="" className="iss-reply-rx-img iss-prompt-rx-img" />
            ) : (
              <span className="iss-reply-rx-placeholder" aria-hidden="true" />
            )}
          </div>
        </div>
        <div className="iss-prompt-audio-strip-chrome">
          <span className="iss-prompt-mode-chip" title={modeTitle} aria-hidden="true">
            {modeLabel}
          </span>
          <button
            type="button"
            className={'iss-prompt-mic-btn' + (micOn ? ' active' : '')}
            aria-pressed={micOn}
            title={micOn ? 'Stop microphone (waveform & spectrum pause)' : 'Start microphone — waveform (top) · spectrum (bottom)'}
            onClick={toggleMic}
          >
            mic
          </button>
        </div>
      </div>
      {micError ? (
        <p className="iss-prompt-audio-err" role="status">
          {micError}
        </p>
      ) : null}
    </div>
  );
};

export default PromptAudioMonitor;

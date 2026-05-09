import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { syncFooterModelHint } from '../lib/ironFooterSync';
import {
  base64ToUtf8,
  emitJawtaBurst,
  emitJawtaPulse,
  emitMeshSignal,
  hexToTextUtf8,
  morseToText,
  rot13,
  textToHexUtf8,
  textToMorse,
  transmitLine,
  utf8ToBase64,
} from '../lib/quickChatCodec';
import { PROMPT_MODES, promptModeConfig, type PromptModeId } from '../constants/promptModes';
import { useAppStore } from '../store';
import PromptAudioMonitor, { ISS_AUDIO_RELAY_PULSE } from './PromptAudioMonitor';

/** Footer + modality grid + quick chat — markup aligned with ../notes.html (iron-search-staff). */
const Footer: React.FC = () => {
  const setCurrentBrand = useAppStore((s) => s.setCurrentBrand);
  const showPad = useAppStore((s) => s.showPad);
  const showBrowserToolbar = useAppStore((s) => s.showBrowserToolbar);
  const notebookCellCount = useAppStore((s) => s.notebookCells.length);
  const togglePad = useAppStore((s) => s.togglePad);
  const toggleBrowserToolbar = useAppStore((s) => s.toggleBrowserToolbar);
  const emptyNotebook = notebookCellCount === 0;
  const padBodyVisible = showPad || emptyNotebook;
  /** Empty: footer toggles address bar. With cells: same as + Pad (notebook body). */
  const footerBrowserPressed = emptyNotebook ? showBrowserToolbar : padBodyVisible;

  const [promptMode, setPromptMode] = useState<PromptModeId>('ask');
  const modeCfg = useMemo(() => promptModeConfig(promptMode), [promptMode]);

  const cyclePromptMode = useCallback((dir: 1 | -1) => {
    const order = PROMPT_MODES.map((m) => m.id);
    const i = order.indexOf(promptMode);
    const ni = (i + dir + order.length) % order.length;
    setPromptMode(order[ni]!);
  }, [promptMode]);

  const onPromptQKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      cyclePromptMode(e.shiftKey ? -1 : 1);
    },
    [cyclePromptMode],
  );

  useEffect(() => {
    const modBtns = document.querySelectorAll('#iron-search-modality-bar .iss-mod-btn');
    const onModClick = (e: Event) => {
      e.preventDefault();
      const btn = (e.target as HTMLElement).closest('.iss-mod-btn');
      if (!btn || !btn.closest('#iron-search-modality-bar')) return;
      const mod = btn.getAttribute('data-mod');
      if (!mod) return;
      if (mod === 'files') {
        useAppStore.getState().toggleFileWall();
      }
      if (mod === 'games') {
        useAppStore.getState().setShowGames(true);
      } else {
        useAppStore.getState().setShowGames(false);
      }
      const hidden = document.getElementById('iron-modality') as HTMLInputElement | null;
      if (hidden) hidden.value = mod;
      modBtns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      syncFooterModelHint(setCurrentBrand);
    };
    modBtns.forEach((btn) => btn.addEventListener('click', onModClick));

    const eng = document.getElementById('iron-search-engine');
    const depth = document.getElementById('iron-search-model');
    eng?.addEventListener('change', () => syncFooterModelHint(setCurrentBrand));
    depth?.addEventListener('change', () => syncFooterModelHint(setCurrentBrand));

    const tid = window.setTimeout(() => syncFooterModelHint(setCurrentBrand), 0);

    const form = document.getElementById('iron-search-staff-form') as HTMLFormElement;
    const onSubmit = (e: Event) => {
      e.preventDefault();
    };
    form?.addEventListener('submit', onSubmit);

    return () => {
      window.clearTimeout(tid);
      modBtns.forEach((btn) => btn.removeEventListener('click', onModClick));
      eng?.removeEventListener('change', () => syncFooterModelHint(setCurrentBrand));
      depth?.removeEventListener('change', () => syncFooterModelHint(setCurrentBrand));
      form?.removeEventListener('submit', onSubmit);
    };
  }, []);

  const getReplyTa = useCallback((): HTMLTextAreaElement | null => {
    return document.getElementById('iss-reply-to') as HTMLTextAreaElement | null;
  }, []);

  const applyReply = useCallback((map: (s: string) => string) => {
    const ta = getReplyTa();
    if (!ta) return;
    try {
      ta.value = map(ta.value);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (err) {
      console.warn('[quick-chat]', err);
    }
  }, [getReplyTa]);

  /** Next click direction: false = encode (→hex / →morse / b64→), true = decode (hex→ / morse→ / →b64). */
  const [hexDecodeNext, setHexDecodeNext] = useState(false);
  const [morseDecodeNext, setMorseDecodeNext] = useState(false);
  const [b64DecodeNext, setB64DecodeNext] = useState(false);

  const onHexCodecClick = useCallback(() => {
    const ta = getReplyTa();
    if (!ta) return;
    try {
      const next = hexDecodeNext ? hexToTextUtf8(ta.value) : textToHexUtf8(ta.value);
      ta.value = next;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      setHexDecodeNext((v) => !v);
    } catch (err) {
      console.warn('[quick-chat] hex', err);
    }
  }, [hexDecodeNext, getReplyTa]);

  const onMorseCodecClick = useCallback(() => {
    const ta = getReplyTa();
    if (!ta) return;
    try {
      const next = morseDecodeNext ? morseToText(ta.value) : textToMorse(ta.value);
      ta.value = next;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      setMorseDecodeNext((v) => !v);
    } catch (err) {
      console.warn('[quick-chat] morse', err);
    }
  }, [morseDecodeNext, getReplyTa]);

  const onB64CodecClick = useCallback(() => {
    const ta = getReplyTa();
    if (!ta) return;
    try {
      const next = b64DecodeNext ? base64ToUtf8(ta.value) : utf8ToBase64(ta.value);
      ta.value = next;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      setB64DecodeNext((v) => !v);
    } catch (err) {
      console.warn('[quick-chat] b64', err);
    }
  }, [b64DecodeNext, getReplyTa]);

  const [rxImageUrl, setRxImageUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (rxImageUrl) URL.revokeObjectURL(rxImageUrl);
    };
  }, [rxImageUrl]);

  const onClearQuickReply = useCallback(() => {
    const ta = getReplyTa();
    if (ta) {
      ta.value = '';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setHexDecodeNext(false);
    setMorseDecodeNext(false);
    setB64DecodeNext(false);
    setRxImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [getReplyTa]);

  const onMeshClick = useCallback(() => {
    const reply = getReplyTa()?.value ?? '';
    const body = reply.trim();
    emitMeshSignal(body || '(empty)', { replyLen: body.length });
    window.dispatchEvent(new CustomEvent(ISS_AUDIO_RELAY_PULSE));
  }, [getReplyTa]);

  const onRxThumbPaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        e.preventDefault();
        const f = it.getAsFile();
        if (!f) continue;
        setRxImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(f);
        });
        break;
      }
    }
  }, []);

  /** Shared quick-chat toolbar — dock = stacked sections under jawta + small buttons; inline = next to Quick chat titles. */
  const quickChatToolbar = (variant: 'dock' | 'inline') => {
    const groups = (
      <>
      <div className="iss-reply-tool-grp iss-reply-tool-grp--jawta" role="group" aria-label="Jawta data bursts and mesh">
        <span className="iss-reply-tool-grp-hd">jawta</span>
        <button
          type="button"
          className="iss-reply-tool-btn"
          title="Broadcast quick reply as data burst (hexterm + jawta channels)"
          onClick={() => {
            emitJawtaBurst(getReplyTa()?.value ?? '');
            window.dispatchEvent(new CustomEvent(ISS_AUDIO_RELAY_PULSE));
          }}
        >
          Burst
        </button>
        <button
          type="button"
          className="iss-reply-tool-btn"
          title="Pulse / sync signal on jawta + hexterm"
          onClick={() => {
            emitJawtaPulse();
            window.dispatchEvent(new CustomEvent(ISS_AUDIO_RELAY_PULSE));
          }}
        >
          Pulse
        </button>
        <button
          type="button"
          className="iss-reply-tool-btn"
          title="Broadcast mesh signal (To field text) on mesh channel"
          onClick={onMeshClick}
        >
          mesh
        </button>
        <button
          type="button"
          className="iss-reply-tool-btn"
          title="Print To field text as a line in the main terminal (#term-output)"
          onClick={() => transmitLine(getReplyTa()?.value ?? '')}
        >
          tx
        </button>
      </div>
      <div className="iss-reply-tool-grp" role="group" aria-label="Hex and Morse">
        <span className="iss-reply-tool-grp-hd">hex / morse</span>
        <button
          type="button"
          className="iss-reply-tool-btn"
          title={
            hexDecodeNext
              ? 'Hex string → UTF-8 text · click again toggles to UTF-8 → hex'
              : 'UTF-8 text → space-separated hex · click again toggles to hex → UTF-8'
          }
          aria-label={hexDecodeNext ? 'Decode hex to UTF-8' : 'Encode text to hex'}
          onClick={onHexCodecClick}
        >
          {hexDecodeNext ? 'hex→' : '→hex'}
        </button>
        <button
          type="button"
          className="iss-reply-tool-btn"
          title={
            morseDecodeNext
              ? 'Morse (space + /) → text · click again toggles to text → Morse'
              : 'Letters/digits → Morse · click again toggles to Morse → text'
          }
          aria-label={morseDecodeNext ? 'Decode Morse to text' : 'Encode text to Morse'}
          onClick={onMorseCodecClick}
        >
          {morseDecodeNext ? 'morse→' : '→morse'}
        </button>
      </div>
      <div className="iss-reply-tool-grp" role="group" aria-label="Cryptographic-style conversion">
        <span className="iss-reply-tool-grp-hd">crypto</span>
        <button
          type="button"
          className="iss-reply-tool-btn"
          title={
            b64DecodeNext
              ? 'Base64 → UTF-8 · click again toggles to UTF-8 → Base64'
              : 'UTF-8 → Base64 · click again toggles to Base64 → UTF-8'
          }
          aria-label={b64DecodeNext ? 'Decode Base64 to UTF-8' : 'Encode UTF-8 to Base64'}
          onClick={onB64CodecClick}
        >
          {b64DecodeNext ? '→b64' : 'b64→'}
        </button>
        <button
          type="button"
          className="iss-reply-tool-btn"
          title="ROT13 — Caesar n=13 (self-inverse: click again to reverse)"
          onClick={() => applyReply(rot13)}
        >
          rot13
        </button>
      </div>
      </>
    );
    return (
      <div
        className={
          'iss-reply-tool-row' +
          (variant === 'dock' ? ' iss-reply-tool-row-dock' : ' iss-reply-tool-row-inline')
        }
        role="toolbar"
        aria-label="Quick chat · jawta · codecs"
      >
        {variant === 'dock' ? <div className="iss-reply-tool-dock-stack">{groups}</div> : groups}
      </div>
    );
  };

  return (
    <div className="footer">
      <div className="iron-search-staff" data-iron-search-staff>
        <form
          className="iron-search-staff-form"
          id="iron-search-staff-form"
          action="https://console.x.ai"
          method="get"
          autoComplete="off"
        >
          <input type="hidden" name="prompt_mode" id="iss-prompt-mode-value" value={promptMode} readOnly />
          <div className="iron-search-staff-input-row">
            <div className="iron-search-staff-chrome-cluster">
              <div className="iron-search-staff-chrome-row">
            <div className="iron-search-staff-model-wrap">
              <div className="iss-row iss-row-engine">
                <span className="iss-model-brand" id="iss-engine-brand">
                  Grok
                </span>
                <span className="iss-model-sep">·</span>
                <select
                  className="iron-search-staff-model"
                  id="iron-search-engine"
                  aria-label="Company or engine"
                  title="Grok, Grokipedia, xAI, and partner sites"
                  defaultValue="grok"
                >
                  <option value="grok">Grok</option>
                  <option value="grokipedia">Grokipedia</option>
                  <option value="xai">X.ai</option>
                  <option value="docsxai">docs.x.ai</option>
                  <option value="xcom">X.com</option>
                  <option value="spacex">SpaceX</option>
                  <option value="starlink">Starlink</option>
                  <option value="terrafab">Terrafab</option>
                  <option value="neuralink">Neuralink</option>
                  <option value="boring">Boring Co.</option>
                  <option value="tesla">Tesla</option>
                </select>
              </div>
              <div className="iss-row iss-row-depth">
                <span className="iss-depth-label">Mode</span>
                <span className="iss-model-sep iss-depth-sep">·</span>
                <select
                  name="model"
                  className="iron-search-staff-model"
                  id="iron-search-model"
                  aria-label="Depth or money mode"
                  title="Depth (Auto…) or Money (Stock, Crypto, Live)"
                  defaultValue="auto"
                >
                  <optgroup label="Depth">
                    <option value="auto">Auto</option>
                    <option value="fast">Fast</option>
                    <option value="balanced">Balanced</option>
                    <option value="deep">Deep</option>
                    <option value="code">Code</option>
                  </optgroup>
                  <optgroup label="Money">
                    <option value="money">Money</option>
                    <option value="stock">Stock</option>
                    <option value="crypto">Crypto</option>
                    <option value="live">Live</option>
                  </optgroup>
                </select>
              </div>
              <div className="iss-row iss-row-metrics" aria-label="Context · tokens · speed">
                <span className="iss-metric-k">%</span>
                <span className="iss-metric-val" id="iss-metric-pct" title="Approx. share of a 128k context (estimated from prompt)">
                  —
                </span>
                <span className="iss-model-sep">·</span>
                <span className="iss-metric-k">tok</span>
                <span className="iss-metric-val" id="iss-metric-tokens" title="Estimated token count (chars÷4)">
                  —
                </span>
                <span className="iss-model-sep">·</span>
                <span className="iss-metric-k">spd</span>
                <span className="iss-metric-val" id="iss-metric-speed" title="Tokens/s when streaming (not connected)">
                  —
                </span>
              </div>
            </div>
            <div className="iron-search-staff-modality-wrap" id="iron-search-modality-outer">
              <input type="hidden" name="modality" id="iron-modality" value="text" />
              <div
                className="iron-search-staff-modality iss-modality-grid"
                id="iron-search-modality-bar"
                role="group"
                aria-label="Message type"
              >
                <button type="button" className="iss-mod-btn active" data-mod="text" aria-pressed="true">
                  Text
                </button>
                <button type="button" className="iss-mod-btn" data-mod="image" aria-pressed="false">
                  Image
                </button>
                <button type="button" className="iss-mod-btn" data-mod="files" aria-pressed="false">
                  Files
                </button>
                <button type="button" className="iss-mod-btn" data-mod="games" aria-pressed="false">
                  Games
                </button>
                <button type="button" className="iss-mod-btn" data-mod="video" aria-pressed="false">
                  Video
                </button>
                <button type="button" className="iss-mod-btn" data-mod="edit" aria-pressed="false">
                  Edit
                </button>
                <button type="button" className="iss-mod-btn" data-mod="train" aria-pressed="false">
                  Train
                </button>
                <button type="button" className="iss-mod-btn" data-mod="audio" aria-pressed="false">
                  Audio
                </button>
                <button type="button" className="iss-mod-btn" data-mod="live" aria-pressed="false">
                  Live
                </button>
              </div>
              <div
                className="iss-pad-toggle-row"
                role="group"
                aria-label={
                  emptyNotebook
                    ? 'Embedded browser address bar'
                    : 'Notebook pad (cells) — centered when terminal is hidden'
                }
              >
                <button
                  type="button"
                  className={'iss-mod-btn iss-footer-browser-btn' + (footerBrowserPressed ? ' active' : '')}
                  id="iss-footer-toggle-browser"
                  aria-pressed={footerBrowserPressed}
                  aria-label={
                    emptyNotebook
                      ? showBrowserToolbar
                        ? 'Hide browser address bar'
                        : 'Show browser address bar'
                      : padBodyVisible
                        ? 'Hide notebook cells'
                        : 'Show notebook cells'
                  }
                  title={
                    emptyNotebook
                      ? showBrowserToolbar
                        ? 'Hide Browser Web toolbar (◀ ▶ URL)'
                        : 'Show Browser Web toolbar'
                      : padBodyVisible
                        ? 'Hide notebook cells (+ Pad)'
                        : 'Show notebook cells (+ Pad)'
                  }
                  onClick={() => {
                    if (emptyNotebook) toggleBrowserToolbar();
                    else togglePad();
                  }}
                >
                  + Browser
                </button>
              </div>
            </div>
              <div className="iron-search-staff-quickchat-wrap">
                {quickChatToolbar('dock')}
              </div>
              </div>
            </div>
            <div className="iron-search-staff-prompt-stack">
              <div className="iron-search-staff-prompt-line">
                <div className="iss-prompt-mode-one">
                  <button
                    type="button"
                    id="iss-prompt-mode-cycle"
                    className="iss-prompt-mode-tab iss-prompt-mode-cycle active"
                    aria-controls="iron-search-q"
                    title={`${modeCfg.title} · click for next mode`}
                    aria-label={`Prompt mode ${modeCfg.label}. ${modeCfg.title}. Click to switch to the next mode.`}
                    onClick={() => cyclePromptMode(1)}
                  >
                    <span className="iss-prompt-mode-tab-main">{modeCfg.label}</span>
                  </button>
                </div>
                <div className="iron-search-staff-q-shell">
                  <input
                    type="search"
                    name="q"
                    className="iron-search-staff-q"
                    id="iron-search-q"
                    placeholder={modeCfg.placeholder}
                    enterKeyHint="send"
                    autoComplete="off"
                    aria-describedby="iss-prompt-mode-hint"
                    title={`${modeCfg.title} · Tab / Shift+Tab cycles mode · click mode button for next`}
                    onKeyDown={onPromptQKeyDown}
                  />
                </div>
                <button type="submit" className="iron-search-staff-go" id="iron-search-go">
                  {modeCfg.submitLabel}
                </button>
              </div>
              <PromptAudioMonitor
                modeTitle={modeCfg.title}
                modeLabel={modeCfg.label}
                rxImageUrl={rxImageUrl}
                onRxThumbPaste={onRxThumbPaste}
              />
              <div className="iron-search-staff-reply-row" aria-label="Quick chat">
                <div className="iss-reply-row-head">
                  <div className="iss-reply-row-head-titles">
                    <span className="iss-reply-head-brand">Quick chat</span>
                    <span className="iss-reply-head-sep" aria-hidden="true">
                      ·
                    </span>
                    <span className="iss-reply-pane-label" id="iss-reply-from-label">
                      From
                    </span>
                    <span className="iss-reply-head-sep" aria-hidden="true">
                      ·
                    </span>
                    <label className="iss-reply-pane-label" htmlFor="iss-reply-to" id="iss-reply-to-label">
                      To
                    </label>
                  </div>
                  <button
                    type="button"
                    className="iss-reply-tool-btn iss-reply-head-clear-btn"
                    title="Clear To field, receive thumb, codec direction"
                    onClick={onClearQuickReply}
                  >
                    Clear
                  </button>
                  {quickChatToolbar('inline')}
                </div>
                <div className="iss-reply-cols">
                  <div className="iss-reply-pane">
                    <div
                      className="iss-reply-from iss-reply-placeholder"
                      id="iss-reply-from"
                      role="status"
                      aria-live="polite"
                      aria-labelledby="iss-reply-from-label"
                    >
                      Incoming messages will show here.
                    </div>
                  </div>
                  <div className="iss-reply-pane">
                    <textarea
                      className="iron-search-staff-reply"
                      id="iss-reply-to"
                      rows={2}
                      autoComplete="off"
                      placeholder="Quick reply — mesh sends this text…"
                      enterKeyHint="send"
                      aria-labelledby="iss-reply-to-label"
                      title="Quick reply body; mesh uses this field when you click mesh"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
        <div className="iron-search-staff-hint">
          <div className="iss-left">
            <span className="iss-strong">Grok</span>
            <span className="iss-dim" id="iss-hint-model">
              Auto
            </span>
            <span className="iss-dim">·</span>
            <span className="iss-dim" id="iss-hint-target">
              console.x.ai
            </span>
          </div>
          <div className="iss-hint-mid">
            <div className="iron-search-staff-q-shell iss-hint-q-shell">
              <input
                type="text"
                className="iron-search-staff-q"
                id="iss-hint-input"
                placeholder="Scratchpad — Enter → Notebook"
                autoComplete="off"
                enterKeyHint="send"
                aria-label="Footer scratchpad (Enter sends to notebook)"
              />
            </div>
          </div>
          <div className="iss-right">
            <span>
              <span className="iss-dim">@</span> <span className="iss-k">files</span>
            </span>
            <span>
              <span className="iss-k">enter</span> <span className="iss-dim">scratchpad → notebook</span>
            </span>
            <span>
              <span className="iss-k">tab</span> <span className="iss-dim">quick chat</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;

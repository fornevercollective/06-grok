/**
 * Footer engine + Grokipedia / Games panel sync — mirrors `syncFooterModelHint` + `syncLiveModalityUi`
 * in ../notes.html for the Vite React shell (no inline notes.html script).
 */

import { useAppStore } from '../store';

const IRON_ENGINE_UI: Record<
  string,
  { brand: string; hint: string; hideDepth: boolean; grokipediaPanel: boolean }
> = {
  grok: { brand: 'Grok', hint: 'console.x.ai', hideDepth: false, grokipediaPanel: false },
  grokipedia: { brand: 'Grokipedia', hint: 'grokipedia.com', hideDepth: true, grokipediaPanel: true },
  xai: { brand: 'X.ai', hint: 'console.x.ai', hideDepth: false, grokipediaPanel: false },
  docsxai: { brand: 'x.ai docs', hint: 'docs.x.ai', hideDepth: true, grokipediaPanel: false },
  xcom: { brand: 'X.com', hint: 'x.com', hideDepth: true, grokipediaPanel: false },
  spacex: { brand: 'SpaceX', hint: 'spacex.com', hideDepth: true, grokipediaPanel: false },
  starlink: { brand: 'Starlink', hint: 'starlink.com', hideDepth: true, grokipediaPanel: false },
  terrafab: { brand: 'Terrafab', hint: 'terrafab.ai', hideDepth: true, grokipediaPanel: false },
  neuralink: { brand: 'Neuralink', hint: 'neuralink.com', hideDepth: true, grokipediaPanel: false },
  boring: { brand: 'Boring Co.', hint: 'boringcompany.com', hideDepth: true, grokipediaPanel: false },
  tesla: { brand: 'Tesla', hint: 'tesla.com', hideDepth: true, grokipediaPanel: false },
};

function ironEngineUi(v: string) {
  return IRON_ENGINE_UI[v] || IRON_ENGINE_UI.grok;
}

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function getIronModality(): string {
  const m = $('iron-modality') as HTMLInputElement | null;
  return ((m && m.value) || 'text').trim() || 'text';
}

let _footerLiveLogOnce = false;

/** Live / train modality chrome (from notes.html `syncLiveModalityUi`). */
function syncLiveModalityUi(): void {
  const mod = getIronModality();
  const staff = document.querySelector('[data-iron-search-staff]');
  const iq = $('iron-search-q') as HTMLInputElement | null;
  const isLive = mod === 'live';
  if (staff) staff.classList.toggle('iss-footer-live', !!isLive);
  /** Footer “Live” = messaging modality only (placeholder, iss-footer-live). Hexcast overlay is #btn-toggle-live (+Live). */
  useAppStore.getState().setFooterLiveEmbed(!!isLive);
  if (isLive && !_footerLiveLogOnce) {
    _footerLiveLogOnce = true;
    console.info('[nt-live] footer modality Live — live messaging / placeholder (not the +Live hexcast overlay)');
  }
  if (!isLive) _footerLiveLogOnce = false;
  const w = window as Window & { __ntLiveHexcastSync?: (on: boolean) => void };
  /** Vanilla notes.html hook: mirror React +Live only, not footer modality. */
  const reactHexcastOn = useAppStore.getState().showLive;
  if (typeof w.__ntLiveHexcastSync === 'function') w.__ntLiveHexcastSync(!!reactHexcastOn);
  if (iq) {
    if (isLive) {
      if (iq.dataset._phSaved == null) iq.dataset._phSaved = iq.placeholder || '';
      iq.placeholder =
        'Live message — console + built-in hexcast below (BroadcastChannel)…';
    } else if (mod === 'games') {
      if (iq.dataset._phSaved == null) iq.dataset._phSaved = iq.placeholder || '';
      iq.placeholder = 'Games · select or search…';
    } else if (mod === 'train') {
      if (iq.dataset._phSaved == null) iq.dataset._phSaved = iq.placeholder || '';
      iq.placeholder = 'Train · objective, data, or training step…';
    } else if (iq.dataset._phSaved != null) {
      iq.placeholder = iq.dataset._phSaved;
      delete iq.dataset._phSaved;
    }
  }
}

export function syncFooterModelHint(setCurrentBrand?: (brand: string) => void): void {
  const eng = $('iron-search-engine') as HTMLSelectElement | null;
  const sel = $('iron-search-model') as HTMLSelectElement | null;
  const hint = $('iss-hint-model');
  const ht = $('iss-hint-target');
  const wrap = document.querySelector('.iron-search-staff-model-wrap');

  const v = eng && eng.value ? eng.value : 'grok';
  if (setCurrentBrand) setCurrentBrand(v);
  const ui = ironEngineUi(v);
  const gk = v === 'grokipedia';
  const mod = getIronModality();

  if (wrap) {
    wrap.classList.toggle('iss-hide-depth', !!ui.hideDepth);
  }
  const modBar = $('iron-search-modality-bar');
  /** Hide only the 3×3 grid for non-Grok engines; keep footer + Browser row visible (see Footer.tsx). */
  if (modBar) modBar.classList.toggle('iss-modality-hidden', !(v === 'grok' || v === 'xai'));

  const main = $('main');
  if (main) main.classList.toggle('grokipedia-panel-active', !!gk || mod === 'games' || v === 'tesla' || v === 'starlink' || v === 'hexcast');

  const issStrong = document.querySelector('.iron-search-staff-hint .iss-left .iss-strong');
  if (issStrong) issStrong.textContent = ui.brand;
  const issEngineBrand = $('iss-engine-brand');
  if (issEngineBrand) issEngineBrand.textContent = ui.brand;

  if (sel && hint) {
    const o = sel.options[sel.selectedIndex];
    hint.textContent = ui.hideDepth ? '—' : o ? String(o.textContent).trim() || '—' : '—';
  }
  if (ht) ht.textContent = ui.hint;

  const iq = $('iron-search-q') as HTMLInputElement | null;
  const go = $('iron-search-go');
  if (iq) {
    if (gk) iq.placeholder = 'Search Grokipedia…';
    else if (v === 'grok' || v === 'xai') iq.placeholder = 'Message Grok . . .';
    else if (mod === 'games') iq.placeholder = 'Games · select or search…';
    else iq.placeholder = 'Search ' + ui.brand + '…';
  }
  if (go) {
    if (gk) go.textContent = 'Search';
    else if (v === 'grok' || v === 'xai') go.textContent = 'Ask';
    else if (mod === 'games') go.textContent = 'Play';
    else go.textContent = 'Open';
  }

  if (main) main.style.removeProperty('grid-template-columns');

  /** Games modality opens the React #nt-games-hexcast overlay (see Footer + App); do not hijack #grokipedia-frame. */

  if (!gk && mod !== 'games') {
    const frame = $('grokipedia-frame');
    const emp = $('grokipedia-empty');
    const vw = $('gp-viewer');
    if (frame) {
      frame.setAttribute('hidden', '');
      frame.removeAttribute('src');
    }
    if (emp) emp.hidden = false;
    if (vw) {
      vw.hidden = true;
      vw.innerHTML = '';
    }
    const gu = $('gpb-url') as HTMLInputElement | null;
    const giu = $('gi-url') as HTMLInputElement | null;
    if (gu) gu.value = '';
    if (giu) giu.value = '';
    const gpbBar = $('gpb-bar');
    if (gpbBar) gpbBar.style.removeProperty('display');
    const w = window as Window & { __gpNavReset?: () => void };
    if (typeof w.__gpNavReset === 'function') w.__gpNavReset();
  }

  syncLiveModalityUi();
}

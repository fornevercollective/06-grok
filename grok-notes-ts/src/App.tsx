import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from './store';
import PluginManager from './plugins/pluginManager';
import { collaborationService } from './services/collaboration';
import { mlService } from './services/mlService';
import { offlineSyncService } from './services/offlineSync';
import { performanceMonitor } from './services/performanceMonitor';
import Footer from './components/Footer';
import NotesDrawer from './components/NotesDrawer';
import NotebookPane from './components/NotebookPane';
import DrawLayer from './components/DrawLayer';
import VisualWallOverlay from './components/VisualWallOverlay';
import ShortcutPopup from './components/ShortcutPopup';
import HexcastPanel from './components/Hexcast';

import TeslaMap from './components/TeslaMap';
import StarlinkMap from './components/StarlinkMap';
import GamesHubStudio from './components/GamesHubStudio';
import type { GamesSortKey } from './components/GamesHubStudio';
import GoGame from './components/GoGame';
import ChessGame from './components/ChessGame';
import NeuralinkGrid from './components/NeuralinkGrid';
import { initGrokTerminal } from './terminal/grokTerminal';
import { uvspeedEmbedBlocked, uvspeedPageUrl } from './lib/uvspeedWebBase';
import { sendToUgradIframe } from './lib/ugradEmbedBridge';
import {
  UGRAD_BLOCH_SUB_PRIMARY,
  UGRAD_CMD_GROUPS,
  UGRAD_HDR_BUTTONS,
  UGRAD_QENUM_COLUMNS,
  UGRAD_Q_ENUM_ROWS,
} from './constants/ugradR0Menu';
import UgradBlochSphereSvg from './components/UgradBlochSphereSvg';
import {
  liveVideoDedupeKey,
  parseGrokipediaVideoLine,
  splitGrokipediaVideoPaste,
  tweetEmbedSrc,
  xTweetIdFromEmbedSrc,
  youtubeVideoIdFromEmbedSrc,
  type GrokipediaVideoKind,
} from './lib/grokipediaVideoEmbed';
import { fetchYoutubeTranscriptFromBackend, fetchYoutubeTitle } from './lib/liveBackend';
import { captureScreenToPngDataUrl, insertCaptureIntoNotebook } from './lib/captureToNote';
import './App.css';

type LiveVideoItem = { id: string; kind: GrokipediaVideoKind; src: string; title?: string };

function appendUniqueLiveVideos(
  prev: LiveVideoItem[],
  candidates: LiveVideoItem[]
): { merged: LiveVideoItem[]; focusLastId?: string } {
  const seen = new Set(prev.map((x) => liveVideoDedupeKey(x.src)));
  const trulyNew: LiveVideoItem[] = [];
  for (const item of candidates) {
    const k = liveVideoDedupeKey(item.src);
    if (seen.has(k)) continue;
    seen.add(k);
    trulyNew.push(item);
  }
  if (!trulyNew.length) return { merged: prev };
  return {
    merged: [...prev, ...trulyNew],
    focusLastId: trulyNew[trulyNew.length - 1]!.id,
  };
}

function liveVideoTabLabel(item: LiveVideoItem, index: number): string {
  if (item.title) return item.title.slice(0, 20);
  try {
    if (item.kind === 'iframe') {
      const u = new URL(item.src);
      const host = u.hostname.replace(/^www\./, '');
      if (host.includes('youtube.com') || host === 'youtu.be') return `V${index + 1} · YouTube`;
      if (host.includes('vimeo.com')) return `V${index + 1} · Vimeo`;
      if (host === 'platform.twitter.com') return `V${index + 1} · X`;
      return `V${index + 1} · ${host.slice(0, 18)}`;
    }
  } catch {
    /* ignore */
  }
  return `V${index + 1} · video`;
}

type GameBoardId = 'hub' | 'go' | 'chess' | 'neuralink' | 'sports' | 'checkers' | 'cards' | 'blackjack' | 'battleship' | 'backgammon' | 'calligraphy' | 'cupstack' | 'dexterity' | 'digital-alphabet' | 'flashcards' | 'glyph' | 'go-monitor' | 'gomoku' | 'games-terminal' | 'hanafuda' | 'iching' | 'kobenhavn' | 'mahjong' | 'mancala' | 'memory' | 'mindmaze' | 'pong' | 'robotics' | 'raw-games' | 'snake' | 'tarot' | 'typing' | 'webgrid' | 'visualspeed';

const GAME_BOARDS: readonly {
  id: GameBoardId;
  navLabel: string;
  file: string;
  panelTitle: string;
}[] = [
  { id: 'hub', navLabel: 'Hub', file: 'games-ugrad-hub.html', panelTitle: 'Games Hub' },
  { id: 'go', navLabel: 'Go', file: 'go-ugrad.html', panelTitle: 'Go Game' },
  { id: 'chess', navLabel: 'Chess', file: 'chess-ugrad.html', panelTitle: 'Chess Game' },
  { id: 'neuralink', navLabel: 'Neuralink', file: 'glyph.html', panelTitle: 'Glyph Game' },
  { id: 'sports', navLabel: 'Sports', file: 'sports-field-ugrad.html', panelTitle: 'Sports Field' },
  { id: 'checkers', navLabel: 'Checkers', file: 'checkers-ugrad.html', panelTitle: 'Checkers Game' },
  { id: 'cards', navLabel: 'Cards', file: 'cards-ugrad.html', panelTitle: 'Card Games' },
  { id: 'blackjack', navLabel: 'Blackjack', file: 'blackjack-ugrad.html', panelTitle: 'Blackjack' },
  { id: 'battleship', navLabel: 'Battleship', file: 'battleship-ugrad.html', panelTitle: 'Battleship' },
  { id: 'backgammon', navLabel: 'Backgammon', file: 'backgammon-ugrad.html', panelTitle: 'Backgammon' },
  { id: 'calligraphy', navLabel: 'Calligraphy', file: 'calligraphy-ugrad.html', panelTitle: 'Calligraphy' },
  { id: 'cupstack', navLabel: 'Cup Stack', file: 'cupstack-ugrad.html', panelTitle: 'Cup Stacking' },
  { id: 'dexterity', navLabel: 'Dexterity', file: 'dexterity-ugrad.html', panelTitle: 'Dexterity Games' },
  { id: 'digital-alphabet', navLabel: 'Digital Alphabet', file: 'digital_alphabet.html', panelTitle: 'Digital Alphabet' },
  { id: 'flashcards', navLabel: 'Flashcards', file: 'flashcards-ugrad.html', panelTitle: 'Flashcards' },
  { id: 'glyph', navLabel: 'Glyph', file: 'glyph.html', panelTitle: 'Glyph Game' },
  { id: 'go-monitor', navLabel: 'Go Monitor', file: 'go-ugrad-monitor.html', panelTitle: 'Go Monitor' },
  { id: 'gomoku', navLabel: 'Gomoku', file: 'gomoku-ugrad.html', panelTitle: 'Gomoku' },
  { id: 'games-terminal', navLabel: 'Games Terminal', file: 'games-ugrad-terminal.html', panelTitle: 'Games Terminal' },
  { id: 'hanafuda', navLabel: 'Hanafuda', file: 'hanafuda-ugrad.html', panelTitle: 'Hanafuda' },
  { id: 'iching', navLabel: 'I Ching', file: 'iching-ugrad.html', panelTitle: 'I Ching' },
  { id: 'kobenhavn', navLabel: 'Kobenhavn', file: 'kobenhavn-ugrad.html', panelTitle: 'Kobenhavn' },
  { id: 'mahjong', navLabel: 'Mahjong', file: 'mahjong-ugrad.html', panelTitle: 'Mahjong' },
  { id: 'mancala', navLabel: 'Mancala', file: 'mancala-ugrad.html', panelTitle: 'Mancala' },
  { id: 'memory', navLabel: 'Memory', file: 'memory-ugrad.html', panelTitle: 'Memory Game' },
  { id: 'mindmaze', navLabel: 'Mind Maze', file: 'mindmaze-ugrad.html', panelTitle: 'Mind Maze' },
  { id: 'pong', navLabel: 'Pong', file: 'pong-ugrad.html', panelTitle: 'Pong' },
  { id: 'robotics', navLabel: 'Robotics', file: 'robotics-ugrad.html', panelTitle: 'Robotics' },
  { id: 'raw-games', navLabel: 'Raw Games', file: 'raw-games-ugrad.html', panelTitle: 'Raw Games' },
  { id: 'snake', navLabel: 'Snake', file: 'snake-ugrad.html', panelTitle: 'Snake' },
  { id: 'tarot', navLabel: 'Tarot', file: 'tarot-ugrad.html', panelTitle: 'Tarot' },
  { id: 'typing', navLabel: 'Typing', file: 'typing-ugrad.html', panelTitle: 'Typing' },
  { id: 'webgrid', navLabel: 'Web Grid', file: 'webgrid-ugrad.html', panelTitle: 'Web Grid' },
  { id: 'visualspeed', navLabel: 'Visual Speed', file: 'visualspeed-ugrad.html', panelTitle: 'Visual Speed' },
];

function sortGameBoards(boards: readonly (typeof GAME_BOARDS)[number][], key: GamesSortKey): (typeof GAME_BOARDS)[number][] {
  const list = [...boards];
  if (key === 'alpha') {
    list.sort((a, b) => a.navLabel.localeCompare(b.navLabel));
  } else if (key === 'training') {
    const pr: Partial<Record<GameBoardId, number>> = {
      hub: 0,
      go: 1,
      chess: 2,
      neuralink: 3,
      'games-terminal': 4,
      'go-monitor': 5,
      gomoku: 6,
      checkers: 7,
      backgammon: 8,
      sports: 9,
      mahjong: 10,
    };
    list.sort((a, b) => (pr[a.id] ?? 100) - (pr[b.id] ?? 100) || a.navLabel.localeCompare(b.navLabel));
  }
  return list;
}

type NewsStreamItem = { name: string; url: string };

/** Same string the rail uses as `item.src` after add (YouTube embed URL). */
function liveStudioEmbedSrcForStream(url: string): string {
  return parseGrokipediaVideoLine(url)?.src ?? url;
}

/** Grouped for the Live Studio sidebar: world / major US cable+broadcast / independent-style outlets (YouTube IDs — replace if a feed moves). */
const NEWS_STREAM_GROUPS: readonly { key: string; label: string; streams: readonly NewsStreamItem[] }[] = [
  {
    key: 'world',
    label: 'World',
    streams: [
      { name: 'Al Jazeera', url: 'https://www.youtube.com/watch?v=4L2-D8nO5xE' },
      { name: 'BBC News', url: 'https://www.youtube.com/watch?v=9Auq9mYxFEE' },
      { name: 'Reuters', url: 'https://www.youtube.com/watch?v=4L2-D8nO5xE' },
    ],
  },
  {
    key: 'major',
    label: 'Major',
    streams: [
      { name: 'CNN', url: 'https://www.youtube.com/watch?v=9gBL1v9Tf_I' },
      { name: 'Fox News', url: 'https://www.youtube.com/watch?v=6p6M2NpI5K8' },
      { name: 'MSNBC', url: 'https://www.youtube.com/watch?v=GEHd6HkzK68' },
      { name: 'CBS News', url: 'https://www.youtube.com/watch?v=BqG2AaR4kIQ' },
      { name: 'ABC News Live', url: 'https://www.youtube.com/watch?v=w_M_a8X0cgQ' },
      { name: 'NBC News Now', url: 'https://www.youtube.com/watch?v=WN3hHtDitN4' },
      { name: 'CNBC', url: 'https://www.youtube.com/watch?v=nqz8s9VJ8ZI' },
      { name: 'Bloomberg TV', url: 'https://www.youtube.com/embed/dp8phLsFtME' },
    ],
  },
  {
    key: 'independent',
    label: 'Independent',
    streams: [
      { name: 'Democracy Now!', url: 'https://www.youtube.com/watch?v=9Auq9mYxFEE' },
      { name: 'PBS NewsHour', url: 'https://www.youtube.com/watch?v=4L2-D8nO5xE' },
      { name: 'The Hill', url: 'https://www.youtube.com/watch?v=6p6M2NpI5K8' },
    ],
  },
];

/** Sidebar quick-add: unique YouTube sources (labels = video id). Same list as multi-paste {{…}} wall presets. */
const WALL_SIDEBAR_PRESETS: readonly NewsStreamItem[] = [
  { name: 'q6JCfp1Nve4', url: 'https://www.youtube.com/watch?v=q6JCfp1Nve4' },
  { name: '78ncTmvcM74', url: 'https://www.youtube.com/watch?v=78ncTmvcM74' },
  { name: 'h4qG50NhzIM', url: 'https://www.youtube.com/watch?v=h4qG50NhzIM' },
  { name: 'FYj2AKYdwz8', url: 'https://www.youtube.com/watch?v=FYj2AKYdwz8' },
  { name: 'rnXIjl_Rzy4', url: 'https://www.youtube.com/watch?v=rnXIjl_Rzy4' },
  { name: '03pYP2Nmreo', url: 'https://www.youtube.com/watch?v=03pYP2Nmreo' },
  { name: 'Cm1v4bteXbI', url: 'https://www.youtube.com/watch?v=Cm1v4bteXbI' },
  { name: '77akujLn4k8', url: 'https://www.youtube.com/watch?v=77akujLn4k8' },
  { name: 'Fu8vYoIkaeM', url: 'https://www.youtube.com/watch?v=Fu8vYoIkaeM' },
  { name: 'v9JBMnxuPX8', url: 'https://www.youtube.com/watch?v=v9JBMnxuPX8' },
  { name: 'iEpJwprxDdk', url: 'https://www.youtube.com/embed/iEpJwprxDdk' },
];

/** Live Studio rail + sorting: matches transcript sidebar buckets (wall = preset id list). */
type LiveVideoStream = 'world' | 'major' | 'independent' | 'wall' | 'paste';

const LIVE_VIDEO_STREAM_ORDER: readonly LiveVideoStream[] = ['world', 'major', 'independent', 'wall', 'paste'];

const LIVE_VIDEO_STREAM_LABELS: Record<LiveVideoStream, string> = {
  world: 'World',
  major: 'Major',
  independent: 'Independent',
  wall: 'Wall presets',
  paste: 'Pasted / other',
};

function buildNewsVidStreamMap(): Map<string, LiveVideoStream> {
  const m = new Map<string, LiveVideoStream>();
  for (const g of NEWS_STREAM_GROUPS) {
    const key = g.key as LiveVideoStream;
    for (const s of g.streams) {
      const p = parseGrokipediaVideoLine(s.url);
      if (!p) continue;
      const id = youtubeVideoIdFromEmbedSrc(p.src);
      if (id) m.set(id, key);
    }
  }
  return m;
}

function buildWallIdSet(): Set<string> {
  const st = new Set<string>();
  for (const s of WALL_SIDEBAR_PRESETS) {
    const p = parseGrokipediaVideoLine(s.url);
    if (!p) continue;
    const id = youtubeVideoIdFromEmbedSrc(p.src);
    if (id) st.add(id);
  }
  return st;
}

const LIVE_NEWS_VID_TO_STREAM = buildNewsVidStreamMap();
const LIVE_WALL_ID_SET = buildWallIdSet();

function liveVideoStreamForItem(item: { kind: GrokipediaVideoKind; src: string }): LiveVideoStream {
  if (item.kind !== 'iframe') return 'paste';
  const id = youtubeVideoIdFromEmbedSrc(item.src);
  if (!id) return 'paste';
  if (LIVE_WALL_ID_SET.has(id)) return 'wall';
  const fromNews = LIVE_NEWS_VID_TO_STREAM.get(id);
  if (fromNews) return fromNews;
  return 'paste';
}

function groupLiveVideosByStream(items: LiveVideoItem[]): { stream: LiveVideoStream; label: string; items: LiveVideoItem[] }[] {
  const buckets: Record<LiveVideoStream, LiveVideoItem[]> = {
    world: [],
    major: [],
    independent: [],
    wall: [],
    paste: [],
  };
  for (const item of items) {
    buckets[liveVideoStreamForItem(item)].push(item);
  }
  return LIVE_VIDEO_STREAM_ORDER.filter((k) => buckets[k].length > 0).map((k) => ({
    stream: k,
    label: LIVE_VIDEO_STREAM_LABELS[k],
    items: buckets[k],
  }));
}

/** Shell markup mirrors notes.html; TS wiring is incremental. Use React onClick for toggles — StrictMode double-mounts effects, so addEventListener ran twice and each click fired toggles twice (no visible change). */
function App() {
  const showTerminal = useAppStore((s) => s.showTerminal);
  const showPad = useAppStore((s) => s.showPad);
  const showNotes = useAppStore((s) => s.showNotes);
  const showDraw = useAppStore((s) => s.showDraw);
  const showLive = useAppStore((s) => s.showLive);
  const grokipediaActive = useAppStore((s) => s.grokipediaActive);
  const currentBrand = useAppStore((s) => s.currentBrand);
  const isCollaborating = useAppStore((s) => s.isCollaborating);
  const showChat = useAppStore((s) => s.showChat);
  const showFileWall = useAppStore((s) => s.showFileWall);
  const showGames = useAppStore((s) => s.showGames);
  const setShowGames = useAppStore((s) => s.setShowGames);
  const toggleGames = useAppStore((s) => s.toggleGames);

  /** Top +Live only — Studio vs uvspeed hexcast / ugrad-r0 (footer Live uses modality, not this). */
  const [liveHxTab, setLiveHxTab] = useState<'studio' | 'hexcast' | 'ugrad'>('studio');
  const [liveExpanded, setLiveExpanded] = useState(false);
  const [activeGameTab, setActiveGameTab] = useState<GameBoardId>('hub');
  const [gamesSortKey, setGamesSortKey] = useState<GamesSortKey>('default');
  const sortedGameBoards = useMemo(() => sortGameBoards(GAME_BOARDS, gamesSortKey), [gamesSortKey]);
  const cycleGamesSort = useCallback(() => {
    setGamesSortKey((k) => (k === 'default' ? 'alpha' : k === 'alpha' ? 'training' : 'default'));
  }, []);
  const goToGamesHub = useCallback(() => setActiveGameTab('hub'), []);
  /** Rail / Board menu opens full uvspeed pages; bar gives ← Hub + Pop out on each board tab. */
  const renderGamesBoardBar = useCallback(
    (title: string, file: string) => (
      <div className="nt-games-subpanel-hd" role="navigation" aria-label="Board navigation">
        <button type="button" className="nt-games-back-hub-btn" onClick={goToGamesHub}>
          ← Hub
        </button>
        <span className="nt-games-subpanel-title">{title}</span>
        <button
          type="button"
          className="nt-games-popout-btn"
          onClick={() => window.open(uvspeedPageUrl(file), '_blank', 'noopener,noreferrer')}
          title={'Pop out · ' + file}
        >
          Pop out
        </button>
      </div>
    ),
    [goToGamesHub]
  );
  const [grokipediaUrl, setGrokipediaUrl] = useState('');
  const [liveVideos, setLiveVideos] = useState<LiveVideoItem[]>([]);
  const [liveVideoPaste, setLiveVideoPaste] = useState('');
  /** queue = URL paste UI; otherwise focused video id (tab/card). */
  const [activeStudioSubTab, setActiveStudioSubTab] = useState<'queue' | string>('queue');
  const [liveTranscripts, setLiveTranscripts] = useState<Record<string, string>>({});
  const [captionBusy, setCaptionBusy] = useState(false);
  const [captionErr, setCaptionErr] = useState<string | null>(null);
  const [dictationOn, setDictationOn] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  /** Live Studio sidebar — World / Major / Independent grid under News streams */
  const [newsByCategoryOpen, setNewsByCategoryOpen] = useState(true);

  /** X/Twitter Tweet embed theme (Live Studio). */
  const [liveXTweetDark, setLiveXTweetDark] = useState(false);
  /** Document Picture-in-Picture window for Live iframe (Chrome); main iframe blanked while active. */
  const [liveDocPipActive, setLiveDocPipActive] = useState(false);
  const liveVidFrameRef = useRef<HTMLDivElement>(null);
  const livePipWindowRef = useRef<Window | null>(null);
  const livePipIframeRef = useRef<HTMLIFrameElement | null>(null);
  const liveDocPipActiveRef = useRef(false);
  const liveVidVideoRef = useRef<HTMLVideoElement>(null);
  liveDocPipActiveRef.current = liveDocPipActive;

  const resolvedLiveIframeSrc = useCallback(
    (item: LiveVideoItem) => {
      if (item.kind !== 'iframe') return item.src;
      const tid = xTweetIdFromEmbedSrc(item.src);
      if (tid) return tweetEmbedSrc(tid, liveXTweetDark ? 'dark' : 'light');
      return item.src;
    },
    [liveXTweetDark]
  );

  const canSpeechDictation =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    );

  const loadGrokipediaUrl = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    let u = trimmed;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      const response = await fetch('http://localhost:3000/api/proxy?url=' + encodeURIComponent(u));
      const data = await response.json();
      if (data.error) {
        console.error(data.error);
        return;
      }
      const leftEl = document.getElementById('gp-left');
      const mainEl = document.getElementById('gp-main');
      const notesEl = document.getElementById('gp-notes');
      const analysisEl = document.getElementById('gp-analysis');
      if (leftEl) {
        leftEl.innerHTML = data.left;
        leftEl.hidden = false;
      }
      if (mainEl) {
        mainEl.innerHTML = data.main;
        mainEl.hidden = false;
      }
      if (notesEl) {
        notesEl.innerHTML = data.notes;
        notesEl.hidden = false;
      }
      if (analysisEl) {
        analysisEl.innerHTML = data.analysis;
        analysisEl.hidden = false;
      }
      const emp = document.getElementById('grokipedia-empty');
      if (emp) emp.hidden = true;
      setGrokipediaUrl(u);
    } catch (error) {
      console.error('Failed to load page:', error);
    }
  }, []);

  useEffect(() => {
    const w = window as Window & {
      loadGrokipediaFromFooter?: (q: string) => void;
      loadLiveVideos?: (urls: string | string[]) => void;
      loadGrokipediaVideos?: (urls: string | string[]) => void;
      __liveVideoWallClear?: () => void;
      __grokipediaVideoWallClear?: () => void;
    };
    const appendLiveVideos = (urls: string | string[]) => {
      const rawList = Array.isArray(urls) ? urls : [urls];
      const next: LiveVideoItem[] = [];
      for (const raw of rawList) {
        const lines = splitGrokipediaVideoPaste(String(raw));
        const toTry = lines.length ? lines : [String(raw)];
        for (const line of toTry) {
          const p = parseGrokipediaVideoLine(line);
          if (p) {
            next.push({
              id: `lv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
              kind: p.kind,
              src: p.src,
            });
          }
        }
      }
      if (next.length) {
        setLiveVideos((prev) => {
          const { merged, focusLastId } = appendUniqueLiveVideos(prev, next);
          if (focusLastId) queueMicrotask(() => setActiveStudioSubTab(focusLastId));
          return merged;
        });
      }
    };
    const clearLiveVideos = () => {
      setLiveVideos([]);
      setActiveStudioSubTab('queue');
      setLiveTranscripts({});
    };

    w.loadGrokipediaFromFooter = (q: string) => {
      if (!q) return;
      const url = 'https://grokipedia.com/search?q=' + encodeURIComponent(q);
      loadGrokipediaUrl(url);
    };
    w.loadLiveVideos = appendLiveVideos;
    w.loadGrokipediaVideos = appendLiveVideos;
    w.__liveVideoWallClear = clearLiveVideos;
    w.__grokipediaVideoWallClear = clearLiveVideos;
    return () => {
      delete w.loadGrokipediaFromFooter;
      delete w.loadLiveVideos;
      delete w.loadGrokipediaVideos;
      delete w.__liveVideoWallClear;
      delete w.__grokipediaVideoWallClear;
    };
  }, [loadGrokipediaUrl]);

  const hexcastPageUrl = useMemo(() => uvspeedPageUrl('hexcast'), []);
  const hexcastCantEmbed = useMemo(() => uvspeedEmbedBlocked(hexcastPageUrl), [hexcastPageUrl]);
  const ugradPageUrl = useMemo(() => uvspeedPageUrl('ugrad-r0.html'), []);
  const ugradCantEmbed = useMemo(() => uvspeedEmbedBlocked(ugradPageUrl), [ugradPageUrl]);
  const ugradIframeRef = useRef<HTMLIFrameElement>(null);

  const addLiveVideosFromPaste = useCallback(async () => {
    const lines = splitGrokipediaVideoPaste(liveVideoPaste);
    const next: LiveVideoItem[] = [];
    for (const line of lines) {
      const p = parseGrokipediaVideoLine(line);
      if (p) {
        const item: LiveVideoItem = {
          id: `lv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          kind: p.kind,
          src: p.src,
        };
        // Fetch title for YouTube
        const vidId = youtubeVideoIdFromEmbedSrc(p.src);
        if (vidId) {
          try {
            item.title = await fetchYoutubeTitle(vidId);
          } catch {
            item.title = 'Unknown Title';
          }
        }
        next.push(item);
      }
    }
    if (next.length) {
      setLiveVideos((prev) => {
        const { merged, focusLastId } = appendUniqueLiveVideos(prev, next);
        if (focusLastId) queueMicrotask(() => setActiveStudioSubTab(focusLastId));
        return merged;
      });
    }
  }, [liveVideoPaste]);

  const addNewsStream = useCallback(async (stream: { name: string; url: string }) => {
    const p = parseGrokipediaVideoLine(stream.url);
    if (p) {
      const item: LiveVideoItem = {
        id: `lv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        kind: p.kind,
        src: p.src,
        title: `${stream.name} Live`,
      };
      setLiveVideos((prev) => {
        const { merged, focusLastId } = appendUniqueLiveVideos(prev, [item]);
        if (focusLastId) queueMicrotask(() => setActiveStudioSubTab(focusLastId));
        return merged;
      });
    }
  }, []);

  const removeLiveVideo = useCallback((id: string) => {
    setLiveVideos((prev) => prev.filter((x) => x.id !== id));
    setLiveTranscripts((t) => {
      const { [id]: _, ...rest } = t;
      return rest;
    });
    setActiveStudioSubTab((cur) => (cur === id ? 'queue' : cur));
  }, []);

  const closeLiveDocumentPip = useCallback(() => {
    try {
      livePipWindowRef.current?.close?.();
    } catch {
      /* ignore */
    }
    livePipWindowRef.current = null;
    livePipIframeRef.current = null;
    setLiveDocPipActive(false);
  }, []);

  const openLiveDocumentPip = useCallback(async () => {
    const item = liveVideos.find((v) => v.id === activeStudioSubTab);
    if (!item || item.kind !== 'iframe') return;
    const src = resolvedLiveIframeSrc(item);
    const dpip = (
      window as Window & {
        documentPictureInPicture?: {
          requestWindow(o?: { width?: number; height?: number }): Promise<Window>;
        };
      }
    ).documentPictureInPicture;
    if (dpip?.requestWindow) {
      try {
        const pw = Math.min(1600, Math.max(480, Math.round(window.innerWidth * 0.92)));
        const ph = Math.min(1000, Math.max(360, Math.round(window.innerHeight * 0.88)));
        const pipWin = await dpip.requestWindow({ width: pw, height: ph });
        livePipWindowRef.current = pipWin;
        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.background = '#000';
        const ifr = pipWin.document.createElement('iframe');
        ifr.className = 'nt-live-vid-embed';
        ifr.title = 'Live embed (picture-in-picture)';
        ifr.src = src;
        ifr.allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        ifr.setAttribute(
          'sandbox',
          'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox'
        );
        ifr.referrerPolicy = 'no-referrer-when-downgrade';
        ifr.style.cssText = 'display:block;width:100%;height:100vh;border:0;';
        pipWin.document.body.appendChild(ifr);
        livePipIframeRef.current = ifr;
        setLiveDocPipActive(true);
        pipWin.addEventListener('pagehide', () => {
          livePipWindowRef.current = null;
          livePipIframeRef.current = null;
          setLiveDocPipActive(false);
        });
        return;
      } catch (e) {
        console.warn('Document Picture-in-Picture unavailable:', e);
      }
    }
    const frame = liveVidFrameRef.current;
    if (frame?.requestFullscreen) {
      try {
        await frame.requestFullscreen();
      } catch (e) {
        console.warn('Fullscreen fallback failed:', e);
      }
    }
  }, [activeStudioSubTab, liveVideos, resolvedLiveIframeSrc]);

  const openLiveVideoNativePip = useCallback(async () => {
    const v = liveVidVideoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
        return;
      }
      await v.requestPictureInPicture();
    } catch (e) {
      console.warn('Video PiP failed:', e);
    }
  }, []);

  const openLiveFrameFullscreen = useCallback(async () => {
    const frame = liveVidFrameRef.current;
    if (!frame?.requestFullscreen) return;
    try {
      await frame.requestFullscreen();
    } catch (e) {
      console.warn('Fullscreen failed:', e);
    }
  }, []);

  useEffect(() => {
    if (!liveDocPipActive || !livePipIframeRef.current) return;
    const item = liveVideos.find((v) => v.id === activeStudioSubTab);
    if (!item || item.kind !== 'iframe') return;
    const next = resolvedLiveIframeSrc(item);
    if (livePipIframeRef.current.src !== next) {
      livePipIframeRef.current.src = next;
    }
  }, [liveXTweetDark, liveDocPipActive, activeStudioSubTab, liveVideos, resolvedLiveIframeSrc]);

  useEffect(() => {
    if (!liveDocPipActiveRef.current) return;
    closeLiveDocumentPip();
  }, [activeStudioSubTab, closeLiveDocumentPip]);

  const liveVideoRailGroups = useMemo(() => groupLiveVideosByStream(liveVideos), [liveVideos]);

  const liveVideoIndexById = useMemo(() => {
    const m = new Map<string, number>();
    liveVideos.forEach((v, i) => m.set(v.id, i));
    return m;
  }, [liveVideos]);

  const loadYoutubeCaptionsForActive = useCallback(async () => {
    if (activeStudioSubTab === 'queue') return;
    const item = liveVideos.find((x) => x.id === activeStudioSubTab);
    if (!item || item.kind !== 'iframe') {
      setCaptionErr('Caption fetch works for YouTube embeds.');
      return;
    }
    const vid = youtubeVideoIdFromEmbedSrc(item.src);
    if (!vid) {
      setCaptionErr('Could not read a YouTube id from this embed.');
      return;
    }
    setCaptionBusy(true);
    setCaptionErr(null);
    try {
      const { text } = await fetchYoutubeTranscriptFromBackend(vid);
      setLiveTranscripts((prev) => {
        const id = activeStudioSubTab;
        const cur = prev[id] ?? '';
        const sep = cur.trim() ? '\n\n--- YouTube captions ---\n' : '';
        return { ...prev, [id]: cur + sep + text };
      });
    } catch (e) {
      setCaptionErr(e instanceof Error ? e.message : 'Caption fetch failed');
    } finally {
      setCaptionBusy(false);
    }
  }, [activeStudioSubTab, liveVideos]);

  const [chatHistory, setChatHistory] = useState<
    { id: string; type: string; message: string }[]
  >(() => {
    const saved = localStorage.getItem('grokChatHistory');
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed as { id: string; type: string; message: string }[];
      } catch {
        /* ignore corrupt localStorage */
      }
    }
    return [

      { id: '4874aef059d0', message: 'Can you verify all that was pending in the other session chat?', type: 'chat' },

      { id: 'abc123def456', message: 'grok chat session id 525a77f03459', type: 'chat' },

      { id: 'xyz789ghi012', message: 'from agent story continuation', type: 'chat' },

      { id: 'jkl345mno678', message: 'this was a seconded crash terminal', type: 'chat' },

      { id: 'pqr901stu234', message: 'grok cli was havin chats in the other tab like this before it froze', type: 'chat' },

      { id: 'vwx567yza890', message: 'want to migrate/implament go/chess/neuralink/sports-field into the game button', type: 'chat' },

      { id: 'bcd123efg456', message: 'create a way to view/reference/train/save grok chats like this one Chat ID {4874aef059d0}', type: 'chat' }

    ];

  });

  const togglePad = useAppStore((s) => s.togglePad);
  const toggleNotes = useAppStore((s) => s.toggleNotes);
  const addNote = useAppStore((s) => s.addNote);
  const notebookCellCount = useAppStore((s) => s.notebookCells.length);
  const emptyNotebook = notebookCellCount === 0;
  /** Same condition as NotebookPane nt-body-hidden — chrome must match actual body visibility (notes.html syncPadToggle). */
  const padBodyVisible = showPad || emptyNotebook;
  const toggleDraw = useAppStore((s) => s.toggleDraw);
  const toggleLive = useAppStore((s) => s.toggleLive);
  const toggleTerminal = useAppStore((s) => s.toggleTerminal);
  const toggleChat = useAppStore((s) => s.toggleChat);
  const setCollaborating = useAppStore((s) => s.setCollaborating);

  const captureTabToNotebook = useCallback(async () => {
    try {
      const dataUrl = await captureScreenToPngDataUrl();
      if (!dataUrl) return;
      insertCaptureIntoNotebook(dataUrl, { caption: 'Screen capture', analyze: true });
    } catch (e) {
      console.warn('[capture]', e);
    }
  }, []);

  useEffect(() => {
    const pluginManager = new PluginManager({
      store: useAppStore,
      registerCommand: (name: string, _handler: Function) => {
        console.log(`Plugin command registered: ${name}`);
      },
      registerHook: () => {},
      emitHook: () => {},
      services: {
        collaboration: collaborationService,
        ml: mlService,
        offlineSync: offlineSyncService,
        performance: performanceMonitor,
      },
    });
    (window as any).pluginManager = pluginManager;
    return () => {
      delete (window as any).pluginManager;
    };
  }, []);

  useEffect(() => {
    const w = window as Window & { notesSurfaceAppendFromScratch?: (text: string) => boolean };
    w.notesSurfaceAppendFromScratch = (text: string) => {
      const v = String(text ?? '').trim();
      if (!v) return false;
      useAppStore.getState().addNotebookCell({
        id: `cell-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: 'markdown',
        content: v,
      });
      return true;
    };
    return () => {
      delete w.notesSurfaceAppendFromScratch;
    };
  }, []);

  /** Reading layout (notes.html syncReadingSidebar): pad rail + Grokipedia article when terminal is hidden. */
  const readingSidebarLayout =
    !showPad && notebookCellCount > 0 && grokipediaActive && !showTerminal;

  /** Middle column (notebook / embed browser) when terminal + Grokipedia chrome are out of the way. */
  const padCenterStage =
    !showTerminal &&
    !grokipediaActive &&
    !readingSidebarLayout &&
    !showNotes &&
    padBodyVisible;

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    main.classList.toggle('nt-reading-sidebar', readingSidebarLayout);
    return () => main.classList.remove('nt-reading-sidebar');
  }, [readingSidebarLayout]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const tid = window.setTimeout(() => {
      const inp = document.getElementById('iss-hint-input') as HTMLInputElement | null;
      if (!inp) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const v = inp.value.trim();
        if (!v) return;
        useAppStore.getState().addNotebookCell({
          id: `cell-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: 'markdown',
          content: v,
        });
        inp.value = '';
      };
      inp.addEventListener('keydown', onKey);
      cleanup = () => inp.removeEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const cleanup = initGrokTerminal();
    return () => {
      cleanup?.();
    };
  }, []);

  /** Second terminal in +Live → ugrad (left column); no document-level focus steal (main term keeps that). */
  useEffect(() => {
    if (!showLive) return;
    return initGrokTerminal({
      outputId: 'nt-ugrad-term-output',
      inputId: 'nt-ugrad-term-input',
      globalDocumentFocus: false,
      promptTag: 'tensor',
    });
  }, [showLive]);

  useEffect(() => {
    document.documentElement.classList.toggle('nt-draw-open', showDraw);
  }, [showDraw]);

  useEffect(() => {
    if (!showLive) {
      setLiveHxTab('studio');
    }
  }, [showLive]);

  useEffect(() => {
    if (liveVideos.length === 0) setActiveStudioSubTab('queue');
  }, [liveVideos.length]);

  useEffect(() => {
    setDictationOn(false);
    setCaptionErr(null);
  }, [activeStudioSubTab]);

  useEffect(() => {
    if (!dictationOn || activeStudioSubTab === 'queue') return;
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onresult: ((ev: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
        onerror: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onresult: ((ev: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
        onerror: (() => void) | null;
      };
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
    let stopped = false;
    rec.onresult = (ev) => {
      if (stopped) return;
      const lines: string[] = [];
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (!r.isFinal) continue;
        const t = r[0]?.transcript?.trim();
        if (t) lines.push(t);
      }
      if (!lines.length) return;
      const chunk = lines.join('\n');
      const id = activeStudioSubTab;
      setLiveTranscripts((prev) => {
        const cur = prev[id] ?? '';
        const sep = cur && !cur.endsWith('\n') ? '\n' : '';
        return { ...prev, [id]: cur + sep + chunk };
      });
    };
    rec.onerror = () => setDictationOn(false);
    try {
      rec.start();
    } catch {
      setDictationOn(false);
    }
    return () => {
      stopped = true;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    };
  }, [dictationOn, activeStudioSubTab]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    if (showLive) {
      console.info('[nt-live] hexcast overlay open (#btn-toggle-live +Live) — Studio | hexcast | ugrad tabs');
    } else {
      console.info('[nt-live] hexcast overlay closed');
    }
  }, [showLive]);

  useEffect(() => {
    const w = window as Window & { __ntLiveHexcastSync?: (on: boolean) => void };
    if (typeof w.__ntLiveHexcastSync === 'function') w.__ntLiveHexcastSync(showLive);
  }, [showLive]);

  useEffect(() => {
    const updateLiveMetrics = () => {
      const now = Date.now();
      const timeComboEl = document.getElementById('nt-live-time-combo');
      const localEl = document.getElementById('nt-live-local');
      const regionEl = document.getElementById('nt-live-region');
      const driftEl = document.getElementById('nt-live-drift');
      const hopsEl = document.getElementById('nt-live-hops');
      const rttEl = document.getElementById('nt-live-rtt');
      const gpuEl = document.getElementById('nt-live-gpu');
      const cpuEl = document.getElementById('nt-live-cpu');

      if (timeComboEl) {
        const seconds = Math.floor(now / 1000);
        const ms = now % 1000;
        timeComboEl.textContent = `${seconds} · ${ms.toString().padStart(3, '0')}`;
      }
      if (localEl) {
        localEl.textContent = new Date(now).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      if (regionEl) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        regionEl.textContent = `${locale} · ${tz}`;
      }
      if (driftEl) {
        const perfNow = performance.now();
        const perfOrigin = performance.timeOrigin;
        const drift = now - (perfOrigin + perfNow);
        driftEl.textContent = `${drift.toFixed(1)}ms`;
      }
      if (hopsEl) {
        hopsEl.textContent = '—'; // Placeholder, requires network analysis
      }
      if (rttEl) {
        // Simple ping simulation
        rttEl.textContent = `${Math.floor(Math.random() * 50) + 10}ms`;
      }
      if (gpuEl) {
        try {
          const canvas = document.createElement('canvas');
          const gl =
            (canvas.getContext('webgl') ||
              canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
          if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info') as
              | { UNMASKED_RENDERER_WEBGL: number }
              | null;
            const renderer = debugInfo
              ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
              : gl.getParameter(gl.RENDERER);
            gpuEl.textContent = renderer ? String(renderer).split(' ')[0] : '—';
          } else {
            gpuEl.textContent = '—';
          }
        } catch {
          gpuEl.textContent = '—';
        }
      }
      if (cpuEl) {
        cpuEl.textContent = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : '—';
      }
    };
    updateLiveMetrics();
    const interval = setInterval(updateLiveMetrics, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'e') {
        setLiveExpanded(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    localStorage.setItem('grokChatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  const mainClassName = [
    'main',
    !showTerminal && 'term-io-hidden',
    showNotes && 'notes-panel-open',
    showDraw && 'nt-draw-active',
    grokipediaActive && 'grokipedia-panel-active',
    padCenterStage && 'nt-pad-center-stage',
  ]
    .filter(Boolean)
    .join(' ');

  const pageClassName = [
    'notes-surface-page',
    'dark',
    showLive && 'nt-live-embed-active',
    showGames && 'nt-games-embed-active',
    showFileWall && 'nt-filewall-embed-active',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={pageClassName}>
      <div className="nt-top">
        <div className="nt-top-left">
          <button
            type="button"
            className="nt-top-btn logo-btn"
            id="btn-toggle-status"
            title="Show terminal input"
            aria-label="Toggle terminal output and prompt"
            aria-pressed={showTerminal}
            onClick={() => toggleTerminal()}
          >
            <span className="logo-cli" translate="no">
              <span className="logo-cli-brand">.grok</span>
              <span className="logo-cli-chev" aria-hidden="true">❯</span>
              <span className="logo-cli-tail">cli</span>
            </span>
          </button>
          <span className="badge badge-live">LIVE</span>
          <span className="nt-top-live-strip" aria-label="Clock and host hints" translate="no">
            <span className="nt-mkv nt-mkv-time">
              <span
                className="nt-mk nt-time-combo"
                id="nt-live-time-combo"
                title="Unix seconds · epoch ms — sub-second suffix in blue"
                aria-label="Unix seconds and epoch milliseconds"
              ></span>
            </span>
            <span className="nt-sep">·</span>
            <span className="nt-mkv">
              <span className="nt-mk" title="Local date and time (browser locale)">local</span>
              <span className="nt-mv" id="nt-live-local"></span>
            </span>
            {!liveExpanded && (
              <>
                <span className="nt-sep">—</span>
                <span className="nt-sep">·</span>
                <span className="nt-expand-hint">ctrl+e expand</span>
              </>
            )}
            {liveExpanded && (
              <>
                <span className="nt-sep">—</span>
                <span className="nt-mkv">
                  <span className="nt-mk">region</span>
                  <span className="nt-mv" id="nt-live-region"></span>
                </span>
                <span className="nt-sep">·</span>
                <span className="nt-mkv">
                  <span className="nt-mk">drift</span>
                  <span className="nt-mv nt-mv-fixed-num" id="nt-live-drift"></span>
                </span>
                <span className="nt-sep">·</span>
                <span className="nt-mkv">
                  <span className="nt-mk">hops</span>
                  <span className="nt-mv" id="nt-live-hops"></span>
                </span>
                <span className="nt-sep">·</span>
                <span className="nt-mkv">
                  <span className="nt-mk">rtt</span>
                  <span className="nt-mv nt-mv-fixed-num" id="nt-live-rtt"></span>
                </span>
                <span className="nt-sep">·</span>
                <span className="nt-mkv">
                  <span className="nt-mk">gpu</span>
                  <span className="nt-mv" id="nt-live-gpu"></span>
                </span>
                <span className="nt-sep">·</span>
                <span className="nt-mkv">
                  <span className="nt-mk">cpu</span>
                  <span className="nt-mv" id="nt-live-cpu"></span>
                </span>
              </>
            )}
          </span>
        </div>
        <div className="status" role="status" aria-live="polite">
          <div className="nt-status-inner">
            <div className="nt-status-topline">
              <div className="nt-status-fact">
                <svg className="grok-mini-mark" width="14" height="14" viewBox="0 0 33 33" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M13.237 21.041l11.082-8.19a.75.75 0 0 1 1.578.379c1.363 3.289.754 7.242-1.957 9.955-2.71 2.714-6.482 3.31-9.93 1.954l-3.765 1.745c5.401 3.697 11.96 2.783 16.059-1.324 3.25-3.255 4.258-7.692 3.316-11.693l.009.008C27.965 7.998 29.666 5.65 33.15.845 33.232.73 33.314.617 33.397.5l-4.586 4.59v-.014L13.234 21.044z"/>
                  <path d="M10.95 23.031c-3.877-3.707-3.208-9.446.1-12.755 2.446-2.45 6.454-3.449 9.952-1.98l3.758-1.737a12.5 12.5 0 0 0-2.54-1.386c-4.5-1.854-9.887-.931-13.545 2.728-3.518 3.523-4.625 8.94-2.725 13.561 1.42 3.454-.906 5.898-3.25 8.363-.83.874-1.664 1.749-2.335 2.674L10.947 23.034z"/>
                </svg>
                <span className="nt-fact-text">
                  <span className="nt-fact-strong">Fact-checked</span> by Grok <time id="nt-fact-time" dateTime="2026-02-14">2 months ago</time>
                </span>
              </div>
            </div>
            <div className="nt-status-metrics">
              <span className="dot" aria-hidden="true"></span>
              <span id="st-state">ready</span>
              <span className="sep">│</span>
              <span>blocks: <span id="nt-sb-count">0</span></span>
            </div>
          </div>
        </div>
        <div className="nt-top-right">
          <button
            type="button"
            className={'nt-top-btn' + (padBodyVisible ? ' active' : '')}
            id="btn-toggle-pad"
            title={
              padBodyVisible
                ? 'Hide notebook cells (middle column when terminal is hidden)'
                : 'Show notebook cells (middle column when terminal is hidden)'
            }
            aria-label={padBodyVisible ? 'Hide notebook cells' : 'Show notebook cells'}
            aria-pressed={padBodyVisible}
            onClick={() => togglePad()}
          >
            + Pad
          </button>
          <button
            type="button"
            className={'nt-top-btn' + (showNotes ? ' active' : '')}
            id="btn-toggle-notes"
            title="Toggle notes panel"
            aria-label="Toggle notes panel"
            aria-pressed={showNotes}
            onClick={() => toggleNotes()}
          >
            +Note
          </button>
          <button
            type="button"
            className={'nt-top-btn' + (showGames ? ' active' : '')}
            id="btn-toggle-games"
            title="Game boards"
            aria-label="Toggle game boards"
            aria-pressed={showGames}
            onClick={() => toggleGames()}
          >
            +Games
          </button>
          <button
            type="button"
            className={'nt-top-btn' + (showDraw ? ' active' : '')}
            id="btn-toggle-draw"
            title="Drawing tools"
            aria-label="Toggle drawing tools"
            aria-pressed={showDraw}
            onClick={() => toggleDraw()}
          >
            + Draw
          </button>
          <button
            type="button"
            className="nt-top-btn"
            id="btn-capture-to-notebook"
            title="Capture a screen/tab/window to the notebook pad (browser will ask what to share). Runs vision analysis in the background if backend + llava are available."
            aria-label="Capture screen to notebook"
            onClick={() => void captureTabToNotebook()}
          >
            Capture
          </button>
          <button
            type="button"
            className={'nt-top-btn' + (showLive ? ' active' : '')}
            id="btn-toggle-live"
            title="Live (Studio | hexcast | ugrad)"
            aria-label="Toggle live hexcast overlay"
            aria-pressed={showLive}
            onClick={() => toggleLive()}
          >
            +Live
          </button>
          <button
            type="button"
            className={'nt-top-btn' + (isCollaborating ? ' active' : '')}
            id="btn-toggle-collab"
            title="Developer bridge — mobile phone lab, live peer connection, and PWA install/sync. Enables the collaboration transport (rooms, peers, sync) when on."
            aria-label="Toggle developer bridge: mobile lab, connection, and PWA syncing"
            aria-pressed={isCollaborating}
            onClick={() => setCollaborating(!isCollaborating)}
          >
            +Bridge
          </button>
          <button
            type="button"
            className={'nt-top-btn' + (showChat ? ' active' : '')}
            id="btn-toggle-chat"
            title="Toggle chat"
            aria-label="Toggle chat"
            aria-pressed={showChat}
            onClick={() => toggleChat()}
          >
            +Chat
          </button>
        </div>
      </div>

      {showLive && (
        <div id="nt-live-hexcast" className="nt-live-hexcast" aria-hidden={false}>
          <div className="nt-live-hexcast-rainbow" aria-hidden="true">
            <span className="hx-r1"></span><span className="hx-r2"></span><span className="hx-r3"></span><span className="hx-r4"></span><span className="hx-r5"></span><span className="hx-r6"></span>
          </div>
          <div className="nt-live-hexcast-head">
            <div className="nt-hx-tabs" role="tablist" aria-label="Live: Studio, hexcast, or μgrad (uvspeed)">
              <button
                type="button"
                className={'nt-hx-tab' + (liveHxTab === 'studio' ? ' active' : '')}
                role="tab"
                id="nt-hx-tab-embed"
                aria-selected={liveHxTab === 'studio'}
                aria-controls="nt-hx-panel-embed"
                data-hx-view="embed"
                onClick={() => setLiveHxTab('studio')}
              >
                Studio
              </button>
              <button
                type="button"
                className={'nt-hx-tab' + (liveHxTab === 'hexcast' ? ' active' : '')}
                role="tab"
                id="nt-hx-tab-external"
                aria-selected={liveHxTab === 'hexcast'}
                aria-controls="nt-hx-panel-external"
                data-hx-view="hexcast"
                onClick={() => setLiveHxTab('hexcast')}
              >
                hexcast
              </button>
              <button
                type="button"
                className={'nt-hx-tab' + (liveHxTab === 'ugrad' ? ' active' : '')}
                role="tab"
                id="nt-hx-tab-ugrad"
                aria-selected={liveHxTab === 'ugrad'}
                aria-controls="nt-hx-panel-ugrad"
                data-hx-view="ugrad"
                onClick={() => setLiveHxTab('ugrad')}
              >
                ugrad
              </button>
            </div>
          </div>
          <div className="nt-hx-body">
            <div
              id="nt-hx-panel-embed"
              className="nt-hx-panel-embed nt-live-studio"
              role="tabpanel"
              hidden={liveHxTab !== 'studio'}
              aria-hidden={liveHxTab !== 'studio'}
              aria-labelledby="nt-hx-tab-embed"
              aria-describedby="nt-live-studio-desc"
            >
              <div className="nt-live-studio-split">
                <div className="nt-hx-video-area">
                  <div className="nt-live-studio-layout">
                    <nav className="nt-live-vid-rail" role="navigation" aria-label="Video sources">
                      <button
                        type="button"
                        className={'nt-live-rail-btn nt-live-rail-queue' + (activeStudioSubTab === 'queue' ? ' active' : '')}
                        aria-selected={activeStudioSubTab === 'queue'}
                        id="nt-live-subtab-queue"
                        onClick={() => setActiveStudioSubTab('queue')}
                      >
                        + Add URLs
                      </button>
                      {liveVideoRailGroups.map((group) => (
                        <div key={group.stream} className={'nt-live-git-section nt-live-git--' + group.stream} role="group" aria-label={group.label}>
                          <div className="nt-live-git-branch-head">
                            <span className="nt-live-git-branch-line" aria-hidden="true" />
                            <span className="nt-live-git-branch-name">{group.label}</span>
                          </div>
                          {group.items.map((item, idx) => {
                            const vi = liveVideoIndexById.get(item.id) ?? 0;
                            const tabLabel = liveVideoTabLabel(item, vi);
                            return (
                            <div className="nt-live-git-row" key={item.id}>
                              <div className="nt-live-git-graph" aria-hidden="true">
                                {idx > 0 ? <span className="nt-live-git-vline nt-live-git-vline--up" /> : null}
                                <span className="nt-live-git-node" />
                                {idx < group.items.length - 1 ? <span className="nt-live-git-vline nt-live-git-vline--down" /> : null}
                              </div>
                              <div className="nt-live-git-actions">
                                <button
                                  type="button"
                                  className={'nt-live-rail-btn' + (activeStudioSubTab === item.id ? ' active' : '')}
                                  aria-selected={activeStudioSubTab === item.id}
                                  id={'nt-live-subtab-' + item.id}
                                  title={item.src}
                                  onClick={() => setActiveStudioSubTab(item.id)}
                                >
                                  {tabLabel}
                                </button>
                                <button
                                  type="button"
                                  className="nt-live-rail-close"
                                  aria-label={'Remove ' + tabLabel}
                                  title="Remove from wall"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeLiveVideo(item.id);
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      ))}
                    </nav>
                    <div className="nt-live-vid-stage">
                  <div className="nt-live-studio-banner" id="nt-live-studio-desc">
                    <span className="nt-live-studio-banner-title">Multi-video viewer</span>
                    <span className="nt-live-studio-banner-sub">Left: sources · right: transcript (backend captions + mic)</span>
                  </div>
                  {activeStudioSubTab === 'queue' ? (
                    <>
                      <div className="nt-live-video-chrome" role="region" aria-label="Add videos">
                        <textarea
                          className="nt-live-video-in"
                          id="nt-live-video-in"
                          rows={2}
                          spellCheck={false}
                          placeholder="YouTube / Vimeo / X post URL / direct .mp4 — one per line or comma-separated"
                          value={liveVideoPaste}
                          onChange={(e) => setLiveVideoPaste(e.target.value)}
                        />
                        <div className="nt-live-video-actions">
                          <button type="button" className="nt-live-video-add" id="nt-live-video-add" onClick={addLiveVideosFromPaste}>
                            Add videos
                          </button>
                          <button
                            type="button"
                            className="nt-live-video-clear"
                            id="nt-live-video-clear"
                            onClick={() => {
                              setLiveVideos([]);
                              setActiveStudioSubTab('queue');
                              setLiveTranscripts({});
                            }}
                            disabled={!liveVideos.length}
                          >
                            Clear all
                          </button>
                        </div>
                      </div>
                      <div className="nt-live-video-wall-outer nt-live-queue-hint">
                        {liveVideos.length === 0 ? (
                          <p className="nt-live-video-empty">
                            Paste URLs and <strong>Add videos</strong>. Each source opens in its own tab (like Grok CLI modes); use{' '}
                            <strong>Add URLs</strong> to return here.
                          </p>
                        ) : (
                          <p className="nt-live-video-empty">
                            <strong>{liveVideos.length}</strong> source{liveVideos.length === 1 ? '' : 's'} loaded — pick one on the <strong>left</strong> to play, or add more URLs.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="nt-live-single-focus">
                      {(() => {
                        const item = liveVideos.find((v) => v.id === activeStudioSubTab);
                        if (!item) {
                          return (
                            <p className="nt-live-video-empty">This source is gone — pick another tab or <strong>Add URLs</strong>.</p>
                          );
                        }
                        const xTweetId = item.kind === 'iframe' ? xTweetIdFromEmbedSrc(item.src) : null;
                        const iframeSrc =
                          item.kind === 'iframe'
                            ? liveDocPipActive
                              ? 'about:blank'
                              : resolvedLiveIframeSrc(item)
                            : '';
                        const iframeKey = xTweetId ? `${item.id}-x-${liveXTweetDark}` : item.id;
                        return (
                          <div className="nt-live-vid-item nt-live-vid-item--solo">
                            <div className="nt-live-vid-solo-stack">
                            <div className="nt-live-vid-toolbar">
                              {xTweetId ? (
                                <label className="nt-live-vid-toggle">
                                  <input
                                    type="checkbox"
                                    checked={liveXTweetDark}
                                    onChange={(e) => setLiveXTweetDark(e.target.checked)}
                                  />
                                  X dark
                                </label>
                              ) : null}
                              {item.kind === 'iframe' ? (
                                <>
                                  <button
                                    type="button"
                                    className="nt-live-vid-tool"
                                    onClick={() => void openLiveDocumentPip()}
                                    title={
                                      (window as Window & { documentPictureInPicture?: unknown }).documentPictureInPicture
                                        ? 'Open in system picture-in-picture (Chrome Document PiP)'
                                        : 'Fullscreen (Document PiP not available)'
                                    }
                                  >
                                    {liveDocPipActive ? 'PiP active' : 'Picture-in-picture'}
                                  </button>
                                  {liveDocPipActive ? (
                                    <button
                                      type="button"
                                      className="nt-live-vid-tool"
                                      onClick={() => closeLiveDocumentPip()}
                                      title="Return embed to Live panel"
                                    >
                                      Dock player
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="nt-live-vid-tool"
                                    onClick={() => void openLiveFrameFullscreen()}
                                    title="Fullscreen this frame"
                                  >
                                    Fullscreen
                                  </button>
                                </>
                              ) : null}
                              {item.kind === 'video' ? (
                                <>
                                  <button
                                    type="button"
                                    className="nt-live-vid-tool"
                                    onClick={() => void openLiveVideoNativePip()}
                                    title="Browser native picture-in-picture (MP4/WebM in this player)"
                                  >
                                    Video PiP
                                  </button>
                                  <button
                                    type="button"
                                    className="nt-live-vid-tool"
                                    onClick={() => void openLiveFrameFullscreen()}
                                  >
                                    Fullscreen
                                  </button>
                                </>
                              ) : null}
                            </div>
                            <div className="nt-live-vid-frame" ref={liveVidFrameRef}>
                              {item.kind === 'iframe' ? (
                                <iframe
                                  key={iframeKey}
                                  className="nt-live-vid-embed"
                                  title="Embedded video"
                                  src={iframeSrc}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
                                  referrerPolicy="no-referrer-when-downgrade"
                                />
                              ) : (
                                <video
                                  ref={liveVidVideoRef}
                                  className="nt-live-vid-direct"
                                  src={item.src}
                                  controls
                                  playsInline
                                  preload="metadata"
                                />
                              )}
                            </div>
                            </div>
                            <button
                              type="button"
                              className="nt-live-vid-remove"
                              aria-label="Remove video"
                              onClick={() => removeLiveVideo(item.id)}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                    </div>
                  </div>
                </div>
                <aside className="nt-hx-transcripts" aria-label="Transcript and captions">
                  <div className="nt-hx-transcripts-hd">Transcript / captions</div>
                  <div className="nt-hx-transcripts-search">
                    <input
                      type="search"
                      placeholder="Search transcripts…"
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      aria-label="Search transcripts"
                      autoComplete="off"
                    />
                  </div>
                  <p className="nt-hx-transcripts-meta">
                    {activeStudioSubTab === 'queue'
                      ? 'Select a source on the left. YouTube captions need grok-notes-backend running (GET /api/youtube-transcript). Mic = browser speech-to-text (not audio from the iframe).'
                      : 'Fetch auto-captions when available, dictate live, or type. Save to Notes for training / analysis.'}
                  </p>
                  {captionErr ? (
                    <p className="nt-hx-transcripts-err" role="alert">
                      {captionErr}
                    </p>
                  ) : null}
                  <div className="nt-hx-transcripts-tools">
                    <button
                      type="button"
                      className="nt-hx-transcripts-fetch"
                      title="Load YouTube captions via grok-notes-backend (GET /api/youtube-transcript)"
                      disabled={
                        activeStudioSubTab === 'queue' ||
                        captionBusy ||
                        !liveVideos.find((x) => x.id === activeStudioSubTab) ||
                        !youtubeVideoIdFromEmbedSrc(liveVideos.find((x) => x.id === activeStudioSubTab)?.src ?? '')
                      }
                      onClick={() => void loadYoutubeCaptionsForActive()}
                    >
                      {captionBusy ? 'Loading…' : 'Captions'}
                    </button>
                    {canSpeechDictation ? (
                      <button
                        type="button"
                        className={'nt-hx-transcripts-mic' + (dictationOn ? ' active' : '')}
                        disabled={activeStudioSubTab === 'queue'}
                        onClick={() => setDictationOn((v) => !v)}
                        title="Browser speech recognition — speaks near your mic, not video audio"
                      >
                         {dictationOn ? 'Stop mic' : 'Live mic'}
                       </button>
                     ) : null}
                     <button
                       type="button"
                       className="nt-hx-transcripts-train-quick"
                       disabled={activeStudioSubTab === 'queue' || !(liveTranscripts[activeStudioSubTab] ?? '' ).trim()}
                       onClick={async () => {
                         if (activeStudioSubTab === 'queue') return;
                         const text = (liveTranscripts[activeStudioSubTab] ?? '' ).trim();
                         if (!text) return;
                         try {
                           const response = await fetch('http://localhost:3000/api/ai/train', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({
                               modelName: 'live-transcript-model-' + Date.now(),
                               baseModel: 'llama3.2',
                               modelfile: `FROM llama3.2\nSYSTEM "You are an AI trained on live transcripts for persona and slant analysis"\nMESSAGE user "${text}"`
                             })
                           });
                           const data = await response.json();
                           alert('Training started: ' + data.message);
                         } catch (error) {
                           alert(
                             'Training failed: ' +
                               (error instanceof Error ? error.message : String(error))
                           );
                         }
                       }}
                       title="Quick train transformer on this transcript"
                     >
                        Train
                      </button>
                      <button
                        type="button"
                        className="nt-hx-transcripts-sort"
                        onClick={() => {
                          // Placeholder for smart sorting
                          alert('Smart sorting videos into streams (placeholder)');
                        }}
                        title="Smart sort videos into data streams"
                      >
                        Sort
                      </button>
                    </div>
                  <div className="nt-hx-transcripts-news" aria-label="Quick add news and wall video streams">
                    <button
                      type="button"
                      className={
                        'nt-hx-transcripts-news-toggle' +
                        (newsByCategoryOpen ? '' : ' nt-hx-transcripts-news-toggle--collapsed')
                      }
                      id="nt-hx-transcripts-news-toggle"
                      aria-expanded={newsByCategoryOpen}
                      aria-controls="nt-hx-transcripts-news-grid"
                      onClick={() => setNewsByCategoryOpen((o) => !o)}
                    >
                      <span className="nt-hx-transcripts-news-label">News streams</span>
                      <span className="nt-hx-transcripts-news-chevron" aria-hidden>
                        ▾
                      </span>
                    </button>
                    <div
                      id="nt-hx-transcripts-news-grid"
                      className="nt-hx-transcripts-news-grid"
                      role="group"
                      aria-label="News by category"
                      hidden={!newsByCategoryOpen}
                    >
                      {NEWS_STREAM_GROUPS.map((group) => (
                        <div key={group.key} className="nt-hx-transcripts-news-col">
                          <div className="nt-hx-transcripts-news-col-label" id={'nt-news-col-' + group.key}>
                            {group.label}
                          </div>
                          <ul
                            className="nt-hx-transcripts-news-list"
                            role="list"
                            aria-labelledby={'nt-news-col-' + group.key}
                          >
                            {group.streams.map((stream) => (
                              <li key={group.key + '-' + stream.name}>
                                <button
                                  type="button"
                                  onClick={() => void addNewsStream(stream)}
                                  title={
                                    'Add ' +
                                    stream.name +
                                    ' to the video wall · ' +
                                    liveStudioEmbedSrcForStream(stream.url)
                                  }
                                >
                                  {stream.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="nt-hx-transcripts-news-sub" aria-label="Wall video presets">
                      <div className="nt-hx-transcripts-news-sub-label" id="nt-news-wall-presets-hd">
                        Wall presets
                      </div>
                      <ul
                        className="nt-hx-transcripts-news-wall-list"
                        role="list"
                        aria-labelledby="nt-news-wall-presets-hd"
                      >
                        {WALL_SIDEBAR_PRESETS.map((stream) => (
                          <li key={stream.url}>
                            <button
                              type="button"
                              onClick={() => void addNewsStream(stream)}
                              title={liveStudioEmbedSrcForStream(stream.url) + ' — add to the video wall'}
                            >
                              {stream.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <textarea
                    className="nt-hx-transcripts-ta"
                    id="nt-live-transcript"
                    spellCheck={true}
                    disabled={activeStudioSubTab === 'queue'}
                    placeholder={
                      activeStudioSubTab === 'queue'
                        ? 'Choose a video tab first…'
                        : 'Transcript, captions, or notes for this video…'
                    }
                    value={activeStudioSubTab === 'queue' ? '' : liveTranscripts[activeStudioSubTab] ?? ''}
                    onChange={(e) => {
                      const id = activeStudioSubTab;
                      if (id === 'queue') return;
                      const v = e.target.value;
                      setLiveTranscripts((prev) => ({ ...prev, [id]: v }));
                    }}
                  />
                  <div className="nt-hx-transcripts-actions">
                    <button
                      type="button"
                      className="nt-hx-transcripts-save"
                      disabled={activeStudioSubTab === 'queue' || !(liveTranscripts[activeStudioSubTab] ?? '').trim()}
                      onClick={() => {
                        if (activeStudioSubTab === 'queue') return;
                        const text = (liveTranscripts[activeStudioSubTab] ?? '').trim();
                        if (!text) return;
                        const idx = liveVideos.findIndex((v) => v.id === activeStudioSubTab);
                        const item = idx >= 0 ? liveVideos[idx] : undefined;
                        const label = item ? liveVideoTabLabel(item, idx) : activeStudioSubTab.slice(0, 12);
                        addNote({ type: 'text', content: `[Live · ${label}]\n${text}` });
                        if (!showNotes) toggleNotes();
                      }}
                    >
                       Save to Notes
                     </button>
                     <button
                       type="button"
                       className="nt-hx-transcripts-analyze"
                       disabled={activeStudioSubTab === 'queue' || !(liveTranscripts[activeStudioSubTab] ?? '' ).trim()}
                       onClick={async () => {
                         if (activeStudioSubTab === 'queue') return;
                         const text = (liveTranscripts[activeStudioSubTab] ?? '' ).trim();
                         if (!text) return;
                         try {
                           const response = await fetch('http://localhost:3000/api/ai/chat', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({
                               message: `Analyze this transcript for linguistic capsules, persona, and slant: ${text}`,
                               offline: true
                             })
                           });
                           const data = await response.json();
                           alert('Analysis: ' + data.response);
                         } catch (error) {
                           alert(
                             'Analysis failed: ' +
                               (error instanceof Error ? error.message : String(error))
                           );
                         }
                       }}
                     >
                       Analyze with Grok
                     </button>
                     <button
                       type="button"
                       className="nt-hx-transcripts-train"
                       disabled={activeStudioSubTab === 'queue' || !(liveTranscripts[activeStudioSubTab] ?? '' ).trim()}
                       onClick={async () => {
                         if (activeStudioSubTab === 'queue') return;
                         const text = (liveTranscripts[activeStudioSubTab] ?? '' ).trim();
                         if (!text) return;
                         try {
                           const response = await fetch('http://localhost:3000/api/ai/train', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({
                               modelName: 'live-transcript-model-' + Date.now(),
                               baseModel: 'llama3.2',
                               modelfile: `FROM llama3.2\nSYSTEM "You are an AI trained on live transcripts for persona and slant analysis"\nMESSAGE user "${text}"`
                             })
                           });
                           const data = await response.json();
                           alert('Training started: ' + data.message);
                         } catch (error) {
                           alert(
                             'Training failed: ' +
                               (error instanceof Error ? error.message : String(error))
                           );
                         }
                       }}
                     >
                       Train Transformer
                     </button>
                   </div>
                </aside>
              </div>
            </div>
            <div
              id="nt-hx-panel-external"
              className={'nt-hx-panel-external' + (!hexcastCantEmbed && hexcastPageUrl ? ' nt-hx-has-url' : '')}
              role="tabpanel"
              hidden={liveHxTab !== 'hexcast'}
              aria-hidden={liveHxTab !== 'hexcast'}
              aria-labelledby="nt-hx-tab-external"
            >
              <HexcastPanel />
            </div>
            <div
              id="nt-hx-panel-ugrad"
              className={'nt-hx-panel-external' + (!ugradCantEmbed && ugradPageUrl ? ' nt-hx-has-url' : '')}
              role="tabpanel"
              hidden={liveHxTab !== 'ugrad'}
              aria-hidden={liveHxTab !== 'ugrad'}
              aria-labelledby="nt-hx-tab-ugrad"
            >
              <div className="nt-hx-ugrad-split">
                <div className="nt-hx-ugrad-term" aria-label="Tensor model readout">
                  <div className="nt-hx-ugrad-tensor-readout-hd" id="nt-hx-ugrad-tensor-hd">
                    <span className="nt-hx-ugrad-tensor-readout-title">Tensor model</span>
                    <span className="nt-hx-ugrad-tensor-readout-sub">readout</span>
                  </div>
                  <div className="term-pane nt-hx-ugrad-term-pane">
                    <div
                      id="nt-ugrad-term-output"
                      className="nt-ugrad-tensor-readout"
                      role="log"
                      aria-live="polite"
                      aria-relevant="additions"
                      aria-labelledby="nt-hx-ugrad-tensor-hd"
                    />
                    <div className="term-prompt">
                      <span className="tp-label">tensor ❯</span>
                      <input
                        id="nt-ugrad-term-input"
                        type="text"
                        placeholder="ops · metrics · help — same shell as main"
                        autoComplete="off"
                        spellCheck={false}
                        aria-label="Tensor readout command line"
                      />
                    </div>
                  </div>
                </div>
                <div className="nt-hx-ugrad-stage">
                  <div className="nt-hx-ugrad-menubar" role="toolbar" aria-label="μgrad R0 — header and commands">
                    <div className="nt-hx-ugrad-menubar-brand">
                      <span className="nt-hx-ugrad-title">μgrad</span>
                      <span className="nt-hx-ugrad-badge">R0</span>
                    </div>
                    <div className="nt-hx-ugrad-menubar-actions">
                      {UGRAD_HDR_BUTTONS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="nt-hx-ugrad-menubar-btn"
                          title={b.title}
                          onClick={() => sendToUgradIframe(ugradIframeRef.current, { action: 'hdr', id: b.id })}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                    <div className="nt-hx-ugrad-menubar-commands">
                      <select
                        className="nt-hx-ugrad-cmd-select"
                        aria-label="Run μgrad command"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          sendToUgradIframe(ugradIframeRef.current, { action: 'cmd', text: v });
                          e.target.selectedIndex = 0;
                        }}
                      >
                        <option value="">Commands…</option>
                        {UGRAD_CMD_GROUPS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.items.map((it) => (
                              <option key={it.cmd} value={it.cmd}>
                                {it.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="nt-hx-ugrad-menubar-extra">
                      <button
                        type="button"
                        className="nt-hx-btn"
                        title={ugradPageUrl}
                        onClick={() => window.open(ugradPageUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Open tab
                      </button>
                      <button
                        type="button"
                        className="nt-hx-btn"
                        title="Copy embed URL"
                        onClick={() => void navigator.clipboard.writeText(ugradPageUrl)}
                      >
                        Copy URL
                      </button>
                    </div>
                  </div>
                  <div className="nt-hx-ugrad-bloch-panel" role="region" aria-label="Bloch sphere reference and computational basis enumeration">
                    <div className="nt-hx-ugrad-bloch-panel-hd">
                      <span className="nt-hx-ugrad-bloch-title">Bloch</span>
                      <div className="nt-hx-ugrad-bloch-panel-hd-lines">
                        <span className="nt-hx-ugrad-bloch-sub">{UGRAD_BLOCH_SUB_PRIMARY}</span>
                        <p className="nt-hx-ugrad-bloch-caption">
                          Six Bloch balls · orange = ket on S² · columns align with enumeration → · equator = X–Y · Z = vertical
                        </p>
                      </div>
                    </div>
                    <div className="nt-hx-ugrad-bloch-layout">
                      <div className="nt-hx-ugrad-bloch-col">
                        <div
                          className="nt-hx-ugrad-bloch-spheres"
                          role="region"
                          aria-label="Bloch spheres — one per enumerated ket (matches table)"
                        >
                          {UGRAD_Q_ENUM_ROWS.map((row) => (
                            <div key={row.n} className="nt-hx-ugrad-bloch-cell">
                              <UgradBlochSphereSvg
                                thetaRad={row.thetaRad}
                                phiRad={row.phiRad}
                                variant="mini"
                              />
                              <span className="nt-hx-ugrad-bloch-ket-lbl">{row.ket}</span>
                            </div>
                          ))}
                        </div>
                        <div className="nt-hx-ugrad-qenum-strip">
                          {UGRAD_QENUM_COLUMNS.map((col) => (
                            <div key={col.key} className="nt-hx-ugrad-qenum">
                              <span className="nt-hx-ugrad-bloch-sub nt-hx-ugrad-qenum-sub">{col.sub}</span>
                              <div className="nt-hx-ugrad-qenum-hd">{col.title}</div>
                              <div
                                className="nt-hx-ugrad-qenum-table"
                                role="table"
                                aria-label={'Basis kets and angles · ' + col.title}
                              >
                                <div className="nt-hx-ugrad-qenum-row nt-hx-ugrad-qenum-row--hd" role="row">
                                  <span role="columnheader">#</span>
                                  <span role="columnheader">ket</span>
                                  <span role="columnheader">σ</span>
                                  <span role="columnheader">θ</span>
                                  <span role="columnheader">φ</span>
                                </div>
                                {UGRAD_Q_ENUM_ROWS.map((row) => (
                                  <div key={col.key + '-' + row.n} className="nt-hx-ugrad-qenum-row" role="row">
                                    <span className="nt-hx-ugrad-qenum-idx" role="cell">
                                      {row.n}
                                    </span>
                                    <span className="nt-hx-ugrad-qenum-ket" role="cell">
                                      {row.ket}
                                    </span>
                                    <span role="cell">{row.role}</span>
                                    <span className="nt-hx-ugrad-mono" role="cell">
                                      {row.theta}
                                    </span>
                                    <span className="nt-hx-ugrad-mono" role="cell">
                                      {row.phi}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <details className="nt-hx-ugrad-embed-setup">
                      <summary>Machine iteration benchmark · uvspeed web root (ugrad-r0.html)</summary>
                      <div className="nt-hx-ugrad-embed-setup-body">
                        <p>
                          The iframe below is the same surface as the standalone <code>web/ugrad-r0.html</code> build:{' '}
                          <strong>evolve</strong>, <strong>train</strong>, and prompt-menu commands execute there. Treat this
                          embed URL + web root as the <strong>benchmark</strong> for machine iterations — same document the
                          μgrad menubar drives via <code>postMessage</code> / same-origin exec.
                        </p>
                        <p>
                          Set base (trailing <code>/</code>): <code>data-uvspeed-web</code> on <code>&lt;html&gt;</code>,{' '}
                          <code>VITE_UVSPEED_WEB_BASE</code>, or <code>window.__UVSPEED_WEB_BASE__</code>. Serve over{' '}
                          <code>http(s)</code>; <code>file:</code> cannot embed another <code>file:</code> page.
                        </p>
                      </div>
                    </details>
                  </div>
                  <iframe
                    ref={ugradIframeRef}
                    className="nt-hx-ext-iframe"
                    title="μgrad R0 — uvspeed web"
                    src={ugradCantEmbed ? undefined : ugradPageUrl}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads allow-modals allow-pointer-lock"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="nt-hx-ext-fallback">
                    <p className="nt-hx-ext-hint" style={{ margin: 0 }}>
                      Set <code>data-uvspeed-web</code> on <code>&lt;html&gt;</code> or <code>VITE_UVSPEED_WEB_BASE</code> to your{' '}
                      <strong>uvspeed/web</strong> URL (with trailing <code>/</code>). <code>file:</code> pages cannot embed another{' '}
                      <code>file:</code> page in an iframe — open μgrad in a new tab instead.
                    </p>
                    <div className="nt-hx-ext-toolbar-actions" style={{ marginTop: 10, justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="nt-hx-btn nt-hx-btn-primary"
                        onClick={() => window.open(ugradPageUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Open ugrad-r0.html
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showGames && (
        <div id="nt-games-hexcast" className="nt-live-hexcast nt-games-overlay" aria-hidden={false}>
          <div className="nt-live-hexcast-rainbow" aria-hidden="true">
            <span className="hx-r1"></span><span className="hx-r2"></span><span className="hx-r3"></span><span className="hx-r4"></span><span className="hx-r5"></span><span className="hx-r6"></span>
          </div>
          <div className="nt-live-hexcast-head nt-games-hexcast-head">
            <div className="nt-hx-head-meta">
              <span className="hx-title">Games</span>
              <span className="hx-sub">
                Hub = training home (iframe + rail). <strong>← Hub</strong> in header returns here from any board; <strong>Close</strong> exits
                Games (footer can stay on Games).
              </span>
            </div>
            <button
              type="button"
              className="nt-games-close-btn"
              id="nt-games-close"
              aria-label={
                activeGameTab === 'hub'
                  ? 'Close Games overlay'
                  : 'Return to Games Hub (uvspeed hub + training rail)'
              }
              title={
                activeGameTab === 'hub'
                  ? 'Close Games overlay (stay on Games modality in footer)'
                  : 'Back to Hub — uvspeed hub iframe, streams, and live training panel'
              }
              onClick={() => {
                if (activeGameTab !== 'hub') {
                  setActiveGameTab('hub');
                  return;
                }
                setShowGames(false);
              }}
            >
              {activeGameTab === 'hub' ? 'Close' : '← Hub'}
            </button>
            <div className="nt-games-head-tools">
              <label htmlFor="nt-games-jump" className="nt-games-jump-label">
                Board
              </label>
              <select
                id="nt-games-jump"
                className="nt-games-jump-select"
                value={activeGameTab}
                aria-label="Switch game board"
                onChange={(e) => setActiveGameTab(e.target.value as GameBoardId)}
              >
                {sortedGameBoards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.navLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="nt-hx-body nt-games-hx-body">
            <div className="nt-games-body-grid">
              <div className="nt-hx-video-area nt-games-stage">
                {GAME_BOARDS.map((b) => (
                  <div
                    key={b.id}
                    id={'nt-games-panel-' + b.id}
                    className="nt-hx-panel-embed nt-games-panel"
                    role="tabpanel"
                    hidden={activeGameTab !== b.id}
                    aria-hidden={activeGameTab !== b.id}
                    aria-label={b.panelTitle}
                  >
                    {b.id === 'hub' ? (
                      <GamesHubStudio
                        boards={sortedGameBoards}
                        onSelectGame={(id) => setActiveGameTab(id as GameBoardId)}
                        sortKey={gamesSortKey}
                        onCycleSort={cycleGamesSort}
                      />
                    ) : b.id === 'go' ? (
                      <div className="nt-games-panel-split nt-games-panel-with-bar">
                        <div className="nt-games-game-stack">
                          {renderGamesBoardBar(b.panelTitle, b.file)}
                          <div className="nt-games-game">
                            <GoGame />
                          </div>
                        </div>
                        <aside className="nt-games-analysis">
                          <h4>Go Analysis</h4>
                          <p>Analyze moves and train AI. Use <strong>Pop out</strong> for the full uvspeed lab tab.</p>
                          <button type="button" onClick={() => alert('Analyzing Go position (placeholder)')}>
                            Analyze Position
                          </button>
                        </aside>
                      </div>
                    ) : b.id === 'chess' ? (
                      <div className="nt-games-panel-split nt-games-panel-with-bar">
                        <div className="nt-games-game-stack">
                          {renderGamesBoardBar(b.panelTitle, b.file)}
                          <div className="nt-games-game">
                            <ChessGame />
                          </div>
                        </div>
                        <aside className="nt-games-analysis">
                          <h4>Chess Analysis</h4>
                          <p>Analyze positions and train AI. Use <strong>Pop out</strong> for the full uvspeed lab tab.</p>
                          <button type="button" onClick={() => alert('Analyzing Chess position (placeholder)')}>
                            Analyze Position
                          </button>
                        </aside>
                      </div>
                    ) : b.id === 'neuralink' ? (
                      <div className="nt-games-panel-split nt-games-panel-with-bar">
                        <div className="nt-games-game-stack">
                          {renderGamesBoardBar(b.panelTitle, b.file)}
                          <div className="nt-games-game">
                            <NeuralinkGrid />
                          </div>
                        </div>
                        <aside className="nt-games-analysis">
                          <h4>Neuralink Analysis</h4>
                          <p>Monitor neural connections. Use <strong>Pop out</strong> for the full uvspeed lab tab.</p>
                          <button type="button" onClick={() => alert('Analyzing neural grid (placeholder)')}>
                            Analyze Grid
                          </button>
                        </aside>
                      </div>
                    ) : (
                      <div className="nt-games-iframe-stack">
                        {renderGamesBoardBar(b.panelTitle, b.file)}
                        <iframe className="nt-games-iframe" src={uvspeedPageUrl(b.file)} title={b.panelTitle} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showFileWall && <VisualWallOverlay />}

      {showChat && (
        <div id="nt-chat-hexcast" className="nt-live-hexcast" aria-hidden="false">
          <div className="nt-live-hexcast-rainbow" aria-hidden="true">
            <span className="hx-r1"></span><span className="hx-r2"></span><span className="hx-r3"></span><span className="hx-r4"></span><span className="hx-r5"></span><span className="hx-r6"></span>
          </div>
          <div className="nt-live-hexcast-head">
            <h3 style={{margin: 0, fontSize: '14px', color: 'var(--qp-text)'}}>Chat History & Training</h3>
          </div>
          <div className="nt-hx-body" style={{padding: '10px', overflowY: 'auto'}}>
            <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
              <button onClick={() => setChatHistory([])} style={{padding: '5px 10px', background: 'var(--qp-bg-tertiary)', border: '1px solid var(--qp-border)', borderRadius: '4px'}}>Clear History</button>
              <button onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                const backup = { date: today, chats: chatHistory };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat-backup-${today}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{padding: '5px 10px', background: 'var(--qp-accent)', color: 'white', border: 'none', borderRadius: '4px'}}>Backup Today's Chat</button>
              <button onClick={() => {
                // Train on history using ML engine
                if (chatHistory.length > 0) {
                  // Placeholder for training
                  alert('Training on ' + chatHistory.length + ' chats (placeholder)');
                }
              }} style={{padding: '5px 10px', background: 'var(--qp-accent)', color: 'white', border: 'none', borderRadius: '4px'}}>Train on History</button>
            </div>
            <div>
              {chatHistory.length === 0 ? (
                <p style={{color: 'var(--iss-muted)'}}>No chats saved yet. Send messages in the footer to save.</p>
              ) : (
                chatHistory.map((chat, i) => (
                  <div key={i} style={{marginBottom: '10px', padding: '8px', background: 'var(--iss-chrome)', borderRadius: '4px'}}>
                    <small style={{color: 'var(--iss-muted)'}}>ID: {chat.id} | Mode: {chat.type}</small>
                    <p style={{margin: '5px 0', color: 'var(--qp-text)'}}>{chat.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className={mainClassName} id="main">
        <div className="term-pane">
          <div id="term-output"></div>
          <div className="term-prompt">
            <span className="tp-label">grok ❯</span>
            <input id="term-input" type="text" placeholder="type command…" autoComplete="off" spellCheck="false" />
          </div>
        </div>

        <div className="grokipedia-pane" id="grokipedia-pane" aria-label="Grokipedia">
          <div className="gpb-bar" role="toolbar" aria-label="Navigator">
            <button type="button" className="gpb-btn" id="gpb-back" title="Back">◀</button>
            <button
              type="button"
              className="gpb-btn"
              id="gpb-refresh"
              title="Refresh"
              onClick={() => {
                const frame = document.getElementById('grokipedia-frame') as HTMLIFrameElement | null;
                if (frame?.src) frame.src = frame.src;
              }}
            >
              ⟳
            </button>
            <input type="text" className="gpb-url" id="gpb-url" spellCheck="false" autoComplete="off" placeholder="https://grokipedia.com/…" value={grokipediaUrl} onChange={(e) => setGrokipediaUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') loadGrokipediaUrl(grokipediaUrl); }} />
            <button type="button" className="gpb-go" id="gpb-go" title="Go" onClick={() => loadGrokipediaUrl(grokipediaUrl)}>Go</button>
          </div>
          <div className="gp-body-stack" id="gp-body-stack">
            {currentBrand === 'tesla' ? (
              <TeslaMap />
            ) : currentBrand === 'starlink' ? (
              <StarlinkMap />
            ) : currentBrand === 'hexcast' ? (
              <HexcastPanel />
            ) : (
              <>
                <div className="gp-left" id="gp-left" hidden></div>
                <div className="gp-main" id="gp-main" hidden></div>
                <div className="gp-notes" id="gp-notes" hidden></div>
                <div className="gp-analysis" id="gp-analysis" hidden></div>
                <div className="gp-viewer" id="gp-viewer" hidden aria-live="polite"></div>
                <div className="grokipedia-empty" id="grokipedia-empty">
              <span>
                Select <strong>Grokipedia</strong> in the footer and search — results load in this web view. Same catalog as{' '}
                <a href="https://grokipedia.com/search?q=plants" target="_blank" rel="noopener noreferrer">
                  grokipedia.com/search
                </a>
                .
              </span>
            </div>
              </>
            )}
          </div>
        </div>

        <div className="splitter" id="splitter-notebook" data-target="notebook-pane"></div>
        <NotebookPane />

        <NotesDrawer />

        {showDraw && <DrawLayer />}
      </div>

      <Footer />
      <ShortcutPopup />
    </div>
  );
}

export default App;
/** Mirrors uvspeed `web/ugrad-r0.html` — #hdr buttons + prompt menu `data-cmd` entries for the +Live embed bar. */

/** Computational-basis & Pauli eigenkets on S² — θ polar from |0⟩, φ azimuth (Bloch convention). */
export const UGRAD_Q_ENUM_ROWS: readonly {
  n: number;
  ket: string;
  role: string;
  theta: string;
  phi: string;
  thetaRad: number;
  phiRad: number;
}[] = [
  { n: 0, ket: '|0⟩', role: 'Z₊', theta: '0', phi: '—', thetaRad: 0, phiRad: 0 },
  { n: 1, ket: '|1⟩', role: 'Z₋', theta: 'π', phi: '—', thetaRad: Math.PI, phiRad: 0 },
  { n: 2, ket: '|+⟩', role: 'X₊', theta: 'π/2', phi: '0', thetaRad: Math.PI / 2, phiRad: 0 },
  { n: 3, ket: '|−⟩', role: 'X₋', theta: 'π/2', phi: 'π', thetaRad: Math.PI / 2, phiRad: Math.PI },
  { n: 4, ket: '|i⟩', role: 'Y₊', theta: 'π/2', phi: 'π/2', thetaRad: Math.PI / 2, phiRad: Math.PI / 2 },
  { n: 5, ket: '|−i⟩', role: 'Y₋', theta: 'π/2', phi: '3π/2', thetaRad: Math.PI / 2, phiRad: (3 * Math.PI) / 2 },
];

/** Primary Bloch line — echoed in panel header; column `sub` variants sit above each enumeration table. */
export const UGRAD_BLOCH_SUB_PRIMARY = 'S² · qubit · |ψ⟩ = α|0⟩ + β|1⟩';

/** Side-by-side slots in +Live Bloch panel — same row data; wire distinct tensors / tracks later. */
export const UGRAD_QENUM_COLUMNS: readonly { key: string; title: string; sub: string }[] = [
  { key: 'pos', title: 'Quantum enumeration · positions', sub: UGRAD_BLOCH_SUB_PRIMARY },
  {
    key: 'alt',
    title: 'Quantum enumeration · channel B',
    sub: 'S² · channel B · Bloch slice · σ leg B · same θ, φ chart',
  },
  {
    key: 'aux',
    title: 'Quantum enumeration · channel C',
    sub: 'S² · channel C · Bloch slice · σ leg C · conjugate / parity track',
  },
];

export const UGRAD_HDR_BUTTONS = [
  { id: 'btn-evolve', label: 'evolve', title: 'run 10 generations' },
  { id: 'btn-mic', label: 'mic', title: 'toggle voice input' },
  { id: 'btn-prompt', label: 'prompt', title: 'toggle teleprompter' },
] as const;

export type UgradCmdGroup = { label: string; items: readonly { cmd: string; label: string }[] };

/** Grouped like `#prompt-menu` in ugrad-r0.html (condensed labels for the bar UI). */
export const UGRAD_CMD_GROUPS: readonly UgradCmdGroup[] = [
  {
    label: 'Training',
    items: [
      { cmd: 'train', label: 'train' },
      { cmd: 'evolve 10', label: 'evolve 10' },
      { cmd: 'auto curriculum', label: 'curriculum' },
      { cmd: 'stop', label: 'stop' },
      { cmd: 'background start', label: 'background' },
    ],
  },
  {
    label: 'R0–R6',
    items: [
      { cmd: 'tensor', label: 'tensor' },
      { cmd: 'gpt train 100', label: 'gpt train' },
      { cmd: 'gpt gen', label: 'gpt gen' },
      { cmd: 'level', label: 'level' },
      { cmd: 'ironline', label: 'ironline' },
    ],
  },
  {
    label: 'Provenance',
    items: [
      { cmd: 'steno', label: 'steno' },
      { cmd: 'languages', label: 'languages' },
      { cmd: 'license', label: 'license' },
      { cmd: 'bloch', label: 'bloch' },
      { cmd: 'slice', label: 'slice' },
    ],
  },
  {
    label: 'Export',
    items: [
      { cmd: 'export', label: 'export' },
      { cmd: 'export png', label: 'export png' },
      { cmd: 'export csv', label: 'export csv' },
      { cmd: 'export svg', label: 'export svg' },
      { cmd: 'quantum export', label: 'export qasm' },
      { cmd: 'quantum miami', label: 'qpu miami' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { cmd: 'compare', label: 'compare' },
      { cmd: 'idiot', label: 'idiot' },
      { cmd: 'leaderboard', label: 'leaderboard' },
      { cmd: 'trajectory', label: 'trajectory' },
      { cmd: 'speed', label: 'speed' },
      { cmd: 'ping', label: 'ping' },
      { cmd: 'cortex', label: 'cortex' },
      { cmd: 'dna', label: 'dna' },
      { cmd: 'contrail', label: 'contrail' },
      { cmd: 'contrail circuit', label: 'contrail circuit' },
      { cmd: 'contrail music', label: 'contrail music' },
      { cmd: 'contrail benchmark', label: 'contrail benchmark' },
    ],
  },
  {
    label: 'Voice',
    items: [
      { cmd: 'voice', label: 'voice' },
      { cmd: 'voice parenthood', label: 'voice parenthood' },
      { cmd: 'voice sing', label: 'voice sing' },
    ],
  },
  {
    label: 'Lounge',
    items: [
      { cmd: 'lounge listen', label: 'lounge listen' },
      { cmd: 'lounge stop', label: 'lounge stop' },
      { cmd: 'lounge clear', label: 'lounge clear' },
    ],
  },
  {
    label: 'State',
    items: [
      { cmd: 'status', label: 'status' },
      { cmd: 'gen', label: 'gen' },
      { cmd: 'help', label: 'help' },
    ],
  },
];

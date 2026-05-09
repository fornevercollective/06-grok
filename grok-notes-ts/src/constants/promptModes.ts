/** Footer main prompt field — Agent / Plan / Ask / Iso / Auto orchestration modes. */

export type PromptModeId = 'agent' | 'plan' | 'ask' | 'iso' | 'auto';

export const PROMPT_MODES: readonly {
  id: PromptModeId;
  label: string;
  sub?: string;
  title: string;
  placeholder: string;
  submitLabel: string;
}[] = [
  {
    id: 'agent',
    label: 'Agent',
    title: 'Agent — autonomous goal pursuit with tools',
    placeholder: 'Agent — goal, constraints, tools…',
    submitLabel: 'Run',
  },
  {
    id: 'plan',
    label: 'Plan',
    title: 'Plan — structured steps and milestones',
    placeholder: 'Plan — phases, checkpoints, dependencies…',
    submitLabel: 'Plan',
  },
  {
    id: 'ask',
    label: 'Ask',
    title: 'Ask — direct question to the model',
    placeholder: 'Message Grok…',
    submitLabel: 'Ask',
  },
  {
    id: 'iso',
    label: 'Iso',
    sub: '{isomorphic orchestration}',
    title: 'Isomorphic orchestration — graph-safe routing across tools',
    placeholder: 'Iso — orchestrate tools / isomorphic graph…',
    submitLabel: 'Orchestrate',
  },
  {
    id: 'auto',
    label: 'Auto',
    sub: '{autoresearch}',
    title: 'Autoresearch — self-directed retrieval and synthesis',
    placeholder: 'Auto — research topic, depth, sources…',
    submitLabel: 'Research',
  },
];

export function promptModeConfig(id: PromptModeId) {
  return PROMPT_MODES.find((m) => m.id === id) ?? PROMPT_MODES[2];
}

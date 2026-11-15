export const modes = ['PREFER_ON_DEVICE', 'ONLY_ON_DEVICE', 'PREFER_IN_CLOUD', 'ONLY_IN_CLOUD'] as const;
export type Mode = (typeof modes)[number];

export function readMode(fallback: Mode = 'PREFER_ON_DEVICE'): Mode {
  try {
    const saved = localStorage.getItem('koe-relay.mode');
    if (modes.includes(saved as Mode)) return saved as Mode;
  } catch { /* The app also works when storage is blocked. */ }
  return fallback;
}

export function hasSavedMode(): boolean {
  try { return modes.includes(localStorage.getItem('koe-relay.mode') as Mode); } catch { return false; }
}

export function saveMode(mode: Mode): void {
  try { localStorage.setItem('koe-relay.mode', mode); } catch { /* Session-only setting. */ }
}

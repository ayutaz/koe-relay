import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  config: { defaultConfig: {} as Record<string, string>, settings: { fetchTimeoutMillis: 0, minimumFetchIntervalMillis: 0 } },
  active: {} as Record<string, string>,
  app: vi.fn(() => ({})), supported: vi.fn(async () => true), fetch: vi.fn(async () => true),
}));
vi.mock('./firebase', () => ({ firebaseConfigured: true, getFirebaseApp: mocks.app }));
vi.mock('firebase/remote-config', () => ({
  isSupported: mocks.supported,
  getRemoteConfig: () => mocks.config,
  ensureInitialized: async () => {},
  fetchAndActivate: mocks.fetch,
  getString: (_config: unknown, key: string) => mocks.active[key] ?? mocks.config.defaultConfig[key],
}));
afterEach(() => { vi.clearAllMocks(); mocks.active = {}; });

it('fetches and activates mode and language parameters with bounded fetch settings', async () => {
  mocks.active = { default_inference_mode: 'ONLY_IN_CLOUD', enabled_languages: '["es"]', cloud_model: 'gemini-3.5-flash' };
  const { loadRemoteSettings } = await import('./remote-config');
  expect(await loadRemoteSettings()).toEqual({ defaultMode: 'ONLY_IN_CLOUD', enabledLanguages: ['ja', 'en', 'es'], cloudModel: 'gemini-3.5-flash' });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.config.settings.fetchTimeoutMillis).toBe(4000);
});

it('works when Remote Config is unreachable and retains previously activated settings', async () => {
  mocks.fetch.mockRejectedValueOnce(new Error('Offline'));
  const { loadRemoteSettings } = await import('./remote-config');
  expect((await loadRemoteSettings()).defaultMode).toBe('PREFER_ON_DEVICE');
  mocks.fetch.mockRejectedValueOnce(new Error('Offline'));
  mocks.active = { default_inference_mode: 'ONLY_ON_DEVICE', enabled_languages: '["fr"]', cloud_model: 'gemini-3.5-flash' };
  expect(await loadRemoteSettings()).toEqual({ defaultMode: 'ONLY_ON_DEVICE', enabledLanguages: ['ja', 'en', 'fr'], cloudModel: 'gemini-3.5-flash' });
});

it.each(['', 'not-a-model', 'gemini-3.5-flash?key=invalid'])('falls back safely for invalid cloud_model %s', async cloud_model => {
  mocks.active = { cloud_model };
  const { loadRemoteSettings } = await import('./remote-config');
  expect((await loadRemoteSettings()).cloudModel).toBe('gemini-3.5-flash-lite');
});

it('uses safe defaults when browser storage does not support Remote Config', async () => {
  mocks.supported.mockResolvedValueOnce(false);
  const { loadRemoteSettings } = await import('./remote-config');
  expect((await loadRemoteSettings()).enabledLanguages).toContain('pt');
  expect(mocks.fetch).not.toHaveBeenCalled();
});

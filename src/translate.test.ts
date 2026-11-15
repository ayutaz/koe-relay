import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.stubGlobal('navigator', { userActivation: { isActive: false } }); });
afterEach(() => { vi.unstubAllGlobals(); });
function mockAPI(state = 'available') {
  const translate = vi.fn(async (text: string) => `English: ${text}`);
  const availability = vi.fn().mockResolvedValue(state);
  const create = vi.fn(async (options) => {
    options.monitor?.({ addEventListener: (_type: string, listener: (event: { loaded: number }) => void) => listener({ loaded: 0.5 }) });
    return { translate };
  });
  vi.stubGlobal('self', { Translator: { availability, create } });
  return { translate, availability, create };
}

it('feature-detects missing and rejected availability as unavailable', async () => {
  vi.stubGlobal('self', {});
  const { translatorAvailability } = await import('./translate');
  expect(await translatorAvailability()).toBe('unavailable');
  const api = mockAPI();
  api.availability.mockRejectedValue(new Error('Unsupported pair'));
  expect(await translatorAvailability('fr')).toBe('unavailable');
});

it.each(['downloadable', 'downloading', 'unavailable'])('never creates a %s translator without a gesture', async state => {
  const api = mockAPI(state);
  const module = await import('./translate');
  await expect(module.prepareTranslator('en')).rejects.toThrow('Prepare on-device AI first');
  await expect(module.translateAll(['案内'])).rejects.toThrow('Prepare on-device AI first');
  expect(api.create).not.toHaveBeenCalled();
});

it('downloads from a gesture, reports progress, and caches independently per target', async () => {
  const api = mockAPI('downloadable');
  vi.stubGlobal('navigator', { userActivation: { isActive: true } });
  const module = await import('./translate');
  const progress = vi.fn();
  await Promise.all([module.prepareTranslator('en', progress), module.prepareTranslator('en')]);
  expect(progress.mock.calls).toEqual([[0.5], [1]]);
  expect(await module.translatorAvailability()).toBe('available');
  vi.stubGlobal('navigator', { userActivation: { isActive: false } });
  expect(await module.translateAll(['案内', '', '場所'])).toEqual(['English: 案内', '', 'English: 場所']);
  expect(api.create).toHaveBeenCalledTimes(1);
  vi.stubGlobal('navigator', { userActivation: { isActive: true } });
  await module.prepareTranslator('es');
  expect(api.create).toHaveBeenCalledTimes(2);
  expect(api.availability).toHaveBeenCalledWith({ sourceLanguage: 'ja', targetLanguage: 'es' });
});

it('creates an available translator without activation and retries a failed creation', async () => {
  const api = mockAPI();
  api.create.mockRejectedValueOnce(new Error('Download failed'));
  const module = await import('./translate');
  await expect(module.translateAll(['案内'])).rejects.toThrow('Download failed');
  expect(await module.translateAll(['案内'])).toEqual(['English: 案内']);
  api.translate.mockResolvedValueOnce(' ');
  await expect(module.translateAll(['案内'])).rejects.toThrow('empty text');
  expect(api.create).toHaveBeenCalledTimes(2);
});

it('does not start a download if activation expires during the availability check', async () => {
  const api = mockAPI('downloadable');
  vi.stubGlobal('navigator', { userActivation: { isActive: true } });
  api.availability.mockImplementation(async () => {
    vi.stubGlobal('navigator', { userActivation: { isActive: false } });
    return 'downloadable';
  });
  const module = await import('./translate');
  await expect(module.prepareTranslator()).rejects.toThrow('Prepare on-device AI first');
  expect(api.create).not.toHaveBeenCalled();
});

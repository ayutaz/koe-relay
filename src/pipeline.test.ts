import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GenerativeModel } from 'firebase/ai';

const original = '【架空の案内】青葉線の青葉駅は11月15日午後3時から閉まります。';
const japanese = { summary: '電車の案内', actions: ['駅の案内を見てください。'], place: '', time: '', easyJapanese: original, english: '', translation: '' };
const cloud = { ...japanese, summary: 'Train notice', place: 'Not stated', time: 'Not stated', english: 'Cloud English.', translation: 'Cloud translation.' };
let rewrite: typeof import('./rewrite');
let firebase: typeof import('./firebase');
let modelAvailability: ReturnType<typeof vi.fn>;
let translatorAvailability: ReturnType<typeof vi.fn>;
let create: ReturnType<typeof vi.fn>;
let translate: ReturnType<typeof vi.fn<(text: string, target: string) => Promise<string>>>;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('navigator', { onLine: true, userActivation: { isActive: false } });
  modelAvailability = vi.fn().mockResolvedValue('available');
  translatorAvailability = vi.fn().mockResolvedValue('available');
  translate = vi.fn(async (text, target) => `${target}: ${text}`);
  create = vi.fn(async ({ targetLanguage }) => ({ translate: (text: string) => translate(text, targetLanguage) }));
  vi.stubGlobal('self', { LanguageModel: { availability: modelAvailability }, Translator: { availability: translatorAvailability, create } });
  firebase = await import('./firebase');
  rewrite = await import('./rewrite');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function routeModels(deviceData: unknown = japanese, deviceSource = 'on_device') {
  const device = { generateContent: vi.fn().mockResolvedValue({ response: { inferenceSource: deviceSource, text: () => JSON.stringify(deviceData) } }) };
  const remote = { generateContent: vi.fn().mockResolvedValue({ response: { inferenceSource: 'in_cloud', text: () => JSON.stringify(cloud) } }) };
  const factory = vi.spyOn(firebase, 'getNoticeModel').mockImplementation(mode => (mode === 'ONLY_IN_CLOUD' ? remote : device) as unknown as GenerativeModel);
  return { device, remote, factory };
}

it('translates the full trimmed source, Japanese fields and optional language after device validation', async () => {
  const { device } = routeModels();
  const result = await rewrite.rewriteNotice(`  ${original}\n`, 'ONLY_ON_DEVICE', 'es');
  expect(result.notice).toEqual({
    ...japanese, english: `en: ${original}`, summary: 'en: 電車の案内',
    actions: ['en: 駅の案内を見てください。'], place: 'Not stated', time: 'Not stated', translation: `es: ${original}`,
  });
  expect(translate.mock.calls).toEqual([[original, 'en'], ['電車の案内', 'en'], ['駅の案内を見てください。', 'en'], [original, 'es']]);
  expect(modelAvailability).toHaveBeenCalledWith(firebase.deviceCreateOptions('es'));
  expect(translatorAvailability.mock.calls.map(([options]) => options)).toContainEqual({ sourceLanguage: 'ja', targetLanguage: 'es' });
  const prompt = device.generateContent.mock.calls[0][0];
  expect(prompt).toContain('summary, actions, place, time: short JAPANESE');
  expect(prompt).toContain('english must be ""');
  expect(prompt).toContain('translation must be ""');
  expect(result.source).toBe('ON_DEVICE');
  expect(rewrite.counters).toEqual({ ON_DEVICE: 1, IN_CLOUD: 0, UNKNOWN: 0 });
});

it.each(['model', 'english translator', 'extra translator'])('routes an unready %s directly to the cloud prompt', async missing => {
  if (missing === 'model') modelAvailability.mockResolvedValue('downloadable');
  else translatorAvailability.mockImplementation(async ({ targetLanguage }) => targetLanguage === (missing === 'extra translator' ? 'es' : 'en') ? 'downloadable' : 'available');
  const fixture = routeModels();
  const onEscalation = vi.fn();
  const result = await rewrite.rewriteNotice(original, 'PREFER_ON_DEVICE', 'es', onEscalation);
  expect(result.escalation).toBe('On-device model or translator not ready → used the cloud.');
  expect(onEscalation).toHaveBeenCalledWith(result.escalation);
  expect(fixture.factory).toHaveBeenCalledExactlyOnceWith('ONLY_IN_CLOUD', 'es');
  expect(fixture.remote.generateContent.mock.calls[0][0]).toBe(rewrite.buildPrompt(original, 'es', false));
  expect(fixture.device.generateContent).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

it.each([['ONLY_ON_DEVICE', true], ['PREFER_ON_DEVICE', false], ['PREFER_IN_CLOUD', false]] as const)('fails before generation if the translator is not ready in %s, online=%s', async (mode, online) => {
  vi.stubGlobal('navigator', { onLine: online });
  translatorAvailability.mockResolvedValue('downloadable');
  const fixture = routeModels();
  await expect(rewrite.rewriteNotice(original, mode)).rejects.toThrow('Prepare on-device AI first');
  expect(fixture.factory).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

it('reruns an SDK cloud fallback with the cloud prompt even if its device-shaped response is invalid', async () => {
  const fixture = routeModels({}, 'in_cloud');
  const result = await rewrite.rewriteNotice(original, 'PREFER_ON_DEVICE');
  expect(result.source).toBe('IN_CLOUD');
  expect(result.notice.english).toBe('Cloud English.');
  expect(result.escalation).toContain('SDK fell back');
  expect(fixture.remote.generateContent.mock.calls[0][0]).toBe(rewrite.buildPrompt(original, undefined, false));
  expect(rewrite.counters).toEqual({ ON_DEVICE: 0, IN_CLOUD: 2, UNKNOWN: 0 });
  expect(create).not.toHaveBeenCalled();
});

it('rejects blank device summaries and preserves bounded retries without invoking Translator', async () => {
  const fixture = routeModels({ ...japanese, summary: ' ' });
  await expect(rewrite.rewriteNotice(original, 'ONLY_ON_DEVICE')).rejects.toThrow('invalid summary');
  expect(fixture.device.generateContent).toHaveBeenCalledTimes(3);
  expect(create).not.toHaveBeenCalled();
});

it('cloud-only languages stay cloud-routed without checking on-device APIs', async () => {
  routeModels();
  const result = await rewrite.rewriteNotice(original, 'PREFER_ON_DEVICE', 'zh');
  expect(result.source).toBe('IN_CLOUD');
  expect(modelAvailability).not.toHaveBeenCalled();
  expect(translatorAvailability).not.toHaveBeenCalled();
});

it('routes an ON_DEVICE cloud-first fallback to cloud when its extra translator is not ready', async () => {
  translatorAvailability.mockImplementation(async ({ targetLanguage }) => targetLanguage === 'es' ? 'unavailable' : 'available');
  const fixture = routeModels();
  const result = await rewrite.rewriteNotice(original, 'PREFER_IN_CLOUD', 'es');
  expect(result.source).toBe('IN_CLOUD');
  expect(result.notice.translation).toBe('Cloud translation.');
  expect(result.escalation).toContain('On-device translator not ready');
  expect(fixture.remote.generateContent.mock.calls[0][0]).toBe(rewrite.buildPrompt(original, 'es', false));
  expect(rewrite.counters).toEqual({ ON_DEVICE: 1, IN_CLOUD: 1, UNKNOWN: 0 });
  expect(create).not.toHaveBeenCalled();
});

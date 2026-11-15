import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GenerativeModel } from 'firebase/ai';
import * as firebase from './firebase';
import { buildOnDevicePrompt, buildPrompt, counters, hasUnsupportedScript, rewriteNotice, rewriteWithModel, sourceFactTokens, validateQuality } from './rewrite';
import { samples } from './ui/samples';

const source = '11月15日午後3時、ひかり市民センターの1階に来てください。';
const notice = { summary: 'Notice', actions: [], place: 'ひかり市民センター 1階', time: '11月15日 午後3時', easyJapanese: source, english: 'Notice.' };
function model(easyJapanese = source, inferenceSource = 'on_device') {
  return { generateContent: vi.fn().mockResolvedValue({ response: { inferenceSource, text: () => JSON.stringify({ ...notice, easyJapanese }) } }) } as unknown as GenerativeModel;
}
beforeEach(() => { counters.ON_DEVICE = counters.IN_CLOUD = counters.UNKNOWN = 0; vi.stubGlobal('navigator', { onLine: true }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('builds a shorter device prompt with exact extracted fact tokens and no reading example', () => {
  expect(sourceFactTokens(source)).toEqual(['11月', '15日', '午後3時', '1階', '11', '15', '3', '1']);
  expect(sourceFactTokens('２０２６年十一月十五日 午後３時 １階 3:30 3:30')).toEqual(['２０２６年', '十一月', '十五日', '午後３時', '１階', '２０２６', '３', '１', '3:30']);
  for (const text of [source, ...Object.values(samples)]) {
    const prompt = buildOnDevicePrompt(text, 'fr');
    expect(prompt).toContain('Do NOT add parenthetical readings');
    expect(prompt).toContain('Use short sentences');
    expect(prompt).toContain('must appear verbatim in easyJapanese and in time/place where relevant: ' + JSON.stringify(sourceFactTokens(text)));
    expect(prompt).toContain('French');
    expect(prompt).not.toContain('図書館（としょかん）');
    expect(prompt.length).toBeLessThan(buildPrompt(text, 'fr', false).length);
    expect(new TextEncoder().encode(prompt).length).toBeLessThanOrEqual(6500);
    expect(JSON.parse(prompt.split('NOTICE_JSON: ')[1])).toBe(text);
  }
  // Fact repetition is part of the budget too; never truncate it or the source.
  expect(() => buildOnDevicePrompt(Array.from({ length: 250 }, (_, i) => `${100000 + i}階`).join(' '))).toThrow('on-device prompt budget');
  expect(buildPrompt(source, undefined, false)).toContain('add correct readings in parentheses only when certain');
});

it.each(['తెలుగు', 'हिन्दी', '한국어', 'русский', 'Ελληνικά', '時刻（うんてんさいかいのこకిけい）', '\u200b', '\u0000', '😀'])('rejects unsupported scripts/characters: %s', text => {
  expect(hasUnsupportedScript(text)).toBe(true);
  expect(() => validateQuality('案内です。', `案内です。${text}`)).toThrow('unsupported');
});
it.each(['強風（きょうふう）です。', '１１月１５日 午後３時 １階。', 'Ａ駅・B線、々〆〇「案内」【情報】〜！？', 'か\u3099 ｶﾞ カー ヽ ヾ ゝ ゞ\n\tOK: 3:30, 3.5%'])('allows Japanese, ASCII and full-width forms: %s', text => {
  expect(hasUnsupportedScript(text)).toBe(false);
});
it.each(['強風（つよいくう）', '11月15日（かんどうつき）', '現在（ぎょうごじさいぜん）', '未定（みじょう）', '強風(きょうふう)', '1階（いっかい）'])('rejects device readings without editing them: %s', text => {
  expect(() => validateQuality(text, text, 'ON_DEVICE')).toThrow('Unreliable on-device readings');
  expect(validateQuality(text, text, 'IN_CLOUD')).toEqual([]);
});
it.each(['on_device', 'in_cloud'])('validates scripts for actual %s responses and counts rejected responses', async inferenceSource => {
  await expect(rewriteWithModel(source, model(source + 'కి', inferenceSource))).rejects.toThrow('unsupported');
  expect(counters[inferenceSource === 'on_device' ? 'ON_DEVICE' : 'IN_CLOUD']).toBe(1);
});

it.each(['missing facts', 'readings', 'foreign script', 'invalid JSON'])('escalates a failed device response once: %s', async failure => {
  const device = model(failure === 'missing facts' ? '案内です。' : source + (failure === 'readings' ? '未定（みじょう）' : 'కి'));
  if (failure === 'invalid JSON') vi.mocked(device.generateContent).mockResolvedValue({ response: { inferenceSource: 'on_device', text: () => '{bad' } } as never);
  const cloud = model(source + '確認（かくにん）してください。', 'in_cloud');
  const factory = vi.spyOn(firebase, 'getNoticeModel').mockReturnValueOnce(device).mockReturnValueOnce(cloud);
  const onEscalation = vi.fn();
  const result = await rewriteNotice(source, 'PREFER_ON_DEVICE', undefined, onEscalation);
  expect(result.source).toBe('IN_CLOUD');
  expect(result).toHaveProperty('escalation', expect.stringContaining('→ re-ran in the cloud.'));
  expect(onEscalation).toHaveBeenCalledWith(expect.stringContaining('On-device result failed the checks ('));
  expect(factory.mock.calls).toEqual([['PREFER_ON_DEVICE', undefined], ['ONLY_IN_CLOUD', undefined, 'gemini-3.5-flash-lite']]);
  expect(vi.mocked(cloud.generateContent).mock.calls[0][0]).toBe(buildPrompt(source, undefined, false));
  expect(counters).toEqual({ ON_DEVICE: 1, IN_CLOUD: 1, UNKNOWN: 0 });
});

it.each([true, false])('ONLY_ON_DEVICE never escalates, online=%s, and stops after three invalid responses', async onLine => {
  vi.stubGlobal('navigator', { onLine });
  const device = model('案内です。');
  const factory = vi.spyOn(firebase, 'getNoticeModel').mockReturnValue(device);
  await expect(rewriteNotice(source, 'ONLY_ON_DEVICE')).rejects.toThrow('numbers');
  expect(device.generateContent).toHaveBeenCalledTimes(3);
  expect(factory.mock.calls.every(([mode]) => mode === 'ONLY_ON_DEVICE')).toBe(true);
  expect(counters).toEqual({ ON_DEVICE: 3, IN_CLOUD: 0, UNKNOWN: 0 });
});
it.each(['PREFER_ON_DEVICE', 'PREFER_IN_CLOUD'] as const)('retries invalid device responses offline in %s and accepts a later valid response', async mode => {
  vi.stubGlobal('navigator', { onLine: false });
  const device = model('案内です。');
  vi.mocked(device.generateContent).mockResolvedValueOnce({ response: { inferenceSource: 'on_device', text: () => JSON.stringify({ ...notice, easyJapanese: '案内です。' }) } } as never)
    .mockResolvedValueOnce({ response: { inferenceSource: 'on_device', text: () => JSON.stringify(notice) } } as never);
  vi.spyOn(firebase, 'getNoticeModel').mockReturnValue(device);
  expect((await rewriteNotice(source, mode)).source).toBe('ON_DEVICE');
  expect(device.generateContent).toHaveBeenCalledTimes(2);
  expect(counters).toEqual({ ON_DEVICE: 2, IN_CLOUD: 0, UNKNOWN: 0 });
});
it('checks current connectivity before escalating and retries on device if it became offline', async () => {
  const device = model('案内です。');
  vi.mocked(device.generateContent).mockImplementation(async () => {
    vi.stubGlobal('navigator', { onLine: false });
    return { response: { inferenceSource: 'on_device', text: () => JSON.stringify({ ...notice, easyJapanese: '案内です。' }) } } as never;
  });
  const factory = vi.spyOn(firebase, 'getNoticeModel').mockReturnValue(device);
  await expect(rewriteNotice(source, 'PREFER_ON_DEVICE')).rejects.toThrow('numbers');
  expect(factory.mock.calls).toEqual([['PREFER_ON_DEVICE', undefined], ['ONLY_ON_DEVICE', undefined], ['ONLY_ON_DEVICE', undefined]]);
  expect(counters.ON_DEVICE).toBe(3);
});
it('never loops on a failed cloud validation after escalation', async () => {
  const factory = vi.spyOn(firebase, 'getNoticeModel').mockReturnValueOnce(model('案内です。')).mockReturnValueOnce(model('案内です。', 'in_cloud'));
  await expect(rewriteNotice(source, 'PREFER_ON_DEVICE')).rejects.toThrow('numbers');
  expect(factory).toHaveBeenCalledTimes(2);
  expect(counters).toEqual({ ON_DEVICE: 1, IN_CLOUD: 1, UNKNOWN: 0 });
});
it.each(['ONLY_IN_CLOUD', 'PREFER_IN_CLOUD', 'PREFER_ON_DEVICE'] as const)('does not retry failed cloud responses in %s', async mode => {
  const cloud = model('案内です。', 'in_cloud');
  vi.spyOn(firebase, 'getNoticeModel').mockReturnValue(cloud);
  await expect(rewriteNotice(source, mode)).rejects.toThrow('numbers');
  expect(cloud.generateContent).toHaveBeenCalledTimes(1);
  expect(counters.IN_CLOUD).toBe(1);
});
it('keeps cloud-first device fallback validation unchanged apart from the new guards', async () => {
  const device = model(source + '未定（みじょう）');
  vi.spyOn(firebase, 'getNoticeModel').mockReturnValue(device);
  await expect(rewriteNotice(source, 'PREFER_IN_CLOUD')).rejects.toThrow('Unreliable on-device readings');
  expect(device.generateContent).toHaveBeenCalledTimes(1);
  expect(vi.mocked(device.generateContent).mock.calls[0][0]).toBe(buildPrompt(source, undefined, false));
});
it('does not retry request failures that produced no response', async () => {
  const device = model();
  vi.mocked(device.generateContent).mockRejectedValue(new Error('Device request failed'));
  vi.spyOn(firebase, 'getNoticeModel').mockReturnValue(device);
  await expect(rewriteNotice(source, 'ONLY_ON_DEVICE')).rejects.toThrow('Device request failed');
  expect(device.generateContent).toHaveBeenCalledTimes(1);
  expect(counters).toEqual({ ON_DEVICE: 0, IN_CLOUD: 0, UNKNOWN: 0 });
});

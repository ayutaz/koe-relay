import { expect, it, vi } from 'vitest';
import { routeMode } from './languages';
import { buildPrompt, validateQuality, rewriteWithModel } from './rewrite';
import { parseRemoteSettings } from './remote-config';

it('routes unsupported device languages to cloud without violating ONLY_ON_DEVICE', () => {
  expect(routeMode('PREFER_ON_DEVICE', 'zh')).toBe('ONLY_IN_CLOUD');
  expect(routeMode('PREFER_IN_CLOUD', 'pt')).toBe('ONLY_IN_CLOUD');
  expect(() => routeMode('ONLY_ON_DEVICE', 'zh')).toThrow('requires cloud');
  expect(routeMode('PREFER_ON_DEVICE', 'es')).toBe('PREFER_ON_DEVICE');
  expect(routeMode('ONLY_ON_DEVICE', 'fr')).toBe('ONLY_ON_DEVICE');
  expect(routeMode('PREFER_IN_CLOUD', 'es', false)).toBe('ONLY_ON_DEVICE');
  expect(() => routeMode('PREFER_ON_DEVICE', 'pt', false)).toThrow('internet');
  expect(() => routeMode('ONLY_IN_CLOUD', undefined, false)).toThrow('offline');
});

it('rejects the observed typo and misreading without silently editing model output', () => {
  expect(() => validateQuality('強風です。', 'つうふうです。みてくだだい。')).toThrow();
  expect(() => validateQuality('強風です。', '強風（つうふう）です。')).toThrow('reading');
  expect(() => validateQuality('強風です。', '強風（きょうふう）です。みてくだだい。')).toThrow('typo');
  expect(validateQuality('強風です。', '強風（きょうふう）です。確認してください。')).toEqual([]);
  // Adjacent kana can be correct Japanese. Do not indiscriminately ban them.
  expect(validateQuality('ここで待ってください。', 'ここで、まってください。')).toEqual([]);
});

it('rejects changed or invented numbers and times and flags missing place names', () => {
  const source = '青葉駅は11月15日午後3時から閉まります。';
  expect(() => validateQuality(source, '青葉駅は11月16日午後3時から閉まります。')).toThrow('numbers');
  expect(() => validateQuality(source, '青葉駅は11月15日午前3時から閉まります。')).toThrow('time');
  expect(() => validateQuality(source, '青葉駅は11月15日午後3時から4時間閉まります。')).toThrow('numbers');
  expect(validateQuality(source, source)).toEqual([]);
  expect(validateQuality(source, '駅は11月15日午後3時から閉まります。').join()).toContain('青葉駅');
});

it('keeps the serialized device prompt under a conservative UTF-8 byte budget', () => {
  expect(buildPrompt('強風です。', 'es')).toContain('Spanish');
  expect(new TextEncoder().encode(buildPrompt('あ'.repeat(1000))).length).toBeLessThan(6500);
  expect(() => buildPrompt('あ'.repeat(4000), undefined, true)).toThrow('on-device');
  expect(buildPrompt('あ'.repeat(4000), undefined, false)).toContain('NOTICE_JSON');
});

it('requires the selected extra translation in the response', async () => {
  const model = { generateContent: vi.fn().mockResolvedValue({ response: { inferenceSource: 'in_cloud', text: () => JSON.stringify({ summary: 's', actions: [], place: 'Not stated', time: 'Not stated', easyJapanese: '案内です。', english: 'Notice.' }) } }) };
  await expect(rewriteWithModel('案内です。', model as never, 'es')).rejects.toThrow('translation');
});

it('parses Remote Config defensively and never enables unknown languages or modes', () => {
  expect(parseRemoteSettings('ONLY_IN_CLOUD', '["ja","en","es","xx"]')).toEqual({ defaultMode: 'ONLY_IN_CLOUD', enabledLanguages: ['ja', 'en', 'es'] });
  expect(parseRemoteSettings('invalid', '{bad')).toEqual({ defaultMode: 'PREFER_ON_DEVICE', enabledLanguages: ['ja', 'en', 'zh', 'es', 'fr', 'pt'] });
  expect(parseRemoteSettings('ONLY_ON_DEVICE', '[]').enabledLanguages).toEqual(['ja', 'en']);
});

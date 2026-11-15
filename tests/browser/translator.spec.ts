import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      translatorReady: boolean; creations: { active: boolean; target: string }[];
      finishTranslator: () => void; finishNano: () => void;
    };
    state.translatorReady = false;
    state.creations = [];
    Object.defineProperty(self, 'Translator', { configurable: true, value: {
      availability: async () => state.translatorReady ? 'available' : 'downloadable',
      create: ({ targetLanguage, monitor }: { targetLanguage: string; monitor: (monitor: unknown) => void }) => {
        state.creations.push({ active: navigator.userActivation.isActive, target: targetLanguage });
        monitor({ addEventListener(_type: string, callback: (event: { loaded: number }) => void) { callback({ loaded: 0.5 }); } });
        return new Promise(resolve => { state.finishTranslator = () => {
          state.translatorReady = true;
          resolve({ translate: async (text: string) => `Translated: ${text}` });
        }; });
      },
    } });
  });
  await page.route('**/src/firebase.ts', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const firebaseConfigured = true;
    export const firebaseStatus = 'Firebase mock (test only)';
    export function setCloudModel() {}
    export function getFirebaseApp() { throw new Error('No live Firebase'); }
    export async function deviceModelAvailability() { return 'available'; }
    export function initializeDeviceModel(mode, callback) {
      callback(0.25);
      return new Promise(resolve => { window.finishNano = () => { callback(1); resolve(); }; });
    }
    window.modelCalls = [];
    export function getNoticeModel(mode) {
      return { async generateContent(prompt) {
        window.modelCalls.push({mode, prompt});
        const cloud = mode === 'ONLY_IN_CLOUD';
        return { response: { inferenceSource: cloud ? 'in_cloud' : 'on_device', text: () => JSON.stringify({
          summary: cloud ? 'Cloud summary' : '電車の案内', actions: [], place: cloud ? 'Not stated' : '', time: cloud ? 'Not stated' : '',
          easyJapanese: JSON.parse(prompt.split('NOTICE_JSON: ')[1]), english: cloud ? 'Cloud English' : ''
        }) } };
      } };
    }
  ` }));
});

test('Prepare starts Nano and translator together, combines progress, then translates on device', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/koe-relay/');
  await page.getByRole('button', { name: 'Train suspension sample' }).click();
  await page.getByLabel('Inference mode').selectOption('ONLY_ON_DEVICE');
  await page.getByRole('button', { name: 'Rewrite notice' }).click();
  await expect(page.locator('#ai-message')).toContainText('Prepare on-device AI first');
  expect(await page.evaluate(() => (window as unknown as { creations: unknown[] }).creations)).toEqual([]);
  await page.getByRole('button', { name: 'Prepare on-device AI' }).click();
  await expect(page.locator('#download-progress')).toHaveJSProperty('value', 0.375);
  await expect(page.locator('#ai-message')).toContainText('Nano 25% · Translator en 50%');
  await expect(page.getByRole('button', { name: 'Rewrite notice' })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { creations: unknown[] }).creations)).toEqual([{ active: true, target: 'en' }]);
  await page.evaluate(() => {
    const state = window as unknown as { finishTranslator: () => void; finishNano: () => void };
    state.finishTranslator(); state.finishNano();
  });
  await expect(page.locator('#ai-message')).toContainText('On-device AI ready');
  await expect(page.locator('#download-progress')).toHaveJSProperty('value', 1);
  await page.getByRole('button', { name: 'Rewrite notice' }).click();
  await expect(page.locator('#source')).toHaveText('ON_DEVICE');
  await expect(page.locator('#english-source')).toHaveText('Translated on device (Chrome Translator API)');
  await expect(page.locator('#english')).toHaveText(`Translated: ${await page.locator('#notice').inputValue()}`);
  await expect(page.locator('#summary')).toHaveText('Translated: 電車の案内');
  await expect(page.locator('#place')).toHaveText('Not stated');
  await expect(page.locator('#time')).toHaveText('Not stated');
  await expect(page.locator('#device-count')).toHaveText('1');
  await expect(page.locator('#cloud-count')).toHaveText('0');
});

test('unprepared translator routes PREFER_ON_DEVICE directly to cloud with a visible reason', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/koe-relay/');
  await page.getByRole('button', { name: 'Shelter opening sample' }).click();
  await page.getByRole('button', { name: 'Rewrite notice' }).click();
  await expect(page.locator('#source')).toHaveText('IN_CLOUD');
  await expect(page.locator('#english-source')).toHaveText('Gemini (cloud)');
  await expect(page.locator('#escalation-message')).toHaveText('On-device model or translator not ready → used the cloud.');
  await expect(page.locator('#cloud-count')).toHaveText('1');
  await expect(page.locator('#device-count')).toHaveText('0');
  const calls = await page.evaluate(() => (window as unknown as { modelCalls: { mode: string; prompt: string }[] }).modelCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0].mode).toBe('ONLY_IN_CLOUD');
  expect(calls[0].prompt).toContain('english must be a complete plain English version');
  expect(await page.evaluate(() => (window as unknown as { creations: unknown[] }).creations)).toEqual([]);
});

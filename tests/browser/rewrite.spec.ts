import { expect, test } from '@playwright/test';

test('mocked SDK results render safely, count the reported source, and clear stale output', async ({ page }) => {
  // Mock only in the test browser. This fixture is never part of dist, and cannot call Firebase.
  const firebaseRequests: string[] = [];
  page.on('request', request => {
    if (/googleapis\.com|recaptcha/.test(request.url())) firebaseRequests.push(request.url());
  });
  await page.route('**/src/firebase.ts', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export const firebaseConfigured = true;
      export const firebaseStatus = 'Firebase mock (test only)';
      export function getFirebaseApp() { throw new Error('Test: no live Firebase'); }
      let calls = 0;
      export function getNoticeModel(mode) {
        return { async generateContent(prompt) {
          calls++;
          const data = { summary: '<img src=x onerror=alert(1)>', actions: ['Check the notice.'], place: 'Aoba', time: 'Unknown', easyJapanese: '電車は止まっています。', english: 'Trains are suspended.' };
          data.easyJapanese = JSON.parse(prompt.split('NOTICE_JSON: ')[1]);
          return {response: {inferenceSource: calls === 1 ? 'in_cloud' : 'on_device', text: () => calls === 3 ? '{}' : JSON.stringify(data)}};
        }};
      }
      export async function initializeDeviceModel(mode, callback) { callback(0.25); callback(1); }`,
  }));
  await page.goto('http://127.0.0.1:4174/koe-relay/');
  await page.getByRole('button', { name: 'Prepare on-device AI' }).click();
  await expect(page.locator('#ai-message')).toContainText('On-device AI ready');
  await expect(page.locator('#source')).toHaveText('NO INFERENCE YET');
  await page.getByLabel('Japanese notice', { exact: true }).fill('電車は止まっています。');
  await page.getByRole('button', { name: 'Rewrite notice' }).click();
  await expect(page.locator('#source')).toHaveText('IN_CLOUD');
  await expect(page.locator('#cloud-count')).toHaveText('1');
  await expect(page.locator('#summary')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#summary img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Speak Japanese', exact: true })).toBeEnabled();
  await expect(page.locator('#easy-japanese')).toHaveText('電車は止まっています。');
  await expect(page.locator('#english')).toHaveText('Trains are suspended.');
  await page.getByRole('button', { name: 'Shelter opening sample' }).click();
  await expect(page.locator('#result')).toBeHidden();
  await page.getByRole('button', { name: 'Rewrite notice' }).click();
  await expect(page.locator('#source')).toHaveText('ON_DEVICE');
  await expect(page.locator('#device-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Rewrite notice' }).click();
  await expect(page.locator('#ai-message')).toContainText('Rewrite failed:');
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#source')).toHaveText('NO VALID RESULT');
  await expect(page.locator('#device-count')).toHaveText('2');
  await expect(page.getByRole('button', { name: 'Rewrite notice' })).toBeEnabled();
  await page.getByLabel('Japanese notice', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Rewrite notice' })).toBeDisabled();
  expect(firebaseRequests).toEqual([]);
});

test('extra language controls route cloud-only languages and declare optional device languages', async ({ page }) => {
  await page.route('**/src/firebase.ts', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const firebaseConfigured = true;
    export const firebaseStatus = 'Firebase mock (test only)';
    export function getFirebaseApp() { throw new Error('No live Firebase'); }
    window.modelCalls = [];
    export function getNoticeModel(mode, language) {
      window.modelCalls.push({mode, language});
      return { async generateContent(prompt) {
        return {response: {inferenceSource: mode === 'ONLY_ON_DEVICE' ? 'on_device' : 'in_cloud', text: () => JSON.stringify({
          summary: 'Test notice', actions: [], place: 'Not stated', time: 'Not stated',
          easyJapanese: JSON.parse(prompt.split('NOTICE_JSON: ')[1]), english: 'Test notice.', translation: '<img> Test ' + language
        })}};
      }};
    }
    export async function initializeDeviceModel(mode, callback, language) { window.preparedLanguage = language; callback(1); }
  ` }));
  await page.goto('http://127.0.0.1:4174/koe-relay/');
  await page.getByLabel('Japanese notice', { exact: true }).fill('案内です。');
  for (const code of ['zh', 'es', 'fr', 'pt']) {
    await page.getByLabel('Inference mode').selectOption(code === 'es' ? 'ONLY_ON_DEVICE' : 'PREFER_ON_DEVICE');
    await page.getByLabel('Additional output language').selectOption(code);
    if (code === 'es') {
      await page.getByRole('button', { name: 'Prepare on-device AI' }).click();
      await expect(page.locator('#ai-message')).toContainText('On-device AI ready');
      expect(await page.evaluate(() => (window as unknown as { preparedLanguage: string }).preparedLanguage)).toBe('es');
    }
    await page.getByRole('button', { name: 'Rewrite notice' }).click();
    await expect(page.locator('#translation')).toHaveText(`<img> Test ${code}`);
    await expect(page.locator('#translation')).toHaveAttribute('lang', code);
    await expect(page.locator('#translation img')).toHaveCount(0);
    await expect(page.locator('#source')).toHaveText(code === 'es' ? 'ON_DEVICE' : 'IN_CLOUD');
  }
  const calls = await page.evaluate(() => (window as unknown as { modelCalls: { mode: string; language: string }[] }).modelCalls);
  expect(calls).toEqual([
    { mode: 'ONLY_IN_CLOUD', language: 'zh' }, { mode: 'ONLY_ON_DEVICE', language: 'es' },
    { mode: 'PREFER_ON_DEVICE', language: 'fr' }, { mode: 'ONLY_IN_CLOUD', language: 'pt' },
  ]);
  await page.getByLabel('Inference mode').selectOption('ONLY_ON_DEVICE');
  await expect(page.getByRole('button', { name: 'Rewrite notice' })).toBeDisabled();
  await expect(page.locator('#language-help')).toContainText('requires cloud');
});

test('Remote Config applies defaults and enabled languages while a saved mode wins', async ({ page }) => {
  await page.route('**/src/remote-config.ts', route => route.fulfill({ contentType: 'text/javascript', body: `
    export async function loadRemoteSettings() { return { defaultMode: 'ONLY_IN_CLOUD', enabledLanguages: ['ja', 'en', 'es'] }; }
  ` }));
  await page.goto('http://127.0.0.1:4174/koe-relay/');
  await expect(page.getByLabel('Inference mode')).toHaveValue('ONLY_IN_CLOUD');
  expect(await page.locator('#extra-language option[value=zh]').evaluate(option => (option as HTMLOptionElement).hidden)).toBe(true);
  expect(await page.locator('#extra-language option[value=es]').evaluate(option => (option as HTMLOptionElement).hidden)).toBe(false);
  await page.getByLabel('Inference mode').selectOption('ONLY_ON_DEVICE');
  await page.reload();
  await expect(page.getByLabel('Inference mode')).toHaveValue('ONLY_ON_DEVICE');
});

test('Japanese quality failures hide results and place warnings remain visible for review', async ({ page }) => {
  await page.route('**/src/firebase.ts', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const firebaseConfigured = true;
    export const firebaseStatus = 'Firebase mock (test only)';
    export function getFirebaseApp() { throw new Error('No live Firebase'); }
    let calls = 0;
    export function getNoticeModel() { return { async generateContent() {
      calls++;
      const easyJapanese = calls === 1 ? '青葉駅は強風（つうふう）です。' : calls === 2 ? '青葉駅は強風です。みてくだだい。' : '強風（きょうふう）です。';
      return { response: { inferenceSource: 'in_cloud', text: () => JSON.stringify({summary: 'Strong wind', actions: [], place: 'Aoba', time: 'Not stated', easyJapanese, english: 'Strong wind.'}) } };
    } }; }
    export async function initializeDeviceModel() {}
  ` }));
  await page.goto('http://127.0.0.1:4174/koe-relay/');
  await page.getByLabel('Japanese notice', { exact: true }).fill('青葉駅は強風です。');
  for (const word of ['reading', 'typo']) {
    await page.getByRole('button', { name: 'Rewrite notice' }).click();
    await expect(page.locator('#ai-message')).toContainText(word);
    await expect(page.locator('#result')).toBeHidden();
  }
  await page.getByRole('button', { name: 'Rewrite notice' }).click();
  await expect(page.locator('#quality-warning')).toContainText('Needs review.');
  await expect(page.locator('#quality-warning')).toContainText('青葉駅');
  await expect(page.locator('#source')).toHaveText('IN_CLOUD');
  await expect(page.locator('#cloud-count')).toHaveText('3');
});

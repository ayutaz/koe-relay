import { expect, test } from '@playwright/test';

test('mocked SDK results render safely, count the reported source, and clear stale output', async ({ page }) => {
  // Mock only in the test browser. This fixture is never part of dist, and cannot call Firebase.
  const firebaseRequests: string[] = [];
  page.on('request', request => {
    if (/googleapis\.com|recaptcha/.test(request.url())) firebaseRequests.push(request.url());
  });
  await page.route('http://127.0.0.1:4174/src/firebase.ts', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export const firebaseConfigured = true;
      export const firebaseStatus = 'Firebase mock (test only)';
      let calls = 0;
      export function getNoticeModel(mode) {
        return { async generateContent() {
          calls++;
          const data = { summary: '<img src=x onerror=alert(1)>', actions: ['Check the notice.'], place: 'Aoba', time: 'Unknown', easyJapanese: '電車は止まっています。', english: 'Trains are suspended.' };
          return {response: {inferenceSource: calls === 1 ? 'in_cloud' : 'on_device', text: () => calls === 3 ? '{}' : JSON.stringify(data)}};
        }};
      }
      export async function initializeDeviceModel(mode, callback) { callback(0.25); callback(1); }`,
  }));
  await page.goto('http://127.0.0.1:4174/');
  await page.getByRole('button', { name: 'Prepare on-device AI' }).click();
  await expect(page.locator('#ai-message')).toContainText('On-device AI ready');
  await expect(page.locator('#source')).toHaveText('NO INFERENCE YET');
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

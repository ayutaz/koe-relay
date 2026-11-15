import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('unconfigured production app is usable without contacting Firebase', async ({ page }) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByText('Firebase not configured', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rewrite notice' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Prepare on-device AI' })).toBeDisabled();
  await expect(page.getByLabel('Inference mode')).toHaveValue('PREFER_ON_DEVICE');
  await page.getByRole('button', { name: 'Shelter opening sample' }).click();
  await expect(page.getByLabel('Japanese notice', { exact: true })).toHaveValue(/ひかり市民センター/);
  await page.getByRole('button', { name: 'Train suspension sample' }).click();
  await expect(page.getByLabel('Japanese notice', { exact: true })).toHaveValue(/運転再開の時刻は未定/);
  await page.getByLabel('Inference mode').selectOption('ONLY_ON_DEVICE');
  await expect(page.locator('#mode-help')).toContainText('without sending the notice to the cloud');
  await page.reload();
  await expect(page.getByLabel('Inference mode')).toHaveValue('ONLY_ON_DEVICE');
  await expect(page.locator('#source')).toHaveText('NO INFERENCE YET');
  await expect(page.locator('#device-count')).toHaveText('0');
  await expect(page.locator('#cloud-count')).toHaveText('0');
  await page.screenshot({ path: '.artifacts/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/mobile.png', fullPage: true });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('speech failure is recoverable and leaves the app usable', async ({ page }) => {
  await page.route('https://huggingface.co/**', route => route.abort('failed'));
  // Dev has no service worker; page routes cannot intercept a worker's upstream fetch.
  await page.goto('http://127.0.0.1:4174/koe-relay/');
  await page.getByRole('button', { name: 'Test Japanese voice' }).click();
  await expect(page.locator('#speech-message')).toContainText('Speech failed:', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Test English voice' })).toBeEnabled();
  await expect(page.getByText('Firebase not configured', { exact: true })).toBeVisible();
  await expect(page.locator('#device-count')).toHaveText('0');
});

test('real piper-plus Japanese and English playback survives an offline reload', async ({ page, context }) => {
  test.skip(process.env.RUN_TTS !== '1', 'Opt in to the real voice download with RUN_TTS=1. No Firebase calls.');
  test.setTimeout(300_000);
  const errors: string[] = [];
  const resources: { url: string; bytes: number | null; fromServiceWorker: boolean; milliseconds: number }[] = [];
  const starts = new Map<string, number>();
  const captures: Promise<void>[] = [];
  await page.addInitScript(() => {
    const evidence: { frames: number; sampleRate: number; duration: number; peak: number; finite: boolean }[] = [];
    (window as unknown as { audioEvidence: typeof evidence }).audioEvidence = evidence;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer) {
        const samples = this.buffer.getChannelData(0);
        let peak = 0;
        let finite = true;
        for (const sample of samples) { finite &&= Number.isFinite(sample); peak = Math.max(peak, Math.abs(sample)); }
        evidence.push({ frames: samples.length, sampleRate: this.buffer.sampleRate, duration: this.buffer.duration, peak, finite });
      }
      return start.apply(this, args);
    };
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => starts.set(request.url(), performance.now()));
  page.on('requestfinished', request => {
    // HF redirects the model request to blob storage. Measure the final body, not the redirect.
    let original = request;
    while (original.redirectedFrom()) original = original.redirectedFrom()!;
    if (!/\.onnx($|\?)|\.wasm($|\?)/.test(original.url())) return;
    const milliseconds = Math.round(performance.now() - (starts.get(original.url()) ?? performance.now()));
    captures.push((async () => {
      const response = await request.response();
      if (!response?.ok()) return;
      // Reading huge bodies through CDP can exceed its inspector buffer. Network byte counts do not.
      const fromServiceWorker = response.fromServiceWorker();
      const rawBytes = (await request.sizes()).responseBodySize;
      const bytes = !fromServiceWorker && rawBytes >= 0 ? rawBytes : null;
      resources.push({ url: original.url(), bytes, fromServiceWorker, milliseconds });
    })());
  });
  await page.goto('./');
  const start = performance.now();
  await page.getByRole('button', { name: 'Load speech model' }).click();
  await expect(page.locator('#speech-message')).toHaveText(/Voice ready|Speech failed:/, { timeout: 240_000 });
  await expect(page.locator('#speech-message')).toContainText('Voice ready');
  const initializationMilliseconds = Math.round(performance.now() - start);
  for (const language of ['Japanese', 'English']) {
    await page.getByRole('button', { name: `Test ${language} voice` }).click();
    await expect(page.locator('#speech-message')).toHaveText('Speech finished.', { timeout: 60_000 });
  }
  await expect(page.locator('#offline-status')).toContainText('speech saved for offline use');
  const onlineAudioEvidence = await page.evaluate(() => (window as unknown as { audioEvidence: unknown[] }).audioEvidence);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await context.setOffline(true);
  await cdp.send('Network.overrideNetworkState', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await page.reload();
  await expect(page.locator('#network-status')).toHaveText('Offline');
  expect(await page.evaluate(() => fetch('./uncached-offline-probe').then(() => false, () => true))).toBe(true);
  for (const language of ['Japanese', 'English']) {
    await page.getByRole('button', { name: `Test ${language} voice` }).click();
    await expect(page.locator('#speech-message')).toHaveText('Speech finished.', { timeout: 60_000 });
  }
  await expect(page.locator('#device-count')).toHaveText('0');
  expect(errors).toEqual([]);
  await Promise.all(captures);
  const audioEvidence = await page.evaluate(() => (window as unknown as { audioEvidence: { frames: number; sampleRate: number; duration: number; peak: number; finite: boolean }[] }).audioEvidence);
  expect(audioEvidence).toHaveLength(2);
  expect(onlineAudioEvidence).toHaveLength(2);
  for (const audio of audioEvidence) {
    expect(audio.finite).toBe(true);
    expect(audio.duration).toBeGreaterThan(0.2);
    expect(audio.peak).toBeGreaterThan(0.001);
  }
  await mkdir('.artifacts', { recursive: true });
  await page.screenshot({ path: '.artifacts/offline-desktop.png', fullPage: true });
  await writeFile('.artifacts/tts-browser.json', JSON.stringify({ browserVersion: page.context().browser()?.version(), initializationMilliseconds, resources, onlineAudioEvidence, offlineAudioEvidence: audioEvidence, errors, humanListeningReview: 'unverified' }, null, 2));
});

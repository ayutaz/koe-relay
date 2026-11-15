import { expect, test } from '@playwright/test';
import { voiceModelUrl, voiceConfigUrl } from '../../src/voice-assets';

test('offline reload serves the Pages shell, runtime, dictionaries and cached speech assets', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('#offline-status')).toContainText('App saved for offline use', { timeout: 60_000 });
  const cacheInfo = await page.evaluate(async ({ model, config }) => {
    const names = await caches.keys();
    const shell = names.find(name => name.includes('/koe-relay/:shell-'))!;
    const keys = await (await caches.open(shell)).keys();
    const speech = await caches.open(shell.split('shell-')[0] + 'voice-v1');
    // Synthetic model bytes isolate cache delivery from a 40 MB external download.
    // The opt-in real playback test separately verifies valid ONNX + offline synthesis.
    await speech.put(model, new Response('offline-model-fixture'));
    await speech.put(config, new Response('{"fixture":true}', { headers: { 'Content-Type': 'application/json' } }));
    return keys.map(key => key.url);
  }, { model: voiceModelUrl, config: voiceConfigUrl });
  expect(cacheInfo.some(url => url.includes('vendor/piper/piper_plus_wasm_bg.wasm'))).toBe(true);
  expect(cacheInfo.some(url => url.includes('vendor/ort/ort-wasm-simd-threaded.wasm'))).toBe(true);
  expect(cacheInfo.some(url => url.includes('cmudict_data-'))).toBe(true);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await context.setOffline(true);
  // Chrome 157 decouples navigator.onLine from transport emulation.
  await cdp.send('Network.overrideNetworkState', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await page.reload();
  await expect(page.locator('#network-status')).toHaveText('Offline');
  expect(await page.evaluate(() => fetch('./uncached-offline-probe').then(() => false, () => true))).toBe(true);
  await expect(page.locator('#offline-status')).toContainText('speech saved for offline use');
  await page.getByRole('button', { name: 'Shelter opening sample' }).click();
  await expect(page.getByLabel('Japanese notice', { exact: true })).toHaveValue(/ひかり市民センター/);
  const delivered = await page.evaluate(async ({ assets, model, config }) => {
    for (const url of assets) {
      const response = await fetch(url);
      if (!response.ok || (await response.arrayBuffer()).byteLength === 0) return false;
    }
    return await (await fetch(model)).text() === 'offline-model-fixture'
      && (await (await fetch(`${model}.json`)).json()).fixture === true
      && (await (await fetch(config)).json()).fixture === true;
  }, { assets: cacheInfo.filter(url => /vendor\/|cmudict_data-/.test(url)), model: voiceModelUrl, config: voiceConfigUrl });
  expect(delivered).toBe(true);
  // A missing cached file must fail too: the worker cannot quietly fetch from the server.
  const cacheMissFailed = await page.evaluate(async () => {
    const shell = (await caches.keys()).find(key => key.includes(':shell-'))!;
    const url = new URL('vendor/piper/LICENSE.md', document.baseURI).href;
    await (await caches.open(shell)).delete(url);
    return fetch(url).then(() => false, () => true);
  });
  expect(cacheMissFailed).toBe(true);
  expect(errors).toEqual([]);
});

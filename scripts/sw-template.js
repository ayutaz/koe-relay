/* Generated with a content-versioned, scope-local manifest by vite.config.ts. */
const FILES = __SHELL_FILES__;
const VOICE = __VOICE_URLS__;
const PREFIX = `koe-relay:${new URL(self.registration.scope).pathname}:`;
const SHELL = `${PREFIX}shell-__BUILD_VERSION__`;
const SPEECH = `${PREFIX}voice-v1`;
const localFiles = new Set(FILES.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  // A failed/partial installation never claims offline readiness or replaces the old worker.
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll([...localFiles])));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== SHELL && key !== SPEECH) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function voiceResponse(url) {
  const cache = await caches.open(SPEECH);
  const saved = await cache.match(url);
  if (saved) return saved;
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok || response.type === 'opaque') throw new Error('Voice download failed');
  // Never cache opaque, failed, or partial responses. Storage failure leaves live speech usable.
  if (response.status === 200) {
    try { await cache.put(url, response.clone()); } catch { /* STATUS remains incomplete. */ }
  }
  return response;
}
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // piper-plus first probes model.onnx.json; this pinned model uses sibling config.json.
  const voiceUrl = url.href === `${VOICE[0]}.json` ? VOICE[1] : url.href;
  if (VOICE.includes(voiceUrl)) {
    event.respondWith(voiceResponse(voiceUrl));
  } else if (localFiles.has(url.href) || (event.request.mode === 'navigate' && url.href === self.registration.scope)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      return await cache.match(event.request.mode === 'navigate' ? new URL('index.html', self.registration.scope).href : url.href) ?? fetch(event.request);
    })());
  }
  // AI, App Check, Remote Config and all unrelated traffic bypass this worker.
});

self.addEventListener('message', event => {
  if (!['STATUS', 'CACHE_VOICE'].includes(event.data?.type) || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'CACHE_VOICE') {
        for (const url of VOICE) await voiceResponse(url);
      }
      const cache = await caches.open(SPEECH);
      const voice = (await Promise.all(VOICE.map(url => cache.match(url)))).every(Boolean);
      event.ports[0].postMessage({ shell: await caches.has(SHELL), voice });
    } catch { event.ports[0].postMessage({ error: true }); }
  })());
});

let registration: Promise<ServiceWorkerRegistration | null> | undefined;

export function registerOffline(): Promise<ServiceWorkerRegistration | null> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return Promise.resolve(null);
  return registration ??= (async () => {
    const result = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { navigator.serviceWorker.removeEventListener('controllerchange', changed); reject(new Error('Offline shell installation timed out. Reload while online to retry.')); }, 30_000);
        const changed = () => { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', changed); resolve(); };
        navigator.serviceWorker.addEventListener('controllerchange', changed);
        if (navigator.serviceWorker.controller) changed();
      });
    }
    return result;
  })().catch(() => null);
}

async function workerRequest(type: 'STATUS' | 'CACHE_VOICE'): Promise<{ shell: boolean; voice: boolean }> {
  if (!await registerOffline() || !navigator.serviceWorker.controller) throw new Error('Offline caching is unavailable. Use the production build over HTTPS or localhost.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Offline cache did not respond. Stay online and try again.')); }, type === 'CACHE_VOICE' ? 180_000 : 5000);
    channel.port1.onmessage = event => {
      clearTimeout(timer);
      channel.port1.close();
      if (event.data.error) reject(new Error('Could not save speech assets. Check your connection and available storage.'));
      else resolve(event.data);
    };
    navigator.serviceWorker.controller!.postMessage({ type }, [channel.port2]);
  });
}

export async function offlineStatus(): Promise<string> {
  if (!import.meta.env.PROD) return 'Offline caching is available in the production build.';
  try {
    const status = await workerRequest('STATUS');
    return status.voice ? 'App and Japanese / English speech saved for offline use. Nano must be prepared separately.' : 'App saved for offline use. Load or save the speech model while online.';
  } catch { return 'Offline cache unavailable. Stay online and reload to retry.'; }
}

export async function saveSpeechOffline(): Promise<void> { await workerRequest('CACHE_VOICE'); }

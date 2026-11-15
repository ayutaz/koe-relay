// Chrome's built-in AI types are deliberately local; no global DOM augmentation.
export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';
interface TranslatorInstance { translate(text: string): Promise<string> }
interface TranslatorAPI {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: { addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void }) => void;
  }): Promise<TranslatorInstance>;
}
const translators = new Map<string, TranslatorInstance>();
const pending = new Map<string, Promise<TranslatorInstance>>();
const api = () => typeof self === 'undefined' ? undefined : (self as typeof self & { Translator?: TranslatorAPI }).Translator;
const options = (target: string) => ({ sourceLanguage: 'ja', targetLanguage: target });
const prepareMessage = 'Prepare on-device AI first. The Chrome on-device translator is not ready.';

export async function translatorAvailability(target = 'en'): Promise<Availability> {
  if (translators.has(target)) return 'available';
  try { return await api()?.availability(options(target)) ?? 'unavailable'; }
  catch { return 'unavailable'; }
}

async function getTranslator(target: string, userGesture: boolean, onProgress: (fraction: number) => void): Promise<TranslatorInstance> {
  const existing = translators.get(target);
  if (existing) { onProgress(1); return existing; }
  const active = pending.get(target);
  if (active) { const translator = await active; onProgress(1); return translator; }
  const creation = (async () => {
    const availability = await translatorAvailability(target);
    if (availability === 'unavailable') throw new Error(`${prepareMessage} Japanese → ${target} is unavailable in this browser.`);
    if (availability !== 'available' && (!userGesture || navigator.userActivation?.isActive !== true)) throw new Error(prepareMessage);
    const translator = await api()!.create({
      ...options(target),
      monitor(monitor) { monitor.addEventListener('downloadprogress', event => onProgress(Math.max(0, Math.min(1, event.loaded)))); },
    });
    translators.set(target, translator);
    onProgress(1);
    return translator;
  })();
  pending.set(target, creation);
  try { return await creation; } finally { pending.delete(target); }
}

// Invoke from the Prepare button before awaiting other setup: activation is transient.
export async function prepareTranslator(target = 'en', onProgress: (fraction: number) => void = () => {}): Promise<void> {
  const userGesture = typeof navigator !== 'undefined' && navigator.userActivation?.isActive === true;
  await getTranslator(target, userGesture, onProgress);
}

export async function translateAll(texts: string[], target = 'en'): Promise<string[]> {
  // Generation has already awaited Nano; this path must never initiate a download.
  const translator = await getTranslator(target, false, () => {});
  const translated: string[] = [];
  for (const text of texts) {
    if (!text.trim()) { translated.push(''); continue; }
    const output = (await translator.translate(text)).trim();
    if (!output) throw new Error('The on-device translator returned empty text. Try again or use the cloud.');
    translated.push(output);
  }
  return translated;
}

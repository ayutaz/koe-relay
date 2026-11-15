import type { AudioResult, PiperPlus, ProgressInfo } from 'piper-plus';

// Both languages use this one multilingual voice. Pin the revision so model and config stay paired.
export const voiceModelUrl = 'https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan/resolve/619ad26fcbd5635b3d70a27eac919f4c2ce892b1/tsukuyomi-chan-6lang-fp16.onnx';
export type SpeechLanguage = 'ja' | 'en';
export type SpeechProgress = (message: string) => void;
let engine: Promise<PiperPlus> | undefined;
export let voiceLoadMilliseconds: number | null = null;

export function loadVoice(onProgress: SpeechProgress = () => {}): Promise<PiperPlus> {
  if (!engine) {
    const start = performance.now();
    engine = (async () => {
      const [{ PiperPlus }, ort] = await Promise.all([import('piper-plus'), import('onnxruntime-web/wasm')]);
      // One WASM thread works on static hosts without COOP/COEP headers (including GitHub Pages).
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = new URL(`${import.meta.env.BASE_URL}vendor/ort/`, document.baseURI).href;
      const tts = await PiperPlus.initialize({
        model: voiceModelUrl,
        ort,
        wasmG2pUrl: new URL(`${import.meta.env.BASE_URL}vendor/piper/piper_plus_wasm.js`, document.baseURI).href,
        onProgress: (info: ProgressInfo) => onProgress(`${info.message} (${Math.round(info.progress * 100)}% of ${info.stage})`),
      });
      voiceLoadMilliseconds = performance.now() - start;
      onProgress(`Voice ready in ${(voiceLoadMilliseconds / 1000).toFixed(1)} s. Shared Japanese / English model.`);
      return tts;
    })().catch(error => { engine = undefined; throw error; });
  }
  return engine;
}

export async function synthesizeSpeech(text: string, language: SpeechLanguage, onProgress: SpeechProgress = () => {}): Promise<AudioResult> {
  if (!text.trim()) throw new Error('There is no text to speak.');
  const tts = await loadVoice(onProgress);
  onProgress(`Making ${language === 'ja' ? 'Japanese' : 'English'} speech locally…`);
  return tts.synthesize(text, { language, lengthScale: 1.5, ssml: false });
}

export async function speak(text: string, language: SpeechLanguage, onProgress: SpeechProgress = () => {}): Promise<void> {
  const audio = await synthesizeSpeech(text, language, onProgress);
  onProgress('Playing local speech…');
  await audio.play();
  onProgress('Speech finished.');
}

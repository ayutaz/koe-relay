import type { Mode } from './settings';

// Chrome Prompt API language declarations, checked 2026-11-15. Support is device-dependent.
export const languages = {
  ja: { label: 'Easy Japanese', onDevice: true },
  en: { label: 'English', onDevice: true },
  zh: { label: 'Chinese', onDevice: false },
  es: { label: 'Spanish', onDevice: true },
  fr: { label: 'French', onDevice: true },
  pt: { label: 'Portuguese', onDevice: false },
} as const;
export type Language = keyof typeof languages;
export type ExtraLanguage = Exclude<Language, 'ja' | 'en'>;
export const extraLanguages: ExtraLanguage[] = ['zh', 'es', 'fr', 'pt'];

export function routeMode(mode: Mode, language?: ExtraLanguage, online = true): Mode {
  if (language && !languages[language].onDevice) {
    if (mode === 'ONLY_ON_DEVICE') throw new Error(`${languages[language].label} requires cloud inference. Choose a cloud-capable mode.`);
    if (!online) throw new Error(`${languages[language].label} requires an internet connection for cloud inference.`);
    return 'ONLY_IN_CLOUD';
  }
  if (!online) {
    if (mode === 'ONLY_IN_CLOUD') throw new Error('Cloud inference is unavailable offline. Choose an on-device mode.');
    return 'ONLY_ON_DEVICE';
  }
  return mode;
}

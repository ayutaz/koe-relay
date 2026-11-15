import { firebaseConfigured, getFirebaseApp } from './firebase';
import { languages } from './languages';
import type { Language } from './languages';
import { modes } from './settings';
import type { Mode } from './settings';

export const remoteDefaults = {
  default_inference_mode: 'PREFER_ON_DEVICE',
  enabled_languages: '["ja","en","zh","es","fr","pt"]',
};
export interface RemoteSettings { defaultMode: Mode; enabledLanguages: Language[] }

export function parseRemoteSettings(mode: string, encoded: string): RemoteSettings {
  let enabled: Language[] = Object.keys(languages) as Language[];
  try {
    const value: unknown = JSON.parse(encoded);
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      enabled = [...new Set(['ja', 'en', ...value.filter(item => Object.hasOwn(languages, item))])] as Language[];
    }
  } catch { /* Invalid remote values cannot break local defaults. */ }
  return { defaultMode: modes.includes(mode as Mode) ? mode as Mode : 'PREFER_ON_DEVICE', enabledLanguages: enabled };
}

export async function loadRemoteSettings(): Promise<RemoteSettings> {
  const fallback = parseRemoteSettings(remoteDefaults.default_inference_mode, remoteDefaults.enabled_languages);
  if (!firebaseConfigured) return fallback;
  try {
    const { getRemoteConfig, isSupported, fetchAndActivate, getString, ensureInitialized } = await import('firebase/remote-config');
    if (!await isSupported()) return fallback;
    const config = getRemoteConfig(getFirebaseApp());
    config.defaultConfig = remoteDefaults;
    config.settings.fetchTimeoutMillis = 4000;
    config.settings.minimumFetchIntervalMillis = 3_600_000;
    await ensureInitialized(config);
    try { await fetchAndActivate(config); } catch { /* Use previously activated values or defaults offline. */ }
    return parseRemoteSettings(getString(config, 'default_inference_mode'), getString(config, 'enabled_languages'));
  } catch { return fallback; }
}

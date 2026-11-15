import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';
import type { AI, GenerativeModel } from 'firebase/ai';
import type { Mode } from './settings';
import { noticeSchema } from './schema';

const envKeys = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY',
] as const;

export const missingFirebaseValues = envKeys.filter(key => !import.meta.env[key]?.trim());
export const firebaseConfigured = missingFirebaseValues.length === 0;
export const firebaseStatus = firebaseConfigured ? 'Firebase ready to connect' : 'Firebase not configured';

let ai: AI | undefined;
const models = new Map<Mode, GenerativeModel>();

// Deliberately lazy: loading the page never initializes App Check or calls Firebase.
export function getNoticeModel(mode: Mode): GenerativeModel {
  if (!firebaseConfigured) throw new Error('Firebase not configured');
  const existing = models.get(mode);
  if (existing) return existing;
  if (!ai) {
    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    });
    if (import.meta.env.DEV) {
      (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
    ai = getAI(app, { backend: new GoogleAIBackend() });
  }
  const model = getGenerativeModel(ai, {
    mode: InferenceMode[mode],
    inCloudParams: {
      model: 'gemini-3.5-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: noticeSchema,
      },
    },
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
        expectedOutputs: [{ type: 'text', languages: ['en', 'ja'] }],
      },
      promptOptions: { responseConstraint: noticeSchema },
    },
  });
  models.set(mode, model);
  return model;
}

export function initializeDeviceModel(mode: Mode, onProgress: (fraction: number) => void): Promise<void> {
  // Called directly from the UI's button event, never on page load.
  return getNoticeModel(mode).initializeDeviceModel(onProgress);
}

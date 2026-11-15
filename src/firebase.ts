import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';
import type { AI, GenerativeModel } from 'firebase/ai';
import type { Mode } from './settings';
import { makeNoticeSchema } from './schema';
import type { ExtraLanguage } from './languages';
import { languages } from './languages';

// Keep every access static. A dynamic import.meta.env[key] causes Vite to embed
// the entire VITE_* environment object, including unused development-only values.
const publicValues = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
};

export const missingFirebaseValues = Object.entries(publicValues).filter(([, value]) => !value?.trim()).map(([key]) => key);
export const firebaseConfigured = missingFirebaseValues.length === 0;
export const firebaseStatus = firebaseConfigured ? 'Firebase ready to connect' : 'Firebase not configured';

let ai: AI | undefined;
let app: FirebaseApp | undefined;
const models = new Map<string, GenerativeModel>();
export const cloudModel = 'gemini-3.8-flash';

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseConfigured) throw new Error('Firebase not configured');
  return app ??= initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  });
}

// AI and App Check wait for an AI action. Remote Config shares only the Firebase app.
export function getNoticeModel(mode: Mode, language?: ExtraLanguage): GenerativeModel {
  if (!firebaseConfigured) throw new Error('Firebase not configured');
  const cacheKey = `${mode}:${language ?? ''}`;
  const existing = models.get(cacheKey);
  if (existing) return existing;
  if (!ai) {
    const app = getFirebaseApp();
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
  const noticeSchema = makeNoticeSchema(language);
  const model = getGenerativeModel(ai, {
    mode: InferenceMode[mode],
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: noticeSchema,
      },
    },
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
        expectedOutputs: [{ type: 'text', languages: ['en', 'ja', ...(language && languages[language].onDevice ? [language] : [])] }],
      },
      promptOptions: { responseConstraint: noticeSchema },
    },
  });
  models.set(cacheKey, model);
  return model;
}

export function initializeDeviceModel(mode: Mode, onProgress: (fraction: number) => void, language?: ExtraLanguage): Promise<void> {
  // Called directly from the UI's button event, never on page load.
  return getNoticeModel(mode, language).initializeDeviceModel(onProgress);
}

import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ app: vi.fn(() => ({})), appCheck: vi.fn(), ai: vi.fn(() => ({})), model: vi.fn(() => ({ initializeDeviceModel: vi.fn().mockResolvedValue(undefined) })) }));
vi.mock('firebase/app', () => ({ initializeApp: mocks.app }));
vi.mock('firebase/app-check', () => ({ initializeAppCheck: mocks.appCheck, ReCaptchaEnterpriseProvider: class {} }));
vi.mock('firebase/ai', async original => ({ ...await original<typeof import('firebase/ai')>(), getAI: mocks.ai, getGenerativeModel: mocks.model }));

const keys = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'];
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.resetModules(); });

it('loads without configuration and never initializes a Firebase service', async () => {
  for (const key of keys) vi.stubEnv(key, '');
  const firebase = await import('./firebase');
  expect(firebase.firebaseStatus).toBe('Firebase not configured');
  expect(() => firebase.getNoticeModel('PREFER_ON_DEVICE')).toThrow('Firebase not configured');
  expect(mocks.app).not.toHaveBeenCalled();
  expect(mocks.appCheck).not.toHaveBeenCalled();
  expect(mocks.ai).not.toHaveBeenCalled();
});

it('configures both inference paths lazily and passes through download progress', async () => {
  for (const key of keys) vi.stubEnv(key, 'test-placeholder');
  vi.stubGlobal('self', {});
  const firebase = await import('./firebase');
  expect(mocks.app).not.toHaveBeenCalled();
  const model = firebase.getNoticeModel('PREFER_ON_DEVICE');
  const config = mocks.model.mock.calls[0] as unknown[];
  expect(config[1]).toMatchObject({ mode: 'prefer_on_device', inCloudParams: { generationConfig: { responseMimeType: 'application/json' } }, onDeviceParams: { createOptions: { expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }], expectedOutputs: [{ type: 'text', languages: ['en', 'ja'] }] } } });
  expect((config[1] as { inCloudParams: { generationConfig: { responseSchema: unknown } } }).inCloudParams.generationConfig.responseSchema).toBeDefined();
  expect((config[1] as { inCloudParams: { model: string } }).inCloudParams.model).toBe('gemini-3.8-flash');
  expect(self).toHaveProperty('FIREBASE_APPCHECK_DEBUG_TOKEN', true);
  const onProgress = vi.fn();
  await firebase.initializeDeviceModel('PREFER_ON_DEVICE', onProgress);
  expect(model.initializeDeviceModel).toHaveBeenCalledWith(onProgress);
  expect(mocks.model).toHaveBeenCalledTimes(1);
  firebase.getNoticeModel('ONLY_ON_DEVICE');
  expect(mocks.model).toHaveBeenCalledTimes(2);
  expect(mocks.appCheck).toHaveBeenCalledTimes(1);
});

it('keeps language-specific device declarations and structured schemas separate', async () => {
  for (const key of keys) vi.stubEnv(key, 'test-placeholder');
  vi.stubGlobal('self', {});
  const firebase = await import('./firebase');
  firebase.getNoticeModel('PREFER_ON_DEVICE', 'es');
  firebase.getNoticeModel('PREFER_ON_DEVICE', 'fr');
  firebase.getNoticeModel('PREFER_ON_DEVICE', 'es');
  expect(mocks.model).toHaveBeenCalledTimes(2);
  const config = (mocks.model.mock.calls[0] as unknown[])[1];
  expect(config).toMatchObject({ onDeviceParams: { createOptions: { expectedOutputs: [{ type: 'text', languages: ['en', 'ja', 'es'] }] } } });
  expect(JSON.stringify(config)).toContain('translation');
});

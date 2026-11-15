// Report names only, never configuration values.
const keys = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'];
const missing = keys.filter(key => !process.env[key]?.trim());
if (missing.length) throw new Error(`Missing GitHub repository variables: ${missing.join(', ')}`);
if (process.env.VITE_APPCHECK_DEBUG_TOKEN) throw new Error('Debug tokens must not be supplied to hosted builds.');
console.log('All seven public hosted configuration variables are present.');

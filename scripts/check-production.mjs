import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Check emitted code, without reading any environment file or printing bundle content.
for (const entry of await readdir('dist', { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !/\.(js|html)$/.test(entry.name)) continue;
  const text = await readFile(resolve(entry.parentPath, entry.name), 'utf8');
  // The SDK itself reads this global even in production. Reject app assignments,
  // build-time env references and the synthetic test token, not SDK read access.
  if (/FIREBASE_APPCHECK_DEBUG_TOKEN\s*=(?!=)|VITE_APPCHECK_DEBUG_TOKEN|PHASE 0 · LOCAL PROTOTYPE|SYNTHETIC_PRIVATE_DEBUG_TOKEN/.test(text)) {
    throw new Error('A development-only marker was found in the production bundle.');
  }
}
const html = await readFile('dist/index.html', 'utf8');
if (!html.includes('/koe-relay/assets/')) throw new Error('Incorrect GitHub Pages asset base.');
const worker = await readFile('dist/sw.js', 'utf8');
if (/__SHELL_FILES__|__VOICE_URLS__|__BUILD_VERSION__/.test(worker)) throw new Error('Incomplete offline worker build.');
console.log('Production output excludes debug setup and uses the /koe-relay/ asset base.');

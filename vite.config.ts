import { defineConfig } from 'vite';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { voiceModelUrl, voiceConfigUrl } from './src/voice-assets.ts';

export default defineConfig({
  base: '/koe-relay/',
  // Test builds never read the real environment files or initialize live Firebase.
  envDir: process.env.KOE_RELAY_TEST === '1' ? '.cache/empty-env' : '.',
  plugins: [{
    name: 'koe-relay-offline',
    apply: 'build',
    async closeBundle() {
      const directory = resolve('dist');
      const entries = await readdir(directory, { recursive: true, withFileTypes: true });
      const files = entries.filter(entry => entry.isFile() && entry.name !== 'sw.js')
        .map(entry => relative(directory, resolve(entry.parentPath, entry.name)).replaceAll('\\', '/')).sort();
      const digest = createHash('sha256');
      for (const file of files) { digest.update(file); digest.update(await readFile(resolve(directory, file))); }
      const template = await readFile('scripts/sw-template.js', 'utf8');
      digest.update(template);
      digest.update(JSON.stringify([voiceModelUrl, voiceConfigUrl]));
      const worker = template.replace('__SHELL_FILES__', JSON.stringify(files))
        .replace('__VOICE_URLS__', JSON.stringify([voiceModelUrl, voiceConfigUrl]))
        .replace('__BUILD_VERSION__', digest.digest('hex').slice(0, 16));
      await writeFile(resolve(directory, 'sw.js'), worker);
    },
  }],
});

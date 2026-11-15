import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Copy runtime-loaded files explicitly: Vite cannot discover a variable import in piper-plus.
const files = [
  ['piper-plus/dist/rust-wasm/piper_plus_wasm.js', 'piper/piper_plus_wasm.js'],
  ['piper-plus/dist/rust-wasm/piper_plus_wasm_bg.wasm', 'piper/piper_plus_wasm_bg.wasm'],
  ['piper-plus/LICENSE.md', 'piper/LICENSE.md'],
  ['piper-plus/THIRD-PARTY-LICENSES.md', 'piper/THIRD-PARTY-LICENSES.md'],
  ['@piper-plus/g2p/LICENSE.md', 'g2p/LICENSE.md'],
  ['@piper-plus/g2p/THIRD_PARTY_LICENSES.md', 'g2p/THIRD_PARTY_LICENSES.md'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'ort/ort-wasm-simd-threaded.mjs'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'ort/ort-wasm-simd-threaded.wasm'],
];
for (const [source, target] of files) {
  const destination = resolve('public/vendor', target);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await copyFile(resolve('node_modules', source), destination);
}
console.log('Prepared local piper-plus and ONNX Runtime assets.');

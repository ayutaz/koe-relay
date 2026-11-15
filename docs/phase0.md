# Phase 0 — feasibility and implementation record

Date: **2026-11-15 (Asia/Tokyo)**. Scope: local prototype, no Firebase project,
no live Firebase/App Check/AI requests, no deployment, and no push.

## Result

The TypeScript production build passes. The app opens without any `.env` file,
shows **Firebase not configured**, and disables AI actions. Fictional samples,
mode settings, and real Japanese/English speech remain usable. The AI code imports
and calls Firebase AI Logic, but its service initialization is lazy and gated by
configuration. Unit tests replace Firebase entry points with mocks.

`npm view firebase version` returned **13.3.0**, above the required 12.5.0 minimum.
`npm view piper-plus version` returned **0.9.1**. Both are installed exactly and
locked in `package-lock.json`, with ONNX Runtime Web **1.31.1**, Vite **8.3.8**, and
TypeScript **7.0.2**. Node used for verification: **24.15.0**; npm **11.4.2**.

## Chrome Prompt API languages and Japanese

Read on 2026-11-15:

- [Chrome: The Prompt API](https://developer.chrome.com/docs/ai/prompt-api),
  page last updated 2026-10-21. Its language section lists `en` (English), `ja`
  (Japanese), `es` (Spanish), `de` (German), and `fr` (French) for the `languages`
  arrays in `expectedInputs` and `expectedOutputs`. Input declarations should
  cover the instruction and notice languages; output declarations should cover
  generated languages. Unsupported combinations can throw `NotSupportedError`.
  Availability checks must use matching options.
- [Chrome: Built-in AI](https://developer.chrome.com/docs/ai/built-in),
  read 2026-11-15, distinguishes the browser's foundation-model Prompt API from
  dedicated rewriting and translation APIs, and links the Firebase hybrid approach.

**Japanese is documented as supported on-device.** That establishes API support,
not the accuracy of this app's bilingual output on any particular device. The app
sets `expectedInputs: [{type: 'text', languages: ['en', 'ja']}]` and the same pair
for `expectedOutputs`, through Firebase's `onDeviceParams.createOptions`.
Actual Japanese Gemini Nano inference has **not been run** in Phase 0.

Chrome's current Prompt API page lists web availability at Chrome 148 and extension
availability at 138; this differs from the brief's older Chrome 139/flag guidance.
The page also requires compatible desktop hardware and substantial free disk space.
Use an eligible current Chrome with the Prompt API exposed; verify the installed
build and current Firebase requirements rather than treating version 139 alone as
a guarantee. Do not auto-change user browser flags. [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api)

## Hybrid and structured-output design

Read on 2026-11-15:

- [Firebase: Hybrid web configuration](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options)
  documents all four modes and `inferenceSource`. `PREFER_ON_DEVICE` prefers the
  device and can fall back to cloud; `ONLY_ON_DEVICE` fails if unavailable.
  `PREFER_IN_CLOUD` can fall back to device; `ONLY_IN_CLOUD` does not. The documented
  SDK 13 cloud default is `gemini-3.5-flash-lite`, used explicitly here.
- [Firebase: Hybrid structured output](https://firebase.google.com/docs/ai-logic/hybrid/web/generate-structured-output)
  requires cloud `generationConfig.responseMimeType: 'application/json'` and
  `responseSchema`, plus on-device `promptOptions.responseConstraint`. Both paths
  use the same Firebase `Schema.object` here.
- [Firebase: Hybrid web setup](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started)
  is the setup reference for later real-device verification.

The model produces required fields `summary`, `actions` (string array), `place`,
`time`, `easyJapanese`, and `english`. Prompts preserve uncertainty and source facts,
mark absent facts as “Not stated”, and separate untrusted source text from the task.
The app validates parsed JSON at runtime and writes generated text via `textContent`.
Schema conformity and these instructions do not establish factual accuracy.

The installed SDK's **symbolic constants** `InferenceSource.ON_DEVICE` and
`InferenceSource.IN_CLOUD` have raw values `on_device` / `in_cloud`, rather than the
uppercase display labels used in the guide. Code compares the exported constants
and maps to uppercase UI badges. Counters are in-memory, reset on reload, and count
SDK responses even when output validation fails. Errors before a response do not
count. Unreported sources use an Unknown counter; selected modes never determine
the badge. Preparing Nano alone also never increments counters.

Fallback policy: try Japanese + English on-device in the default mode. If a device
cannot support those languages or the model is unavailable, a cloud-capable mode
may use cloud inference, with the actual source displayed. `ONLY_ON_DEVICE` must
surface the error without a cloud retry. If device testing contradicts documented
Japanese support, use cloud for Japanese processing while online. An English-only
on-device rewrite could be added for English source text; it cannot safely process
a Japanese notice by merely changing its language declaration. Any future local
translation stage needs separate support/quality tests. Do not show fabricated
translations as an offline fallback. When offline and unavailable, retain the
original notice and show a clear error. Chinese/Portuguese are not listed Prompt
API languages here; future support needs a cloud or separately verified local path.

## App Check and future GitHub Pages hosting

`src/firebase.ts` initializes the app from all six Firebase environment values,
sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` only in development, initializes
`ReCaptchaEnterpriseProvider` with the seventh environment value, then obtains AI
with `getAI(app, { backend: new GoogleAIBackend() })`. All of this waits for an AI
button action. Missing/blank values cause no service initialization.

The AI preparation button calls `model.initializeDeviceModel(callback)` directly
from a user interaction and updates a native progress element. Model instances are
cached by mode so preparing and generating in the same mode share an instance.

[Firebase's Enterprise guide](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
and [debug-provider guide](https://firebase.google.com/docs/app-check/web/debug-provider),
read 2026-11-15, require the registered site/app setup and describe the development
debug flag. Keep generated debug tokens private. Do not add localhost to a
production reCAPTCHA key's domains. Later GitHub Pages builds must register the
actual host domain and use production attestation. Relative Vite asset URLs and
one-thread ONNX WASM avoid requiring cross-origin isolation headers for speech.
Actual hosted App Check enforcement has not been verified.

## piper-plus API inspection and browser evidence

Read the installed `node_modules/piper-plus/README.npm.md`, `types/index.d.ts`,
`src/index.js`, `src/model-manager.js`, and `src/phonemizer/rust-wasm-adapter.js`.
The npm package has `README.npm.md`, not `README.md`. The implementation uses its
documented APIs:

```ts
const tts = await PiperPlus.initialize({ model: voiceModelUrl, ort, wasmG2pUrl, onProgress });
const audio = await tts.synthesize(text, { language: 'ja', lengthScale: 1.5, ssml: false });
await audio.play();
```

English uses `language: 'en'` on the **same instance and voice weights**, so a
second voice-model download is unnecessary. The pinned model is the root FP16
Tsukuyomi-chan multilingual model at revision
`619ad26fcbd5635b3d70a27eac919f4c2ce892b1`:
[model card and terms](https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan).
The model's `config.json` is the sibling fallback for this direct model URL.
`scripts/prepare-assets.mjs` copies the installed phonemizer and ONNX runtime files
into local static assets; no runtime files are loaded from unversioned JS CDNs.

Measurements on 2026-11-15: production preview on local Windows Chrome, fresh
isolated browser contexts. MB below is decimal (1,000,000 bytes). The voice payload
size and time are from a separate full Node `fetch` download and `arrayBuffer()`
byte count, including redirects. Local WASM payload sizes were also checked against
installed files; request times below come from the first browser run.

| Asset | Used for | Bytes | MB | Request time |
| --- | --- | ---: | ---: | ---: |
| Shared FP16 ONNX voice | Japanese and English | 39,652,717 | 39.65 | 2.246 s (Node download) |
| piper phonemizer WASM, including Japanese dictionary | Japanese | 60,130,163 | 60.13 | 0.553 s (local server) |
| ONNX Runtime WASM | Both languages | 14,848,852 | 14.85 | 0.527 s (local server) |

Full first initialization (JS imports, config/voice download, ONNX session creation,
and phonemizer setup): **9.778 s**. In that browser run, the voice request took
3.533 s and Playwright reported 39,675,394 network bytes; network accounting is
distinct from the exact file payload. The separate downloaded payload has SHA-256
`5289e9b6eaf21080803b7fe1c4dc85b5491d4c216121207a41df18dd5f68e5d7`.
The WASM times measure local preview delivery,
not public hosting/CDN throughput. The table excludes JS, config, and dictionary
chunks. The emitted English CMU dictionary chunk is **6,209,952 bytes**; startup
plus speech assets are roughly **121 MB uncompressed**. Compression/cache/network
conditions can substantially change transfer bytes and time. Build output is
roughly **100.07 MB** on disk, excluding the separately fetched 39.65 MB voice.
It currently contains both Vite's emitted ORT WASM and the explicitly copied ORT
WASM; only the configured copied one is requested. Deduplicating that distribution
asset is a later size optimization.

`npm run build` succeeds with Vite warnings about large dictionary chunks and an
upstream variable `../../assets/` URL in the optional Chinese phonemizer dictionary
loader. Japanese and English passed despite that optional path; Chinese is not
claimed or exposed by this prototype. The library uses WASM CPU inference for
this VITS model's int64 inputs. This is not WebGPU evidence.

**Caching limit:** although the README describes IndexedDB model caching,
`PiperPlus.initialize()` in 0.9.1 creates its ONNX session directly from the URL.
The separate `ModelManager.loadModel()` path provides IndexedDB caching. This app
uses the initialization API and holds one engine in memory; it does not yet add
durable caching. Ordinary browser HTTP cache is not an offline guarantee. A later
phase must cache app shell, model/config, JS dictionaries, and all WASM files,
then verify both same-page offline use and offline reload. Gemini Nano downloads
are separately managed by Chrome. No service worker or Remote Config is implemented.

## Verification and remaining gates

- Production build: passed (`tsc --noEmit` plus Vite).
- Unit tests: 15 passed, using mocks for all Firebase initialization/generation.
  Covers missing env, lazy initialization, structured settings, progress forwarding,
  SDK source mapping/counters, input limits, malformed output, and request failures.
- Production browser: missing-env mode, samples, mode persistence, responsive
  layout, zero external startup requests, and recoverable speech download error.
- Real browser: piper-plus initialization and Japanese/English playback completed;
  no uncaught page errors. The final complete suite passed **4 browser tests**
  in 25.1 s, including the opt-in real speech test. The final speech run used
  Chrome **157.0.8103.51** and initialized in **7.804 s**. Instrumenting the real
  Web Audio playback buffers found finite samples with nonzero amplitude:
  Japanese 106,240 frames / 4.818 s, peak 0.456; English 67,328 frames / 3.053 s,
  peak 0.382 (both 22,050 Hz). Automated playback and signal checks are not a
  human listening review or proof of semantic/pronunciation quality.
- Mocked browser: result rendering/source labels, counters, stale-result clearing,
  malformed output recovery, and safe rendering of HTML-like model text. Synthetic
  SDK results are test-only and are never shown as real inference evidence.
- `npm audit` reports four high entries propagated from the Node-side Firestore
  gRPC dependency (`@grpc/grpc-js`). Firestore is not imported by this app. No forced
  Firebase downgrade was applied, because it would violate the required hybrid SDK
  minimum; evaluate an upstream-compatible dependency fix before publication.

Still unverified: actual Gemini Nano Japanese generation/quality, actual cloud
generation, real `inferenceSource` behavior/failover, App Check enforcement,
Japanese/English listening quality, offline reload, hosted Pages paths, and
public release readiness. Phase 0 does not establish that this can safely replace
an official notice.

Local artifacts are ignored under `.artifacts/`: desktop/mobile screenshots and
`tts-browser.json` and `voice-download.json`. They record the exact browser version,
network measurements, voice payload/hash, and the latest real speech run.
Reproduce browser checks with `RUN_TTS=1 npm run test:browser`
(PowerShell environment assignment is shown in the README).

## Local commit restriction

The session can write source files but `.git` is explicitly read-only. `git add`
and `git commit` failed to create `.git/index.lock` with “Permission denied”. No
commits were created and nothing was pushed. See [suggested local commits](local-commits.md)
for small, explicit file groups to commit from a writable Git session. This is a
filesystem permission boundary, not a failed code/build check.

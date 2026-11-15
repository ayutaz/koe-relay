# Koe Relay

Koe Relay helps people who find Japanese public notices difficult to read: paste a notice to get its key facts, actions, easy Japanese and plain English, then listen to either version in your browser. Firebase AI Logic hybrid inference offers on-device Gemini Nano or cloud Gemini rewriting, while local speech and cached assets support use with limited connectivity. Optional translations extend text access to four more languages. Always check AI output against the original notice.

**[Try Koe Relay](https://ayutaz.github.io/koe-relay/)** · [Public source](https://github.com/ayutaz/koe-relay) · [Final QA results and verification limits](docs/final-qa.md)

## How it uses Firebase AI Logic hybrid inference

Firebase AI Logic is part of the interactive rewrite path, not just a dependency:

- [`src/firebase.ts:4`](https://github.com/ayutaz/koe-relay/blob/main/src/firebase.ts#L4) imports `getAI`, `GoogleAIBackend`, `getGenerativeModel` and `InferenceMode` from `firebase/ai`.
- [`src/firebase.ts:64`](https://github.com/ayutaz/koe-relay/blob/main/src/firebase.ts#L64) initializes App Check with `ReCaptchaEnterpriseProvider`, then `getAI(app, { backend: new GoogleAIBackend() })`.
- [`src/firebase.ts:71`](https://github.com/ayutaz/koe-relay/blob/main/src/firebase.ts#L71) creates the model with `mode: InferenceMode[mode]`, cloud JSON schema settings and on-device Japanese/English language declarations. [`src/firebase.ts:92`](https://github.com/ayutaz/koe-relay/blob/main/src/firebase.ts#L92) prepares Nano through the SDK's `initializeDeviceModel` when the user clicks the preparation button.
- **Rewrite notice** calls `rewriteNotice`, then [`src/rewrite.ts:85`](https://github.com/ayutaz/koe-relay/blob/main/src/rewrite.ts#L85) actually invokes `model.generateContent(prompt, { signal })`. [`src/rewrite.ts:89`](https://github.com/ayutaz/koe-relay/blob/main/src/rewrite.ts#L89) reads `result.response.inferenceSource` and updates the source counter before parsing and validating the returned JSON.

Gemini Nano handles supported on-device requests through Firebase AI Logic's Chrome Prompt API integration. The cloud default is **`gemini-3.5-flash-lite`**, defined in [`src/settings.ts`](src/settings.ts); Remote Config's `cloud_model` can override it. Cloud requests use Firebase AI Logic and the Gemini Developer API. The project owner reports Spark with no billing; this QA did not inspect the billing console. Free-tier quotas can temporarily prevent requests. See [Firebase's hybrid configuration documentation](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options).

| Mode | Behavior |
| --- | --- |
| `PREFER_ON_DEVICE` | Prefer Nano; cloud is permitted when needed. |
| `ONLY_ON_DEVICE` | Keep rewriting on the device; fail if unavailable. |
| `PREFER_IN_CLOUD` | Prefer cloud; allow a supported device fallback. |
| `ONLY_IN_CLOUD` | Use cloud; fail without connectivity. |

Japanese and English are always included. Chinese and Portuguese **require cloud**; either PREFER mode routes those requests to `ONLY_IN_CLOUD`. Spanish and French can also be attempted on compatible devices using language-specific Prompt API declarations. All four extra languages are text output only. Preparing a device model is separate from generating a response.

The displayed badge comes from **`result.response.inferenceSource`**, never the selected mode. `ON_DEVICE`, `IN_CLOUD` and Unknown counters count SDK responses, including responses rejected by validation. Failed requests before a response do not count. Counters reset on reload.

The prompt asks for kanji with readings only when certain, and preservation of original numbers, dates, times and place names. Runtime checks reject a few known Japanese typos and number/time changes; missing recognizable place names produce a visible review warning. These checks are partial safeguards, not proof of correct readings or factual accuracy. Always compare the rewrite with the original notice.

## Try it — English testing instructions for judges

1. Open **https://ayutaz.github.io/koe-relay/**. The cloud path works in modern browsers with JavaScript and internet access; Gemini Nano is not required for cloud testing. No application account, payment or personal API key is required. Chrome is used for the automated browser checks; other browsers have not been individually verified.
2. Choose **Train suspension sample** or **Shelter opening sample**. Both are fictional.
3. Select `ONLY_IN_CLOUD` and **Rewrite notice**. Confirm an actual `IN_CLOUD` badge and counter, then review numbers, times, places, restrictions and uncertainty against the source.
4. Try an additional output language. Chinese and Portuguese explicitly require cloud. Speech buttons remain Japanese and English only.
5. Select **Load speech model**, then test both voices. Allow roughly 140 MB of uncompressed offline assets. Read the voice usage terms displayed in the app.
6. Wait for **App and Japanese / English speech saved for offline use**. Disconnect the network and reload. Confirm **Offline**, try both voice tests again, and select samples. Browsers can evict stored assets; a readiness message is not a permanent storage guarantee.
7. For on-device rewriting, use **desktop Chrome 148+ with Gemini Nano available**. Select **Japanese + English only**, choose `ONLY_ON_DEVICE`, and click **Prepare on-device AI** while online. Wait for preparation, then rewrite and verify actual `ON_DEVICE` output. Prepare again after selecting Spanish or French before testing those combinations. Chrome version alone does not ensure support: hardware, storage, supported languages and browser policy also matter. See the [Chrome Prompt API requirements](https://developer.chrome.com/docs/ai/prompt-api).
8. With Nano prepared, disconnect and try an on-device rewrite. If Nano is unavailable, the app shows an error and retains the original notice. It does not fabricate an offline translation.

Cloud-capable modes may send notices to Google. Use fictional or non-sensitive notices for judging. Production attestation uses reCAPTCHA Enterprise on `ayutaz.github.io`; judges do not need a debug token. A blocked request can reflect attestation, connectivity or free-tier quota; check the displayed error and try later if quota-limited.

To check Nano support, open Chrome DevTools on the hosted page and run the following diagnostic, using the same Japanese/English declarations as the app:

```js
typeof LanguageModel === 'undefined'
  ? 'Prompt API unavailable in this browser'
  : await LanguageModel.availability({
      expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
      expectedOutputs: [{ type: 'text', languages: ['en', 'ja'] }],
    });
```

`available` means ready; `downloadable` or `downloading` means preparation/download is still needed; `unavailable` means this configuration cannot run on this device. This diagnostic checks availability; the app itself performs inference through Firebase AI Logic. If unavailable, return to `ONLY_IN_CLOUD` while online.

The demo has no app-level sign-in, paywall or judge allowlist. The submission requires free, unrestricted judge access until judging ends; future uptime, quota capacity and App Check acceptance throughout that period still require monitoring by the project owner. Current verification and any access failures are recorded in [final QA](docs/final-qa.md).

## Built during the submission period

Koe Relay was created from scratch on **2026-11-15**, within the **2026-11-11–2026-11-30** submission period (dates supplied by the author). Work for this submission includes the notice workflow and English UI; Firebase AI Logic hybrid mode selection, Nano preparation, runtime inference-source badges/counters, structured prompts and validation; optional text translations; Remote Config integration; browser speech integration; offline caching and status; GitHub Pages workflow; and tests/documentation. The app did not train a new voice model or create a new speech engine.

## Pre-existing work used

- **[piper-plus npm package](https://www.npmjs.com/package/piper-plus) `0.9.1`**, an existing open-source project by this app's author, provides the browser speech engine under **MIT**. Its implementation predates this submission and is incorporated as a dependency; the notice app and its speech integration were built during the period.
- **[Piper Plus:つくよみちゃん voice model](https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan)** is an existing model, not trained during this submission. The app downloads revision `619ad26fcbd5635b3d70a27eac919f4c2ce892b1` of the root FP16 multilingual weights and matching configuration. The legacy base is CC BY 4.0, with separate Tsukuyomi-chan corpus/model and generated-audio terms; see credits below. These assets are downloaded on demand rather than committed here.
- Firebase JS SDK, ONNX Runtime, language dictionaries and the build/test tools are existing third-party dependencies. Their use is not claimed as newly built work.

## Local setup

Requires Node.js 24+, npm and Google Chrome for browser tests.

```sh
npm ci
npm run dev
```

Open the printed URL with the `/koe-relay/` path. Without configuration, the app shows **Firebase not configured** and disables rewriting; samples and speech remain usable.

Use `.env.example` as a template. Set the six `VITE_FIREBASE_*` public web configuration fields and `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` in an ignored local environment file. Enable Firebase AI Logic with the Gemini Developer API and App Check with reCAPTCHA Enterprise. Restart Vite after configuration changes. Client web config and the site key are public; never use service-account credentials or a server secret.

For local development, privately register an App Check debug token and set `VITE_APPCHECK_DEBUG_TOKEN` only in ignored `.env.development.local`. It is used only under `import.meta.env.DEV`. Never print, commit or share this file or token. Do not allow localhost on the production reCAPTCHA key. Production builds omit the app's debug-token assignment.

Remote Config fetches `default_inference_mode` and `enabled_languages` on startup with safe defaults and previously activated settings when available. A saved user mode wins. Parameter formats and REST template examples are in [Phase 1](docs/phase1.md#remote-config).

## Tech stack

TypeScript, Vite and standard HTML/CSS; Firebase JS SDK `13.3.0` (AI Logic, App Check and Remote Config); Chrome Prompt API / Gemini Nano and cloud Gemini; piper-plus `0.9.1` with ONNX Runtime Web `1.31.1` for local speech; Service Worker and Cache Storage for offline assets; Vitest and Playwright; GitHub Actions and GitHub Pages. Versions are pinned in `package-lock.json`.

## Offline behavior

The production Service Worker precaches the app shell, all bundled JavaScript/dictionaries, piper-plus phonemizer and ONNX runtime. Loading the voice or choosing **Save speech for offline use** caches the revision-pinned voice and config. Japanese and English share the same weights. The worker handles piper-plus's companion-config probe using the pinned sibling config.

The UI shows cache readiness separately from Online/Offline. `navigator.onLine` is a browser connectivity hint; it cannot guarantee internet access. When offline, supported PREFER requests use `ONLY_ON_DEVICE`, and cloud-only requests are disabled. Nano downloads are managed separately by Chrome. Notices and inference responses are not stored by the Service Worker. Clearing site data or browser storage eviction removes offline capability. Development mode intentionally does not register the worker; use a production preview to test offline operation.

## Build and test

```sh
npm test
npm run build
node scripts/check-production.mjs
npm run preview
```

Preview: `http://127.0.0.1:4173/koe-relay/`. Browser tests require a configuration-free build, isolated from real environment files:

```powershell
$env:KOE_RELAY_TEST = '1'
npm run build
npm run test:browser
# Optional real voice download and online/offline playback; no Firebase inference:
$env:RUN_TTS = '1'
npm run test:browser
Remove-Item Env:RUN_TTS, Env:KOE_RELAY_TEST -ErrorAction SilentlyContinue
```

The default suite verifies safe UI rendering, mocked inference/source counters, language routing, Remote Config UI behavior, failure recovery, and offline shell/runtime delivery with synthetic model bytes. The opt-in test downloads the actual voice, synthesizes both languages, disables HTTP cache, disconnects, reloads and synthesizes both again. Audio buffers must be finite and non-silent. This is automated synthesis evidence, not human pronunciation review or real Nano/cloud accuracy evidence.

`npm run build` type-checks TypeScript. `predev` / `prebuild` copy pinned installed WASM assets to ignored `public/vendor/`. Build output and artifacts stay ignored. Upstream dictionary-chunk and optional Chinese-loader URL warnings currently remain. See [Phase 0](docs/phase0.md) for original dependency and speech measurements, and Phase 1 for updated limits.

## GitHub Pages setup

The workflow builds/tests on push to `main` and deploys only `dist/` using the Pages artifact/deploy actions. The Vite base and worker scope support `/koe-relay/`.

Set Pages' publishing source to **GitHub Actions** on the intended `ayutaz/koe-relay` repository and provide these repository **variables**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`

The workflow deliberately does not read a debug-token variable. Hosted builds fail if public configuration is missing. The hosted index and main assets were checked during final QA; local QA changes are not deployed until a later authorized push. No push or deployment was performed during final QA.

## About and license

Koe Relay is an open-source #BuildHybridAI 2026 submission by [ayutaz](https://github.com/ayutaz). Application source is licensed under **[Apache License 2.0](LICENSE)**. The public repository includes source, fictional samples, the asset preparation scripts, pinned dependencies and run/test instructions. Voice weights are retrieved from the pinned public URL described above; browser-managed Gemini Nano is downloaded by Chrome. The application license does not replace any third-party or voice terms. GitHub detects Apache-2.0 from `LICENSE`; the repository's About description should also mention it before final submission.

## Credits

Application code: [Apache-2.0](LICENSE). Third-party software, voice weights and generated voice have separate terms:

- [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk): Apache-2.0.
- [piper-plus](https://github.com/ayutaz/piper-plus) `0.9.1`, [@piper-plus/g2p](https://github.com/ayutaz/piper-plus/tree/dev/src/wasm/g2p), and [ONNX Runtime](https://github.com/microsoft/onnxruntime): MIT. Bundled dictionaries carry their own notices, copied into the built vendor directory.
- **Piper Plus:つくよみちゃん** — [Tsukuyomi-chan model and terms](https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan), revision `619ad26fcbd5635b3d70a27eac919f4c2ce892b1`, root FP16 multilingual model. Its legacy base is CC BY 4.0; the voice also follows the [Tsukuyomi-chan corpus terms](https://tyc.rei-yumesaki.net/material/corpus/#terms3). It is not covered by the application's Apache license.
- Voice data: Tsukuyomi-chan corpus, voice: Rei Yumesaki (© Rei Yumesaki). This is an unofficial work. Rei Yumesaki does not develop or support this app/model. Direct inquiries to the [Piper Plus developer](https://github.com/ayutaz/piper-plus/issues).

As shown in the app: credit **Piper Plus:つくよみちゃん** when sharing audio, including video descriptions. Generated audio must not attack people, advocate for or against political, religious or ideological positions, publish intense content without appropriate audience separation, or be offered for reuse as raw material. Corpus-derived components retain corpus terms when modified or redistributed. Read the linked official terms before sharing audio.

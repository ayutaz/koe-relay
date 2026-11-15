# Koe Relay

Koe Relay helps people who find Japanese public notices difficult to read: paste a notice to get its key facts, actions, easy Japanese and plain English, then listen to either version in your browser. Firebase AI Logic hybrid inference offers on-device Gemini Nano simplification followed by Chrome Translator API translation, or cloud Gemini rewriting. Local speech and cached assets support use with limited connectivity. Optional translations extend text access to four more languages. Always check AI output against the original notice.

**[Try Koe Relay](https://ayutaz.github.io/koe-relay/)** · [Public source](https://github.com/ayutaz/koe-relay) · [Final QA results and verification limits](docs/final-qa.md)

## How it uses Firebase AI Logic hybrid inference

Firebase AI Logic is part of the interactive rewrite path, not just a dependency:

- [`src/firebase.ts`](src/firebase.ts) imports `getAI`, `GoogleAIBackend`, `getGenerativeModel` and `InferenceMode` from `firebase/ai`, initializes App Check with `ReCaptchaEnterpriseProvider`, then calls `getAI(app, { backend: new GoogleAIBackend() })`.
- It creates the model with `mode: InferenceMode[mode]`, cloud JSON schema settings and on-device language declarations plus JSON `responseConstraint`. The preparation button starts the SDK's `initializeDeviceModel` and Chrome's Japanese → English translator download together, with combined progress. It also prepares a supported selected Spanish/French translator.
- **Rewrite notice** calls [`rewriteNotice`](src/rewrite.ts), which invokes `model.generateContent(prompt, { signal })`, reads `result.response.inferenceSource` and updates the source counter before parsing and validating the returned JSON.

Gemini Nano handles supported on-device requests through Firebase AI Logic's Chrome Prompt API integration. The cloud default is **`gemini-3.5-flash-lite`**, defined in [`src/settings.ts`](src/settings.ts); Remote Config's `cloud_model` can override it. Cloud requests use Firebase AI Logic and the Gemini Developer API. The project owner reports Spark with no billing; this QA did not inspect the billing console. Free-tier quotas can temporarily prevent requests. See [Firebase's hybrid configuration documentation](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options).

| Mode | Behavior |
| --- | --- |
| `PREFER_ON_DEVICE` | Use Nano plus Chrome Translator when both report `available`; otherwise use the cloud prompt in `ONLY_IN_CLOUD` while online, with a visible reason. A rejected device response triggers one cloud rerun while online. Offline, retry device validation up to twice. |
| `ONLY_ON_DEVICE` | Keep rewriting on the device; retry validation up to twice, then fail. Show “Prepare on-device AI first” if the model or translator is not ready. |
| `PREFER_IN_CLOUD` | Prefer cloud; allow a supported device fallback. |
| `ONLY_IN_CLOUD` | Use cloud; fail without connectivity. |

Japanese and English are always included. Chinese and Portuguese **require cloud**; either PREFER mode routes those requests to `ONLY_IN_CLOUD`. Spanish and French can also be attempted on compatible devices using language-specific Prompt API declarations and a prepared Japanese → target Chrome translator; otherwise cloud-capable modes route them to cloud. All four extra languages are text output only. Preparation is separate from generating a response. Translator downloads require a user gesture; rewriting never starts a translator download.

The displayed badge comes from **`result.response.inferenceSource`**, never the selected mode. Under English, a source note shows “Translated on device (Chrome Translator API)” or “Gemini (cloud)”. `ON_DEVICE`, `IN_CLOUD` and Unknown counters count SDK responses, including responses rejected by validation. Failed requests before a response do not count. Counters reset on reload.

Ready device-first requests use a separate compact prompt: one short sentence per source sentence in the same order, kanji without parenthetical readings, and the source date/time/floor/place phrases (extracted with the same patterns as validation) quoted as phrases that must appear in `easyJapanese`. Nano returns short Japanese summary/actions/place/time and empty English/optional translation placeholders. After validation, [Chrome Translator](src/translate.ts) translates the full trimmed original notice into English and any prepared extra language, and Nano's Japanese fields into English. Missing place/time become “Not stated”. A conservative 6,500 UTF-8 byte prompt cap reserves room within Nano's 9,216-token input limit for the schema and SDK framing; it is not a measured tokenizer count. JSON structured output still uses on-device `responseConstraint`. An unexpected SDK `IN_CLOUD` fallback for the device prompt reruns once with the cloud prompt in `ONLY_IN_CLOUD`, counting both responses. Cloud-first requests and quality-escalation cloud requests use the existing cloud prompt, which permits readings only when certain.

If an actual `ON_DEVICE` response fails validation in online `PREFER_ON_DEVICE`, the app reruns the same notice/language once through Firebase AI Logic `ONLY_IN_CLOUD` with **`gemini-3.5-flash-lite`**, independent of the ordinary Remote Config model override. The UI displays the reason and “→ re-ran in the cloud.”; the successful response badge shows `IN_CLOUD`, and both responses count. If offline or in `ONLY_ON_DEVICE`, up to two further device attempts are allowed. Cloud validation errors and request failures are not automatically retried. `ONLY_IN_CLOUD` and `PREFER_IN_CLOUD` retain their ordinary routing and cloud prompt.

## Quality guards

Both paths validate JSON shape and check `easyJapanese` for known Japanese typos and unchanged number/date/time/floor expressions. Device summaries must not be blank; empty device place/time and English/translation placeholders are allowed before translation. A Unicode script allowlist rejects foreign-script contamination in `easyJapanese` (including Telugu, Devanagari and Hangul); Japanese scripts, ASCII and Japanese/full-width forms are allowed. Actual device responses with parenthetical kana readings are rejected as **unreliable on-device readings**; nothing is silently stripped. Missing recognizable place names produce a visible review warning.

Real Chrome 157 / Firebase AI Logic `ONLY_ON_DEVICE` observations supplied by the author on **2026-11-15** covered **8 runs** of the two fictional samples: **6 failed number/date checks**, dropping facts such as `11月15日`, `午後3時` and `1階`. Nano also invented readings such as `強風（つよいくう）` and inserted Telugu characters into a reading. One run passed the checks despite incorrect readings. The author reports correct readings from cloud `gemini-3.5-flash-lite` on these samples. See [the full findings and evidence limits](docs/final-qa.md#real-nano-findings-and-quality-hardening). These observations motivated the guards and a new device prompt that asks for one easy sentence per source sentence and quotes the exact date, time, floor and place phrases to keep. After that change, the same two samples through the deployed app (`ONLY_ON_DEVICE`, Chrome 157) passed all checks in **6 of 6 runs** with no parenthetical readings; Nano's output stays close to the source wording, and one run dropped the closing sentence. Easier wording with readings comes from the cloud path. Checks cannot prove correct readings, meaning or factual accuracy. Always compare with the source.

The later **2026-11-15**, Chrome 157 / Firebase AI Logic `ONLY_ON_DEVICE` measurement used the current sentence-by-sentence prompt on the same two fictional samples (**8 runs**). Easy Japanese retained all facts, but Nano renamed fictional 青葉線 to “Tozai Line” / “Asakusa Line” (and 青葉駅 to “Asakusa Station”) in **3 of 4 train runs**, and returned the summary in Japanese in **5 of 8 runs**. Keeping Japanese names in parentheses worked only partially. Chrome Translator ja→en correctly used “Aoba Line, Aoba Station, Kawami Station”, “Hikari Civic Center 1F” and “As of 3:00 pm on November 15” on these samples. Its availability was `downloadable`; creation downloaded in about **7 seconds**. This small author-supplied comparison motivates the split pipeline, not a general accuracy claim. After the split, 6 in-app runs on the deployed build (Chrome 157, `ONLY_ON_DEVICE`): 4 passed, 1 showed a review warning for station names missing from easy Japanese, and the first (cold start) hit the 45-second timeout; every completed run's English used the correct names, dates and times. Automated regression tests use mocks; compare all output against the source.

## Try it — English testing instructions for judges

1. Open **https://ayutaz.github.io/koe-relay/**. The cloud path works in modern browsers with JavaScript and internet access; Gemini Nano is not required for cloud testing. No application account, payment or personal API key is required. Chrome is used for the automated browser checks; other browsers have not been individually verified.
2. Choose **Train suspension sample** or **Shelter opening sample**. Both are fictional.
3. Select `ONLY_IN_CLOUD` and **Rewrite notice**. Confirm an actual `IN_CLOUD` badge and counter, then review numbers, times, places, restrictions and uncertainty against the source.
4. Try an additional output language. Chinese and Portuguese explicitly require cloud. Speech buttons remain Japanese and English only.
5. Select **Load speech model**, then test both voices. Allow roughly 140 MB of uncompressed offline assets. Read the voice usage terms displayed in the app.
6. Wait for **App and Japanese / English speech saved for offline use**. Disconnect the network and reload. Confirm **Offline**, try both voice tests again, and select samples. Browsers can evict stored assets; a readiness message is not a permanent storage guarantee.
7. For on-device rewriting, use **desktop Chrome 148+ with Gemini Nano available**. Select **Japanese + English only**, choose `ONLY_ON_DEVICE`, and click **Prepare on-device AI** while online. This now downloads both Nano and Chrome's on-device translator. The **Translator API needs desktop Chrome 138+**, with separate [Chrome Translator requirements](https://developer.chrome.com/docs/ai/translator-api); Nano still needs compatible Chrome 148+. Wait for both preparations, then rewrite and verify actual `ON_DEVICE` output and the Chrome Translator source note. Prepare again after selecting Spanish or French before testing those combinations. Chrome version alone does not ensure support: hardware, storage, supported languages and browser policy also matter. See the [Chrome Prompt API requirements](https://developer.chrome.com/docs/ai/prompt-api).
8. With Nano and the translators prepared, disconnect and try an on-device rewrite. If Nano or the English translator is unavailable, the app shows an error and retains the original notice. It does not fabricate an offline translation.

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

`available` means ready; `downloadable` or `downloading` means preparation/download is still needed; `unavailable` means this configuration cannot run on this device. Also feature-detect `'Translator' in self` and check `await Translator.availability({sourceLanguage: 'ja', targetLanguage: 'en'})`. A `downloadable` translator requires the Prepare button, even if Chrome already holds a shared language pack. These diagnostics check availability; the app itself performs Nano inference through Firebase AI Logic. If unavailable, return to `ONLY_IN_CLOUD` while online.

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

The UI shows cache readiness separately from Online/Offline. `navigator.onLine` is a browser connectivity hint; it cannot guarantee internet access. When offline, supported PREFER requests use `ONLY_ON_DEVICE`, and cloud-only requests are disabled. Nano and Translator language-pack downloads are managed separately by Chrome; prepare both while online before disconnecting. Notices and inference responses are not stored by the Service Worker. Clearing site data or browser storage eviction removes offline capability. Development mode intentionally does not register the worker; use a production preview to test offline operation.

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

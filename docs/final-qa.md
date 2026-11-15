# Final submission QA

Checked **2026-11-15 (Asia/Tokyo)** against the #BuildHybridAI 2026 requirements supplied by the author. Scope: this public repository and its existing [GitHub Pages deployment](https://ayutaz.github.io/koe-relay/). No push, deployment, remote configuration change or commit was made. This session exposes `.git` as read-only. No environment-file contents or private App Check token values were printed or copied into this report.

## Commands and results

Environment: Windows, Node.js **24.15.0**, npm **11.4.2**, desktop Chrome **157.0.8103.79** in headless Playwright.

| Check | Result |
| --- | --- |
| `npm ci` | Passed with 232 packages installed. The first attempt failed because the sandbox could not write the default user npm cache; setting `npm_config_cache` to repository-local `.cache/npm` resolved it. No dependency versions changed. |
| `npm test` | **35 passed**, 4 test files. |
| `npm run build` | Passed TypeScript checking and Vite production build, both with normal local configuration and with `KOE_RELAY_TEST=1`. |
| `node scripts/check-production.mjs` | Passed on normal and isolated production builds, including the final normal build after UI fixes. No application debug-token assignment, debug environment reference, synthetic debug-token sentinel or development banner matched the check. Correct `/koe-relay/` asset base and completed Service Worker template. |
| `KOE_RELAY_TEST=1` build, then `RUN_TTS=1 npm run test:browser` | **12 passed**, no skipped tests, in 48.5 seconds. The final two additional text-color corrections were subsequently rebuilt and checked separately for contrast. |
| `git diff --check` | Passed. |

The browser suite covered the unconfigured app, fictional samples, mode persistence, safe rendering of model output, actual SDK source-counter semantics using mocks, extra-language routing, Remote Config handling, validation warnings/rejections, timeout and retry recovery, speech-download failure recovery, offline shell/runtime delivery and real speech playback after an offline reload.

Build warnings remain for large upstream dictionary chunks and an optional loader asset URL resolved at runtime. These did not fail the build or Japanese/English playback tests.

## Live hosted checks

- Index: **HTTP 200**. The HTML's main JavaScript and CSS each returned **HTTP 200** with appropriate content types and nonempty bodies.
- `sw.js`: **HTTP 200**. All **18** files in its deployed shell manifest returned **HTTP 200** to HEAD requests, including runtime assets and bundled dictionaries.
- A fresh browser context opened the hosted app, chose the fictional train sample and `ONLY_IN_CLOUD`, and clicked **Rewrite notice**. The live request completed with a visible result, **`IN_CLOUD`**, cloud counter **1**, device counter **0**, and **Rewrite ready**. No JavaScript page errors were observed.
- App Check token exchange returned **HTTP 200** and the page loaded reCAPTCHA script. No debug token was configured in the test browser. This demonstrates one successful hosted cloud/App Check path, not universal attestation acceptance or future availability.
- `LanguageModel.availability()` with the app's Japanese/English declarations returned **`unavailable`** on this machine. No real Nano generation, Nano download or offline Nano rewrite was verified.
- The existing hosted `favicon.ico` returns **404**. The local change adds `public/favicon.svg` and an explicit icon link; Vite emits `/koe-relay/favicon.svg`, verified **HTTP 200**, `image/svg+xml`, in production preview. The live favicon remains unchanged because nothing was pushed.

The hosted run used the already deployed app. Local README, accessibility and favicon changes are not present on the public site yet.

## Real local speech and offline evidence

The opt-in browser test downloaded the revision-pinned Tsukuyomi-chan model, initialized piper-plus in approximately **8.5 seconds**, and synthesized Japanese and English. It then disabled HTTP cache, emulated offline transport and browser connectivity, reloaded through the Service Worker, confirmed an uncached request failed, and synthesized both languages again.

| Audio | Online duration | Offline duration |
| --- | --- | --- |
| Japanese test | 4.86 seconds | 4.82 seconds |
| English test | 2.55 seconds | 2.48 seconds |

All four audio buffers were finite and non-silent, with no page errors. This proves automated synthesis/playback and offline asset delivery for these test strings. Human listening, pronunciation, intelligibility and speech quality remain **unverified**. These tests do not perform Firebase inference.

## UI and accessibility review

Reviewed full-page desktop and **390 × 844** mobile screenshots. The mobile layout stacks correctly, labels and controls remain visible, and there is no horizontal page overflow. Changes were limited to:

- Darker small text for hints, step labels, counters, voice terms, footer, empty results, speech information and neutral source badge.
- More distinct textarea/select borders and a darker keyboard-focus outline.
- `aria-describedby` connections for the notice/count, inference-mode help and additional-language help.
- A clickable Apache-2.0 footer license and removal of the misleading suggestion that every user-supplied notice is fictional.
- The SVG favicon.

A computed-color spot check of all **50 visible text elements** in the unconfigured mobile state passed normal-text contrast thresholds after corrections; minimum measured ratio **4.62:1**. Keyboard Tab navigation showed visible **3px solid outlines** on enabled form controls, buttons and links. Existing browser tests also exercised generated results and error/retry states. This is a focused QA review, not a comprehensive WCAG audit or screen-reader certification; native select popups, every generated-output state and other browsers were not exhaustively audited.

## README and rule coverage

The README now leads with the value proposition and includes:

- Firebase AI Logic imports, App Check initialization, `InferenceMode` selection, runtime `generateContent` and `inferenceSource` handling, with source file/line links.
- The correct in-code cloud default, **`gemini-3.5-flash-lite`**, and the `cloud_model` Remote Config override. The previous README's `gemini-3.8-flash` description was stale.
- Hosted URL, English testing instructions for cloud, local speech, offline reload and Nano; Chrome **148+** desktop requirements and a matching `LanguageModel.availability()` diagnostic.
- Hosted reCAPTCHA Enterprise guidance: judges need no debug token, account, payment or personal API key. Local Firebase/App Check setup is documented separately.
- The author's statement that this app was created from scratch on **2026-11-15**, within **11/11–11/30**, and the work built for the submission. This authorship/timing disclosure is supplied by the author, not independently established by QA.
- Explicit pre-existing-work disclosure for the same author's **MIT piper-plus npm package**, the existing pinned Tsukuyomi-chan model, its separate model/corpus/audio terms, and other dependencies.
- Local setup, build/test commands, technology stack, About/license and credits.

GitHub's public repository API reports a public repository and detected **Apache-2.0** license. The README now has an explicit About/license section and the UI links to `LICENSE`. The repository's external About description does not literally mention the license; no remote metadata was edited. If the submission requires that exact description field, add “Apache-2.0” there before final submission.

Official references checked for the README:

- [Firebase hybrid configuration, inference modes and source reporting](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options)
- [Chrome Prompt API requirements and availability checks](https://developer.chrome.com/docs/ai/prompt-api)
- [Tsukuyomi-chan model terms](https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan) and [official corpus terms](https://tyc.rei-yumesaki.net/material/corpus/#terms3)

## Privacy and dependency checks

Applied the public-repository privacy review workflow. A bounded pattern scan covered **38 tracked files** and the file trees of **11 locally reachable commits**, excluding private environment-file contents. No tracked private environment-file paths, common literal Google/OpenAI/AWS/GitHub key patterns, private-key blocks, service-account declarations, literal UUID-shaped App Check debug assignments, private Windows user paths or email patterns were found. All reachable commit author/committer email identities were GitHub noreply identities. Firebase web configuration and the reCAPTCHA site key are public client configuration by design.

The newly written SVG and this report were also reviewed for private data. Generated screenshots, raw test evidence, npm audit output, caches, vendor copies and `dist/` remain ignored. The production checker verifies known development markers; it is not a proof that arbitrary unknown secrets cannot exist. This review does not cover unreachable Git objects, GitHub caches, other repositories or remote configuration secrets.

`npm audit` reports **4 high-severity affected packages**, tracing through `firebase` → Firestore/Firestore compatibility → **`@grpc/grpc-js@1.9.16`**, with two underlying gRPC advisories. The app does not import Firestore or host a gRPC server. The automatic proposed fix is a breaking downgrade to Firebase 9.14.0, so it was not applied during this small final-QA pass. Dependency advisories remain unresolved; this report does not declare the entire dependency tree vulnerability-free.

## Remaining verification limits

- Real Nano generation, on-device language quality and offline Nano operation need a compatible machine. The app uses Firebase AI Logic for that path in code, but the current machine cannot supply runtime evidence.
- The live cloud check covers one train rewrite in Chrome. It does not prove factual correctness, all translations, all browsers or future free-tier capacity.
- Human review of generated text and speech is still needed; heuristics cannot guarantee readings, meaning, negation or safety-critical facts.
- The app has no sign-in, paywall or judge allowlist. **Free and unrestricted access until judging ends remains an operational requirement**, not something a single QA run can guarantee. The owner must maintain hosting, sufficient quota and working App Check. Billing-console state, attestation enforcement settings and the entire judging period were not independently verified.
- Local changes, including the favicon, require a later authorized publication. No push was made.

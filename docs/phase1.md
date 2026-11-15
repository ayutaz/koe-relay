# Phase 1 — quality, languages, offline use and deployment preparation

Date: **2026-11-15 (Asia/Tokyo)**. Work stayed in this repository. No push,
deployment, Firebase configuration change or live AI inference was performed.
Neither private environment file was printed or copied into documentation.

## Starting evidence and scope

The manager/user reports that project `koe-relay-hybrid` exists on Spark with
Gemini Developer API, no billing, enforced App Check, a registered development
debug token and a successful real `ONLY_IN_CLOUD` train rewrite (`IN_CLOUD: 1`).
That run preserved facts but returned the reading `つうふう` for 強風 and the typo
`みてくだだい`. This is supplied evidence, not a live run reproduced here.

Phase 0 remains a historical record. This report supersedes its statements about
missing offline support, Remote Config, extra languages and deployment code.

## Output quality and model choice

`src/rewrite.ts` now asks for short grammatical Japanese retaining kanji, with
readings only when certain. It explicitly gives 強風（きょうふう） and
確認してください, preserves every stated restriction/uncertainty, and requests
verbatim original numbers, dates, times, floor numbers and place names in
`easyJapanese`. English and optional translations should include original names
and numeric/time expressions alongside translations. Source text remains JSON
encoded and marked as untrusted data.

Validation rejects malformed/empty required fields, the observed typo/misreading,
changed/omitted/invented Arabic/full-width number tokens and omitted/changed
recognizable date/time/floor expressions in easy Japanese. It flags missing
recognizable place names in a prominent **Needs review** message. Legitimate
adjacent kana such as ここ are allowed. A selected extra language requires a
nonempty `translation` field. Rejected responses still increment their actual
reported-source counters; no result is shown and no automatic cloud retry occurs.

**Limits:** this is a targeted spelling/reading check and heuristic fact check,
not a Japanese proofreader or semantic verifier. Place extraction can miss names
or overmatch a phrase. Number-token equality cannot prove quantity relationships;
the checks do not comprehensively validate translations, negation, readings or
all written-out numbers. Flagged results remain visible for comparison. No model
output is silently corrected. Human review against the source is still required.

Official sources checked **2026-11-15**:

- [Firebase AI Logic supported models](https://firebase.google.com/docs/ai-logic/models#available-model-names)
  lists stable `gemini-3.8-flash` for Gemini Developer API. It also describes
  upcoming routing changes for older model names.
- [Gemini Developer API pricing — Gemini 3.8 Flash](https://aistudio.google.com/docs/pricing#gemini-3.8-flash)
  lists free-tier input/output. This supports using it without enabling billing,
  subject to free-tier access and quota; it does not prove this project's live access.
- [Firebase hybrid configuration](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options)
  permits overriding the cloud model; the SDK default is Flash-Lite.

The explicit cloud model is now **`gemini-3.8-flash`** as a quality candidate.
There is no benchmark establishing better Japanese on these samples yet. No paid
model, billing upgrade or alternate paid fallback was added. App Check enforcement
remains required. The manager should compare the train and shelter samples on the
new model before claiming a quality improvement.

The full JSON-encoded prompt is limited to **6,500 UTF-8 bytes** for any request
that can reach Nano. This is a conservative proxy, leaving over 2,700 of the 9,216
token input limit for schema/SDK framing. It is not an exact Nano tokenizer count;
the installed SDK does not support `countTokens()` for `ONLY_ON_DEVICE`.
Over-budget PREFER requests route explicitly to cloud while online; device-only
or offline requests fail with a shortening message. The app never truncates a notice.
The ordinary 4,000-character limit applies to cloud too. No long cloud prompt can
fall back to the device, because that request uses `ONLY_IN_CLOUD`.

## Language routing and source evidence

`src/languages.ts` is the capability catalog. Japanese and English are always
generated; one optional additional language can be selected at a time:

| Code | Output | Routing |
| --- | --- | --- |
| `zh` | Chinese | Cloud required; PREFER modes become `ONLY_IN_CLOUD`. |
| `es` | Spanish | Cloud available; device attempt permitted when compatible. |
| `fr` | French | Cloud available; device attempt permitted when compatible. |
| `pt` | Portuguese | Cloud required; PREFER modes become `ONLY_IN_CLOUD`. |

[Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api#language_support),
checked 2026-11-15, lists `en`, `ja`, `es`, `de`, `fr`. Chinese and Portuguese are
therefore not declared as device outputs. Model instances and preparation are
keyed by mode and extra language, with matching structured schemas and language
declarations. Availability/accuracy for each combination must still be tested on
the actual device. The UI identifies cloud requirements and disables unsupported
device-only/offline combinations. Extra-language results are text only.

When the browser signals offline, supported PREFER requests use `ONLY_ON_DEVICE`;
cloud-only requests cannot run. A browser Online signal does not guarantee internet
reachability. The badge/counters always use SDK `response.inferenceSource`,
including Unknown when absent; selection/preparation never fabricates evidence.

## Offline implementation and verification

The production build generates `dist/sw.js` with a content-versioned manifest of
all emitted/public shell files, including dynamic dictionary chunks and vendor
WASM/JS. URLs resolve within the worker's `/koe-relay/` scope. Installation must
finish before it claims the page; incomplete installation does not replace a
working worker. Updates wait for old controlled pages to close. Activation removes
old shell caches for this scope. Speech uses a separate scope-local cache and a
revision-pinned model/config URL, so shell updates can retain the voice.

On first production load, shell/runtime assets are cached automatically. The
roughly 40 MB voice is saved by **Load speech model**, by actual speech use, or by
**Save speech for offline use**. The UI reports shell-only readiness separately
from full speech readiness. Total uncompressed cached files are roughly **140 MB**;
the build currently includes an extra ORT WASM copy and optional Chinese dictionary
chunks. Compression affects transfer size. Storage failures leave online speech
usable but cannot produce a successful offline-ready status. Cache eviction/site
data clearing requires reloading online. Development does not install a worker.

The worker caches only manifest files and the exact pinned speech URLs. It maps
piper-plus's initial `model.onnx.json` probe to this revision's sibling `config.json`
to avoid requiring an uncached 404 offline. Opaque/failed responses are not cached.
AI, App Check, Remote Config and unrelated URLs pass through. Source notices and
rewrite responses are not cached. Chrome manages Nano downloads independently.

Playwright evidence (local production preview at `/koe-relay/`):

- Default regression test installs the real worker and caches real bundled runtime
  and dictionaries, seeds synthetic external model/config bytes, disables the HTTP
  cache, sets transport and browser network state offline, reloads, and fetches the
  shell, phonemizer/ORT files, English dictionary and model/config through the worker.
  An uncached URL and a deliberately removed cached file fail offline, so network
  fallback cannot conceal a missing cache entry. Synthetic bytes are not speech evidence.
- The opt-in real test downloads the pinned voice, synthesizes Japanese and English,
  disables HTTP cache, goes offline, reloads, creates a fresh engine and synthesizes
  both again. All four playback operations complete. Offline audio buffers are finite,
  non-silent and longer than 0.2 seconds. No uncaught page errors occurred.
- Chrome used: **157.0.8103.79**. Artifacts and signal measurements are ignored under
  `.artifacts/`; timings vary and are not a performance guarantee. Service-Worker
  responses have no claimed network byte count (CDP sizes can be unavailable).
- Desktop/mobile screenshots were inspected; no horizontal overflow at 390 px.

This proves local offline shell delivery and real speech synthesis, not human
listening quality, actual Nano inference, or behavior on the deployed origin.

## Remote Config

The app uses `firebase/remote-config`, `getRemoteConfig`, `ensureInitialized`,
`fetchAndActivate` and `getString`. Fetch timeout: **4 seconds**; minimum fetch
interval: **1 hour**. UI remains usable during loading. Unsupported storage,
network errors and malformed values fall back to safe in-code defaults or valid
previously activated settings. No Authentication or Analytics is required.

| Parameter | Type | In-code default | Accepted values |
| --- | --- | --- | --- |
| `default_inference_mode` | STRING | `PREFER_ON_DEVICE` | `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, `ONLY_IN_CLOUD` |
| `enabled_languages` | STRING containing JSON array | `["ja","en","zh","es","fr","pt"]` | Language codes from the catalog; unknown codes discarded. |

Japanese/English are mandatory baseline outputs and remain enabled even for `[]`.
A saved valid user mode overrides the remote default. New settings are deferred
during inference, and the remote default does not overwrite a mode after an AI
interaction. Disabled optional languages are hidden. Selecting another language
clears stale output; remotely disabling the current optional language does too.

Manager REST template fragment (values here are public defaults, not credentials):

```json
{
  "parameters": {
    "default_inference_mode": {
      "defaultValue": {"value": "PREFER_ON_DEVICE"},
      "valueType": "STRING"
    },
    "enabled_languages": {
      "defaultValue": {"value": "[\"ja\",\"en\",\"zh\",\"es\",\"fr\",\"pt\"]"},
      "valueType": "STRING"
    }
  }
}
```

Use authenticated GET/PUT
`https://firebaseremoteconfig.googleapis.com/v1/projects/koe-relay-hybrid/remoteConfig`.
Merge these keys into the existing template, preserve unrelated settings, and use
the GET ETag with `If-Match` on PUT. Do not replace the whole template with this
fragment or store bearer tokens in this repo. Reference:
[Remote Config REST management](https://firebase.google.com/docs/remote-config/automate-rc)
and [Web setup](https://firebase.google.com/docs/remote-config/web/get-started)
(read 2026-11-15). Live Remote Config delivery remains unverified; unit tests cover
fetch success, unreachable service, cached activation, invalid settings and unsupported storage.

## GitHub Pages, configuration and documentation

`.github/workflows/pages.yml` runs on push to `main` or manual dispatch, installs
dependencies, runs unit and isolated browser tests, builds the hosted app, checks
the production bundle and uploads/deploys **only `dist/`**. It uses GitHub's Pages
environment and minimal deployment permissions. Vite base: **`/koe-relay/`**.
The intended repository/origin is `ayutaz/koe-relay`,
`https://ayutaz.github.io/koe-relay/`.

Seven public repository variables are required: `VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`,
`VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`. Missing values fail the hosted build with
names only. **The workflow never reads a real debug token from repository variables
or secrets.** Its isolated test build injects a public synthetic sentinel and checks
that it is absent from the bundle. It rejects a debug token supplied to the hosted
build process. Production code omits the
app's development-only assignment. Firebase's SDK still contains its own debug
global read logic; that alone is not evidence of a bundled debug-token value.

The sentinel check caught an inherited dynamic `import.meta.env[key]` lookup:
Vite materialized the entire environment object, including unrelated VITE values.
Configuration checks now use explicit static reads of the seven public fields.
The synthetic-token production build and exclusion check pass. No private token
was read or printed to carry out this regression check.

Browser test builds use `KOE_RELAY_TEST=1` and an empty environment directory.
They cannot load either real environment file or call the real Firebase project.
Mocked AI/Remote Config fixtures exist only in tests, outside the deployment output.

The phase label was removed. English UI now includes connectivity/cache status,
explicit language requirements, validation warnings, voice terms and Apache-2.0.
README documents the hybrid policy, actual `inferenceSource`, local setup, offline
behavior, testing, credits and hosted judge steps. Reference:
[GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
(read 2026-11-15).

## Verification and handoff

- `npm test`: **25 unit tests passed** (mocked Firebase APIs).
- `RUN_TTS=1 npm run test:browser`: **8 browser tests passed**, including real
  online/offline Japanese and English playback. A normal run skips the real download.
- `npm run build`: passed (TypeScript + Vite). Existing upstream dictionary size
  and optional Chinese-loader URL warnings remain.
- `node scripts/check-production.mjs`: passed for production output, checking
  debug setup exclusion, Pages base and worker manifest generation. The isolated
  production build with a synthetic debug-token sentinel also passed this check.
- `.git` is read-only: explicit staging failed creating `.git/index.lock` with
  Permission denied. No commits, push or deployment. See
  [local commit groups](local-commits-phase1.md).

Unverified: live `gemini-3.8-flash` project access and Japanese quality, all real
extra-language translations, Nano Japanese/English/es/fr inference and offline
rewriting, real SDK hybrid failover, hosted App Check, live Remote Config, Pages
deployment/update lifecycle on the hosted origin and human listening quality.
The supplied successful cloud run used the earlier configuration, so it does not
validate the new prompt/model.

The manager must set the Remote Config parameters and Pages variables/source,
complete the existing public-history/internal-notes cleanup and dependency/voice
review, commit from a writable Git session and deploy only when authorized. The
human should compare real train/shelter output, verify actual ON_DEVICE/IN_CLOUD
badges and listen to both voices online/offline before recording or submitting.

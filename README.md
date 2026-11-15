# Koe Relay (draft)

Turn a Japanese notice into easy Japanese and English, then listen in your browser.
A Vite + TypeScript prototype for #BuildHybridAI 2026, with no UI framework.

Phase 0 implements the Firebase AI Logic integration, structured notice output,
inference counters, and local piper-plus speech. **No Firebase project was used
for Phase 0 verification.** Live rewriting and App Check enforcement remain unverified.
Japanese and English browser speech have passed automated playback checks;
human listening review is still needed. See [the Phase 0 report](docs/phase0.md).

## Run locally

Requires Node.js 24+ and npm. Use desktop Chrome for speech and on-device AI checks.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Without environment values the app displays
**Firebase not configured**, disables AI actions, and still allows sample selection
and real speech tests. No Firebase service initializes on page load.

Choose **Load speech model**, then **Test Japanese voice** or **Test English voice**.
The first use downloads one shared multilingual voice (39.65 MB) from Hugging Face,
plus local WASM and dictionary assets. Speech text stays in the browser.
The initial speech assets total roughly 121 MB before HTTP compression.
Initial download and initialization took 9.78 seconds in one local test; this is
not a speed guarantee. This phase does not yet provide offline app/model caching.

## Configure Firebase later

After a project exists, copy `.env.example` to `.env.local` and fill all seven values.
Use Firebase's public Web app configuration and the **reCAPTCHA Enterprise site
key**, never a server secret or service account. `VITE_*` values are bundled into
the client and are publicly readable. Restart Vite after changing environment values.

Enable Firebase AI Logic with the Gemini Developer API backend and register the
Web app with App Check using reCAPTCHA Enterprise. In development, the app enables
App Check's debug flag before initialization. Register the generated debug token
privately in the Firebase console; never commit or share it. Do not add localhost
to the production reCAPTCHA allowed domains. Production builds omit the debug flag
and need a registered production domain. See [human setup tasks](HUMAN_TODO.md).

1. Paste a short Japanese notice or choose either fictional sample.
2. Select an inference mode (defaults to `PREFER_ON_DEVICE`, remembered locally).
3. Choose **Prepare on-device AI** from a user click to download/initialize Gemini Nano.
4. Choose **Rewrite notice**. Review the summary, actions, place/time, easy Japanese,
   and English against the original before using the result.
5. Read the `ON_DEVICE` / `IN_CLOUD` badge and session counters, then use the Speak buttons.

Hybrid modes may send the notice to Google through Firebase AI Logic. Choose
`ONLY_ON_DEVICE` to prohibit cloud inference; unsupported devices will fail rather
than silently send the notice to the cloud. The UI explains the selected policy.
Counters count returned SDK responses, including malformed output; failed requests
do not increment them. A missing inference source is counted as Unknown.

## Build and verify

```sh
npm run build
npm test
npm run test:browser
npm run preview
```

The browser suite uses an installed Google Chrome. The default suite checks the
production app without configuration and exercises synthetic SDK responses in a
separate local dev server. These tests never call Firebase. Real speech testing is
opt-in because it downloads large public model files. In PowerShell:

```powershell
$env:RUN_TTS = '1'
npm run test:browser
```

For restricted workspaces, keep npm/browser temporary files inside the repository:

```powershell
$env:npm_config_cache = Join-Path $PWD '.cache/npm'
$env:TEMP = Join-Path $PWD '.cache/tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force $env:TEMP | Out-Null
```

`predev` and `prebuild` copy the installed piper-plus WASM and ONNX Runtime assets
into ignored `public/vendor/`; they do not download models. `dist/` is the static
output; relative asset URLs support a future GitHub Pages repository path.
No site was published or pushed. Full offline reload, service worker caching,
Remote Config, additional UI languages, and public deployment are later work.

## License and credits

Application code: [Apache-2.0](LICENSE). Third-party software, voice weights, and
generated voice are governed separately:

- [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk): Apache-2.0.
- [piper-plus](https://github.com/ayutaz/piper-plus) `0.9.1`,
  [@piper-plus/g2p](https://github.com/ayutaz/piper-plus/tree/dev/src/wasm/g2p),
  and [ONNX Runtime](https://github.com/microsoft/onnxruntime): MIT. Bundled
  dictionaries also have their own notices, copied into the built vendor directory.
- **Piper Plus:つくよみちゃん** — [Piper Plus Tsukuyomi-chan model](https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan),
  pinned revision `619ad26fcbd5635b3d70a27eac919f4c2ce892b1`, root FP16 multilingual model.
  Its legacy base is CC BY 4.0; the voice also follows the
  [Tsukuyomi-chan corpus terms](https://tyc.rei-yumesaki.net/material/corpus/#terms3).
  It is not covered by the application's Apache license.
- Voice data: Tsukuyomi-chan corpus, CV. Rei Yumesaki (© Rei Yumesaki).
  This is an unofficial work. Rei Yumesaki does not develop or support this app/model;
  direct inquiries to the Piper Plus developer. Model and voice data are not checked into this repo.

Credit **Piper Plus:つくよみちゃん** when sharing generated audio, including video
descriptions. Follow the linked model/corpus restrictions: no attacking people,
political/religious/ideological advocacy, intense material without audience
separation, or redistribution of generated audio for reuse as raw material.
Corpus-derived components retain the corpus terms when modified or redistributed.
The app displays voice attribution and a plain English summary of these conditions.
Review the official display template before public release; Phase 0 is local only.

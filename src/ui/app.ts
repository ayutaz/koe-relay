import { firebaseConfigured, firebaseStatus, initializeDeviceModel } from '../firebase';
import { counters, rewriteNotice } from '../rewrite';
import type { Notice, Source } from '../rewrite';
import { modes, readMode, saveMode } from '../settings';
import type { Mode } from '../settings';
import { loadVoice, speak } from '../tts';
import type { SpeechLanguage } from '../tts';
import { samples } from './samples';

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <header class="site-header"><a class="brand" href="./"><span class="brand-mark" aria-hidden="true">kr</span> Koe Relay</a><span class="phase">PHASE 0 · LOCAL PROTOTYPE</span></header>
    <main>
      <section class="intro"><span class="eyebrow">CLEAR WORDS. A FAMILIAR VOICE.</span><h1>A notice everyone<br>can understand.</h1><p>Bring a Japanese notice. Get the essentials in easy Japanese and English, then listen in your browser.</p></section>
      <aside class="connection" aria-label="Connection status"><span class="status-dot" aria-hidden="true"></span><strong id="firebase-status"></strong><span>${firebaseConfigured ? 'Connect only when you choose an AI action.' : 'You can explore samples and test speech. Rewriting needs project setup.'}</span></aside>
      <div class="workspace">
        <section class="card input-card" aria-labelledby="input-heading">
          <div class="section-top"><span class="step">01 / INPUT</span><span class="tag">Japanese → clear words</span></div>
          <h2 id="input-heading">Start with a notice</h2><label for="notice">Japanese notice</label>
          <textarea id="notice" lang="ja" rows="7" maxlength="4000" spellcheck="false"></textarea>
          <div class="input-meta"><span>Fictional samples for testing only</span><span id="character-count"></span></div>
          <div class="sample-buttons"><button id="sample-train" class="secondary">Train suspension sample</button><button id="sample-shelter" class="secondary">Shelter opening sample</button></div>
          <label for="mode">Inference mode</label><select id="mode">${modes.map(mode => `<option value="${mode}">${mode}</option>`).join('')}</select>
          <p id="mode-help" class="hint"></p>
          <div class="action-row"><button id="rewrite" class="primary">Rewrite notice <span aria-hidden="true">↗</span></button><button id="download" class="secondary">Prepare on-device AI</button></div>
          <progress id="download-progress" max="1" value="0" hidden aria-label="AI model download progress"></progress>
          <p id="ai-message" class="message" role="status" aria-live="polite"></p>
        </section>
        <section class="card result-card" aria-labelledby="result-heading">
          <div class="section-top"><span class="step">02 / UNDERSTAND</span><span id="source" class="badge">NO INFERENCE YET</span></div>
          <h2 id="result-heading">The message, made clear</h2>
          <div class="counters" aria-label="Inference responses this session"><span>ON_DEVICE <strong id="device-count">0</strong></span><span>IN_CLOUD <strong id="cloud-count">0</strong></span><span>Unknown <strong id="unknown-count">0</strong></span></div>
          <div id="empty-result" class="empty-result"><span class="empty-icon" aria-hidden="true">↳</span><h3>Your rewrite will appear here</h3><p>Key facts, what to do, and two clear versions.<br>No generated results are shown until AI responds.</p></div>
          <div id="result" hidden>
            <h3>At a glance</h3><p id="summary"></p><dl><div><dt>Place</dt><dd id="place"></dd></div><div><dt>Time</dt><dd id="time"></dd></div></dl><h3>What to do</h3><ul id="actions"></ul>
            <div class="language-result"><div class="language-heading"><h3>Easy Japanese</h3><button id="speak-ja" class="secondary">Speak Japanese</button></div><p id="easy-japanese" lang="ja"></p></div>
            <div class="language-result"><div class="language-heading"><h3>English</h3><button id="speak-en" class="secondary">Speak English</button></div><p id="english" lang="en"></p></div>
          </div>
        </section>
      </div>
      <section class="speech-panel" aria-labelledby="speech-heading"><div><span class="step">03 / LISTEN LOCALLY</span><h2 id="speech-heading">A voice that stays on your device</h2><p>Test speech before Firebase is set up. The first use downloads a shared voice and runtime files; speech is synthesized here in your browser.</p></div><div class="speech-controls"><button id="load-voice" class="secondary">Load speech model</button><button id="test-ja" class="secondary">Test Japanese voice</button><button id="test-en" class="secondary">Test English voice</button></div><p id="speech-message" class="message" role="status" aria-live="polite">Voice not loaded. Initial assets total about 121 MB uncompressed; download speed varies.</p></section>
      <section class="voice-terms" aria-label="Voice credits and usage terms"><h2>Voice credits & use</h2><p><strong>Piper Plus:つくよみちゃん</strong> · An unofficial voice using the Tsukuyomi-chan corpus (voice: Rei Yumesaki, © Rei Yumesaki). Rei Yumesaki does not develop or support this app or model.</p><p>Generated audio must not attack people, advocate for or against political, religious, or ideological positions, publish intense content without appropriate audience separation, or be offered for reuse as raw material. Credit “Piper Plus:つくよみちゃん” when sharing audio, including in video descriptions.</p><p>Read the <a href="https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan">model terms</a> and <a href="https://tyc.rei-yumesaki.net/material/corpus/#terms3">corpus terms</a>. Inquiries belong with the <a href="https://github.com/ayutaz/piper-plus/issues">Piper Plus developer</a>.</p></section>
    </main><footer>Built for #BuildHybridAI 2026 <span>Fictional notices · Verify AI output against the original</span></footer>`;

  const el = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const input = el<HTMLTextAreaElement>('notice');
  const mode = el<HTMLSelectElement>('mode');
  let notice: Notice | null = null;
  let aiBusy = false;
  let speechBusy = false;
  el('firebase-status').textContent = firebaseStatus;
  mode.value = readMode();
  input.value = samples.train;

  function updateControls() {
    el<HTMLButtonElement>('rewrite').disabled = aiBusy || !firebaseConfigured || !input.value.trim();
    el<HTMLButtonElement>('download').disabled = aiBusy || !firebaseConfigured || mode.value === 'ONLY_IN_CLOUD';
    mode.disabled = aiBusy;
    input.disabled = aiBusy;
    for (const id of ['sample-train', 'sample-shelter']) el<HTMLButtonElement>(id).disabled = aiBusy;
    el('character-count').textContent = `${input.value.length} / 4,000`;
    el('mode-help').textContent = mode.value === 'ONLY_ON_DEVICE' ? 'On-device only. If this device cannot run Japanese + English, the request fails without sending the notice to the cloud.' : mode.value === 'ONLY_IN_CLOUD' ? 'Cloud only. Rewriting sends this notice to Google through Firebase AI Logic.' : 'Hybrid mode. This notice may be sent to Google through Firebase AI Logic if cloud inference is selected or needed.';
    for (const id of ['load-voice', 'test-ja', 'test-en', 'speak-ja', 'speak-en']) {
      el<HTMLButtonElement>(id).disabled = speechBusy || (id.startsWith('speak-') && !notice);
    }
  }
  const updateCounters = () => {
    el('device-count').textContent = String(counters.ON_DEVICE);
    el('cloud-count').textContent = String(counters.IN_CLOUD);
    el('unknown-count').textContent = String(counters.UNKNOWN);
  };
  function renderResult(value: Notice, source: Source | null) {
    notice = value;
    el('empty-result').hidden = true;
    el('result').hidden = false;
    for (const [id, text] of Object.entries({ summary: value.summary, place: value.place, time: value.time, 'easy-japanese': value.easyJapanese, english: value.english })) el(id).textContent = text;
    el('actions').replaceChildren(...value.actions.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
    if (!value.actions.length) { const item = document.createElement('li'); item.textContent = 'No actions stated.'; el('actions').append(item); }
    el('source').textContent = source ?? 'SOURCE UNKNOWN';
    el('source').dataset.source = source ?? 'UNKNOWN';
  }
  const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
  function inputChanged() {
    notice = null;
    el('result').hidden = true;
    el('empty-result').hidden = false;
    el('source').textContent = 'NO INFERENCE YET';
    delete el('source').dataset.source;
    el('ai-message').textContent = '';
    updateControls();
  }
  for (const key of ['train', 'shelter'] as const) el(`sample-${key}`).onclick = () => { input.value = samples[key]; inputChanged(); };
  input.oninput = inputChanged;
  mode.onchange = () => { saveMode(mode.value as Mode); updateControls(); };
  el('rewrite').onclick = async () => {
    aiBusy = true;
    notice = null;
    el('result').hidden = true;
    el('empty-result').hidden = false;
    el('source').textContent = 'WAITING FOR RESPONSE';
    delete el('source').dataset.source;
    updateControls();
    el('ai-message').textContent = 'Rewriting notice…';
    try {
      const result = await rewriteNotice(input.value, mode.value as Mode);
      renderResult(result.notice, result.source);
      el('ai-message').textContent = 'Rewrite ready. Check the details against the original notice.';
    } catch (error) {
      el('ai-message').textContent = `Rewrite failed: ${errorText(error)}`;
      el('source').textContent = 'NO VALID RESULT';
    } finally { aiBusy = false; updateCounters(); updateControls(); }
  };
  el('download').onclick = async () => {
    aiBusy = true;
    updateControls();
    const progress = el<HTMLProgressElement>('download-progress');
    progress.hidden = false;
    progress.value = 0;
    el('ai-message').textContent = 'Preparing Japanese + English on-device AI…';
    try {
      await initializeDeviceModel(mode.value as Mode, fraction => { progress.value = fraction; el('ai-message').textContent = `AI model download: ${Math.round(fraction * 100)}%`; });
      progress.value = 1;
      el('ai-message').textContent = 'On-device AI ready. A real rewrite will report the inference source.';
    } catch (error) { progress.hidden = true; el('ai-message').textContent = `On-device setup failed: ${errorText(error)} Try a cloud-capable mode when online.`; }
    finally { aiBusy = false; updateControls(); }
  };
  const speechMessage = (message: string) => { el('speech-message').textContent = message; };
  async function runSpeech(action: () => Promise<unknown>) {
    speechBusy = true;
    updateControls();
    try { await action(); } catch (error) { speechMessage(`Speech failed: ${errorText(error)}`); }
    finally { speechBusy = false; updateControls(); }
  }
  el('load-voice').onclick = () => { void runSpeech(() => loadVoice(speechMessage)); };
  const speakText = (text: string, language: SpeechLanguage) => { void runSpeech(() => speak(text, language, speechMessage)); };
  el('test-ja').onclick = () => speakText('これは音声のテストです。駅の案内を確認してください。', 'ja');
  el('test-en').onclick = () => speakText('This is a voice test. Please check the station notice.', 'en');
  el('speak-ja').onclick = () => { if (notice) speakText(notice.easyJapanese, 'ja'); };
  el('speak-en').onclick = () => { if (notice) speakText(notice.english, 'en'); };
  updateControls();
}

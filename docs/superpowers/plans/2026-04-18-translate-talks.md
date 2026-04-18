# Translate Talks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only real-time speech transcription app for DevParaná events, designed for accessibility on a projected screen.

**Architecture:** Single-page static app (HTML + CSS + JS vanilla) using Chrome's Web Speech API. No backend, no build tools, no dependencies. Three JS modules: `speech.js` (Web Speech API wrapper), `ui.js` (display and controls), `app.js` (orchestration).

**Tech Stack:** HTML5, CSS3, JavaScript ES Modules, Web Speech API (`webkitSpeechRecognition`)

---

## File Structure

```
translate-talks/
├── index.html          # Main page with all markup
├── css/
│   └── styles.css      # Themes (dark/light), layout, controls, animations
├── js/
│   ├── speech.js       # Web Speech API wrapper with auto-restart
│   ├── ui.js           # Transcript display, theme toggle, font control, auto-hide
│   └── app.js          # Wires speech callbacks to UI, handles toggle button
└── assets/
    └── devparana.svg    # DevParaná logo (green diamond with white circuit pattern)
```

---

### Task 1: Project Scaffold — HTML + SVG Asset

**Files:**
- Create: `assets/devparana.svg`
- Create: `index.html`

- [ ] **Step 1: Create the SVG asset**

Create `assets/devparana.svg` with the DevParaná logo:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <path d="M132.5 290.8L9.2 167.5c-9.6-9.6-9.6-25.4 0-35L132.5 9.2c9.6-9.6 25.4-9.6 35 0l123.3 123.3c9.6 9.6 9.6 25.4 0 35L167.5 290.8c-2.4 2.4-5.2 4.2-8.1 5.4l-18.5.1c-3.1-1.2-6-3.1-8.4-5.5z" fill="#15a04b"/>
  <path d="M232.6 98.9c-8.1 0-14.8 6.7-14.8 14.8 0 6.5 4.3 12.3 10.4 14.2v27.5c0 15.6-9.8 24.2-31.8 27.7-3-5.8-9.3-9.5-19.2-11h-.1c-7.8-1-13.7-3.3-18-6.8V158c4.2-3.7 10.1-6 18.2-7h.1c13.9-2.1 21-8.7 21-19.4v-16.1c6.4-1.6 11.3-7.4 11.3-14.4 0-8.2-6.7-14.9-14.8-14.9s-14.8 6.7-14.8 15c0 7.1 5.1 13.1 11.7 14.5v16c0 7.4-4.6 11.2-15.4 12.9-7 .8-12.7 2.6-17.2 5.4v-48.6c5.4-3.2 9-9 9-15.6 0-10-8.1-18.2-18.2-18.2-10 0-18.2 8.1-18.2 18.2 0 6.7 3.6 12.5 9 15.6v41.5c-4.1-2-9-3.4-14.8-4.1-13.5-2-15.2-7.8-15.2-12.7v-11.3c6.5-1.5 11.5-7.4 11.5-14.5 0-8.1-6.7-14.8-14.8-14.8s-14.8 6.6-14.8 14.7c0 7.1 5 12.9 11.5 14.5V126c0 10.7 7 17.2 20.9 19.2 6.7 1 11.8 2.5 15.7 5.2v23.3c-9.3-5.9-21-9.8-35.6-11.6-22.5-3.4-32.5-11.9-32.5-27.8V128c5.9-2 10.1-7.5 10.1-14.1 0-8.1-6.7-14.8-14.8-14.8s-14.8 6.7-14.8 14.8c0 6.5 4.2 12.1 10.1 14.1v6.3c0 11.6 4.3 20.7 12.9 27 6.5 4.9 15.6 8.1 27.7 9.9h.1c16.2 2.1 28.2 6.7 36.9 13.9v111.2c5.9 2.3 12.6 2.2 18.5-.1v-49.7c4.2-3.6 10-5.8 18-6.8h.1c13.9-2.1 21-8.7 21-19.4v-2.4c4.3-1.4 7.5-5.5 7.5-10.2s-3.2-8.9-7.5-10.2v-5.2c11.4-1.9 20.1-5.1 26.4-9.8 8.6-6.3 12.9-15.4 12.9-27v-27.6c5.4-2.1 9.5-7.6 9.5-14.1 0-3.9-1.5-7.6-4.2-10.5-2.8-2.8-6.5-4.4-10.5-4.4zm-47.2 2.3c0-5.2 4.2-9.4 9.3-9.4 5.2 0 9.3 4.2 9.3 9.4s-4.2 9.3-9.3 9.3c-5 0-9.3-4.3-9.3-9.3zm-78.1 8.3c-5.1 0-9.3-4.2-9.3-9.3 0-5.2 4.2-9.3 9.3-9.3s9.3 4.2 9.3 9.3c0 5.1-4.3 9.3-9.3 9.3zM67.8 123c-5.1 0-9.3-4.1-9.3-9.3 0-5.2 4.2-9.3 9.3-9.3s9.3 4.2 9.3 9.3c0 5.1-4.3 9.3-9.3 9.3zm82-24.7c-7 0-12.7-5.7-12.7-12.7 0-7.1 5.7-12.8 12.7-12.8s12.7 5.7 12.7 12.7c0 7-5.7 12.8-12.7 12.8zm9.2 75c4.6 2.6 10.2 4.4 17.1 5.3 6.4 1 10.7 2.7 13 5.6-12 2.2-22.1 5.9-30.1 11.2v-22.1zm32.6 24.2c-4.3 1.4-7.5 5.5-7.5 10.2 0 4.9 3.2 8.9 7.5 10.2v2.4c-.1 7.4-4.6 11.2-15.4 12.9-6.9.8-12.5 2.6-17 5.3v-31.4c7.8-6.9 18.4-11.4 32.4-13.8v4.2zm41-74.4c-5.2 0-9.3-4.2-9.3-9.3s4.2-9.3 9.3-9.3c2.5 0 4.9 1 6.7 2.7 1.8 1.8 2.6 4.1 2.6 6.5 0 5.2-4.2 9.4-9.3 9.4z" fill="#fff"/>
</svg>
```

- [ ] **Step 2: Create HTML page**

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Translate Talks — DevParaná</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header id="controls" class="controls">
    <img src="assets/devparana.svg" alt="DevParaná" class="logo">
    <button id="toggle-btn" class="ctrl-btn" title="Iniciar/Parar">▶</button>
    <button id="theme-toggle" class="ctrl-btn" title="Alternar tema">☀️</button>
    <button id="font-down" class="ctrl-btn" title="Diminuir fonte">A-</button>
    <button id="font-up" class="ctrl-btn" title="Aumentar fonte">A+</button>
    <span id="status" class="status" title="Status">⚪</span>
  </header>

  <main id="transcript-area" class="transcript-area">
    <div id="transcript" class="transcript"></div>
    <p id="interim" class="interim"></p>
  </main>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Verify scaffold in browser**

Run: `open index.html` in Chrome (or serve locally)
Expected: Page loads with dark background, controls bar visible at top with logo + buttons, empty transcript area.

- [ ] **Step 4: Commit**

```bash
git add assets/ index.html
git commit -m "feat: project scaffold with HTML structure and SVG logo"
```

---

### Task 2: CSS Styles — Themes, Layout, Controls, Animations

**Files:**
- Create: `css/styles.css`

- [ ] **Step 1: Create the stylesheet**

Create `css/styles.css`:

```css
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* ── Theme: Dark (default) ── */
[data-theme="dark"] {
  --bg: #1a1a2e;
  --text-final: #ffffff;
  --text-interim: #15a04b;
  --controls-bg: rgba(0, 0, 0, 0.6);
  --ctrl-btn-bg: rgba(255, 255, 255, 0.1);
  --ctrl-btn-hover: rgba(255, 255, 255, 0.2);
  --error-color: #ff6b6b;
}

/* ── Theme: Light ── */
[data-theme="light"] {
  --bg: #f5f5f5;
  --text-final: #1a1a2e;
  --text-interim: #15a04b;
  --controls-bg: rgba(255, 255, 255, 0.8);
  --ctrl-btn-bg: rgba(0, 0, 0, 0.08);
  --ctrl-btn-hover: rgba(0, 0, 0, 0.15);
  --error-color: #cc0000;
}

body {
  background-color: var(--bg);
}

/* ── Controls Bar ── */
.controls {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--controls-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.controls.hidden {
  opacity: 0;
  transform: translateY(-100%);
  pointer-events: none;
}

.logo {
  width: 32px;
  height: 32px;
}

.ctrl-btn {
  background: var(--ctrl-btn-bg);
  border: none;
  color: var(--text-final);
  font-size: 18px;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.ctrl-btn:hover {
  background: var(--ctrl-btn-hover);
}

.status {
  margin-left: auto;
  font-size: 20px;
  line-height: 1;
}

/* ── Transcript Area ── */
.transcript-area {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80px 48px 48px;
  text-align: center;
}

.transcript {
  width: 100%;
  max-width: 1200px;
}

.phrase {
  color: var(--text-final);
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease;
}

.interim {
  color: var(--text-interim);
  font-weight: 400;
  line-height: 1.4;
  opacity: 0.85;
  min-height: 1.4em;
  width: 100%;
  max-width: 1200px;
  text-align: center;
}

.interim.error {
  color: var(--error-color);
  font-weight: 600;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Verify styling in browser**

Reload `index.html` in Chrome.
Expected: Dark theme with `#1a1a2e` background, controls bar at top with backdrop blur, buttons styled with rounded corners, empty transcript area centered vertically.

- [ ] **Step 3: Commit**

```bash
git add css/
git commit -m "feat: add CSS with dark/light themes, controls bar, transcript layout"
```

---

### Task 3: Speech Recognition Module

**Files:**
- Create: `js/speech.js`

- [ ] **Step 1: Create the speech module**

Create `js/speech.js`:

```javascript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function createSpeechEngine() {
  if (!SpeechRecognition) {
    return {
      start() {},
      stop() {},
      get isRunning() { return false; },
      get supported() { return false; },
      set onInterim(_fn) {},
      set onFinal(_fn) {},
      set onError(_fn) {},
      set onStatusChange(_fn) {},
    };
  }

  let recognition = null;
  let shouldRestart = false;
  let running = false;

  const callbacks = {
    onInterim: () => {},
    onFinal: () => {},
    onError: () => {},
    onStatusChange: () => {},
  };

  function init() {
    recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        if (!transcript) continue;

        if (event.results[i].isFinal) {
          callbacks.onFinal(transcript);
        } else {
          callbacks.onInterim(transcript);
        }
      }
    };

    recognition.onend = () => {
      if (shouldRestart) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (_e) {
            // already running, ignore
          }
        }, 100);
      } else {
        running = false;
        callbacks.onStatusChange('stopped');
      }
    };

    recognition.onerror = (event) => {
      const silentErrors = ['no-speech', 'aborted'];
      if (silentErrors.includes(event.error)) {
        return;
      }

      if (event.error === 'audio-capture' || event.error === 'network') {
        callbacks.onError(event.error);
        // auto-restart will retry via onend
        return;
      }

      // not-allowed or other fatal errors — stop
      shouldRestart = false;
      running = false;
      callbacks.onError(event.error);
      callbacks.onStatusChange('stopped');
    };
  }

  function start() {
    if (!recognition) init();
    shouldRestart = true;
    running = true;
    callbacks.onStatusChange('recording');
    try {
      recognition.start();
    } catch (_e) {
      // already started
    }
  }

  function stop() {
    shouldRestart = false;
    running = false;
    callbacks.onStatusChange('stopped');
    if (recognition) {
      try {
        recognition.stop();
      } catch (_e) {
        // already stopped
      }
    }
  }

  return {
    start,
    stop,
    get isRunning() { return running; },
    get supported() { return true; },
    set onInterim(fn) { callbacks.onInterim = fn; },
    set onFinal(fn) { callbacks.onFinal = fn; },
    set onError(fn) { callbacks.onError = fn; },
    set onStatusChange(fn) { callbacks.onStatusChange = fn; },
  };
}
```

- [ ] **Step 2: Verify module loads**

Open browser console on `index.html`. Type:
```javascript
import('./js/speech.js').then(m => console.log('speech loaded, supported:', m.createSpeechEngine().supported));
```
Expected: `speech loaded, supported: true` (in Chrome)

- [ ] **Step 3: Commit**

```bash
git add js/speech.js
git commit -m "feat: add speech recognition module with auto-restart"
```

---

### Task 4: UI Controls Module

**Files:**
- Create: `js/ui.js`

- [ ] **Step 1: Create the UI module**

Create `js/ui.js`:

```javascript
const MAX_PHRASES = 3;
const MIN_FONT_SIZE = 24;
const MAX_FONT_SIZE = 96;
const FONT_STEP = 8;
const DEFAULT_FONT_SIZE = 48;
const HIDE_DELAY = 3000;

export function createUI() {
  const transcriptEl = document.getElementById('transcript');
  const interimEl = document.getElementById('interim');
  const controls = document.getElementById('controls');
  const themeBtn = document.getElementById('theme-toggle');
  const fontUpBtn = document.getElementById('font-up');
  const fontDownBtn = document.getElementById('font-down');
  const statusEl = document.getElementById('status');
  const toggleBtn = document.getElementById('toggle-btn');

  const phrases = [];
  let hideTimeout = null;
  let fontSize = parseInt(localStorage.getItem('tt-fontSize'), 10) || DEFAULT_FONT_SIZE;
  let theme = localStorage.getItem('tt-theme') || 'dark';

  function init() {
    applyTheme();
    applyFontSize();
    setupAutoHide();

    themeBtn.addEventListener('click', toggleTheme);
    fontUpBtn.addEventListener('click', () => changeFontSize(FONT_STEP));
    fontDownBtn.addEventListener('click', () => changeFontSize(-FONT_STEP));
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tt-theme', theme);
    themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  }

  function applyFontSize() {
    transcriptEl.style.fontSize = `${fontSize}px`;
    interimEl.style.fontSize = `${fontSize}px`;
    localStorage.setItem('tt-fontSize', fontSize);
  }

  function changeFontSize(delta) {
    fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize + delta));
    applyFontSize();
  }

  function setupAutoHide() {
    document.addEventListener('mousemove', () => {
      controls.classList.remove('hidden');
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        controls.classList.add('hidden');
      }, HIDE_DELAY);
    });

    hideTimeout = setTimeout(() => {
      controls.classList.add('hidden');
    }, HIDE_DELAY);
  }

  function addFinalPhrase(text) {
    phrases.push(text);
    if (phrases.length > MAX_PHRASES) {
      phrases.shift();
    }
    renderPhrases();
    clearInterim();
  }

  function setInterim(text) {
    interimEl.textContent = text;
    interimEl.classList.remove('error');
  }

  function clearInterim() {
    interimEl.textContent = '';
    interimEl.classList.remove('error');
  }

  function renderPhrases() {
    transcriptEl.innerHTML = '';
    for (const phrase of phrases) {
      const p = document.createElement('p');
      p.className = 'phrase';
      p.textContent = phrase;
      transcriptEl.appendChild(p);
    }
  }

  function setStatus(status) {
    statusEl.textContent = status === 'recording' ? '🔴' : '⚪';
    toggleBtn.textContent = status === 'recording' ? '⏹' : '▶';
  }

  function showError(message) {
    interimEl.textContent = message;
    interimEl.classList.add('error');
    setTimeout(() => {
      if (interimEl.classList.contains('error')) {
        interimEl.textContent = '';
        interimEl.classList.remove('error');
      }
    }, 5000);
  }

  return {
    init,
    addFinalPhrase,
    setInterim,
    setStatus,
    showError,
    get toggleBtn() { return toggleBtn; },
  };
}
```

- [ ] **Step 2: Verify module loads**

Open browser console on `index.html`. Type:
```javascript
import('./js/ui.js').then(m => { const ui = m.createUI(); ui.init(); console.log('ui loaded'); });
```
Expected: `ui loaded`, dark theme applied, font size 48px, controls bar auto-hides after 3s.

- [ ] **Step 3: Commit**

```bash
git add js/ui.js
git commit -m "feat: add UI module with theme toggle, font control, auto-hide"
```

---

### Task 5: App Orchestration

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: Create the app module**

Create `js/app.js`:

```javascript
import { createSpeechEngine } from './speech.js';
import { createUI } from './ui.js';

const speech = createSpeechEngine();
const ui = createUI();

ui.init();

if (!speech.supported) {
  ui.showError('Navegador não suporta reconhecimento de voz. Use o Chrome.');
}

const ERROR_MESSAGES = {
  'audio-capture': 'Microfone não detectado',
  'not-allowed': 'Permissão de microfone negada',
  'network': 'Sem conexão com serviço de transcrição',
};

speech.onFinal = (text) => ui.addFinalPhrase(text);
speech.onInterim = (text) => ui.setInterim(text);
speech.onStatusChange = (status) => ui.setStatus(status);
speech.onError = (error) => {
  ui.showError(ERROR_MESSAGES[error] || `Erro: ${error}`);
};

ui.toggleBtn.addEventListener('click', () => {
  if (speech.isRunning) {
    speech.stop();
  } else {
    speech.start();
  }
});
```

- [ ] **Step 2: Verify full integration in Chrome**

1. Open `index.html` in Chrome (must use a local server for ES modules — e.g. `npx serve .` or `python3 -m http.server 8000`)
2. Click the ▶ button — Chrome should ask for microphone permission
3. Grant permission — status should change to 🔴, button to ⏹
4. Speak into the microphone — interim text appears in green, final text appears in white
5. Wait for 3+ phrases — only 3 latest should be visible
6. Click ⏹ — status returns to ⚪
7. Test theme toggle (☀️/🌙) — background switches between dark/light
8. Test font size (A-/A+) — text size changes
9. Stop moving mouse for 3s — controls bar fades out
10. Move mouse — controls bar reappears

Expected: All 10 checks pass.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: add app orchestration wiring speech to UI"
```

---

### Task 6: Final Polish and Verification

**Files:**
- Modify: `index.html` (add meta tags for fullscreen/PWA readiness)

- [ ] **Step 1: Add finishing meta tags to index.html**

Add these meta tags inside `<head>` after the viewport meta, for better fullscreen/kiosk experience on the event machine:

```html
  <meta name="description" content="Transcrição em tempo real de palestras — DevParaná">
  <meta name="theme-color" content="#1a1a2e">
  <link rel="icon" href="assets/devparana.svg" type="image/svg+xml">
```

- [ ] **Step 2: Full end-to-end verification**

Run a local server and test in Chrome:
```bash
cd translate-talks && python3 -m http.server 8000
```

Open `http://localhost:8000` in Chrome and verify:

1. Page loads with dark theme, controls visible
2. Logo displays correctly
3. Click ▶ → mic permission → 🔴 recording
4. Speak → green interim text → white final text
5. After 3 phrases, oldest disappears (memory management)
6. Toggle theme → light mode works
7. A+/A- → font changes and persists on reload
8. Theme persists on reload
9. Controls auto-hide after 3s idle mouse
10. Click ⏹ → stops, ⚪ status
11. Leave running for 2+ minutes → auto-restart keeps working
12. Error states: deny mic permission → shows "Permissão de microfone negada"

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: add meta tags for fullscreen readiness

Complete translate-talks app:
- Real-time speech transcription via Web Speech API
- Dark/light theme toggle with persistence
- Adjustable font size for projector visibility
- Auto-hiding controls for clean display
- Memory-safe: only keeps last 3 phrases
- Auto-restart on speech timeout"
```

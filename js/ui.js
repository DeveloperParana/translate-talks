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

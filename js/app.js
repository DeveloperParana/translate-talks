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

export type SpeechStatus = 'recording' | 'stopped';

export interface SpeechEngine {
  start(): void;
  stop(): void;
  readonly isRunning: boolean;
  readonly supported: boolean;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: string) => void;
  onStatusChange: (status: SpeechStatus) => void;
}

export function createSpeechEngine(): SpeechEngine {
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  if (!SpeechRecognition) {
    return {
      start() {},
      stop() {},
      get isRunning() { return false; },
      get supported() { return false; },
      onInterim: () => {},
      onFinal: () => {},
      onError: () => {},
      onStatusChange: () => {},
    };
  }

  let recognition: SpeechRecognition | null = null;
  let shouldRestart = false;
  let running = false;

  const engine: SpeechEngine = {
    onInterim: () => {},
    onFinal: () => {},
    onError: () => {},
    onStatusChange: () => {},

    get isRunning() { return running; },
    get supported() { return true; },

    start() {
      if (!recognition) initRecognition();
      shouldRestart = true;
      running = true;
      engine.onStatusChange('recording');
      try { recognition!.start(); } catch (_e) { /* already started */ }
    },

    stop() {
      shouldRestart = false;
      running = false;
      engine.onStatusChange('stopped');
      try { recognition?.stop(); } catch (_e) { /* already stopped */ }
    },
  };

  function initRecognition() {
    recognition = new SpeechRecognition!();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          engine.onFinal(transcript);
        } else {
          engine.onInterim(transcript);
        }
      }
    };

    recognition.onend = () => {
      if (shouldRestart) {
        setTimeout(() => {
          try { recognition!.start(); } catch (_e) { /* already running */ }
        }, 100);
      } else {
        running = false;
        engine.onStatusChange('stopped');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (['no-speech', 'aborted'].includes(event.error)) return;

      if (event.error === 'audio-capture' || event.error === 'network') {
        engine.onError(event.error);
        return;
      }

      shouldRestart = false;
      running = false;
      engine.onError(event.error);
      engine.onStatusChange('stopped');
    };
  }

  return engine;
}

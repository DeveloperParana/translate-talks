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
  let restartAttempts = 0;

  // Deduplication: buffer finals to merge progressive results
  let pendingFinal = '';
  let pendingFinalTimer: ReturnType<typeof setTimeout> | null = null;
  const FINAL_DEBOUNCE_MS = 400;

  const RESTART_BASE_DELAY = 150;
  const MAX_RESTART_ATTEMPTS = 5;

  function flushPendingFinal() {
    if (pendingFinalTimer) {
      clearTimeout(pendingFinalTimer);
      pendingFinalTimer = null;
    }
    if (pendingFinal) {
      engine.onFinal(pendingFinal);
      pendingFinal = '';
    }
  }

  const engine: SpeechEngine = {
    onInterim: () => {},
    onFinal: () => {},
    onError: () => {},
    onStatusChange: () => {},

    get isRunning() { return running; },
    get supported() { return true; },

    start() {
      shouldRestart = true;
      running = true;
      restartAttempts = 0;
      engine.onStatusChange('recording');
      safeStart();
    },

    stop() {
      shouldRestart = false;
      running = false;
      restartAttempts = 0;
      flushPendingFinal();
      engine.onStatusChange('stopped');
      try { recognition?.stop(); } catch (_e) { /* already stopped */ }
    },
  };

  function safeStart() {
    if (!shouldRestart) return;

    // Re-create instance if stale (after multiple failures)
    if (!recognition || restartAttempts >= 3) {
      initRecognition();
      restartAttempts = 0;
    }

    try {
      recognition!.start();
      restartAttempts = 0;
    } catch (_e) {
      restartAttempts++;
      if (restartAttempts < MAX_RESTART_ATTEMPTS) {
        const delay = RESTART_BASE_DELAY * Math.pow(2, restartAttempts - 1);
        setTimeout(safeStart, delay);
      } else {
        // Exhausted retries — re-create and try one last time
        initRecognition();
        restartAttempts = 0;
        try { recognition!.start(); } catch (_e2) {
          running = false;
          engine.onError('not-allowed');
          engine.onStatusChange('stopped');
        }
      }
    }
  }

  function initRecognition() {
    recognition = new SpeechRecognition!();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          // Check if this is a progressive update of a pending final
          const isProgressive = pendingFinal &&
            (transcript.startsWith(pendingFinal) || pendingFinal.startsWith(transcript));

          if (isProgressive) {
            // Replace buffer with the longer version
            if (pendingFinalTimer) clearTimeout(pendingFinalTimer);
            pendingFinal = transcript.length >= pendingFinal.length ? transcript : pendingFinal;
          } else {
            // Different phrase — flush any pending final first
            flushPendingFinal();
            pendingFinal = transcript;
          }

          // Debounce: wait for more progressive updates before emitting
          pendingFinalTimer = setTimeout(() => {
            if (pendingFinal) {
              engine.onFinal(pendingFinal);
              pendingFinal = '';
            }
            pendingFinalTimer = null;
          }, FINAL_DEBOUNCE_MS);
        } else {
          engine.onInterim(transcript);
        }
      }
    };

    recognition.onend = () => {
      if (shouldRestart) {
        flushPendingFinal();
        setTimeout(safeStart, RESTART_BASE_DELAY);
      } else {
        running = false;
        engine.onStatusChange('stopped');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (['no-speech', 'aborted'].includes(event.error)) return;

      if (event.error === 'network' || event.error === 'audio-capture') {
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

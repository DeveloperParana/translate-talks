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
            // already running
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
        return;
      }

      // not-allowed or other fatal errors
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

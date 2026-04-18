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

  // Chunking: linhas curtas para publico surdo.
  // - Soft: se passar de N palavras E houver micropausa, fecha a linha.
  // - Hard: se passar de M palavras sem pausa, fecha imediatamente.
  const CHUNK_SOFT_WORDS = 4;
  const CHUNK_HARD_WORDS = 9;
  const CHUNK_PAUSE_MS = 250;

  // Restart: Chrome precisa de tempo pra liberar o audio antes de outro start().
  const RESTART_BASE_DELAY = 100;
  const MAX_RESTART_ATTEMPTS = 5;

  // Dedupe entre sessoes: o continuous do Chrome reinicia e re-processa audio
  // sobreposto, emitindo finais progressivos (ex.: 'mas eu' -> 'mas eu poderia').
  // Bufferiza o ultimo final e, se o proximo for prefixo/superset, substitui em
  // vez de emitir duas vezes. Aplicado tambem aos chunks para cobrir o caso de
  // chunk emitido na sessao anterior reaparecer dentro de um final da nova.
  const FINAL_DEBOUNCE_MS = 400;
  let pendingFinal = '';
  let pendingFinalTimer: ReturnType<typeof setTimeout> | null = null;

  let recognition: SpeechRecognition | null = null;
  let shouldRestart = false;
  let running = false;
  let restartAttempts = 0;

  // Ultimo interim emitido para fora (dedupe contra re-renders redundantes).
  let lastInterim = '';
  // Palavras ja emitidas como pseudo-finais na enunciacao em andamento. Subtraido
  // do final real para nao duplicar texto.
  let consumedWords = 0;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;

  function clearPauseTimer() {
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
  }

  function flushPendingFinal() {
    if (pendingFinalTimer) {
      clearTimeout(pendingFinalTimer);
      pendingFinalTimer = null;
    }
    if (pendingFinal) {
      const toEmit = pendingFinal;
      pendingFinal = '';
      engine.onFinal(toEmit);
    }
  }

  // Roteia toda emissao de final pelo buffer de dedupe. Se o novo texto for
  // prefixo/superset do pendente, substitui (mantendo o mais longo). Caso
  // contrario, descarrega o pendente e bufferiza o novo. Em ambos os casos,
  // re-arma o debounce.
  function emitFinalBuffered(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const isProgressive = pendingFinal.length > 0 &&
      (trimmed.startsWith(pendingFinal) || pendingFinal.startsWith(trimmed));

    if (isProgressive) {
      if (trimmed.length > pendingFinal.length) pendingFinal = trimmed;
    } else {
      flushPendingFinal();
      pendingFinal = trimmed;
    }

    if (pendingFinalTimer) clearTimeout(pendingFinalTimer);
    pendingFinalTimer = setTimeout(() => {
      pendingFinalTimer = null;
      if (pendingFinal) {
        const toEmit = pendingFinal;
        pendingFinal = '';
        engine.onFinal(toEmit);
      }
    }, FINAL_DEBOUNCE_MS);
  }

  function commitChunk(chunkText: string) {
    const chunkTokens = chunkText.trim().split(/\s+/).filter(Boolean);
    if (chunkTokens.length === 0) return;
    consumedWords += chunkTokens.length;
    lastInterim = '';
    emitFinalBuffered(chunkText);
  }

  function resetUtteranceState() {
    lastInterim = '';
    consumedWords = 0;
    clearPauseTimer();
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
      resetUtteranceState();
      engine.onStatusChange('recording');
      safeStart();
    },

    stop() {
      shouldRestart = false;
      running = false;
      restartAttempts = 0;
      resetUtteranceState();
      flushPendingFinal();
      engine.onStatusChange('stopped');
      try { recognition?.stop(); } catch (_e) { /* already stopped */ }
    },
  };

  function safeStart() {
    if (!shouldRestart) return;

    // Recria a instancia se estiver velha (apos multiplas falhas seguidas).
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
        // Ultima tentativa apos esgotar retries.
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
      // Percorre apenas resultados novos a partir de resultIndex. Agrega todos
      // os nao-finais do evento em um unico interim (evita multiplas chamadas
      // redundantes quando o engine emite varios parciais no mesmo tick).
      let interimBuf = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          const tokens = transcript.trim().split(/\s+/).filter(Boolean);
          const start = Math.min(consumedWords, tokens.length);
          const text = tokens.slice(start).join(' ').trim();
          if (text) emitFinalBuffered(text);
          resetUtteranceState();
        } else {
          interimBuf += transcript;
        }
      }

      const fullInterim = interimBuf.trim();
      if (!fullInterim) return;

      const tokens = fullInterim.split(/\s+/).filter(Boolean);
      // Se a API revisou para menos palavras que ja consumimos, aguarda.
      if (tokens.length < consumedWords) return;

      const visibleTokens = tokens.slice(consumedWords);
      const visible = visibleTokens.join(' ');

      // Hard cap: fecha linha imediatamente, sem esperar pausa.
      if (visibleTokens.length >= CHUNK_HARD_WORDS) {
        clearPauseTimer();
        commitChunk(visible);
        return;
      }

      // Soft cap: agenda fechamento se houver pausa curta no discurso.
      if (visibleTokens.length >= CHUNK_SOFT_WORDS) {
        clearPauseTimer();
        const snapshot = visible;
        pauseTimer = setTimeout(() => {
          pauseTimer = null;
          commitChunk(snapshot);
        }, CHUNK_PAUSE_MS);
      } else {
        clearPauseTimer();
      }

      if (visible !== lastInterim) {
        lastInterim = visible;
        engine.onInterim(visible);
      }
    };

    recognition.onend = () => {
      if (shouldRestart) {
        // Nao descarrega o pendente aqui: queremos que um final progressivo da
        // proxima sessao possa substituir o buffer antes de emitir.
        setTimeout(safeStart, RESTART_BASE_DELAY);
      } else {
        running = false;
        flushPendingFinal();
        engine.onStatusChange('stopped');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ruidos comuns em continuous=true; onend cuida do restart.
      if (['no-speech', 'aborted'].includes(event.error)) return;

      // Transitorios: notifica mas mantem o auto-restart ligado.
      if (event.error === 'network' || event.error === 'audio-capture') {
        engine.onError(event.error);
        return;
      }

      // Fatais (not-allowed, service-not-allowed, language-not-supported, ...).
      shouldRestart = false;
      running = false;
      engine.onError(event.error);
      engine.onStatusChange('stopped');
    };
  }

  return engine;
}

import { correctTokens } from '../text-correct';
import type { VocabularyEntry } from '../vocabulary';
import type {
  OnDeviceStatus,
  SpeechAlternativeSnapshot,
  SpeechDebugEvent,
  SpeechEngine,
  SpeechEngineOptions,
} from './types';

// Lixo comum que o STT emite quando capta ruido sem fala clara. Tudo
// minusculo, sem acento, sem pontuacao. Comparacao e contra a versao
// normalizada do final.
const NOISE_FILLERS = new Set([
  'a', 'ah', 'aham', 'ahn', 'aii', 'aii a', 'an', 'e', 'eh', 'em', 'eu',
  'hm', 'hmm', 'hum', 'humm', 'ne', 'oh', 'ooh', 'opa', 'so', 'ta', 'tah',
  'ti', 'uh', 'uhm', 'uhum', 'um', 'uma', 'uns', 'uh uh',
]);

// Implementacao do SpeechEngine baseada em window.webkitSpeechRecognition
// (Chrome/Edge). Inclui:
//   - chunking por palavras com soft/hard cap pra legendas curtas
//   - dedupe entre sessoes (continuous reinicia e re-processa audio)
//   - selecao entre N alternativas via score do vocabulario
//   - correcao fuzzy pos-reconhecimento contra vocabulario de dominio
//   - on-device recognition (processLocally) quando disponivel: zero
//     round-trip pro servidor do Google
//   - debounce adaptativo: emite final imediatamente em sessao estavel e
//     so bufferiza dentro da janela de restart (onde duplicatas acontecem)
export function createWebSpeechEngine(options: SpeechEngineOptions = {}): SpeechEngine {
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  if (!SpeechRecognition) {
    return {
      start() {},
      stop() {},
      async installOnDevice() { return 'unsupported' as const; },
      get isRunning() { return false; },
      get supported() { return false; },
      get onDeviceStatus() { return 'unsupported' as const; },
      onInterim: () => {},
      onFinal: () => {},
      onError: () => {},
      onStatusChange: () => {},
      onOnDeviceStatusChange: () => {},
    };
  }

  // Vocabulario fica em closure mas pode ser zero-len; correctTokens trata.
  const vocabulary: VocabularyEntry[] = options.vocabulary ?? [];

  // Hook de debug. Push em array do chamador, custo desprezivel quando
  // ausente (curto-circuito antes de construir o evento).
  const onDebugEvent = options.onDebugEvent;
  const onOnDeviceStatusChangeOpt = options.onOnDeviceStatusChange;
  const debugStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  function debugTime(): number {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return now - debugStartedAt;
  }

  // Chunking: linhas curtas para publico surdo.
  // - Soft: se passar de N palavras E houver micropausa, fecha a linha.
  // - Hard: se passar de M palavras sem pausa, fecha imediatamente.
  const CHUNK_SOFT_WORDS = 30;
  const CHUNK_HARD_WORDS = 12;
  const CHUNK_PAUSE_MS = 150;

  // Restart: Chrome precisa de tempo pra liberar o audio antes de outro start().
  const RESTART_BASE_DELAY = 100;
  const MAX_RESTART_ATTEMPTS = 5;

  // Dedupe entre sessoes: o continuous do Chrome reinicia e re-processa audio
  // sobreposto, emitindo finais progressivos (ex.: 'mas eu' -> 'mas eu poderia').
  // Estrategia adaptativa: dentro de uma sessao estavel emite final na hora
  // (debounce 0). Apos onend, abre uma janela curta (RESTART_DEDUPE_WINDOW_MS)
  // onde finais sao bufferizados pra colapsar progressivos. Enquanto bufferiza,
  // o pendente e mostrado como interim pra latencia percebida ficar zero.
  const FINAL_DEBOUNCE_MS = 400;
  const RESTART_DEDUPE_WINDOW_MS = 1500;
  let pendingFinal = '';
  let pendingFinalTimer: ReturnType<typeof setTimeout> | null = null;
  let inRestartWindow = false;
  let restartWindowTimer: ReturnType<typeof setTimeout> | null = null;

  // Suporte on-device (Chrome 139+ via SpeechRecognition.available/install).
  // Caveats descobertos via probe automatizado contra Chrome 147 headless:
  //   1. pt-BR processLocally=true retorna 'downloadable' (modelo NAO vem
  //      pre-instalado no Chrome — precisa baixar via install()).
  //   2. install() FALHA com SecurityError quando availability='downloadable'
  //      e nao ha user gesture ativo. Mensagem exata do Chrome:
  //      "Failed to execute 'install' on 'SpeechRecognition': Requires
  //       handling a user gesture when availability is 'downloadable'."
  //   3. Por isso install() so e disparado dentro do callstack do start()
  //      (que e chamado a partir do click do usuario). Em onend (background)
  //      so consultamos available() pra ver se ja terminou de baixar.
  //   4. Quando install() resolve com sucesso, forcamos swap pra local.
  let processLocallyEnabled = false;
  let onDeviceStatus: OnDeviceStatus = 'unknown';
  let installInflight = false;
  // Marca se ja tentamos install() pelo menos uma vez. Bloqueia retentativas
  // automaticas em cada start() pra nao spammar a API quando o usuario
  // negou ou Chrome decidiu nao baixar.
  let installAttempted = false;

  function setOnDeviceStatus(next: OnDeviceStatus) {
    if (onDeviceStatus === next) return;
    onDeviceStatus = next;
    try { engine.onOnDeviceStatusChange(next); } catch (_e) { /* noop */ }
  }

  // Quantas alternativas pedir pro engine. Chrome ranqueia internamente (a
  // primeira costuma ser a melhor segundo o motor); usamos as N pra deixar o
  // vocabulario re-ranquear quando ele bate em alguma das alternativas
  // secundarias.
  const MAX_ALTERNATIVES = 5;

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

  function enterRestartWindow() {
    inRestartWindow = true;
    if (restartWindowTimer) clearTimeout(restartWindowTimer);
    restartWindowTimer = setTimeout(() => {
      inRestartWindow = false;
      restartWindowTimer = null;
      // Garante que nada fica preso quando a janela fecha sem novo final.
      flushPendingFinal();
    }, RESTART_DEDUPE_WINDOW_MS);
  }

  // Roteia toda emissao de final pelo buffer de dedupe. Em sessao estavel
  // (fora da janela de restart), emite imediato pra zerar latencia. Dentro
  // da janela, agrupa progressivos e mostra o pendente como interim pra
  // texto aparecer ja na tela enquanto o debounce protege contra duplicata.
  function emitFinalBuffered(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!inRestartWindow) {
      // Caminho rapido: nada de buffer. Mas descarrega qualquer pendente
      // anterior primeiro pra preservar ordem dos finais.
      flushPendingFinal();
      engine.onFinal(trimmed);
      return;
    }

    const isProgressive = pendingFinal.length > 0 &&
      (trimmed.startsWith(pendingFinal) || pendingFinal.startsWith(trimmed));

    if (isProgressive) {
      if (trimmed.length > pendingFinal.length) pendingFinal = trimmed;
    } else {
      flushPendingFinal();
      pendingFinal = trimmed;
    }

    // Mostra o pendente como interim agora: o usuario ve o texto sem esperar
    // o debounce. O commit final acontece depois e e idempotente visualmente
    // (o leitor renderiza interim como linha provisoria, e quando vira final
    // o texto ja esta na tela).
    if (pendingFinal !== lastInterim) {
      lastInterim = pendingFinal;
      engine.onInterim(pendingFinal);
    }

    if (pendingFinalTimer) clearTimeout(pendingFinalTimer);
    pendingFinalTimer = setTimeout(() => {
      pendingFinalTimer = null;
      if (pendingFinal) {
        const toEmit = pendingFinal;
        pendingFinal = '';
        // Limpa interim porque o final substitui (mestre/leitor trocam a
        // linha provisoria pelo commit final).
        lastInterim = '';
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

  interface PickedAlternative {
    index: number;
    transcript: string;
    score: number;
    correctedText: string;
    correctedHits: number;
    correctedScore: number;
  }

  // Escolhe a alternativa com melhor casamento contra o vocabulario, ja
  // retornando o texto corrigido + metadados pra debug. Sem vocabulario,
  // devolve a primeira alternativa (comportamento equivalente ao motor sem
  // vies). Empate por score: mantem a alternativa de menor indice (ranking
  // implicito do engine).
  function pickBestAlternative(result: SpeechRecognitionResult): PickedAlternative {
    const count = Math.min(result.length, MAX_ALTERNATIVES);
    if (count === 0) {
      return { index: 0, transcript: '', score: 0, correctedText: '', correctedHits: 0, correctedScore: 0 };
    }

    if (vocabulary.length === 0) {
      return {
        index: 0,
        transcript: result[0].transcript,
        score: 0,
        correctedText: result[0].transcript,
        correctedHits: 0,
        correctedScore: 0,
      };
    }

    let best: PickedAlternative = {
      index: 0,
      transcript: result[0].transcript,
      score: -1,
      correctedText: result[0].transcript,
      correctedHits: 0,
      correctedScore: 0,
    };

    for (let k = 0; k < count; k++) {
      const alt = result[k].transcript;
      const corrected = correctTokens(alt, vocabulary);
      // Pequeno bonus pra primeira alternativa: empata? engine ja a preferiu.
      const indexBonus = k === 0 ? 0.01 : 0;
      const score = corrected.score + indexBonus;
      if (score > best.score) {
        best = {
          index: k,
          transcript: alt,
          score,
          correctedText: corrected.text,
          correctedHits: corrected.hits,
          correctedScore: corrected.score,
        };
      }
    }

    return best;
  }

  // Filtro de ruido: barra finais que parecem lixo do STT capturando som
  // ambiente sem fala clara. Heuristica conservadora pra nao engolir
  // respostas legitimas curtas tipo "sim", "nao", "ola".
  // Drop quando: <= 2 palavras, sem hit no vocabulario, todas alternativas
  // com confidence < threshold (ou 0/NaN, comum em ruido), E o texto
  // normalizado bate com a lista de fillers conhecidos.
  function isLikelyNoise(picked: PickedAlternative, alternatives: SpeechAlternativeSnapshot[]): boolean {
    const text = picked.correctedText.trim();
    if (!text) return true;
    const tokens = text.split(/\s+/);
    if (tokens.length > 2) return false;
    if (picked.correctedHits > 0) return false;
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\s]/g, '')
      .trim();
    if (!NOISE_FILLERS.has(normalized)) return false;
    // Confidence eh ruim no Chrome (frequentemente 0); so usamos como sinal
    // adicional: se alguma alternativa tem confidence > 0.7 mantem.
    const hasHighConfidence = alternatives.some((alt) => alt.confidence > 0.7);
    return !hasHighConfidence;
  }

  function snapshotAlternatives(result: SpeechRecognitionResult): SpeechAlternativeSnapshot[] {
    const count = Math.min(result.length, MAX_ALTERNATIVES);
    const out: SpeechAlternativeSnapshot[] = [];
    for (let k = 0; k < count; k++) {
      out.push({
        transcript: result[k].transcript,
        confidence: typeof result[k].confidence === 'number' ? result[k].confidence : 0,
      });
    }
    return out;
  }

  const engine: SpeechEngine = {
    onInterim: () => {},
    onFinal: () => {},
    onError: () => {},
    onStatusChange: () => {},
    // Inicializa com o handler vindo de options pra capturar transicoes
    // que acontecem antes do chamador atribuir manualmente. Pode ser
    // sobrescrito depois (setter padrao do objeto).
    onOnDeviceStatusChange: onOnDeviceStatusChangeOpt ?? (() => {}),

    get isRunning() { return running; },
    get supported() { return true; },
    get onDeviceStatus() { return onDeviceStatus; },

    // Tentativa explicita de instalar o modelo on-device. Deve ser chamado
    // dentro de um event handler de clique. Retorna o status apos a
    // tentativa pra UI atualizar feedback.
    async installOnDevice(): Promise<OnDeviceStatus> {
      const SR = SpeechRecognition!;
      if (typeof SR.available !== 'function' || typeof SR.install !== 'function') {
        setOnDeviceStatus('unsupported');
        return onDeviceStatus;
      }
      try {
        const status = await SR.available({ langs: ['pt-BR'], processLocally: true });
        if (status === 'available') {
          processLocallyEnabled = true;
          setOnDeviceStatus('installed');
          swapToLocalIfRunning();
          return onDeviceStatus;
        }
        if (status === 'unavailable') {
          setOnDeviceStatus('unavailable');
          return onDeviceStatus;
        }
        // 'downloadable' ou 'downloading' -> chama install. install()
        // requer user gesture quando 'downloadable'; chamada feita aqui
        // PRESERVA gesture porque foi disparada do click do usuario.
        setOnDeviceStatus(status === 'downloading' ? 'downloading' : 'downloadable');
        installInflight = true;
        installAttempted = true;
        setOnDeviceStatus('downloading');
        try {
          const installed = await SR.install({ langs: ['pt-BR'], processLocally: true });
          installInflight = false;
          if (installed) {
            processLocallyEnabled = true;
            setOnDeviceStatus('installed');
            swapToLocalIfRunning();
          } else {
            setOnDeviceStatus('unavailable');
          }
        } catch (_e) {
          installInflight = false;
          // install falhou (gesture perdido, network, etc.). Nao tenta de
          // novo automaticamente; usuario pode chamar de novo via UI.
          setOnDeviceStatus('downloadable');
        }
        return onDeviceStatus;
      } catch (_e) {
        setOnDeviceStatus('unsupported');
        return onDeviceStatus;
      }
    },

    start() {
      shouldRestart = true;
      running = true;
      restartAttempts = 0;
      resetUtteranceState();
      engine.onStatusChange('recording');
      // Boot do on-device aproveita o user gesture do click. Sync (nao
      // bloqueia o safeStart) — se modelo precisa baixar, install() roda
      // em background mas com gesture valido.
      bootstrapOnDevice();
      safeStart();
    },

    stop() {
      shouldRestart = false;
      running = false;
      restartAttempts = 0;
      resetUtteranceState();
      if (restartWindowTimer) {
        clearTimeout(restartWindowTimer);
        restartWindowTimer = null;
      }
      inRestartWindow = false;
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

  // Bootstrap on-device chamado a partir de start() (user gesture vivo).
  // Se modelo ja existe local: ativa imediatamente. Se 'downloadable':
  // dispara install() na mesma stack pra preservar transient activation.
  // Se nao suportado: marca status pra UI esconder controles relacionados.
  function bootstrapOnDevice() {
    if (processLocallyEnabled || installInflight) return;
    const SR = SpeechRecognition!;
    if (typeof SR.available !== 'function') {
      setOnDeviceStatus('unsupported');
      return;
    }
    SR.available({ langs: ['pt-BR'], processLocally: true })
      .then((status) => {
        if (status === 'available') {
          processLocallyEnabled = true;
          setOnDeviceStatus('installed');
          swapToLocalIfRunning();
          return;
        }
        if (status === 'unavailable') {
          setOnDeviceStatus('unavailable');
          return;
        }
        if (status === 'downloading') {
          setOnDeviceStatus('downloading');
          return;
        }
        setOnDeviceStatus('downloadable');
        // Auto-install best-effort: alguns Chromes preservam transient
        // activation por ate 5s atraves de microtasks. Se a janela fechou,
        // o erro eh capturado e UI pode oferecer botao manual.
        if (typeof SR.install !== 'function' || installAttempted) return;
        installInflight = true;
        installAttempted = true;
        setOnDeviceStatus('downloading');
        SR.install({ langs: ['pt-BR'], processLocally: true })
          .then((installed) => {
            installInflight = false;
            if (installed) {
              processLocallyEnabled = true;
              setOnDeviceStatus('installed');
              swapToLocalIfRunning();
            } else {
              setOnDeviceStatus('unavailable');
            }
          })
          .catch(() => {
            installInflight = false;
            // Provavel SecurityError por gesture expirado. Volta pra
            // 'downloadable' pra UI mostrar botao manual.
            setOnDeviceStatus('downloadable');
          });
      })
      .catch(() => { setOnDeviceStatus('unsupported'); });
  }

  // Re-checa o status apos onend (pode ter terminado download durante a
  // sessao). Sem chamar install() — onend NAO tem user gesture.
  function recheckOnDeviceBackground() {
    if (processLocallyEnabled || installInflight) return;
    const SR = SpeechRecognition!;
    if (typeof SR.available !== 'function') return;
    if (onDeviceStatus !== 'downloading' && onDeviceStatus !== 'downloadable') return;
    SR.available({ langs: ['pt-BR'], processLocally: true })
      .then((status) => {
        if (status === 'available') {
          processLocallyEnabled = true;
          setOnDeviceStatus('installed');
          swapToLocalIfRunning();
        } else if (status === 'downloading') {
          setOnDeviceStatus('downloading');
        } else if (status === 'downloadable') {
          setOnDeviceStatus('downloadable');
        }
      })
      .catch(() => { /* keep current status */ });
  }

  // Forca um restart pra reinstanciar com processLocally=true. Para a
  // instancia atual (cloud), descarta o handle pra forcar nova criacao no
  // proximo safeStart, e abre janela de dedupe pra absorver sobreposicao
  // entre as sessoes cloud->local.
  function swapToLocalIfRunning() {
    if (!running || !recognition) return;
    const old = recognition;
    recognition = null;
    enterRestartWindow();
    try { old.stop(); } catch (_e) { /* ignore */ }
    // Se onend nao disparar (instancia ja sumindo), garantimos restart.
    setTimeout(safeStart, RESTART_BASE_DELAY);
  }

  function initRecognition() {
    recognition = new SpeechRecognition!();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = MAX_ALTERNATIVES;
    if (processLocallyEnabled) {
      // Browsers antigos ignoram silenciosamente; ja garantimos via flag.
      recognition.processLocally = true;
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Percorre apenas resultados novos a partir de resultIndex. Agrega todos
      // os nao-finais do evento em um unico interim (evita multiplas chamadas
      // redundantes quando o engine emite varios parciais no mesmo tick).
      let interimBuf = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const picked = pickBestAlternative(result);
          const alternatives = onDebugEvent ? snapshotAlternatives(result) : [];

          const tokens = picked.correctedText.trim().split(/\s+/).filter(Boolean);
          const start = Math.min(consumedWords, tokens.length);
          const text = tokens.slice(start).join(' ').trim();

          // Filtro de ruido aplicado depois da subtracao de chunks ja
          // emitidos (evita classificar como ruido um sufixo legitimo curto
          // que sobrou apos o chunking).
          if (text && isLikelyNoise({ ...picked, correctedText: text }, alternatives)) {
            if (onDebugEvent) {
              onDebugEvent({
                t: debugTime(),
                resultIndex: i,
                isFinal: true,
                alternatives,
                picked: { index: picked.index, transcript: picked.transcript, score: picked.score },
                corrected: { text: picked.correctedText, hits: picked.correctedHits, score: picked.correctedScore },
                emitted: { kind: 'dropped', text, reason: 'noise-filter' },
                processLocally: processLocallyEnabled,
              });
            }
            resetUtteranceState();
            continue;
          }

          if (text) emitFinalBuffered(text);

          if (onDebugEvent) {
            onDebugEvent({
              t: debugTime(),
              resultIndex: i,
              isFinal: true,
              alternatives,
              picked: { index: picked.index, transcript: picked.transcript, score: picked.score },
              corrected: { text: picked.correctedText, hits: picked.correctedHits, score: picked.correctedScore },
              emitted: text ? { kind: 'final', text } : { kind: 'dropped', text: '', reason: 'empty-after-chunk-subtract' },
              processLocally: processLocallyEnabled,
            });
          }

          resetUtteranceState();
        } else {
          // Interim raramente traz alternativas alem da primeira; correcao
          // fuzzy roda direto no transcript do top-1.
          interimBuf += result[0].transcript;
        }
      }

      const fullInterim = interimBuf.trim();
      if (!fullInterim) return;

      const correctedInterim = vocabulary.length > 0
        ? correctTokens(fullInterim, vocabulary).text
        : fullInterim;

      const tokens = correctedInterim.split(/\s+/).filter(Boolean);
      // Se a API revisou para menos palavras que ja consumimos, aguarda.
      if (tokens.length < consumedWords) return;

      const visibleTokens = tokens.slice(consumedWords);
      const visible = visibleTokens.join(' ');

      // Hard cap: fecha linha imediatamente, sem esperar pausa.
      if (visibleTokens.length >= CHUNK_HARD_WORDS) {
        clearPauseTimer();
        commitChunk(visible);
        if (onDebugEvent) {
          onDebugEvent({
            t: debugTime(),
            resultIndex: event.resultIndex,
            isFinal: false,
            alternatives: [{ transcript: fullInterim, confidence: 0 }],
            corrected: { text: correctedInterim, hits: 0, score: 0 },
            emitted: { kind: 'final', text: visible, reason: 'hard-cap' },
            processLocally: processLocallyEnabled,
          });
        }
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
        if (onDebugEvent) {
          onDebugEvent({
            t: debugTime(),
            resultIndex: event.resultIndex,
            isFinal: false,
            alternatives: [{ transcript: fullInterim, confidence: 0 }],
            corrected: { text: correctedInterim, hits: 0, score: 0 },
            emitted: { kind: 'interim', text: visible },
            processLocally: processLocallyEnabled,
          });
        }
      }
    };

    recognition.onend = () => {
      if (shouldRestart) {
        // Abre janela de dedupe: a proxima sessao tipicamente re-emite audio
        // sobreposto. Dentro da janela, finais sao agrupados; fora, vao
        // direto pra tela com latencia zero.
        enterRestartWindow();
        // Re-checa on-device caso o download tenha completado entre sessoes.
        // Background-only: NAO chama install (sem user gesture aqui).
        recheckOnDeviceBackground();
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

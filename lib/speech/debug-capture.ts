import type { SpeechDebugEvent } from './types';

// Captura de debug: grava o audio do mic em paralelo com a transcricao e
// agrega os eventos estruturados emitidos pelo engine. Ao parar, baixa
// dois arquivos:
//   - speech-debug-<ts>.webm  - audio bruto (com noise suppression aplicada)
//   - speech-debug-<ts>.json  - log de eventos + metadados da sessao
// Util pra correlacionar "o que o orador disse" vs "o que cada etapa da
// pipeline produziu" (engine -> picker -> corretor fuzzy -> dedupe).
//
// Constraints de mic incluem noiseSuppression/echoCancellation/AGC. Isso
// nao afeta o pipeline da SpeechRecognition (que abre seu proprio capture
// com defaults do Chrome, ja com noise suppression desde Chrome 80+) mas
// garante que o audio gravado pra auditoria seja limpo.

export interface DebugCaptureMeta {
  startedAt: string;
  durationMs: number;
  userAgent: string;
  vocabularySize: number;
  notes?: string;
}

export interface DebugCaptureResult {
  audio: Blob;
  events: SpeechDebugEvent[];
  meta: DebugCaptureMeta;
}

export interface DebugCaptureSession {
  pushEvent(event: SpeechDebugEvent): void;
  stop(): Promise<DebugCaptureResult>;
  abort(): void;
}

const SPEECH_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  channelCount: 1,
};

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'audio/webm';
}

export async function startDebugCapture(opts: { vocabularySize: number; notes?: string }): Promise<DebugCaptureSession> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    throw new Error('mediaDevices indisponivel');
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder indisponivel');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: SPEECH_AUDIO_CONSTRAINTS });
  const events: SpeechDebugEvent[] = [];
  const chunks: Blob[] = [];
  const startedAtMs = performance.now();
  const startedAtIso = new Date().toISOString();
  const mimeType = pickMimeType();

  const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(1000);

  const releaseStream = () => {
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    pushEvent(event) {
      events.push(event);
    },
    abort() {
      try { recorder.stop(); } catch (_e) { /* ignore */ }
      releaseStream();
    },
    stop() {
      return new Promise<DebugCaptureResult>((resolve, reject) => {
        recorder.onstop = () => {
          try {
            const audio = new Blob(chunks, { type: mimeType });
            const meta: DebugCaptureMeta = {
              startedAt: startedAtIso,
              durationMs: performance.now() - startedAtMs,
              userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
              vocabularySize: opts.vocabularySize,
              notes: opts.notes,
            };
            releaseStream();
            resolve({ audio, events, meta });
          } catch (e) {
            releaseStream();
            reject(e);
          }
        };
        try {
          recorder.stop();
        } catch (e) {
          releaseStream();
          reject(e);
        }
      });
    },
  };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Atraso pra garantir que o navegador iniciou o download antes de revogar.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadDebugSession(result: DebugCaptureResult): void {
  const ts = result.meta.startedAt.replace(/[:.]/g, '-');
  triggerDownload(result.audio, `speech-debug-${ts}.webm`);
  const payload = {
    meta: result.meta,
    events: result.events,
  };
  const json = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(json, `speech-debug-${ts}.json`);
}

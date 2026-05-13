import { createWebSpeechEngine } from './web-speech';
import type { SpeechEngine, SpeechEngineOptions } from './types';

export type {
  SpeechEngine,
  SpeechEngineOptions,
  SpeechStatus,
  SpeechEngineFactory,
  SpeechDebugEvent,
  SpeechAlternativeSnapshot,
  OnDeviceStatus,
} from './types';

// Selecao do engine. Hoje so existe Web Speech (gratis, no client). Quando
// novos engines (Whisper streaming, Deepgram, Vosk via WASM) forem
// contribuidos, este switch passa a olhar NEXT_PUBLIC_SPEECH_ENGINE pra
// permitir trocar via env sem refactor no chamador.
export function createSpeechEngine(options?: SpeechEngineOptions): SpeechEngine {
  return createWebSpeechEngine(options);
}

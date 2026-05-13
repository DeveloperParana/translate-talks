import type { VocabularyEntry } from '../vocabulary';

export type SpeechStatus = 'recording' | 'stopped';

// Estados do reconhecimento on-device (Chrome 139+ API SpeechRecognition.available/install).
//   - 'unknown': ainda nao foi detectado.
//   - 'unsupported': navegador nao expoe SR.available (Chrome <139, Firefox, Safari).
//   - 'unavailable': Chrome diz que nao tem suporte pra esse idioma local.
//   - 'downloadable': modelo precisa ser baixado; install() requer user gesture.
//   - 'downloading': download em andamento; ainda em cloud nessa sessao.
//   - 'installed': modelo pronto e em uso (processLocally=true ativo).
export type OnDeviceStatus =
  | 'unknown'
  | 'unsupported'
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'installed';

export interface SpeechEngine {
  start(): void;
  stop(): void;
  readonly isRunning: boolean;
  readonly supported: boolean;
  // Status atual do on-device. UI consulta pra mostrar badge e decidir se
  // oferece botao de "Baixar modelo on-device" (que precisa user gesture).
  readonly onDeviceStatus: OnDeviceStatus;
  // Forca tentativa de instalar o modelo on-device. Deve ser chamado em
  // resposta a um clique do usuario (transient activation). Idempotente:
  // se ja instalado, no-op; se em download, retorna o status atual.
  installOnDevice(): Promise<OnDeviceStatus>;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: string) => void;
  onStatusChange: (status: SpeechStatus) => void;
  onOnDeviceStatusChange: (status: OnDeviceStatus) => void;
}

// Snapshot bruto de uma alternativa do engine. Usado pra debug e pra
// auditoria offline (compara o que o STT entregou com o que emitimos).
export interface SpeechAlternativeSnapshot {
  transcript: string;
  confidence: number;
}

// Evento estruturado de debug: cobre tudo que aconteceu num onresult,
// do que o engine entregou ate o que foi pra rede. Permite diagnosticar
// onde o erro nasceu (engine, picker, corretor fuzzy, dedupe, chunking)
// sem precisar reproduzir o audio.
export interface SpeechDebugEvent {
  // Tempo relativo ao inicio da sessao de debug, em ms.
  t: number;
  resultIndex: number;
  isFinal: boolean;
  alternatives: SpeechAlternativeSnapshot[];
  picked?: { index: number; transcript: string; score: number };
  corrected?: { text: string; hits: number; score: number };
  emitted?: { kind: 'interim' | 'final' | 'dropped'; text: string; reason?: string };
  // Indica se a sessao atual esta usando reconhecimento on-device (Chrome 139+).
  processLocally: boolean;
}

export interface SpeechEngineOptions {
  // Vocabulario passado pra correcao pos-reconhecimento e selecao entre
  // alternativas. Engines que nao usam (ex.: STT server-side com biasing
  // nativo) podem ignorar.
  vocabulary?: VocabularyEntry[];
  // Hook opcional pra capturar eventos de debug sem afetar a pipeline. O
  // engine deve invocar de forma assincrona/baixo-custo (push em array).
  onDebugEvent?: (event: SpeechDebugEvent) => void;
  // Recebe transicoes de estado do on-device (downloadable -> downloading
  // -> installed). UI usa pra decidir banner de download e badge.
  onOnDeviceStatusChange?: (status: OnDeviceStatus) => void;
}

export type SpeechEngineFactory = (options?: SpeechEngineOptions) => SpeechEngine;

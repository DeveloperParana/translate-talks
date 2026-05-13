interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  // On-device recognition flag (Chrome 139+). Quando true, evita round-trip
  // pro servidor do Google e reduz latencia drasticamente.
  processLocally?: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable';

interface SpeechRecognitionAvailabilityOptions {
  langs: string[];
  processLocally?: boolean;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
  // APIs estaticas adicionadas no Chrome 139+ pra reconhecimento on-device.
  // Marcadas como opcionais porque rodamos em browsers antigos tambem.
  available?: (
    options: SpeechRecognitionAvailabilityOptions,
  ) => Promise<SpeechRecognitionAvailability>;
  install?: (
    options: SpeechRecognitionAvailabilityOptions,
  ) => Promise<boolean>;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

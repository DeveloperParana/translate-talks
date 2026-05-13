'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSpeechEngine } from '@/lib/speech';
import type { OnDeviceStatus, SpeechDebugEvent } from '@/lib/speech';
import {
  startDebugCapture,
  downloadDebugSession,
  type DebugCaptureSession,
} from '@/lib/speech/debug-capture';
import { supabase } from '@/lib/supabase';
import { getRoomChannel } from '@/lib/room';
import type { Phrase } from '@/components/transcript-display';
import { TranscriptDisplay } from '@/components/transcript-display';
import { ControlsBar } from '@/components/controls-bar';
import { RoomCodeDisplay } from '@/components/room-code-display';
import { VocabularyModal } from '@/components/vocabulary-modal';
import {
  BASE_VOCABULARY,
  loadRoomVocabulary,
  mergeVocabularies,
  type VocabularyEntry,
} from '@/lib/vocabulary';

const MAX_PHRASES = 5;
const MIN_FONT_SIZE = 24;
const MAX_FONT_SIZE = 96;
const FONT_STEP = 8;
const DEFAULT_FONT_SIZE = 48;

function countPresence(state: Record<string, unknown[]>): { total: number } {
  let total = 0;
  for (const presences of Object.values(state)) {
    total += presences.length;
  }
  return { total };
}

function formatTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function MestrePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState<'recording' | 'stopped'>('stopped');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [theme, setTheme] = useState('dark');
  const [errorText, setErrorText] = useState('');
  const [connectedCount, setConnectedCount] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>(BASE_VOCABULARY);
  const [showVocabModal, setShowVocabModal] = useState(false);
  const [debugRecording, setDebugRecording] = useState(false);
  const [onDeviceStatus, setOnDeviceStatus] = useState<OnDeviceStatus>('unknown');

  // Engine recriado quando o vocabulario muda (efeito abaixo). Ref guarda a
  // instancia ativa pra os callbacks de UI sem disparar re-render.
  const speechRef = useRef<ReturnType<typeof createSpeechEngine> | null>(null);

  // Sessao de debug ativa (audio + log). Ref pra nao re-renderizar a cada
  // evento; o engine empurra direto via callback estavel abaixo.
  const debugSessionRef = useRef<DebugCaptureSession | null>(null);
  const handleDebugEventRef = useRef<((event: SpeechDebugEvent) => void) | undefined>(undefined);
  handleDebugEventRef.current = (event) => {
    debugSessionRef.current?.pushEvent(event);
  };

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  if (channelRef.current === null) channelRef.current = supabase.channel(getRoomChannel(code));

  const myIdRef = useRef(crypto.randomUUID());
  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInterimRef = useRef<string | null>(null);
  const phraseIdRef = useRef(0);

  useEffect(() => {
    setTheme(localStorage.getItem('tt-theme') || 'dark');
    const saved = parseInt(localStorage.getItem('tt-fontSize') || '', 10);
    if (saved >= MIN_FONT_SIZE && saved <= MAX_FONT_SIZE) setFontSize(saved);
    setVocabulary(mergeVocabularies(BASE_VOCABULARY, loadRoomVocabulary(code)));
  }, [code]);

  useEffect(() => {
    const goOffline = () => setConnectionError('Sem conexão com a internet');
    const goOnline = () => setConnectionError('');
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if (!navigator.onLine) goOffline();
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  useEffect(() => {
    const channel = channelRef.current!;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const { total } = countPresence(state);
      setConnectedCount(total);

      // Collect all mestre IDs
      const mestreIds: string[] = [];
      for (const presences of Object.values(state)) {
        for (const p of presences) {
          const pr = p as { role?: string; id?: string };
          if (pr.role === 'mestre' && pr.id) {
            mestreIds.push(pr.id);
          }
        }
      }

      // If multiple mestres, only the earliest (smallest) ID stays
      if (mestreIds.length > 1) {
        mestreIds.sort();
        if (mestreIds[0] !== myIdRef.current) {
          setBlocked(true);
        }
      }
    });

    channel.subscribe(async (channelStatus) => {
      if (channelStatus === 'SUBSCRIBED') {
        await channel.track({ role: 'mestre', id: myIdRef.current });
      }
    });

    return () => {
      if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const channel = channelRef.current!;
    // Se ja existia engine (vocabulario mudou em runtime), preserva o estado
    // de gravacao pra reiniciar o novo engine na mesma sessao.
    const wasRunning = speechRef.current?.isRunning ?? false;
    if (speechRef.current) {
      speechRef.current.stop();
    }

    const speech = createSpeechEngine({
      vocabulary,
      // Indireciona pelo ref pra sobreviver a recriacoes da engine sem
      // perder eventos quando o debug ja esta ativo.
      onDebugEvent: (event) => handleDebugEventRef.current?.(event),
      onOnDeviceStatusChange: (s) => setOnDeviceStatus(s),
    });
    speechRef.current = speech;
    setOnDeviceStatus(speech.onDeviceStatus);

    speech.onFinal = (text: string) => {
      const time = formatTime();
      const id = ++phraseIdRef.current;
      setPhrases((prev) => {
        const next = [...prev, { id, text, time }];
        return next.length > MAX_PHRASES ? next.slice(-MAX_PHRASES) : next;
      });
      setInterimText('');
      // Cancel pending interim broadcast since final supersedes it
      if (interimTimerRef.current) {
        clearTimeout(interimTimerRef.current);
        interimTimerRef.current = null;
      }
      pendingInterimRef.current = null;
      channel.send({ type: 'broadcast', event: 'final', payload: { text, time } });
    };

    speech.onInterim = (text: string) => {
      setInterimText(text);
      // Throttle broadcast to leitores (150ms) to avoid flooding Supabase
      pendingInterimRef.current = text;
      if (!interimTimerRef.current) {
        interimTimerRef.current = setTimeout(() => {
          if (pendingInterimRef.current !== null) {
            channel.send({ type: 'broadcast', event: 'interim', payload: { text: pendingInterimRef.current } });
          }
          interimTimerRef.current = null;
        }, 150);
      }
    };

    speech.onStatusChange = (s) => setStatus(s);

    speech.onError = (error: string) => {
      const messages: Record<string, string> = {
        'audio-capture': 'Microfone não detectado',
        'not-allowed': 'Permissão de microfone negada',
        'network': 'Sem conexão com serviço de transcrição',
      };
      setErrorText(messages[error] || `Erro: ${error}`);
      setTimeout(() => setErrorText(''), 5000);
    };

    if (wasRunning) speech.start();

    return () => {
      speech.stop();
    };
  }, [vocabulary]);

  const handleToggle = useCallback(() => {
    const speech = speechRef.current!;
    if (speech.isRunning) { speech.stop(); } else { speech.start(); }
  }, []);

  const handleThemeToggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('tt-theme', next);
      return next;
    });
  }, []);

  const handleFontUp = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.min(MAX_FONT_SIZE, prev + FONT_STEP);
      localStorage.setItem('tt-fontSize', String(next));
      return next;
    });
  }, []);

  const handleFontDown = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.max(MIN_FONT_SIZE, prev - FONT_STEP);
      localStorage.setItem('tt-fontSize', String(next));
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setPhrases([]);
    setInterimText('');
    channelRef.current!.send({ type: 'broadcast', event: 'clear', payload: {} });
  }, []);

  const handleVocabulary = useCallback(() => {
    setShowVocabModal(true);
  }, []);

  const handleVocabularySaved = useCallback((entries: VocabularyEntry[]) => {
    setVocabulary(mergeVocabularies(BASE_VOCABULARY, entries));
  }, []);

  const handleInstallOnDevice = useCallback(async () => {
    const speech = speechRef.current;
    if (!speech) return;
    try {
      await speech.installOnDevice();
    } catch (err) {
      setErrorText(`Falha ao baixar modelo on-device: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setErrorText(''), 5000);
    }
  }, []);

  const handleDebugToggle = useCallback(async () => {
    if (debugSessionRef.current) {
      const session = debugSessionRef.current;
      debugSessionRef.current = null;
      setDebugRecording(false);
      try {
        const result = await session.stop();
        downloadDebugSession(result);
      } catch (err) {
        setErrorText(`Falha ao salvar debug: ${err instanceof Error ? err.message : String(err)}`);
        setTimeout(() => setErrorText(''), 5000);
      }
      return;
    }
    try {
      const session = await startDebugCapture({ vocabularySize: vocabulary.length });
      debugSessionRef.current = session;
      setDebugRecording(true);
    } catch (err) {
      setErrorText(`Não foi possível iniciar debug: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setErrorText(''), 5000);
    }
  }, [vocabulary.length]);

  // Garante que a sessao de debug eh fechada (audio liberado, log perdido)
  // se o usuario sair da pagina sem clicar em parar.
  useEffect(() => {
    return () => {
      if (debugSessionRef.current) {
        debugSessionRef.current.abort();
        debugSessionRef.current = null;
      }
    };
  }, []);

  if (blocked) {
    return (
      <div className="home">
        <img src="/devparana.svg" alt="DevParaná" className="home-logo" />
        <h1>Sala Ocupada</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '18px', textAlign: 'center', maxWidth: '400px' }}>
          Já existe um mestre nesta sala. Apenas um mestre pode transmitir por vez.
        </p>
        <button className="btn-primary" style={{ maxWidth: '320px' }} onClick={() => router.push('/')}>
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <>
      <ControlsBar status={status} onToggle={handleToggle} showMicButton={true}
        roomCode={code} theme={theme} onThemeToggle={handleThemeToggle}
        onFontUp={handleFontUp} onFontDown={handleFontDown}
        connectedCount={connectedCount} onClear={handleClear}
        onVocabulary={handleVocabulary}
        onDebugToggle={handleDebugToggle} debugRecording={debugRecording}
        onDeviceStatus={onDeviceStatus} onInstallOnDevice={handleInstallOnDevice}
        connectionError={connectionError} />
      <TranscriptDisplay phrases={phrases} interimText={errorText || interimText} fontSize={fontSize} />
      <RoomCodeDisplay code={code} />
      <VocabularyModal roomCode={code} open={showVocabModal}
        onClose={() => setShowVocabModal(false)} onSaved={handleVocabularySaved} />
    </>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSpeechEngine } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import { getRoomChannel } from '@/lib/room';
import { TranscriptDisplay } from '@/components/transcript-display';
import { ControlsBar } from '@/components/controls-bar';
import { RoomCodeDisplay } from '@/components/room-code-display';

const MAX_PHRASES = 3;
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

export default function MestrePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [phrases, setPhrases] = useState<string[]>([]);
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState<'recording' | 'stopped'>('stopped');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [theme, setTheme] = useState('dark');
  const [errorText, setErrorText] = useState('');
  const [connectedCount, setConnectedCount] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const speechRef = useRef(createSpeechEngine());
  const channelRef = useRef(supabase.channel(getRoomChannel(code)));
  const myIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    setTheme(localStorage.getItem('tt-theme') || 'dark');
    const saved = parseInt(localStorage.getItem('tt-fontSize') || '', 10);
    if (saved >= MIN_FONT_SIZE && saved <= MAX_FONT_SIZE) setFontSize(saved);
  }, []);

  useEffect(() => {
    const channel = channelRef.current;

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

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const speech = speechRef.current;
    const channel = channelRef.current;

    speech.onFinal = (text: string) => {
      setPhrases((prev) => {
        const next = [...prev, text];
        return next.length > MAX_PHRASES ? next.slice(-MAX_PHRASES) : next;
      });
      setInterimText('');
      channel.send({ type: 'broadcast', event: 'final', payload: { text } });
    };

    speech.onInterim = (text: string) => {
      setInterimText(text);
      channel.send({ type: 'broadcast', event: 'interim', payload: { text } });
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
  }, []);

  const handleToggle = useCallback(() => {
    const speech = speechRef.current;
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
        connectedCount={connectedCount} />
      <TranscriptDisplay phrases={phrases} interimText={errorText || interimText} fontSize={fontSize} />
      <RoomCodeDisplay code={code} />
    </>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
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

export default function MestrePage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [phrases, setPhrases] = useState<string[]>([]);
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState<'recording' | 'stopped'>('stopped');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [theme, setTheme] = useState('dark');
  const [errorText, setErrorText] = useState('');

  const speechRef = useRef(createSpeechEngine());
  const channelRef = useRef(supabase.channel(getRoomChannel(code)));

  useEffect(() => {
    setTheme(localStorage.getItem('tt-theme') || 'dark');
    const saved = parseInt(localStorage.getItem('tt-fontSize') || '', 10);
    if (saved >= MIN_FONT_SIZE && saved <= MAX_FONT_SIZE) setFontSize(saved);
  }, []);

  useEffect(() => {
    const channel = channelRef.current;
    channel.subscribe();
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

  return (
    <>
      <ControlsBar status={status} onToggle={handleToggle} showMicButton={true}
        roomCode={code} theme={theme} onThemeToggle={handleThemeToggle}
        onFontUp={handleFontUp} onFontDown={handleFontDown} />
      <TranscriptDisplay phrases={phrases} interimText={errorText || interimText} fontSize={fontSize} />
      <RoomCodeDisplay code={code} />
    </>
  );
}

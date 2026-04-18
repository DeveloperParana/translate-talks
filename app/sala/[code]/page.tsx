'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getRoomChannel } from '@/lib/room';
import { TranscriptDisplay } from '@/components/transcript-display';
import { ControlsBar } from '@/components/controls-bar';

const MAX_PHRASES = 3;
const MIN_FONT_SIZE = 24;
const MAX_FONT_SIZE = 96;
const FONT_STEP = 8;
const DEFAULT_FONT_SIZE = 48;

function countPresence(state: Record<string, unknown[]>): number {
  let total = 0;
  for (const presences of Object.values(state)) {
    total += presences.length;
  }
  return total;
}

export default function LeitorPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [phrases, setPhrases] = useState<string[]>([]);
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [theme, setTheme] = useState('dark');
  const [connectedCount, setConnectedCount] = useState(0);

  useEffect(() => {
    setTheme(localStorage.getItem('tt-theme') || 'dark');
    const saved = parseInt(localStorage.getItem('tt-fontSize') || '', 10);
    if (saved >= MIN_FONT_SIZE && saved <= MAX_FONT_SIZE) setFontSize(saved);
  }, []);

  useEffect(() => {
    const channel = supabase.channel(getRoomChannel(code));

    channel
      .on('broadcast', { event: 'final' }, ({ payload }) => {
        setPhrases((prev) => {
          const next = [...prev, payload.text];
          return next.length > MAX_PHRASES ? next.slice(-MAX_PHRASES) : next;
        });
        setInterimText('');
      })
      .on('broadcast', { event: 'interim' }, ({ payload }) => {
        setInterimText(payload.text);
      })
      .on('presence', { event: 'sync' }, () => {
        setConnectedCount(countPresence(channel.presenceState()));
      })
      .subscribe(async (channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          setStatus('connected');
          await channel.track({ role: 'leitor' });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [code]);

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
      <ControlsBar status={status} showMicButton={false} roomCode={code}
        theme={theme} onThemeToggle={handleThemeToggle}
        onFontUp={handleFontUp} onFontDown={handleFontDown}
        connectedCount={connectedCount} />
      <TranscriptDisplay phrases={phrases} interimText={interimText} fontSize={fontSize}
        waitingMessage="Aguardando mestre iniciar a transcrição..." />
    </>
  );
}

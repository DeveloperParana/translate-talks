'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'recording' | 'stopped' | 'connected' | 'disconnected';

interface ControlsBarProps {
  status: Status;
  onToggle?: () => void;
  showMicButton: boolean;
  roomCode?: string;
  theme: string;
  onThemeToggle: () => void;
  onFontUp: () => void;
  onFontDown: () => void;
  connectedCount?: number;
}

const HIDE_DELAY = 3000;

export function ControlsBar({
  status,
  onToggle,
  showMicButton,
  roomCode,
  theme,
  onThemeToggle,
  onFontUp,
  onFontDown,
  connectedCount,
}: ControlsBarProps) {
  const controlsRef = useRef<HTMLElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();

  const resetHideTimer = useCallback(() => {
    controlsRef.current?.classList.remove('hidden');
    clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      controlsRef.current?.classList.add('hidden');
    }, HIDE_DELAY);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', resetHideTimer);
    hideTimeoutRef.current = setTimeout(() => {
      controlsRef.current?.classList.add('hidden');
    }, HIDE_DELAY);
    return () => {
      document.removeEventListener('mousemove', resetHideTimer);
      clearTimeout(hideTimeoutRef.current);
    };
  }, [resetHideTimer]);

  const statusClass = status === 'recording' ? 'status-recording' : status === 'connected' ? 'status-connected' : 'status-idle';

  return (
    <header ref={controlsRef} className="controls" role="toolbar" aria-label="Controles de transcrição">
      <img src="/devparana.svg" alt="DevParaná" className="logo" />
      <button className="ctrl-btn" onClick={() => router.push('/')} title="Voltar ao início" aria-label="Voltar ao início">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </button>
      {showMicButton && onToggle && (
        <button className="ctrl-btn" onClick={onToggle} title="Iniciar/Parar" aria-label={status === 'recording' ? 'Parar transcrição' : 'Iniciar transcrição'}>
          {status === 'recording' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
          )}
        </button>
      )}
      <button className="ctrl-btn" onClick={onThemeToggle} title="Alternar tema" aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}>
        {theme === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        )}
      </button>
      <button className="ctrl-btn" onClick={onFontDown} title="Diminuir fonte" aria-label="Diminuir tamanho da fonte">A-</button>
      <button className="ctrl-btn" onClick={onFontUp} title="Aumentar fonte" aria-label="Aumentar tamanho da fonte">A+</button>
      {roomCode && (
        <span style={{ color: 'var(--text-muted)', fontSize: '14px', marginLeft: '8px' }}>
          Sala: <strong style={{ color: 'var(--text-final)', letterSpacing: '2px' }}>{roomCode}</strong>
        </span>
      )}
      {connectedCount !== undefined && connectedCount > 0 && (
        <span className="connected-badge" title="Pessoas conectadas">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          {connectedCount}
        </span>
      )}
      <span className={`status-dot ${statusClass}`} title="Status" />
    </header>
  );
}

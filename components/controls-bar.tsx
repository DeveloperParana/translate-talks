'use client';

import { useEffect, useRef, useCallback } from 'react';

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

  const statusIcon = status === 'recording' ? '🔴' : status === 'connected' ? '🟢' : '⚪';
  const toggleIcon = status === 'recording' ? '⏹' : '▶';

  return (
    <header ref={controlsRef} className="controls">
      <img src="/devparana.svg" alt="DevParaná" className="logo" />
      {showMicButton && onToggle && (
        <button className="ctrl-btn" onClick={onToggle} title="Iniciar/Parar">
          {toggleIcon}
        </button>
      )}
      <button className="ctrl-btn" onClick={onThemeToggle} title="Alternar tema">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <button className="ctrl-btn" onClick={onFontDown} title="Diminuir fonte">A-</button>
      <button className="ctrl-btn" onClick={onFontUp} title="Aumentar fonte">A+</button>
      {roomCode && (
        <span style={{ color: 'var(--text-muted)', fontSize: '14px', marginLeft: '8px' }}>
          Sala: <strong style={{ color: 'var(--text-final)', letterSpacing: '2px' }}>{roomCode}</strong>
        </span>
      )}
      {connectedCount !== undefined && connectedCount > 0 && (
        <span className="connected-badge" title="Pessoas conectadas">
          👥 {connectedCount}
        </span>
      )}
      <span className="status" title="Status">{statusIcon}</span>
    </header>
  );
}

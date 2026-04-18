'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { OnDeviceStatus } from '@/lib/speech';

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
  onClear?: () => void;
  onVocabulary?: () => void;
  onDebugToggle?: () => void;
  debugRecording?: boolean;
  onDeviceStatus?: OnDeviceStatus;
  onInstallOnDevice?: () => void;
  connectionError?: string;
}

// Mapeamento estado -> rotulo curto pra badge. Foco em informacao acionavel:
// "Local" significa latencia <1s, "Cloud" significa que o usuario pode
// querer baixar modelo, "Baixando..." comunica progresso.
function onDeviceLabel(s: OnDeviceStatus): { text: string; tone: 'good' | 'warn' | 'neutral' | 'hidden' } {
  switch (s) {
    case 'installed': return { text: 'On-device', tone: 'good' };
    case 'downloading': return { text: 'Baixando modelo...', tone: 'warn' };
    case 'downloadable': return { text: 'Cloud (modelo disponivel)', tone: 'warn' };
    case 'unavailable': return { text: 'Cloud', tone: 'neutral' };
    case 'unsupported': return { text: '', tone: 'hidden' };
    case 'unknown': return { text: '', tone: 'hidden' };
  }
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
  onClear,
  onVocabulary,
  onDebugToggle,
  debugRecording,
  onDeviceStatus,
  onInstallOnDevice,
  connectionError,
}: ControlsBarProps) {
  const deviceBadge = onDeviceStatus ? onDeviceLabel(onDeviceStatus) : { text: '', tone: 'hidden' as const };
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
    document.addEventListener('touchstart', resetHideTimer);
    hideTimeoutRef.current = setTimeout(() => {
      controlsRef.current?.classList.add('hidden');
    }, HIDE_DELAY);
    return () => {
      document.removeEventListener('mousemove', resetHideTimer);
      document.removeEventListener('touchstart', resetHideTimer);
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
      {onClear && (
        <button className="ctrl-btn" onClick={onClear} title="Limpar transcrição" aria-label="Limpar transcrição">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      )}
      {onVocabulary && (
        <button className="ctrl-btn" onClick={onVocabulary} title="Vocabulário da sala" aria-label="Editar vocabulário da sala">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="13" y2="11"/></svg>
        </button>
      )}
      {onDebugToggle && (
        <button
          className={`ctrl-btn${debugRecording ? ' active' : ''}`}
          onClick={onDebugToggle}
          title={debugRecording ? 'Parar captura de debug e baixar' : 'Iniciar captura de debug (audio + log)'}
          aria-label={debugRecording ? 'Parar captura de debug' : 'Iniciar captura de debug'}
          aria-pressed={!!debugRecording}
        >
          {debugRecording ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
          )}
        </button>
      )}
      {deviceBadge.tone !== 'hidden' && (
        onDeviceStatus === 'downloadable' && onInstallOnDevice ? (
          <button
            className={`device-badge device-badge-${deviceBadge.tone}`}
            onClick={onInstallOnDevice}
            title="Baixar modelo de reconhecimento on-device pra reduzir latencia (~50MB)"
            aria-label="Baixar modelo on-device"
          >
            Baixar modelo on-device
          </button>
        ) : (
          <span
            className={`device-badge device-badge-${deviceBadge.tone}`}
            title={onDeviceStatus === 'installed'
              ? 'Reconhecimento rodando localmente (latencia <1s)'
              : 'Reconhecimento via servico em nuvem do Chrome'}
          >
            {deviceBadge.text}
          </span>
        )
      )}
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
      {connectionError && (
        <div className="offline-banner" role="alert">{connectionError}</div>
      )}
    </header>
  );
}

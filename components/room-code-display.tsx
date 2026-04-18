'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface RoomCodeDisplayProps {
  code: string;
}

export function RoomCodeDisplay({ code }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const roomUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/sala/${code}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl || code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="room-code">
        <button className="room-code-btn" onClick={handleCopy} title="Copiar link da sala" aria-label="Copiar link da sala">
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          )}
        </button>
        Sala: <span>{code}</span>
        <button className="room-code-btn" onClick={() => setShowQR(true)} title="Mostrar QR Code" aria-label="Mostrar QR Code da sala">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="4" height="4" rx="0.5"/><line x1="22" y1="14" x2="22" y2="22"/><line x1="14" y1="22" x2="22" y2="22"/></svg>
        </button>
      </div>

      {showQR && (
        <div className="qr-overlay" onClick={() => setShowQR(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <QRCodeSVG value={roomUrl} size={240} bgColor="#ffffff" fgColor="#1a1a2e" level="M" />
            <p className="qr-code-text">Sala: {code}</p>
            <p className="qr-url-text">{roomUrl}</p>
            <button className="btn-primary qr-close-btn" onClick={() => setShowQR(false)}>Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}

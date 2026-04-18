'use client';

interface TranscriptDisplayProps {
  phrases: string[];
  interimText: string;
  fontSize: number;
  waitingMessage?: string;
}

export function TranscriptDisplay({ phrases, interimText, fontSize, waitingMessage }: TranscriptDisplayProps) {
  const showWaiting = waitingMessage && phrases.length === 0 && !interimText;

  return (
    <main className="transcript-area" role="region" aria-label="Transcrição em tempo real">
      <div className="transcript" style={{ fontSize: `${fontSize}px` }} aria-live="polite" aria-atomic="false">
        {phrases.map((phrase, i) => (
          <p key={`${i}-${phrase.slice(0, 20)}`} className="phrase">{phrase}</p>
        ))}
      </div>
      {showWaiting ? (
        <p className="waiting" style={{ fontSize: `${Math.max(20, fontSize * 0.5)}px` }} role="status">{waitingMessage}</p>
      ) : (
        <p className="interim" style={{ fontSize: `${fontSize}px` }} aria-live="off">{interimText}</p>
      )}
    </main>
  );
}

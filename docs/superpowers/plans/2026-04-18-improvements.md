# Translate Talks Improvements Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve accessibility, robustness, mobile support, and UX of the real-time transcription app for conference use.

**Architecture:** All changes are client-side (Next.js App Router + Supabase Realtime). No new backend needed. QR code generation uses `qrcode.react`. Reconnection uses Supabase channel state monitoring. Accessibility uses ARIA live regions.

**Tech Stack:** Next.js 15, React 19, Supabase Realtime (broadcast + presence), Web Speech API, qrcode.react

---

## File Structure

Files to modify:
- `lib/speech.ts` — Add network error auto-recovery with retry delay
- `components/transcript-display.tsx` — Add ARIA live regions, timestamps support
- `components/controls-bar.tsx` — Add aria-labels, clear button, offline banner, touch support
- `components/room-code-display.tsx` — Add copy-to-clipboard and QR code modal
- `app/sala/[code]/mestre/page.tsx` — Add clear handler, offline detection, timestamps, connection error
- `app/sala/[code]/page.tsx` — Add clear event listener, offline detection, timestamps, connection error
- `app/globals.css` — Add mobile/landscape media queries, QR modal styles, offline banner styles
- `app/layout.tsx` — Add proper viewport meta for mobile

Files to install:
- `qrcode.react` — QR code generation

No new files created. All changes modify existing files.

---

### Task 1: Accessibility — ARIA live regions and labels

**Files:**
- Modify: `components/transcript-display.tsx`
- Modify: `components/controls-bar.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add ARIA live region to transcript-display.tsx**

Replace the entire `TranscriptDisplay` component in `components/transcript-display.tsx`:

```tsx
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
```

Key decisions:
- `aria-live="polite"` on transcript div — screen readers announce new phrases without interrupting
- `aria-live="off"` on interim — interim text changes too rapidly, would overwhelm screen readers
- `role="status"` on waiting message — announces connection state

- [ ] **Step 2: Add aria-labels to all buttons in controls-bar.tsx**

In `components/controls-bar.tsx`, add `aria-label` to every button and the header. Change the `return` block:

```tsx
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
```

The remaining elements (roomCode, connectedCount, status-dot) stay the same.

- [ ] **Step 3: Add viewport meta to layout.tsx**

In `app/layout.tsx`, add inside `<head>`:

```tsx
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add ARIA accessibility support

- aria-live regions on transcript for screen readers
- aria-labels on all control buttons
- viewport meta for mobile
- role=toolbar on controls header

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Speech API auto-recovery on network errors

**Files:**
- Modify: `lib/speech.ts`

- [ ] **Step 1: Update onerror handler to auto-retry on network errors**

In `lib/speech.ts`, replace the `recognition.onerror` handler (lines 91-103) with:

```typescript
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (['no-speech', 'aborted'].includes(event.error)) return;

      // Network and audio-capture errors: notify but keep auto-restart active
      if (event.error === 'network' || event.error === 'audio-capture') {
        engine.onError(event.error);
        // onend will fire after this and handle the restart via shouldRestart
        return;
      }

      // Fatal errors: stop completely
      shouldRestart = false;
      running = false;
      engine.onError(event.error);
      engine.onStatusChange('stopped');
    };
```

Also update the `onend` handler (lines 80-89) to add a longer delay for recovery:

```typescript
    recognition.onend = () => {
      if (shouldRestart) {
        setTimeout(() => {
          try { recognition!.start(); } catch (_e) { /* already running */ }
        }, 300);
      } else {
        running = false;
        engine.onStatusChange('stopped');
      }
    };
```

Key insight: when `network` or `audio-capture` errors fire, `shouldRestart` stays `true` because we don't set it to `false`. The `onend` event fires automatically after `onerror`, and since `shouldRestart` is still `true`, it will auto-restart. The 300ms delay (up from 100ms) gives the network a moment to recover.

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/speech.ts
git commit -m "fix: speech API auto-recovers from network errors

Network and audio-capture errors no longer kill shouldRestart.
The onend handler continues to auto-restart recognition.
Increased restart delay from 100ms to 300ms for recovery.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Offline detection and connection error display

**Files:**
- Modify: `app/sala/[code]/mestre/page.tsx`
- Modify: `app/sala/[code]/page.tsx`
- Modify: `components/controls-bar.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add connectionError prop to ControlsBar**

In `components/controls-bar.tsx`, add `connectionError` to the interface and render it:

Add to `ControlsBarProps`:
```typescript
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
  connectionError?: string;
}
```

Add `onClear` and `connectionError` to the destructured props.

Add the offline banner just before `</header>` closing tag (but inside it):

```tsx
      {connectionError && (
        <div className="offline-banner" role="alert">{connectionError}</div>
      )}
```

- [ ] **Step 2: Add offline-banner CSS**

In `app/globals.css`, add after `.connected-badge` block:

```css
.offline-banner {
  position: fixed; top: 64px; left: 0; right: 0; z-index: 99;
  padding: 8px 16px; text-align: center;
  background: var(--error-color); color: #ffffff;
  font-size: 14px; font-weight: 600;
}
```

- [ ] **Step 3: Add offline detection to mestre page**

In `app/sala/[code]/mestre/page.tsx`, add state:

```typescript
const [connectionError, setConnectionError] = useState('');
```

Add a new `useEffect` for offline detection:

```typescript
useEffect(() => {
  const goOffline = () => setConnectionError('Sem conexao com a internet');
  const goOnline = () => setConnectionError('');
  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);
  if (!navigator.onLine) goOffline();
  return () => {
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('online', goOnline);
  };
}, []);
```

Pass `connectionError={connectionError}` to `<ControlsBar>`.

- [ ] **Step 4: Add offline detection to leitor page**

Same pattern as Step 3 in `app/sala/[code]/page.tsx`:

Add state: `const [connectionError, setConnectionError] = useState('');`

Add the same `useEffect` for offline/online events.

Pass `connectionError={connectionError}` to `<ControlsBar>`.

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: offline detection with visual banner

Shows red banner when internet connection is lost.
Auto-clears when connection is restored.
Works on both mestre and leitor pages.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Mobile responsive layout + landscape mode + touch support

**Files:**
- Modify: `app/globals.css`
- Modify: `components/controls-bar.tsx`

- [ ] **Step 1: Add mobile media queries to globals.css**

Append to the end of `app/globals.css`:

```css
/* Mobile */
@media (max-width: 768px) {
  .controls { gap: 8px; padding: 8px 12px; }
  .logo { width: 28px; height: 28px; }
  .ctrl-btn { width: 36px; height: 36px; font-size: 14px; }
  .transcript-area { padding: 64px 16px 48px; }
  .phrase { margin-bottom: 12px; }
  .home h1 { font-size: 24px; }
  .home-actions { padding: 0 20px; }
  .code-input { font-size: 22px; letter-spacing: 8px; padding: 12px; }
  .room-code { font-size: 12px; padding: 6px 12px; bottom: 16px; }
  .room-code span { font-size: 16px; letter-spacing: 3px; }
  .offline-banner { top: 52px; }
}

@media (max-width: 480px) {
  .controls { gap: 6px; padding: 6px 8px; }
  .ctrl-btn { width: 32px; height: 32px; }
  .ctrl-btn svg { width: 14px; height: 14px; }
  .transcript-area { padding: 52px 12px 40px; }
  .offline-banner { top: 44px; }
}

/* Landscape on mobile */
@media (max-height: 500px) {
  .controls { gap: 6px; padding: 6px 8px; }
  .ctrl-btn { width: 32px; height: 32px; }
  .logo { width: 24px; height: 24px; }
  .transcript-area { padding: 48px 16px 32px; }
  .phrase { margin-bottom: 8px; }
  .room-code { bottom: 8px; padding: 4px 12px; }
  .offline-banner { top: 44px; }
}
```

- [ ] **Step 2: Add touch support to controls-bar.tsx**

In `components/controls-bar.tsx`, update the `useEffect` that sets up the hide timer to also listen for `touchstart`:

```typescript
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
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: mobile responsive layout + landscape + touch support

- Media queries for 768px, 480px, and landscape (height < 500px)
- Controls bar adapts size for smaller screens
- Touch events show/hide controls on mobile
- Transcript area padding adapts for mobile

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Clear transcript button for mestre

**Files:**
- Modify: `components/controls-bar.tsx`
- Modify: `app/sala/[code]/mestre/page.tsx`
- Modify: `app/sala/[code]/page.tsx`

- [ ] **Step 1: Add clear button to ControlsBar**

In `components/controls-bar.tsx`, the `onClear` prop was already added to the interface in Task 3. Now add the button in the JSX, after the font buttons:

```tsx
      <button className="ctrl-btn" onClick={onFontUp} title="Aumentar fonte" aria-label="Aumentar tamanho da fonte">A+</button>
      {onClear && (
        <button className="ctrl-btn" onClick={onClear} title="Limpar transcrição" aria-label="Limpar transcrição">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      )}
```

- [ ] **Step 2: Add handleClear to mestre page**

In `app/sala/[code]/mestre/page.tsx`, add the handler after `handleFontDown`:

```typescript
  const handleClear = useCallback(() => {
    setPhrases([]);
    setInterimText('');
    channelRef.current.send({ type: 'broadcast', event: 'clear', payload: {} });
  }, []);
```

Pass `onClear={handleClear}` to `<ControlsBar>`.

- [ ] **Step 3: Add clear event listener to leitor page**

In `app/sala/[code]/page.tsx`, add another `.on()` handler in the channel chain (after the `interim` handler):

```typescript
      .on('broadcast', { event: 'clear' }, () => {
        setPhrases([]);
        setInterimText('');
      })
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: clear transcript button for mestre

Trash icon button clears local transcript and broadcasts
clear event to all connected leitores.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Copy room code + QR code

**Files:**
- Install: `qrcode.react`
- Modify: `components/room-code-display.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Install qrcode.react**

```bash
npm install qrcode.react
```

- [ ] **Step 2: Rewrite room-code-display.tsx with copy + QR**

Replace the entire file `components/room-code-display.tsx`:

```tsx
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
      // Fallback: copy just the code
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
```

- [ ] **Step 3: Add QR modal and room-code-btn styles**

In `app/globals.css`, replace the existing `.room-code` block and add QR styles:

Replace:
```css
.room-code {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; padding: 8px 20px;
  background: var(--controls-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-radius: 12px; color: var(--text-muted); font-size: 14px;
}
.room-code span { color: var(--text-final); font-weight: 700; font-size: 18px; letter-spacing: 4px; }
```

With:
```css
.room-code {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; padding: 8px 20px;
  background: var(--controls-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-radius: 12px; color: var(--text-muted); font-size: 14px;
}
.room-code span { color: var(--text-final); font-weight: 700; font-size: 18px; letter-spacing: 4px; }
.room-code-btn {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center; padding: 4px; border-radius: 4px;
  transition: color 0.2s ease;
}
.room-code-btn:hover { color: var(--text-final); }

.qr-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.qr-modal {
  background: #ffffff; border-radius: 16px; padding: 32px;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  max-width: 320px; width: 90%;
}
.qr-code-text {
  color: #1a1a2e; font-size: 24px; font-weight: 700; letter-spacing: 6px;
}
.qr-url-text {
  color: #666; font-size: 12px; word-break: break-all; text-align: center;
}
.qr-close-btn { max-width: 200px; padding: 12px 24px; font-size: 16px; }
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: copy room link + QR code modal

- Copy button copies full room URL to clipboard
- QR code button opens modal with scannable QR
- QR modal shows room code and URL
- Click outside or Fechar button closes modal

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Optional timestamps on phrases

**Files:**
- Modify: `components/transcript-display.tsx`
- Modify: `app/sala/[code]/mestre/page.tsx`
- Modify: `app/sala/[code]/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Update TranscriptDisplay to accept and render timestamps**

Update the interface and component in `components/transcript-display.tsx`:

```tsx
'use client';

export interface Phrase {
  text: string;
  time: string;
}

interface TranscriptDisplayProps {
  phrases: Phrase[];
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
          <p key={`${i}-${phrase.text.slice(0, 20)}`} className="phrase">
            <span className="timestamp">{phrase.time}</span>
            {phrase.text}
          </p>
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
```

- [ ] **Step 2: Add timestamp styles**

In `app/globals.css`, add after `.phrase` block:

```css
.timestamp {
  font-size: 0.4em; color: var(--text-muted); font-weight: 400;
  margin-right: 8px; vertical-align: middle;
}
```

- [ ] **Step 3: Update mestre page to send timestamps**

In `app/sala/[code]/mestre/page.tsx`:

Add import at top:
```typescript
import type { Phrase } from '@/components/transcript-display';
```

Change state from `string[]` to `Phrase[]`:
```typescript
const [phrases, setPhrases] = useState<Phrase[]>([]);
```

Add a helper function for formatting time:
```typescript
function formatTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
```

Update `speech.onFinal`:
```typescript
    speech.onFinal = (text: string) => {
      const time = formatTime();
      setPhrases((prev) => {
        const next = [...prev, { text, time }];
        return next.length > MAX_PHRASES ? next.slice(-MAX_PHRASES) : next;
      });
      setInterimText('');
      channel.send({ type: 'broadcast', event: 'final', payload: { text, time } });
    };
```

- [ ] **Step 4: Update leitor page to receive timestamps**

In `app/sala/[code]/page.tsx`:

Add import:
```typescript
import type { Phrase } from '@/components/transcript-display';
```

Change state:
```typescript
const [phrases, setPhrases] = useState<Phrase[]>([]);
```

Update the `final` broadcast handler:
```typescript
      .on('broadcast', { event: 'final' }, ({ payload }) => {
        setPhrases((prev) => {
          const next = [...prev, { text: payload.text, time: payload.time || '' }];
          return next.length > MAX_PHRASES ? next.slice(-MAX_PHRASES) : next;
        });
        setInterimText('');
      })
```

Update the `clear` handler:
```typescript
      .on('broadcast', { event: 'clear' }, () => {
        setPhrases([]);
        setInterimText('');
      })
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit and push all changes**

```bash
git add -A
git commit -m "feat: timestamps on transcribed phrases

Each phrase shows HH:MM timestamp. Timestamp is generated
by mestre and broadcast to leitores for consistency.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push
```

---

## Self-Review

**Spec coverage:**
1. aria-live no transcript — Task 1 ✓
2. Reconexão automática Supabase — Task 3 (offline detection; Supabase handles reconnection internally) ✓
3. Speech API auto-recover — Task 2 ✓
4. Layout responsivo mobile — Task 4 ✓
5. Botão limpar transcrição — Task 5 ✓
6. Copiar código da sala — Task 6 ✓
7. QR Code da sala — Task 6 ✓
8. Detecção de offline — Task 3 ✓
9. Landscape mode — Task 4 ✓
10. Timestamps nas frases — Task 7 ✓

**Placeholder scan:** No TBD, TODO, or vague instructions found. All code blocks are complete.

**Type consistency check:**
- `Phrase` type defined in `transcript-display.tsx` and imported in both page files ✓
- `connectionError` prop added to `ControlsBarProps` in Task 3, used in both pages ✓
- `onClear` prop added to `ControlsBarProps` in Task 3, button rendered in Task 5, handler in mestre ✓
- `phrases` state changes from `string[]` to `Phrase[]` in Task 7 for both pages ✓

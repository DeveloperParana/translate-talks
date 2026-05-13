'use client';

import { useEffect, useState } from 'react';
import {
  loadRoomVocabulary,
  saveRoomVocabulary,
  parseVocabularyText,
  serializeVocabulary,
  type VocabularyEntry,
} from '@/lib/vocabulary';

interface VocabularyModalProps {
  roomCode: string;
  open: boolean;
  onClose: () => void;
  onSaved: (entries: VocabularyEntry[]) => void;
}

const PLACEHOLDER = `Um termo por linha. Variantes separadas por vírgula.

Next.js, nexta, nestes
TypeScript, taipscript
DevParaná
# linhas com # são ignoradas`;

export function VocabularyModal({ roomCode, open, onClose, onSaved }: VocabularyModalProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!open) return;
    setText(serializeVocabulary(loadRoomVocabulary(roomCode)));
  }, [open, roomCode]);

  if (!open) return null;

  const handleSave = () => {
    const entries = parseVocabularyText(text);
    saveRoomVocabulary(roomCode, entries);
    onSaved(entries);
    onClose();
  };

  const handleClear = () => {
    setText('');
  };

  return (
    <div className="qr-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Vocabulário da sala">
      <div className="vocab-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="vocab-title">Vocabulário da sala</h2>
        <p className="vocab-help">
          Termos do evento ou palestrante. O reconhecimento corrige variações
          comuns (ex.: <em>nexta</em> &rarr; <em>Next.js</em>).
        </p>
        <textarea
          className="vocab-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          spellCheck={false}
          aria-label="Lista de termos"
        />
        <div className="vocab-actions">
          <button className="btn-secondary vocab-btn" onClick={handleClear} type="button">Limpar</button>
          <button className="btn-secondary vocab-btn" onClick={onClose} type="button">Cancelar</button>
          <button className="btn-primary vocab-btn" onClick={handleSave} type="button">Salvar</button>
        </div>
      </div>
    </div>
  );
}

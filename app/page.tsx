'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomCode } from '@/lib/room';

export default function Home() {
  const router = useRouter();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  function handleCreate() {
    const code = generateRoomCode();
    router.push(`/sala/${code}/mestre`);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length === 4) {
      router.push(`/sala/${code}`);
    }
  }

  return (
    <div className="home">
      <img src="/devparana.svg" alt="DevParaná" className="home-logo" />
      <h1>Translate Talks</h1>

      {!showJoin ? (
        <div className="home-actions">
          <button className="btn-primary" onClick={handleCreate}>
            Criar Sala
          </button>
          <button className="btn-secondary" onClick={() => setShowJoin(true)}>
            Entrar na Sala
          </button>
        </div>
      ) : (
        <form className="join-form" onSubmit={handleJoin}>
          <input
            className="code-input"
            type="text"
            maxLength={4}
            placeholder="Código"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            autoFocus
          />
          <button
            className="btn-primary"
            type="submit"
            disabled={joinCode.trim().length !== 4}
          >
            Entrar
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => { setShowJoin(false); setJoinCode(''); }}
          >
            Voltar
          </button>
        </form>
      )}
    </div>
  );
}

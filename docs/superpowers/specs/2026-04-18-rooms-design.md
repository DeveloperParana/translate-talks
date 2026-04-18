# Translate Talks — Salas de Transcrição (Design Spec)

## Problema

A versão atual do Translate Talks funciona apenas em um dispositivo local. Para eventos do DevParaná, precisamos que um mestre de cerimônia capture e transcreva o áudio do palco, e que leitores (plateia) possam acompanhar a transcrição em tempo real nos seus próprios dispositivos ou em um telão.

## Abordagem

Migrar o app para Next.js (App Router) e usar Supabase Realtime Broadcast para sincronizar a transcrição entre mestre e leitores. O broadcast é efêmero — zero tabelas, zero persistência. Deploy na Vercel.

## Arquitetura

```
Mestre (Chrome)                    Supabase Realtime                    Leitor(es)
┌──────────────┐                  ┌─────────────────┐                ┌──────────────┐
│ Web Speech   │──transcript──►   │ Broadcast Canal  │──subscribe──► │ Exibe texto  │
│ API + Mic    │                  │ "sala:ABCD"      │               │ em tempo real│
│ Controles    │                  └─────────────────┘               │ Tema/Fonte   │
└──────────────┘                                                     └──────────────┘
```

### Supabase Realtime Broadcast

- Usa o canal de Broadcast do Supabase (não Presence, não Postgres Changes)
- Canal nomeado: `sala:<code>` (ex: `sala:KXPZ`)
- Eventos enviados pelo mestre:
  - `interim`: `{ text: string }` — frase sendo processada
  - `final`: `{ text: string }` — frase finalizada
- Leitores assinam o canal e recebem eventos em tempo real
- Nenhuma tabela é criada no Supabase — apenas o Realtime é usado
- Ao fechar a aba, a conexão é desfeita automaticamente

### Next.js App Router

Páginas:
- `/` — Home com "Criar Sala" e "Entrar na Sala"
- `/sala/[code]/mestre` — Tela do mestre (mic + transcrição + broadcast)
- `/sala/[code]` — Tela do leitor (recebe broadcast + exibe)

## Estrutura de Arquivos

```
translate-talks/
├── app/
│   ├── layout.tsx              # Layout raiz (fonte, metadata)
│   ├── page.tsx                # Home: "Criar Sala" / "Entrar na Sala"
│   ├── globals.css             # Estilos globais + temas dark/light
│   └── sala/
│       └── [code]/
│           ├── page.tsx        # Leitor: assina broadcast e exibe
│           └── mestre/
│               └── page.tsx    # Mestre: mic + broadcast
├── components/
│   ├── transcript-display.tsx  # Exibição de frases (compartilhado mestre/leitor)
│   ├── controls-bar.tsx        # Barra de controles (tema, fonte, status)
│   └── room-code-display.tsx   # Exibição do código da sala (apenas mestre)
├── lib/
│   ├── speech.ts               # Web Speech API wrapper (migrado do atual speech.js)
│   ├── supabase.ts             # Client Supabase singleton
│   └── room.ts                 # Geração de código de sala + helpers
├── public/
│   └── devparana.svg           # Logo DevParaná
├── next.config.js
├── package.json
├── tsconfig.json
└── .env.local                  # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Módulos

### `lib/speech.ts`

Migração do `speech.js` atual para TypeScript. Mesma lógica:
- `createSpeechEngine()` retorna objeto com `start()`, `stop()`, `isRunning`, `supported`
- Callbacks: `onInterim`, `onFinal`, `onError`, `onStatusChange`
- Auto-restart ao receber `onend`
- Tratamento de erros silenciosos (`no-speech`, `aborted`)
- Idioma fixo: `pt-BR`

### `lib/supabase.ts`

Singleton do client Supabase:
- Usa `createClient` do `@supabase/supabase-js`
- Lê `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do env
- Exporta instância única do client

### `lib/room.ts`

Utilitários de sala:
- `generateRoomCode()`: Gera código de 4 letras maiúsculas aleatórias (ex: `KXPZ`). Usa apenas consoantes e vogais que não se confundem (`ABCDEFGHJKLMNPQRSTUVWXYZ` — sem I e O para evitar confusão com 1 e 0).
- `getRoomChannel(code: string)`: Retorna string `sala:<code>` para nomear o canal Supabase

## Componentes

### `components/transcript-display.tsx`

Componente React compartilhado entre mestre e leitor:
- Props: `phrases: string[]`, `interimText: string`
- Renderiza as últimas 3 frases finalizadas em cor principal + interim em verde DevParaná
- Mesma lógica visual do app atual (estilo legenda, fadeIn animation)
- Gerencia apenas a exibição — não sabe de onde vêm os dados

### `components/controls-bar.tsx`

Barra de controles compartilhada:
- Props: `status: 'recording' | 'stopped' | 'connected' | 'disconnected'`, `onToggle?: () => void`, `showMicButton: boolean`, `roomCode?: string`
- Toggle de tema (claro/escuro) — persiste no `localStorage`
- Controle de fonte (A-/A+) — persiste no `localStorage`
- Botão de mic (apenas para mestre, via `showMicButton`)
- Indicador de status
- Logo DevParaná
- Auto-hide após 3s sem mouse

### `components/room-code-display.tsx`

Exibição do código da sala no mestre:
- Props: `code: string`
- Mostra o código em letras grandes para fácil leitura/compartilhamento
- Estilo discreto, posicionado abaixo do transcript

## Páginas

### `/` — Home

Tela inicial com branding DevParaná:
- Logo centralizada
- Título "Translate Talks"
- Dois botões:
  - **"Criar Sala"**: Gera código via `generateRoomCode()`, redireciona para `/sala/[code]/mestre`
  - **"Entrar na Sala"**: Exibe input para digitar código de 4 letras. Ao confirmar, redireciona para `/sala/[code]`
- Fundo com tema escuro, estilo consistente com o restante do app

### `/sala/[code]/mestre` — Tela do Mestre

- Componente client-side (`"use client"`)
- Inicializa `SpeechEngine` + canal Supabase Broadcast `sala:<code>`
- Ao receber `onFinal`: adiciona à lista de frases + envia `{ type: 'broadcast', event: 'final', payload: { text } }` no canal
- Ao receber `onInterim`: atualiza interim + envia `{ type: 'broadcast', event: 'interim', payload: { text } }` no canal
- Gerencia lista de frases (máximo 3, limpa memória)
- Renderiza `<ControlsBar showMicButton={true} roomCode={code} />` + `<TranscriptDisplay />` + `<RoomCodeDisplay />`

### `/sala/[code]` — Tela do Leitor

- Componente client-side (`"use client"`)
- Assina canal Supabase Broadcast `sala:<code>`
- Ao receber evento `final`: adiciona à lista de frases local
- Ao receber evento `interim`: atualiza interim local
- Mesma gestão de memória (máximo 3 frases)
- Renderiza `<ControlsBar showMicButton={false} status="connected" />` + `<TranscriptDisplay />`
- Se o canal não receber nenhum evento em 30s após conexão, exibe mensagem "Aguardando mestre iniciar a transcrição..."

## Temas

Mantém os mesmos temas do app atual:

### Tema Escuro (padrão)
- Fundo: `#1a1a2e`
- Texto final: `#ffffff`
- Texto interim: `#15a04b`
- Controles: `rgba(0, 0, 0, 0.6)` com blur

### Tema Claro
- Fundo: `#f5f5f5`
- Texto final: `#1a1a2e`
- Texto interim: `#15a04b`
- Controles: `rgba(255, 255, 255, 0.8)` com blur

Tema é controlado localmente por cada usuário (mestre e leitores independentes).

## Gestão de Memória

Mesma política do app atual:
- Máximo 3 frases finalizadas no estado + 1 interim
- Frases antigas são descartadas do array ao ultrapassar o limite
- Consumo de memória constante independente da duração da palestra

## Configuração Supabase

Necessário criar um projeto gratuito no Supabase:
1. Criar projeto em supabase.com
2. Anotar `Project URL` e `anon public key`
3. Criar `.env.local` com:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. Nenhuma tabela precisa ser criada — apenas o Realtime é usado
5. No dashboard Supabase, Realtime deve estar habilitado (vem habilitado por padrão)

## Tecnologias

- Next.js 14+ (App Router)
- TypeScript
- React 18+
- @supabase/supabase-js
- Web Speech API (Chrome)
- CSS Modules ou globals.css com CSS variables
- Deploy: Vercel

## Considerações

- O Supabase Broadcast é efêmero: se o mestre fechar a aba, o canal morre. Leitores param de receber. Isso é o comportamento desejado.
- O plano gratuito do Supabase suporta até 200 conexões simultâneas de Realtime — suficiente para eventos.
- Cada leitor controla tema e fonte independentemente.
- A Web Speech API ainda requer Chrome no dispositivo do mestre. Leitores podem usar qualquer navegador moderno.
- O código de 4 letras tem 24^4 = 331.776 combinações possíveis — mais que suficiente para evitar colisões em eventos.

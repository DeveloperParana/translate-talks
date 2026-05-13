# Speech engines

Abstração de reconhecimento de fala. O app fala apenas com a interface
`SpeechEngine`; a implementação pode ser trocada sem alterar o resto do
código.

## Contrato

```ts
// lib/speech/types.ts
interface SpeechEngine {
  start(): void;
  stop(): void;
  readonly isRunning: boolean;
  readonly supported: boolean;
  onInterim: (text: string) => void;  // texto parcial (vai e volta)
  onFinal: (text: string) => void;    // chunk fechado, nunca volta atrás
  onError: (error: string) => void;
  onStatusChange: (status: 'recording' | 'stopped') => void;
}

interface SpeechEngineOptions {
  vocabulary?: VocabularyEntry[]; // opcional, viés de domínio
}
```

Garantias esperadas de quem implementa:

- `start()` é idempotente. Chamar duas vezes não duplica streams.
- `stop()` faz flush de qualquer buffer interno antes de mudar o status.
- `onFinal` recebe texto já deduplicado entre sessões/reconexões.
- `onInterim` pode ser chamado muitas vezes por segundo, mas o conteúdo
  precisa ser substitutivo (não acumular texto).

## Engines disponíveis

| Engine | Arquivo | Custo | Qualidade pt-BR | Infra |
|---|---|---|---|---|
| Web Speech API | `web-speech.ts` | 0 | Média | Nenhuma (Chrome/Edge) |

## Como adicionar um engine novo

1. Crie `lib/speech/<nome>.ts` exportando `create<Nome>Engine(options): SpeechEngine`.
2. Implemente o contrato acima. Reaproveite `correctTokens` de `lib/text-correct.ts` se o engine não fizer biasing nativo.
3. Adicione o switch em `lib/speech/index.ts`. Sugerimos selecionar via
   `process.env.NEXT_PUBLIC_SPEECH_ENGINE` pra trocar sem mexer nos
   componentes.
4. Documente trade-offs no quadro acima (latência, custo, idiomas).

## Candidatos para futuras contribuições

- **Whisper streaming** (whisper.cpp via WASM) — open source, roda local, modelos grandes pesam ~200 MB.
- **Deepgram** — STT comercial com pontuação automática e baixa latência; exige API key e proxy.
- **Google Cloud Speech-to-Text** — `enableAutomaticPunctuation`, biasing nativo via `SpeechContext`; exige backend.
- **Vosk** — open source, modelos médios em pt-BR (~50 MB), roda em Node/WASM.

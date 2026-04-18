import type { VocabularyEntry } from './vocabulary';

export interface CorrectOptions {
  // Similaridade minima [0..1] = 1 - lev/maxLen pra aceitar substituicao.
  threshold?: number;
  // Tokens com <= MIN_FUZZY_LEN chars exigem igualdade exata (normalizada).
  // Default 3: termos curtos como 'API', 'CSS' nao podem virar qualquer coisa.
  minFuzzyLen?: number;
  // Tamanho maximo da janela em tokens (1-3 captura termos compostos como
  // "type script" -> "TypeScript"). Default 3.
  maxWindow?: number;
}

export interface CorrectResult {
  text: string;
  // Quantos tokens foram substituidos por entradas do vocab. Usado por
  // pickBestAlternative pra ranquear alternativas.
  hits: number;
  // Soma dos pesos das entradas que casaram. Termos raros (weight > 1) puxam
  // a alternativa pra cima.
  score: number;
}

interface CompiledTarget {
  // Forma normalizada do alvo (sem acento, lowercase, sem pontuacao).
  norm: string;
  // Quantos tokens (palavras) o alvo tem. Determina a janela onde casa.
  tokenCount: number;
}

interface CompiledEntry {
  canonical: string;
  weight: number;
  targets: CompiledTarget[];
  // Se o canonical normalizado e muito curto (<= minFuzzyLen), todas as
  // variantes exigem igualdade exata com a janela. Sem isso, variantes
  // foneticas multi-palavra (ex.: 'a pi' pra 'API') casariam por similaridade
  // contra fragmentos como 'a api' e dropariam o artigo.
  requireExact: boolean;
}

// Cache de compilacao indexado por referencia da lista. Vocab muda pouco e a
// referencia vem do React state (estavel entre renders), entao isso evita
// recompilar a cada interim.
const compileCache = new WeakMap<VocabularyEntry[], CompiledEntry[]>();

export function correctTokens(text: string, vocab: VocabularyEntry[], options: CorrectOptions = {}): CorrectResult {
  const threshold = options.threshold ?? 0.78;
  const minFuzzyLen = options.minFuzzyLen ?? 3;
  const maxWindow = options.maxWindow ?? 3;

  const trimmed = text.trim();
  if (!trimmed || vocab.length === 0) {
    return { text: trimmed, hits: 0, score: 0 };
  }

  const compiled = getCompiled(vocab);
  const tokens = trimmed.split(/\s+/);
  const normTokens = tokens.map(normalize);

  const out: string[] = [];
  let hits = 0;
  let score = 0;
  let i = 0;

  while (i < tokens.length) {
    let bestCanonical: string | null = null;
    let bestConsume = 0;
    let bestWeight = 0;
    let bestSim = threshold;

    const windowMax = Math.min(maxWindow, tokens.length - i);
    for (let w = windowMax; w >= 1; w--) {
      const windowNorm = normTokens.slice(i, i + w).join(' ');
      if (!windowNorm) continue;

      for (const entry of compiled) {
        for (const target of entry.targets) {
          if (target.tokenCount !== w) continue;

          const targetLen = target.norm.length;
          const windowLen = windowNorm.length;
          let sim: number;
          // Termos curtos: igualdade exata pra evitar substituicao agressiva.
          // Inclui entradas marcadas requireExact (canonical curto) — protege
          // canonicais como "API" mesmo quando a variante e multi-token.
          if (entry.requireExact || targetLen <= minFuzzyLen || windowLen <= minFuzzyLen) {
            if (target.norm !== windowNorm) continue;
            sim = 1;
          } else {
            const dist = levenshtein(windowNorm, target.norm);
            const maxLen = Math.max(windowLen, targetLen);
            sim = 1 - dist / maxLen;
          }

          const isBetter = sim > bestSim || (sim === bestSim && bestCanonical !== null && entry.weight > bestWeight);
          if (isBetter) {
            bestSim = sim;
            bestCanonical = entry.canonical;
            bestConsume = w;
            bestWeight = entry.weight;
          }
        }
      }
      // Se janela maior ja casou perfeito, nao vale tentar menores (que poderiam
      // casar parcialmente e quebrar o termo composto).
      if (bestCanonical !== null && bestSim === 1) break;
    }

    if (bestCanonical !== null) {
      out.push(bestCanonical);
      hits++;
      score += bestWeight;
      i += bestConsume;
    } else {
      out.push(tokens[i]);
      i++;
    }
  }

  return { text: out.join(' '), hits, score };
}

function getCompiled(vocab: VocabularyEntry[]): CompiledEntry[] {
  const cached = compileCache.get(vocab);
  if (cached) return cached;
  // minFuzzyLen e parametro do correctTokens, mas requireExact e propriedade
  // do vocabulario; usamos o default (3) na compilacao. Casos extremos com
  // threshold ajustado podem reaplicar a regra dinamicamente, mas nao vale a
  // pena complicar agora.
  const COMPILE_MIN_FUZZY = 3;
  const compiled = vocab.map<CompiledEntry>((entry) => {
    const targets: CompiledTarget[] = [];
    const seen = new Set<string>();
    const add = (s: string) => {
      const norm = normalize(s);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      targets.push({ norm, tokenCount: norm.split(/\s+/).length });
    };
    add(entry.canonical);
    if (entry.variants) for (const v of entry.variants) add(v);
    const canonicalNorm = normalize(entry.canonical);
    return {
      canonical: entry.canonical,
      weight: entry.weight ?? 1,
      targets,
      requireExact: canonicalNorm.length <= COMPILE_MIN_FUZZY,
    };
  });
  compileCache.set(vocab, compiled);
  return compiled;
}

// Normaliza pra comparacao: lowercase, sem diacriticos, sem pontuacao de
// borda. Hifen e ponto interno sao mantidos (Next.js -> next.js -> nextjs?
// nao: vamos remover . tambem pra casar "next js" e "nextjs" do STT).
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?()[\]{}"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein iterativo classico. Espaco O(min(a,b)) usando duas linhas.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  if (a.length > b.length) {
    const tmp = a;
    a = b;
    b = tmp;
  }

  let prev = new Array(a.length + 1);
  let curr = new Array(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1,
        prev[i] + 1,
        prev[i - 1] + cost,
      );
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }

  return prev[a.length];
}

import { correctTokens } from '../lib/text-correct.ts';
import { BASE_VOCABULARY, parseVocabularyText, mergeVocabularies } from '../lib/vocabulary.ts';

interface Case {
  name: string;
  input: string;
  vocab?: ReturnType<typeof mergeVocabularies>;
  expected: string;
}

const cases: Case[] = [
  {
    name: 'next.js variant',
    input: 'eu uso nexta no front end',
    expected: 'eu uso Next.js no frontend',
  },
  {
    name: 'two-token compound',
    input: 'gosto de type script com node gs',
    expected: 'gosto de TypeScript com Node.js',
  },
  {
    name: 'short term exact match preserves article',
    input: 'a api do servidor',
    expected: 'a API do servidor',
  },
  {
    name: 'short term exact match alone',
    input: 'preciso da api',
    expected: 'preciso da API',
  },
  {
    name: 'no false positive on common words',
    input: 'hoje fui ao mercado comprar pao',
    expected: 'hoje fui ao mercado comprar pao',
  },
  {
    name: 'custom vocab from text',
    input: 'palestra com fulano hoje',
    vocab: mergeVocabularies(BASE_VOCABULARY, parseVocabularyText('Fulano de Tal, fulano')),
    expected: 'palestra com Fulano de Tal hoje',
  },
  {
    name: 'react variant',
    input: 'componente reaque novo',
    expected: 'componente React novo',
  },
];

let failures = 0;
for (const c of cases) {
  const vocab = c.vocab ?? BASE_VOCABULARY;
  const result = correctTokens(c.input, vocab);
  const ok = result.text === c.expected;
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`${mark} | ${c.name}`);
  console.log(`     in:  ${c.input}`);
  console.log(`     out: ${result.text}`);
  if (!ok) {
    console.log(`     exp: ${c.expected}`);
    failures++;
  }
}

console.log(`\n${cases.length - failures}/${cases.length} passed`);
process.exit(failures > 0 ? 1 : 0);

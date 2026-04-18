// Analisa um JSON de captura de debug do engine de fala (gerado por
// lib/speech/debug-capture.ts) e cospe metricas que apontam onde a
// pipeline esta vazando. Uso:
//
//   npx tsx scripts/analyze-debug.mts ~/Downloads/speech-debug-*.json
//
// Saida: bloco textual com secoes:
//   - Resumo (volume, duracao, processLocally)
//   - Confidence (distribuicao das alternativas top)
//   - Alternativas (quantas o engine devolveu)
//   - Vocabulario (hits, top corrections, finais sem hit)
//   - Drops (filtro de ruido, esvaziamento por chunk)
//   - Latencia (gap interim->final do mesmo resultIndex)
//   - Duplicacao (prefix overlap entre finais consecutivos)
//   - Suspeitos (finais com confidence baixo)
//   - Texto (linha do tempo dos finais emitidos)

import { readFileSync } from 'node:fs';

interface SpeechAlternativeSnapshot {
  transcript: string;
  confidence: number;
}
interface SpeechDebugEvent {
  t: number;
  resultIndex: number;
  isFinal: boolean;
  alternatives: SpeechAlternativeSnapshot[];
  picked?: { index: number; transcript: string; score: number };
  corrected?: { text: string; hits: number; score: number };
  emitted?: { kind: 'interim' | 'final' | 'dropped'; text: string; reason?: string };
  processLocally: boolean;
}
interface DebugFile {
  meta: {
    startedAt: string;
    durationMs: number;
    userAgent: string;
    vocabularySize: number;
    notes?: string;
  };
  events: SpeechDebugEvent[];
}

const file = process.argv[2];
if (!file) {
  console.error('uso: tsx scripts/analyze-debug.mts <arquivo.json>');
  process.exit(1);
}

const raw = readFileSync(file, 'utf-8');
const data: DebugFile = JSON.parse(raw);
const events = data.events;

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const finals = events.filter((e) => e.isFinal);
const interims = events.filter((e) => !e.isFinal);
const dropped = events.filter((e) => e.emitted?.kind === 'dropped');
const finalEmits = events.filter((e) => e.emitted?.kind === 'final');
const localCount = events.filter((e) => e.processLocally).length;

console.log(`# Debug analysis — ${file.split('/').pop()}`);
console.log(`Started: ${data.meta.startedAt}  duration: ${(data.meta.durationMs / 1000).toFixed(1)}s`);
console.log(`UA: ${data.meta.userAgent}`);
console.log(`Vocab size: ${data.meta.vocabularySize}`);
console.log();

console.log('## Volume');
console.log(`events:        ${events.length}`);
console.log(`  interims:    ${interims.length}`);
console.log(`  finals:      ${finals.length}`);
console.log(`  emitted-fin: ${finalEmits.length}  (${pct(finalEmits.length, finals.length)} dos finals)`);
console.log(`  dropped:     ${dropped.length}`);
console.log(`processLocally events: ${localCount} (${pct(localCount, events.length)})`);
console.log();

console.log('## Confidence (alt[0] dos finals)');
const topConfs = finals.map((e) => e.alternatives[0]?.confidence ?? 0).filter((c) => c > 0).sort((a, b) => a - b);
const zeros = finals.filter((e) => (e.alternatives[0]?.confidence ?? 0) === 0).length;
console.log(`  amostra:    ${topConfs.length} finals com conf > 0  (${zeros} com conf=0)`);
if (topConfs.length > 0) {
  console.log(`  p10/50/90:  ${quantile(topConfs, 0.1).toFixed(2)} / ${quantile(topConfs, 0.5).toFixed(2)} / ${quantile(topConfs, 0.9).toFixed(2)}`);
  const lows = topConfs.filter((c) => c < 0.5).length;
  console.log(`  conf < 0.5: ${lows} (${pct(lows, topConfs.length)})  -> finals suspeitos de ruido/erro`);
}
console.log();

console.log('## Alternativas por final');
const altCounts = finals.map((e) => e.alternatives.length);
const histogram = new Map<number, number>();
for (const c of altCounts) histogram.set(c, (histogram.get(c) ?? 0) + 1);
const sortedHist = [...histogram.entries()].sort((a, b) => a[0] - b[0]);
for (const [n, count] of sortedHist) {
  console.log(`  ${n} alt(s): ${count} finals (${pct(count, finals.length)})`);
}
const onlyOne = altCounts.filter((c) => c === 1).length;
console.log(`  obs: ${pct(onlyOne, finals.length)} dos finals tiveram so 1 alt -> vocab-biasing inerte nesses casos`);
console.log();

console.log('## Vocabulario');
const finalsWithHits = finals.filter((e) => (e.corrected?.hits ?? 0) > 0);
console.log(`  finals com hit:    ${finalsWithHits.length} (${pct(finalsWithHits.length, finals.length)})`);
console.log(`  finals sem hit:    ${finals.length - finalsWithHits.length}`);

const correctionDiffs = new Map<string, number>();
for (const e of finals) {
  if (!e.picked || !e.corrected) continue;
  if (e.corrected.hits === 0) continue;
  const original = normalize(e.picked.transcript).split(/\s+/);
  const corrected = normalize(e.corrected.text).split(/\s+/);
  const origSet = new Set(original);
  const corrSet = new Set(corrected);
  for (const w of corrSet) {
    if (!origSet.has(w)) {
      correctionDiffs.set(w, (correctionDiffs.get(w) ?? 0) + 1);
    }
  }
}
const topCorrections = [...correctionDiffs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log(`  top palavras inseridas pela correcao fuzzy:`);
for (const [w, n] of topCorrections) console.log(`    "${w}" x${n}`);
console.log();

console.log('## Picker');
const pickedNonZero = finals.filter((e) => (e.picked?.index ?? 0) > 0);
console.log(`  finals onde picker escolheu alt > 0: ${pickedNonZero.length} (${pct(pickedNonZero.length, finals.length)})`);
const pickerWinByVocab: { time: number; from: string; to: string }[] = [];
for (const e of finals) {
  if (!e.picked || !e.alternatives.length) continue;
  if (e.picked.index === 0) continue;
  const alt0 = e.alternatives[0]?.transcript.trim() ?? '';
  pickerWinByVocab.push({
    time: e.t,
    from: alt0.slice(0, 80),
    to: e.picked.transcript.trim().slice(0, 80),
  });
}
if (pickerWinByVocab.length > 0) {
  console.log(`  amostra (alt[0] -> escolhida):`);
  for (const x of pickerWinByVocab.slice(0, 5)) {
    console.log(`    @${(x.time / 1000).toFixed(1)}s  "${x.from}"`);
    console.log(`                    -> "${x.to}"`);
  }
}
console.log();

console.log('## Drops (filtro de ruido)');
const reasons = new Map<string, number>();
for (const e of dropped) {
  const r = e.emitted?.reason ?? 'unknown';
  reasons.set(r, (reasons.get(r) ?? 0) + 1);
}
for (const [r, n] of reasons) console.log(`  ${r}: ${n}`);
if (dropped.length > 0) {
  console.log(`  amostra:`);
  for (const e of dropped.slice(0, 8)) {
    console.log(`    @${(e.t / 1000).toFixed(1)}s  "${e.emitted?.text}" (${e.emitted?.reason})`);
  }
}
console.log();

console.log('## Latencia interim -> final (mesmo resultIndex)');
type Row = { idx: number; firstInterim: number; final: number };
const byIdx = new Map<number, Row>();
for (const e of events) {
  const cur = byIdx.get(e.resultIndex);
  if (!cur) {
    byIdx.set(e.resultIndex, { idx: e.resultIndex, firstInterim: e.isFinal ? Number.NaN : e.t, final: e.isFinal ? e.t : Number.NaN });
  } else {
    if (!e.isFinal && (Number.isNaN(cur.firstInterim) || e.t < cur.firstInterim)) cur.firstInterim = e.t;
    if (e.isFinal && (Number.isNaN(cur.final) || e.t > cur.final)) cur.final = e.t;
  }
}
const lats = [...byIdx.values()].filter((r) => !Number.isNaN(r.firstInterim) && !Number.isNaN(r.final)).map((r) => r.final - r.firstInterim).sort((a, b) => a - b);
if (lats.length > 0) {
  console.log(`  amostra: ${lats.length} pares interim->final`);
  console.log(`  p10/50/90/max: ${quantile(lats, 0.1).toFixed(0)} / ${quantile(lats, 0.5).toFixed(0)} / ${quantile(lats, 0.9).toFixed(0)} / ${Math.max(...lats).toFixed(0)} ms`);
} else {
  console.log(`  (sem pares; talvez captura iniciou no meio de uma sessao)`);
}
console.log();

console.log('## Duplicacao (prefix overlap entre finais consecutivos)');
let dupCount = 0;
const dupSamples: { a: string; b: string }[] = [];
const finalTexts = finalEmits.map((e) => e.emitted?.text ?? '').filter(Boolean);
for (let i = 1; i < finalTexts.length; i++) {
  const a = finalTexts[i - 1];
  const b = finalTexts[i];
  if (a === b) continue;
  if (a.length === 0 || b.length === 0) continue;
  if (a.startsWith(b) || b.startsWith(a)) {
    dupCount++;
    if (dupSamples.length < 5) dupSamples.push({ a, b });
  }
}
console.log(`  pares com prefixo: ${dupCount} de ${Math.max(0, finalTexts.length - 1)}`);
for (const x of dupSamples) {
  console.log(`    "${x.a.slice(0, 60)}"  /  "${x.b.slice(0, 60)}"`);
}
console.log();

console.log('## Texto emitido (timeline dos finals)');
console.log('  legenda: F=final do engine  H=hard-cap chunk  S=soft-cap chunk');
for (const e of finalEmits) {
  const conf = e.alternatives[0]?.confidence ?? 0;
  // Reason vem populado quando origem foi chunking do interim path.
  const isChunk = !!e.emitted?.reason;
  const kindTag = isChunk ? (e.emitted?.reason === 'hard-cap' ? 'H' : 'S') : 'F';
  const confTag = isChunk ? '   ' : conf > 0.7 ? '   ' : conf > 0.5 ? ' ? ' : '!! ';
  console.log(`  [${kindTag}]${confTag}@${(e.t / 1000).toFixed(1)}s  "${e.emitted?.text}"`);
}

export interface VocabularyEntry {
  // Forma final que aparece na transcricao.
  canonical: string;
  // Variantes foneticas/ortograficas que o STT costuma cuspir. O matcher usa
  // o canonical + variantes como alvos pro fuzzy match.
  variants?: string[];
  // Peso pra ranquear alternativas concorrentes. Default 1. Termos raros do
  // dominio podem subir pra 2 e ganhar prioridade no pickBestAlternative.
  weight?: number;
}

// Vocabulario base: termos comuns em palestras de tecnologia em pt-BR. Mantido
// curto de proposito (matcher roda a cada interim). Eventos especificos devem
// adicionar termos via UI da sala, nao aqui.
export const BASE_VOCABULARY: VocabularyEntry[] = [
  // Web/dev
  { canonical: 'Next.js', variants: ['nexta gs', 'nest gs', 'nexta', 'next g s', 'nexitis', 'nextes'] },
  { canonical: 'React', variants: ['reaque', 'reagi', 'rie act'] },
  { canonical: 'TypeScript', variants: ['type script', 'taipscript', 'taip script'] },
  { canonical: 'JavaScript', variants: ['java script', 'javascripti', 'java scripti'] },
  { canonical: 'Node.js', variants: ['node gs', 'noud gs', 'no de gs'] },
  { canonical: 'Vercel', variants: ['versel', 'vercell', 'versão'] },
  { canonical: 'Supabase', variants: ['supa base', 'soupa base', 'supabeisi'] },
  { canonical: 'PostgreSQL', variants: ['postgre sql', 'pos gres', 'postigres', 'postgrese'] },
  { canonical: 'GitHub', variants: ['guit hub', 'git rabe', 'git rabi'] },
  { canonical: 'GitLab', variants: ['guit leb', 'git lebe'] },
  { canonical: 'Docker', variants: ['doquer', 'doker'] },
  { canonical: 'Kubernetes', variants: ['kubernetis', 'kubernet', 'cubernetes'] },
  { canonical: 'API', variants: ['a pi', 'ape i', 'a p i'] },
  { canonical: 'CSS', variants: ['ce ss', 'sess', 'c s s'] },
  { canonical: 'HTML', variants: ['hagatemele', 'hatemele', 'h t m l'] },
  { canonical: 'JSON', variants: ['gei son', 'jeison', 'jê son'] },
  { canonical: 'frontend', variants: ['front end', 'fronchend'] },
  { canonical: 'backend', variants: ['back end', 'beck end'] },
  { canonical: 'fullstack', variants: ['full stack', 'foul stack'] },
  { canonical: 'open source', variants: ['oupen source', 'open sors'] },
  { canonical: 'DevParaná', variants: ['dev parana', 'def paraná', 'devi parana'] },

  // IA / LLMs / agentes — termos que o STT cloud do Chrome erra mais.
  // Pesos altos (2) em termos curtos e ambíguos pra ganhar das alternativas.
  { canonical: 'IA', variants: ['i a', 'ia', 'inteligência artificial'], weight: 2 },
  { canonical: 'LLM', variants: ['l l m', 'éle éle eme', 'ele ele eme'], weight: 2 },
  { canonical: 'GPT', variants: ['g p t', 'gê pê tê', 'ge pe te'], weight: 2 },
  { canonical: 'ChatGPT', variants: ['chat gpt', 'chat g p t', 'chati gepete'] },
  // Removido 'cloud' como variante: confunde com "cloud computing".
  { canonical: 'Claude', variants: ['clode', 'clóude', 'clody'] },
  { canonical: 'Gemini', variants: ['geminai', 'jemini', 'guêmini'] },
  { canonical: 'Copilot', variants: ['copai lot', 'co pilot', 'copilote'] },
  { canonical: 'Cursor', variants: ['curser', 'kerser'] },
  // Removido 'limite'/'limites'/'plante': palavras comuns em pt-BR. Mesmo
  // sendo o caso real do print original ("limite la" -> "prompt la"), o
  // custo de trocar "tem limite" por "tem prompt" eh maior que o ganho.
  { canonical: 'prompt', variants: ['promp', 'pront', 'prompti', 'pronpte'], weight: 2 },
  { canonical: 'prompts', variants: ['prompis', 'pronts'], weight: 2 },
  { canonical: 'modelo', variants: ['model'] },
  { canonical: 'modelos', variants: ['modeles'] },
  // ATENCAO: NAO adicionar "a gente" como variante de "agente". "a gente"
  // eh pronome coloquial pt-BR (= nos/we) e ocorre o tempo todo em fala
  // natural. O fuzzy ia juntar os dois tokens e trocar o sujeito da frase.
  { canonical: 'agente', variants: ['agent', 'agenti'] },
  { canonical: 'agentes', variants: ['agents'] },
  { canonical: 'agentic', variants: ['agentic ai', 'a gentic', 'a gêntic'] },
  { canonical: 'token', variants: ['tóquen', 'toquem', 'toquen'] },
  { canonical: 'tokens', variants: ['tóquens', 'toquens'] },
  { canonical: 'embedding', variants: ['embeding', 'embed in', 'imbedding'] },
  { canonical: 'embeddings', variants: ['embedins', 'imbeddings'] },
  { canonical: 'RAG', variants: ['hag', 'rag', 'h a g', 'érre a gê'] },
  { canonical: 'fine-tuning', variants: ['fine tuning', 'faine tuning', 'fai tuning'] },
  { canonical: 'fine-tune', variants: ['fine tune', 'faine tune'] },
  { canonical: 'transformer', variants: ['transformers', 'transforme'] },
  { canonical: 'atenção', variants: ['atensão'] },
  { canonical: 'inferência', variants: ['inferenssia', 'inferensia'] },
  { canonical: 'treinamento', variants: ['treino', 'training'] },
  { canonical: 'alucinação', variants: ['hallucination', 'alusinação'] },
  { canonical: 'alucinações', variants: ['hallucinations', 'alusinacoes'] },
  // Removido 'contexto': palavra comum, falaria-se "contexto" o tempo todo
  // sem se referir a context window.
  { canonical: 'context window', variants: ['context windou', 'janela de contexto'] },
  { canonical: 'MCP', variants: ['m c p', 'eme cê pê', 'eme ce pe'], weight: 2 },
  { canonical: 'API key', variants: ['ape i quei', 'a pi key', 'ape i ki'] },
  { canonical: 'OpenAI', variants: ['open ai', 'open a i', 'open éi'] },
  { canonical: 'Anthropic', variants: ['antropic', 'anthropic', 'antropi'] },
  { canonical: 'Hugging Face', variants: ['ranguin face', 'haguen face', 'hugin face'] },
  { canonical: 'streaming', variants: ['estriming', 'striming'] },
  { canonical: 'tokenização', variants: ['toquenização', 'tokenizassão'] },
  { canonical: 'guardrails', variants: ['guard rails', 'guardreils', 'guardreil'] },
  { canonical: 'few-shot', variants: ['few shot', 'fiu shot', 'fiu chot'] },
  { canonical: 'zero-shot', variants: ['zero shot', 'zero chot'] },
  { canonical: 'chain of thought', variants: ['chain of thot', 'cheini ofi tot'] },
  { canonical: 'machine learning', variants: ['machin learning', 'mexin lerning'] },
  { canonical: 'deep learning', variants: ['dip learning', 'dipi lerning'] },
];

// Limite defensivo: matcher fuzzy roda em cada interim e janela 1-3 cresce
// linearmente com o vocabulario. 200 entradas combinadas (base + sala) ainda
// rodam confortavelmente em devices fracos.
export const MAX_VOCAB_ENTRIES = 200;

const STORAGE_PREFIX = 'tt-vocab-';

export function loadRoomVocabulary(roomCode: string): VocabularyEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + roomCode);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).slice(0, MAX_VOCAB_ENTRIES);
  } catch {
    return [];
  }
}

export function saveRoomVocabulary(roomCode: string, entries: VocabularyEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = entries.filter(isValidEntry).slice(0, MAX_VOCAB_ENTRIES);
    window.localStorage.setItem(STORAGE_PREFIX + roomCode, JSON.stringify(trimmed));
  } catch {
    // Quota cheia ou storage indisponivel: silencioso, usuario nao ve diferenca.
  }
}

// Combina base + sala dedupando por canonical (case-insensitive). Sala vence
// em caso de colisao pra permitir ajustar variantes do termo base.
export function mergeVocabularies(...sources: VocabularyEntry[][]): VocabularyEntry[] {
  const map = new Map<string, VocabularyEntry>();
  for (const list of sources) {
    for (const entry of list) {
      if (!isValidEntry(entry)) continue;
      map.set(entry.canonical.toLowerCase(), entry);
    }
  }
  return Array.from(map.values()).slice(0, MAX_VOCAB_ENTRIES);
}

// Parser do formato textual da UI: uma linha por entrada, primeira palavra
// (ou trecho ate a primeira virgula) e o canonical, demais separadas por
// virgula sao variantes. Linhas em branco e comecando com # sao ignoradas.
//   Next.js, nexta, nestes
//   DevParaná
//   # comentario
export function parseVocabularyText(text: string): VocabularyEntry[] {
  const out: VocabularyEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const [canonical, ...variants] = parts;
    out.push(variants.length > 0 ? { canonical, variants } : { canonical });
  }
  return out;
}

export function serializeVocabulary(entries: VocabularyEntry[]): string {
  return entries
    .map((e) => (e.variants && e.variants.length > 0 ? [e.canonical, ...e.variants].join(', ') : e.canonical))
    .join('\n');
}

function isValidEntry(value: unknown): value is VocabularyEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.canonical !== 'string' || v.canonical.trim().length === 0) return false;
  if (v.variants !== undefined && !Array.isArray(v.variants)) return false;
  return true;
}

import type {
  ArixStatePayload,
  AuditIssue,
  BrainSettings,
  ChatEngineUsed,
  LocalLlmStatus,
  TaughtRule,
  TechnicalSignals,
  WebsiteAudit,
} from '../src/types/arix.ts';
import {
  findLocalFiles,
  listComputerEntries,
  readLocalFile,
  runComputerCommand,
} from './computer.ts';
import { OFFLINE_KNOWLEDGE_LIBRARY } from './offlineKnowledge.ts';
import { addKnowledgeNote, addRule } from './store.ts';

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'and',
  'or',
  'but',
  'if',
  'then',
  'so',
  'do',
  'does',
  'did',
  'can',
  'could',
  'should',
  'would',
  'will',
  'my',
  'me',
  'i',
  'you',
  'your',
  'we',
  'our',
  'it',
  'this',
  'that',
  'these',
  'those',
  'what',
  'how',
  'why',
  'when',
  'where',
  'who',
  'about',
  'please',
  'tell',
  'give',
  'show',
  'make',
  'need',
  'want',
  'have',
  'has',
  'had',
  'just',
]);

export function isNetworkOfflineError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const causeMsg =
    err instanceof Error && err.cause
      ? String(err.cause).toLowerCase()
      : '';
  const combined = `${msg} ${causeMsg}`;
  return (
    combined.includes('enotfound') ||
    combined.includes('eai_again') ||
    combined.includes('enetunreach') ||
    combined.includes('ehostunreach') ||
    combined.includes('econnrefused') ||
    combined.includes('econnreset') ||
    combined.includes('etimedout') ||
    combined.includes('fetch failed') ||
    combined.includes('networkerror') ||
    combined.includes('socket hang up') ||
    combined.includes('getaddrinfo') ||
    combined.includes('offline')
  );
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9#+._/-]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

interface SearchableDocument {
  id: string;
  sourceType:
    | 'knowledge_note'
    | 'taught_rule'
    | 'website_knowledge'
    | 'audit'
    | 'chat_memory'
    | 'built_in';
  sourceLabel: string;
  title: string;
  content: string;
  tags: string[];
  priorityBoost: number;
}

export interface RetrievedMatch {
  doc: SearchableDocument;
  score: number;
}

export function retrieveRelevantKnowledge(
  query: string,
  state: ArixStatePayload,
  options?: { limit?: number; includeChatMemory?: boolean; visitorOnly?: boolean }
): RetrievedMatch[] {
  const limit = options?.limit ?? 4;
  const includeChatMemory =
    options?.includeChatMemory ?? state.brainSettings.autoIndexChat;
  const visitorOnly = options?.visitorOnly === true;

  const docs: SearchableDocument[] = [];

  if (state.widgetSettings.siteKnowledge.trim()) {
    const blocks = state.widgetSettings.siteKnowledge
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean);
    blocks.forEach((block, idx) => {
      docs.push({
        id: `site-kb-${idx}`,
        sourceType: 'website_knowledge',
        sourceLabel: 'Website Knowledge',
        title: `Website Info #${idx + 1}`,
        content: block,
        tags: ['website', 'site', 'support', 'info', 'help'],
        priorityBoost: visitorOnly ? 3.2 : 1.7,
      });
    });
  }

  for (const note of state.knowledgeNotes) {
    if (visitorOnly && note.category !== 'website') continue;
    docs.push({
      id: note.id,
      sourceType: 'knowledge_note',
      sourceLabel: 'Offline Knowledge Vault',
      title: note.title,
      content: note.content,
      tags: [...note.tags, note.category],
      priorityBoost: 2.6,
    });
  }

  if (!visitorOnly) {
    for (const rule of state.rules.filter((r) => r.active)) {
      docs.push({
        id: rule.id,
        sourceType: 'taught_rule',
        sourceLabel: `Taught Rule (${rule.weight})`,
        title: rule.title,
        content: rule.instruction,
        tags: [rule.category, rule.weight, 'rule'],
        priorityBoost: rule.weight === 'strict' ? 2.1 : 1.7,
      });
    }

    for (const audit of state.audits.slice(0, 12)) {
      const topIssues = audit.issues
        .slice(0, 4)
        .map((i) => `- [${i.priority}] ${i.title}: ${i.solutionSummary}`)
        .join('\n');
      docs.push({
        id: audit.id,
        sourceType: 'audit',
        sourceLabel: 'Saved Website Audit',
        title: `Audit: ${audit.targetLabel}`,
        content: `${audit.summary}\n${topIssues}`,
        tags: ['audit', 'website', 'ux', audit.targetLabel.toLowerCase()],
        priorityBoost: 1.5,
      });
    }

    if (includeChatMemory) {
      const history = state.chatHistory;
      for (let i = 0; i < history.length - 1; i++) {
        const u = history[i];
        const a = history[i + 1];
        if (
          u.role === 'user' &&
          a.role === 'arix' &&
          a.content.length >= 30 &&
          a.engineUsed !== 'offline_knowledge'
        ) {
          docs.push({
            id: `mem-${a.id}`,
            sourceType: 'chat_memory',
            sourceLabel: 'Remembered Past Answer',
            title: u.content.slice(0, 90),
            content: a.content.slice(0, 2200),
            tags: tokenize(u.content).slice(0, 8),
            priorityBoost: 1.45,
          });
        }
      }
    }

    for (const kb of OFFLINE_KNOWLEDGE_LIBRARY) {
      docs.push({
        id: kb.id,
        sourceType: 'built_in',
        sourceLabel: 'Arix Core Offline Knowledge',
        title: kb.title,
        content: kb.content,
        tags: [...kb.tags, kb.category],
        priorityBoost: 1.25,
      });
    }
  }

  const queryLower = query.toLowerCase().trim();
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored: RetrievedMatch[] = [];

  for (const doc of docs) {
    const titleLower = doc.title.toLowerCase();
    const contentLower = doc.content.toLowerCase();
    const tagSet = new Set(doc.tags.map((t) => t.toLowerCase()));
    const contentTokens = new Set(tokenize(`${doc.title} ${doc.content}`));

    let score = 0;
    let matchedCount = 0;

    for (const tok of queryTokens) {
      let tokHit = false;
      if (tagSet.has(tok)) {
        score += 4.2;
        tokHit = true;
      }
      if (titleLower.includes(tok)) {
        score += 3.5;
        tokHit = true;
      }
      if (contentTokens.has(tok)) {
        score += 2.0;
        tokHit = true;
      } else if (tok.length >= 4 && contentLower.includes(tok)) {
        score += 1.2;
        tokHit = true;
      }
      if (tokHit) matchedCount++;
    }

    if (queryLower.length >= 4 && titleLower.includes(queryLower)) {
      score += 8;
    } else if (queryLower.length >= 6 && contentLower.includes(queryLower)) {
      score += 5;
    }

    if (matchedCount > 0) {
      const coverage = matchedCount / queryTokens.length;
      const finalScore = (score + coverage * 4) * doc.priorityBoost;
      if (finalScore >= 3.2) {
        scored.push({ doc, score: finalScore });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// Safe arithmetic/math evaluator (zero eval/Function on arbitrary JS)
function tryEvaluateMathExpression(input: string): string | null {
  const cleaned = input
    .trim()
    .replace(/^(calculate|calc|compute|solve|what is|what's|=)\s+/i, '')
    .replace(/\?+$/, '')
    .trim();

  if (!cleaned || cleaned.length > 140) return null;
  if (!/[0-9]/.test(cleaned)) return null;
  if (!/[+\-*/%^()]|\b(sqrt|abs|round|floor|ceil|sin|cos|tan|log|pi)\b/i.test(cleaned)) {
    return null;
  }

  // Only allow safe math characters and known math identifiers
  const stripped = cleaned
    .replace(/\b(sqrt|abs|round|floor|ceil|sin|cos|tan|log|pow|min|max|pi)\b/gi, '')
    .replace(/[0-9.+\-*/%^(),\s]/g, '');

  if (stripped.length > 0) return null;

  try {
    const expr = cleaned
      .replace(/\^/g, '**')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(
        /\b(sqrt|abs|round|floor|ceil|sin|cos|tan|log|pow|min|max)\b/gi,
        (m) => `Math.${m.toLowerCase()}`
      );

    // Safe strictly validated mathematical expression
    const result = Function(`"use strict"; return (${expr});`)() as unknown;
    if (typeof result === 'number' && Number.isFinite(result)) {
      const formatted = Number.isInteger(result)
        ? result.toLocaleString('en-US')
        : Number(result.toFixed(8)).toString();
      return `**Offline Calculation:**\n\`${cleaned}\` = **${formatted}**`;
    }
  } catch {
    return null;
  }
  return null;
}

export async function detectLocalLlm(
  rawEndpoint: string,
  preferredModel?: string
): Promise<LocalLlmStatus> {
  const endpoint = (rawEndpoint || 'http://127.0.0.1:11434')
    .trim()
    .replace(/\/+$/, '');

  // 1. Try Ollama native endpoint (/api/tags)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(`${endpoint}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as {
        models?: Array<{ name?: string; model?: string }>;
      };
      const models = (data.models || [])
        .map((m) => m.name || m.model || '')
        .filter(Boolean);
      const activeModel =
        preferredModel && models.includes(preferredModel)
          ? preferredModel
          : preferredModel || models[0] || '';
      return {
        available: models.length > 0,
        provider: 'ollama',
        endpoint,
        models,
        activeModel,
        error:
          models.length === 0
            ? 'Ollama is running, but no models are downloaded yet. Run: ollama pull qwen2.5-coder:7b'
            : undefined,
      };
    }
  } catch {
    // Fall through to OpenAI-compatible local endpoint check
  }

  // 2. Try OpenAI-compatible local runtime (LM Studio / llama.cpp / vLLM)
  try {
    const base = endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(`${base}/models`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as {
        data?: Array<{ id?: string }>;
      };
      const models = (data.data || [])
        .map((m) => m.id || '')
        .filter(Boolean);
      const activeModel =
        preferredModel && models.includes(preferredModel)
          ? preferredModel
          : preferredModel || models[0] || '';
      return {
        available: models.length > 0,
        provider: 'openai_compatible',
        endpoint: base,
        models,
        activeModel,
      };
    }
  } catch {
    // Neither running
  }

  return {
    available: false,
    provider: 'none',
    endpoint,
    models: [],
    activeModel: preferredModel || '',
    error: `No local LLM detected at ${endpoint}. Built-in Offline Knowledge Engine is ready immediately, or start Ollama on your PC for full local LLM chat.`,
  };
}

export async function queryLocalLlm(params: {
  settings: BrainSettings;
  systemInstruction: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
}): Promise<{ reply: string; modelUsed: string; provider: string }> {
  const status = await detectLocalLlm(
    params.settings.localLlmUrl,
    params.settings.localLlmModel
  );
  if (!status.available || !status.activeModel) {
    throw new Error(
      status.error ||
        `No local LLM model available at ${params.settings.localLlmUrl}.`
    );
  }

  const messages = [
    { role: 'system', content: params.systemInstruction },
    ...params.history.slice(-10),
    { role: 'user', content: params.userMessage },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    if (status.provider === 'ollama') {
      const res = await fetch(`${status.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: status.activeModel,
          messages,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Ollama returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        message?: { content?: string };
      };
      const text = (data.message?.content || '').trim();
      if (!text) {
        throw new Error('Ollama returned an empty response.');
      }
      return {
        reply: text,
        modelUsed: status.activeModel,
        provider: 'Ollama Local LLM',
      };
    }

    // OpenAI-compatible local server (LM Studio, llama-server, LocalAI)
    const res = await fetch(`${status.endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: status.activeModel,
        messages,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Local OpenAI-compatible server returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = (data.choices?.[0]?.message?.content || '').trim();
    if (!text) {
      throw new Error('Local LLM returned an empty response.');
    }
    return {
      reply: text,
      modelUsed: status.activeModel,
      provider: 'Local LLM',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface OfflineEngineResult {
  reply: string;
  engineUsed: ChatEngineUsed;
  engineLabel: string;
  toolsInvoked: string[];
  newlyLearnedRules: TaughtRule[];
}

export async function runOfflineKnowledgeEngine(params: {
  message: string;
  state: ArixStatePayload;
  rootDir: string;
  offlineReason?: string;
}): Promise<OfflineEngineResult> {
  const { message, state, rootDir, offlineReason } = params;
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const toolsInvoked: string[] = ['offlineKnowledgeBrain'];
  const newlyLearnedRules: TaughtRule[] = [];

  const headerNote = offlineReason
    ? `> **Offline Brain Active:** ${offlineReason}\n\n`
    : '';

  // 1. Offline Teach / Remember Rule
  const teachRuleMatch = trimmed.match(
    /^(?:teach(?:\s+arix)?|add rule|rule)\s*:\s*(.+)$/is
  );
  if (teachRuleMatch) {
    const body = teachRuleMatch[1].trim();
    const title = body.split(/[.!?\n]/)[0].slice(0, 64) || 'Offline Taught Rule';
    const saved = addRule({
      title,
      instruction: body,
      category: 'owner_directive',
      weight: 'strict',
      active: true,
      source: 'chat',
    });
    newlyLearnedRules.push(saved);
    toolsInvoked.push('saveTaughtRule');
    return {
      reply: `${headerNote}Saved permanently to my local brain (\`data/arix-memory.json\`):\n\n- **Rule:** ${saved.title}\n- **Instruction:** ${saved.instruction}\n\nI will follow this both offline and online.`,
      engineUsed: 'offline_knowledge',
      engineLabel: 'Arix Offline Knowledge Brain',
      toolsInvoked,
      newlyLearnedRules,
    };
  }

  // 2. Offline Save Knowledge Note ("remember: ..." or "save note: ...")
  const noteMatch = trimmed.match(
    /^(?:remember(?:\s+that)?|save\s+note|learn|note)\s*:\s*(.+)$/is
  );
  if (noteMatch) {
    const body = noteMatch[1].trim();
    const firstLine = body.split('\n')[0].trim();
    const title = firstLine.slice(0, 72) || 'Saved Offline Note';
    const tags = tokenize(body).slice(0, 8);
    const savedNote = addKnowledgeNote({
      title,
      content: body,
      category: 'personal',
      tags,
      source: 'chat',
    });
    toolsInvoked.push('saveKnowledgeNote');
    return {
      reply: `${headerNote}Stored in my **Offline Knowledge Vault** (\`data/arix-memory.json\`):\n\n- **Title:** ${savedNote.title}\n- **Tags:** ${savedNote.tags.join(', ') || 'general'}\n\nAsk me about it anytime — even with zero internet.`,
      engineUsed: 'offline_knowledge',
      engineLabel: 'Arix Offline Knowledge Brain',
      toolsInvoked,
      newlyLearnedRules,
    };
  }

  // 3. Real Local Terminal Command ("run command: ...")
  const cmdMatch = trimmed.match(/^(?:run\s+command|cmd|exec|shell)\s*:\s*(.+)$/i);
  if (cmdMatch) {
    const command = cmdMatch[1].trim();
    toolsInvoked.push('runComputerCommand');
    const result = await runComputerCommand(command, '.', rootDir);
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    return {
      reply: `${headerNote}Executed locally in \`${result.cwd}\` (exit code \`${result.exitCode}\`):\n\n\`\`\`text\n${output || '(no output)'}\n\`\`\``,
      engineUsed: 'offline_knowledge',
      engineLabel: 'Arix Offline Local Tools',
      toolsInvoked,
      newlyLearnedRules,
    };
  }

  // 4. Real Local File Read ("read file <path>")
  const readMatch = trimmed.match(/^(?:read|open|show|view)\s+file\s+["']?([^"'\n]+)["']?$/i);
  if (readMatch) {
    const filePath = readMatch[1].trim();
    toolsInvoked.push('readLocalFile');
    try {
      const file = readLocalFile(filePath, rootDir);
      const ext = file.path.split('.').pop() || 'text';
      return {
        reply: `${headerNote}**Local File:** \`${file.path}\` (${file.sizeBytes.toLocaleString()} bytes)\n\n\`\`\`${ext}\n${file.content.slice(0, 8000)}\n\`\`\``,
        engineUsed: 'offline_knowledge',
        engineLabel: 'Arix Offline Local Tools',
        toolsInvoked,
        newlyLearnedRules,
      };
    } catch (err) {
      return {
        reply: `${headerNote}Could not read \`${filePath}\`: ${err instanceof Error ? err.message : 'File not found.'}`,
        engineUsed: 'offline_knowledge',
        engineLabel: 'Arix Offline Local Tools',
        toolsInvoked,
        newlyLearnedRules,
      };
    }
  }

  // 5. Real Local File Search ("find file <query>")
  const findMatch = trimmed.match(/^(?:find|search)\s+files?\s+(.+)$/i);
  if (findMatch) {
    const query = findMatch[1].trim();
    toolsInvoked.push('findLocalFiles');
    const matches = findLocalFiles(query, rootDir, 30);
    const list =
      matches.length > 0
        ? matches.map((m) => `- \`${m.relativePath}\` (${m.type})`).join('\n')
        : `No files matched "${query}" in \`${rootDir}\`.`;
    return {
      reply: `${headerNote}**Local File Search for \`${query}\`** (${matches.length} found):\n\n${list}`,
      engineUsed: 'offline_knowledge',
      engineLabel: 'Arix Offline Local Tools',
      toolsInvoked,
      newlyLearnedRules,
    };
  }

  // 6. Real Local Folder Listing ("list files ...")
  const listMatch = trimmed.match(/^(?:list|show)\s+(?:files|folder|dir|directory)(?:\s+in)?(?:\s+["']?([^"'\n]+)["']?)?$/i);
  if (listMatch) {
    const rel = (listMatch[1] || '.').trim();
    toolsInvoked.push('listComputerFolder');
    try {
      const listing = listComputerEntries(rel, rootDir);
      const rows = listing.entries
        .slice(0, 50)
        .map(
          (e) =>
            `- ${e.type === 'directory' ? '[Folder]' : '[File]'} \`${e.relativePath}\`${e.type === 'file' ? ` (${e.sizeBytes.toLocaleString()} B)` : ''}`
        )
        .join('\n');
      return {
        reply: `${headerNote}**Workspace Folder:** \`${listing.currentPath}\`\n\n${rows || '(empty folder)'}`,
        engineUsed: 'offline_knowledge',
        engineLabel: 'Arix Offline Local Tools',
        toolsInvoked,
        newlyLearnedRules,
      };
    } catch (err) {
      return {
        reply: `${headerNote}Could not list folder \`${rel}\`: ${err instanceof Error ? err.message : 'Invalid path'}`,
        engineUsed: 'offline_knowledge',
        engineLabel: 'Arix Offline Local Tools',
        toolsInvoked,
        newlyLearnedRules,
      };
    }
  }

  // 7. Date & Time offline
  if (/^(what(?:'s| is) the )?(current )?(time|date|day)( today| now)?\??$/i.test(lower)) {
    const now = new Date();
    return {
      reply: `${headerNote}**Local System Time:** ${now.toLocaleString()}\n**ISO Timestamp:** \`${now.toISOString()}\``,
      engineUsed: 'offline_knowledge',
      engineLabel: 'Arix Offline Knowledge Brain',
      toolsInvoked,
      newlyLearnedRules,
    };
  }

  // 8. Safe Math Calculation offline
  const mathResult = tryEvaluateMathExpression(trimmed);
  if (mathResult) {
    return {
      reply: `${headerNote}${mathResult}`,
      engineUsed: 'offline_knowledge',
      engineLabel: 'Arix Offline Math Engine',
      toolsInvoked,
      newlyLearnedRules,
    };
  }

  // 9. Owner Identity / Rules / Status Summary
  if (
    /^(who are you|hi|hello|hey|status|my rules|what do you know|show knowledge)\b/i.test(
      lower
    ) &&
    trimmed.length < 48
  ) {
    const activeRules = state.rules.filter((r) => r.active);
    const rulesPreview = activeRules
      .slice(0, 6)
      .map((r) => `- **${r.title}** (${r.weight}): ${r.instruction}`)
      .join('\n');
    return {
      reply: `${headerNote}I am **Arix**, ${state.persona.ownerName}'s personal autonomous AI — currently running in **100% Offline Knowledge Mode** directly on your machine.\n\n**Local Brain Loaded:**\n- **${state.knowledgeNotes.length}** custom Offline Knowledge Vault notes\n- **${activeRules.length}** active Taught Rules\n- **${OFFLINE_KNOWLEDGE_LIBRARY.length}** built-in engineering & operations guides\n- **${state.audits.length}** saved website audits · **${state.connections.length}** connected sites\n- **Workspace Root:** \`${rootDir}\`\n\n${rulesPreview ? `**Active Rules:**\n${rulesPreview}\n\n` : ''}**Offline Quick Commands:**\n- Ask any coding, Git, PowerShell, Electron, SQL, Cloudflare, or UX question\n- \`teach: <rule>\` or \`remember: <fact/note>\` to permanently grow my offline brain\n- \`list files\`, \`find file <name>\`, \`read file <path>\`, or \`run command: <cmd>\`\n- For full conversational offline AI generation, connect **Ollama** in the **Offline Brain** tab.`,
      engineUsed: 'offline_knowledge',
      engineLabel: 'Arix Offline Knowledge Brain',
      toolsInvoked,
      newlyLearnedRules,
    };
  }

  // 10. Knowledge Vault + Rules + Audits + Past Memory + Built-in Corpus Retrieval
  const matches = retrieveRelevantKnowledge(trimmed, state, { limit: 3 });

  if (matches.length > 0) {
    const primary = matches[0];
    const secondary = matches.slice(1);
    const parts: string[] = [];

    parts.push(
      `### ${primary.doc.title}\n*Source: ${primary.doc.sourceLabel}*\n\n${primary.doc.content}`
    );

    if (secondary.length > 0) {
      parts.push(
        `\n---\n**Related Local Knowledge:**\n` +
          secondary
            .map(
              (m) =>
                `- **${m.doc.title}** (*${m.doc.sourceLabel}*): ${m.doc.content
                  .replace(/```[\s\S]*?```/g, '[code snippet]')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 220)}`
            )
            .join('\n')
      );
    }

    return {
      reply: `${headerNote}${parts.join('\n')}`,
      engineUsed: 'offline_knowledge',
      engineLabel: 'Arix Offline Knowledge Brain',
      toolsInvoked,
      newlyLearnedRules,
    };
  }

  // 11. Graceful guidance when no exact local knowledge entry matched yet
  return {
    reply: `${headerNote}I searched your **Offline Knowledge Vault** (${state.knowledgeNotes.length} notes), **${state.rules.filter((r) => r.active).length} Taught Rules**, past chat memory, and built-in engineering guides, but I don't have a stored offline entry matching **"${trimmed.slice(0, 100)}"** yet.\n\n**How to handle this offline right now:**\n1. **Teach me this topic offline:** Reply with \`remember: <your notes or answer>\` or add a document in the **Offline Brain** tab.\n2. **Run a local neural model (100% offline, any topic):** Install **Ollama** on your PC (\`winget install Ollama.Ollama\` then \`ollama pull qwen2.5-coder:7b\`) and select it in the **Offline Brain** tab so Arix can reason about any topic without internet.\n3. **Use local offline tools:** Try \`list files\`, \`find file <name>\`, \`read file <path>\`, \`run command: <cmd>\`, or any math calculation.`,
    engineUsed: 'offline_knowledge',
    engineLabel: 'Arix Offline Knowledge Brain',
    toolsInvoked,
    newlyLearnedRules,
  };
}

export function runOfflineVisitorAssistant(
  question: string,
  state: ArixStatePayload
): string {
  const matches = retrieveRelevantKnowledge(question, state, {
    limit: 2,
    includeChatMemory: false,
    visitorOnly: true,
  });

  if (matches.length > 0) {
    return matches
      .map((m) => m.doc.content.trim())
      .join('\n\n')
      .slice(0, 1800);
  }

  if (state.widgetSettings.siteKnowledge.trim()) {
    return `Here is what I know about this website:\n\n${state.widgetSettings.siteKnowledge.trim().slice(0, 1000)}\n\nIf you need more specific help, please contact the site owner.`;
  }

  return `${state.widgetSettings.welcomeMessage} I am currently running in offline knowledge mode — please ask about information listed on this site or reach out to the site owner for direct support.`;
}

export function buildOfflineCodeAudit(params: {
  targetLabel: string;
  inputType: 'url' | 'code' | 'screenshot';
  url?: string;
  signals: TechnicalSignals;
  appliedRulesUsed: string[];
}): WebsiteAudit {
  const { targetLabel, inputType, url, signals, appliedRulesUsed } = params;
  const issues: AuditIssue[] = [];
  let idx = 1;

  const pushIssue = (
    item: Omit<AuditIssue, 'id' | 'status'>
  ) => {
    issues.push({
      ...item,
      id: `issue-offline-${idx++}`,
      status: 'open',
    });
  };

  if (signals.hasViewportMeta === false) {
    pushIssue({
      title: 'Missing responsive mobile viewport meta tag',
      priority: 'P0 Critical',
      uxImpactScore: 95,
      category: 'Mobile UX',
      affectedArea: '<head> document metadata',
      userExperienceImpact:
        'Mobile visitors see a zoomed-out desktop layout with tiny unreadable text and awkward horizontal scrolling.',
      evidence: 'No <meta name="viewport"> tag detected in the HTML head.',
      solutionSummary:
        'Add the standard responsive viewport meta tag inside <head>.',
      beforeCode: '<head>\n  <title>Site</title>\n</head>',
      afterCode:
        '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Site</title>\n</head>',
      matchedTaughtRule: appliedRulesUsed[0] || 'Offline Core UX Checklist',
      impactDimensions: {
        taskCompletion: 90,
        accessibility: 88,
        perceivedSpeed: 65,
        trustAndClarity: 92,
      },
    });
  }

  if ((signals.unlabeledInputs || 0) > 0) {
    pushIssue({
      title: `${signals.unlabeledInputs} form input(s) missing accessible labels`,
      priority: 'P0 Critical',
      uxImpactScore: 91,
      category: 'Accessibility',
      affectedArea: 'Form controls (<input>, <textarea>, <select>)',
      userExperienceImpact:
        'Screen reader and keyboard users cannot tell what data is required, blocking form completion.',
      evidence: `Detected ${signals.unlabeledInputs} input element(s) without id/label, aria-label, or placeholder.`,
      solutionSummary:
        'Associate every form input with a visible <label htmlFor="..."> or aria-label.',
      beforeCode: '<input type="email" />',
      afterCode:
        '<label htmlFor="user-email">Email Address</label>\n<input id="user-email" type="email" autocomplete="email" />',
      matchedTaughtRule: appliedRulesUsed[0] || 'Offline Core UX Checklist',
      impactDimensions: {
        taskCompletion: 94,
        accessibility: 98,
        perceivedSpeed: 40,
        trustAndClarity: 86,
      },
    });
  }

  if ((signals.emptyInteractiveElements || 0) > 0) {
    pushIssue({
      title: `${signals.emptyInteractiveElements} empty or unlabeled interactive buttons/links`,
      priority: 'P0 Critical',
      uxImpactScore: 89,
      category: 'Accessibility',
      affectedArea: 'Buttons and anchor links',
      userExperienceImpact:
        'Icon-only buttons without aria-label are announced as blank buttons to assistive technologies.',
      evidence: `Found ${signals.emptyInteractiveElements} button/link element(s) without visible text or aria-label.`,
      solutionSummary: 'Add descriptive aria-label text to all icon-only controls.',
      beforeCode: '<button><svg>...</svg></button>',
      afterCode: '<button type="button" aria-label="Open menu"><svg aria-hidden="true">...</svg></button>',
      matchedTaughtRule: appliedRulesUsed[0] || 'Offline Core UX Checklist',
      impactDimensions: {
        taskCompletion: 88,
        accessibility: 96,
        perceivedSpeed: 30,
        trustAndClarity: 85,
      },
    });
  }

  if ((signals.imagesMissingAlt || 0) > 0) {
    pushIssue({
      title: `${signals.imagesMissingAlt} image(s) missing alt attributes`,
      priority: 'P1 High',
      uxImpactScore: 78,
      category: 'Accessibility',
      affectedArea: '<img> elements',
      userExperienceImpact:
        'Broken images or screen readers provide no description of visual content, hurting both accessibility and SEO.',
      evidence: `${signals.imagesMissingAlt} of ${signals.totalImages || signals.imagesMissingAlt} image(s) lack alt text.`,
      solutionSummary:
        'Add concise descriptive alt text for informative images and alt="" for purely decorative graphics.',
      beforeCode: '<img src="/banner.jpg" />',
      afterCode: '<img src="/banner.jpg" alt="Featured movie catalog banner" loading="lazy" />',
      matchedTaughtRule: appliedRulesUsed[0] || 'Offline Core UX Checklist',
      impactDimensions: {
        taskCompletion: 65,
        accessibility: 90,
        perceivedSpeed: 50,
        trustAndClarity: 76,
      },
    });
  }

  if ((signals.insecureBlankLinks || 0) > 0) {
    pushIssue({
      title: `${signals.insecureBlankLinks} external target="_blank" link(s) missing rel="noopener noreferrer"`,
      priority: 'P1 High',
      uxImpactScore: 74,
      category: 'Error & Bug',
      affectedArea: 'External links',
      userExperienceImpact:
        'Exposes window.opener to opened tabs and weakens browser tab isolation security.',
      evidence: `${signals.insecureBlankLinks} anchor tag(s) use target="_blank" without rel="noopener".`,
      solutionSummary: 'Add rel="noopener noreferrer" to every target="_blank" link.',
      beforeCode: '<a href="https://example.com" target="_blank">Visit</a>',
      afterCode:
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Visit</a>',
      matchedTaughtRule: appliedRulesUsed[0] || 'Offline Core UX Checklist',
      impactDimensions: {
        taskCompletion: 50,
        accessibility: 45,
        perceivedSpeed: 55,
        trustAndClarity: 88,
      },
    });
  }

  if ((signals.blockingScripts || 0) > 0) {
    pushIssue({
      title: `${signals.blockingScripts} render-blocking external script(s) in HTML`,
      priority: 'P1 High',
      uxImpactScore: 72,
      category: 'Performance',
      affectedArea: '<script src="..."> tags',
      userExperienceImpact:
        'Delays First Contentful Paint by pausing HTML parsing while scripts download.',
      evidence: `Found ${signals.blockingScripts} synchronous external <script> tag(s) without defer, async, or type="module".`,
      solutionSummary: 'Add defer or type="module" to non-critical external scripts.',
      beforeCode: '<script src="/app.js"></script>',
      afterCode: '<script src="/app.js" defer></script>',
      matchedTaughtRule: appliedRulesUsed[0] || 'Offline Core UX Checklist',
      impactDimensions: {
        taskCompletion: 60,
        accessibility: 40,
        perceivedSpeed: 92,
        trustAndClarity: 70,
      },
    });
  }

  if (!signals.metaDescription) {
    pushIssue({
      title: 'Missing meta description for SEO and link previews',
      priority: 'P2 Medium',
      uxImpactScore: 58,
      category: 'SEO & Structure',
      affectedArea: '<head> SEO metadata',
      userExperienceImpact:
        'Search results and shared links show random page snippets instead of a clear value proposition.',
      evidence: 'No <meta name="description"> tag found.',
      solutionSummary:
        'Add a 140–160 character <meta name="description"> tag summarizing the page.',
      beforeCode: '<head>\n  <title>My Site</title>\n</head>',
      afterCode:
        '<head>\n  <title>My Site</title>\n  <meta name="description" content="Clear summary of your site and key value." />\n</head>',
      matchedTaughtRule: appliedRulesUsed[0] || 'Offline Core UX Checklist',
      impactDimensions: {
        taskCompletion: 45,
        accessibility: 50,
        perceivedSpeed: 30,
        trustAndClarity: 75,
      },
    });
  }

  if (signals.hasLangAttr === false) {
    pushIssue({
      title: 'Missing lang attribute on <html> root element',
      priority: 'P2 Medium',
      uxImpactScore: 54,
      category: 'Accessibility',
      affectedArea: '<html> tag',
      userExperienceImpact:
        'Screen readers and browser translation tools may mispronounce page content.',
      evidence: 'No lang attribute detected on <html>.',
      solutionSummary: 'Declare lang="en" (or your primary page language) on <html>.',
      beforeCode: '<html>',
      afterCode: '<html lang="en">',
      matchedTaughtRule: appliedRulesUsed[0] || 'Offline Core UX Checklist',
      impactDimensions: {
        taskCompletion: 40,
        accessibility: 82,
        perceivedSpeed: 20,
        trustAndClarity: 60,
      },
    });
  }

  if (issues.length === 0) {
    pushIssue({
      title: 'Static HTML baseline checks passed offline',
      priority: 'P3 Low',
      uxImpactScore: 25,
      category: 'Usability & Flow',
      affectedArea: 'Overall Document Structure',
      userExperienceImpact:
        'No obvious static HTML blockers (viewport, labels, alt text, blocking scripts) were found in the offline scan.',
      evidence: 'All deterministic offline HTML checks passed.',
      solutionSummary:
        'Verify live visual contrast, keyboard focus order, and interactive states in a browser or connect a Local LLM / Cloud Brain for deep semantic review.',
      beforeCode: '<!-- Static HTML checks passed -->',
      afterCode: '<!-- Verify keyboard tab order and responsive breakpoints -->',
      matchedTaughtRule: appliedRulesUsed[0] || 'Offline Core UX Checklist',
      impactDimensions: {
        taskCompletion: 25,
        accessibility: 25,
        perceivedSpeed: 25,
        trustAndClarity: 25,
      },
    });
  }

  return {
    id: `audit-${Date.now()}`,
    targetLabel,
    inputType,
    url,
    analyzedAt: new Date().toISOString(),
    summary: `Offline Static UX & Code Audit completed for ${targetLabel}. Detected ${issues.length} finding(s) using Arix's built-in offline HTML analyzer.`,
    uxPrioritizationRationale:
      'Ranked offline by user task completion, mobile usability, accessibility blockers, security hygiene, and SEO fundamentals.',
    appliedRulesUsed,
    technicalSignals: signals,
    issues,
  };
}

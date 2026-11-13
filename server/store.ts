import fs from 'fs';
import path from 'path';
import { resolveComputerRoot } from './computer.ts';
import type {
  ArixStatePayload,
  ChatMessage,
  ConnectedSite,
  CustomSection,
  PersonaSettings,
  RuleCategory,
  TaughtRule,
  WebsiteAudit,
} from '../src/types/arix.ts';

const DATA_DIR = process.env.ARIX_DATA_DIR
  ? path.resolve(process.env.ARIX_DATA_DIR, 'data')
  : path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'arix-memory.json');
const LEGACY_STORE_FILE = path.join(DATA_DIR, 'lisa-memory.json');

interface PersistedArixStore {
  rules: TaughtRule[];
  persona: PersonaSettings;
  connections: ConnectedSite[];
  connectionTokens: Record<string, string>;
  audits: WebsiteAudit[];
  chatHistory: ChatMessage[];
  customSections: CustomSection[];
  computerRootOverride?: string;
}

const DEFAULT_PERSONA: PersonaSettings = {
  ownerName: 'Owner',
  primaryGoal:
    'Serve as my personal unrestricted AI across coding, architecture, website analysis, GitHub repositories, Cloudflare infrastructure, and custom tasks.',
  techStack: 'TypeScript, React, Node.js, Tailwind CSS, Cloudflare, GitHub',
  codingStyle: 'Clean, modular, production-ready code with zero placeholder stubs',
  tonePreference: 'Direct, precise, and solution-first',
  customDirective: '',
};

const DEFAULT_RULES: TaughtRule[] = [
  {
    id: 'rule-seed-1',
    title: 'Prioritize task-blocking UX issues first',
    instruction:
      'When analyzing websites, rank any broken navigation, form failure, unreadable contrast, or critical error as P0 Critical based on user impact.',
    category: 'analysis_ux',
    weight: 'strict',
    active: true,
    createdAt: new Date().toISOString(),
    source: 'manual',
  },
  {
    id: 'rule-seed-2',
    title: 'Deliver complete working code fixes',
    instruction:
      'For any coding or debugging request, provide complete, copy-ready implementation code aligned with my taught tech stack.',
    category: 'coding',
    weight: 'preferred',
    active: true,
    createdAt: new Date().toISOString(),
    source: 'manual',
  },
];

function mapLegacyCategory(cat: string): RuleCategory {
  if (cat === 'tech_stack') return 'coding';
  if (cat === 'ux_priority' || cat === 'brand_tone') return 'analysis_ux';
  if (cat === 'custom_check') return 'owner_directive';
  if (
    cat === 'coding' ||
    cat === 'analysis_ux' ||
    cat === 'connections' ||
    cat === 'automation' ||
    cat === 'owner_directive'
  ) {
    return cat;
  }
  return 'owner_directive';
}

function createInitialStore(): PersistedArixStore {
  if (fs.existsSync(LEGACY_STORE_FILE)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_STORE_FILE, 'utf-8'));
      const migratedRules: TaughtRule[] = Array.isArray(legacy.rules)
        ? legacy.rules.map((r: TaughtRule & { category: string }) => ({
            ...r,
            category: mapLegacyCategory(r.category),
          }))
        : DEFAULT_RULES;
      const migratedChat: ChatMessage[] = Array.isArray(legacy.chatHistory)
        ? legacy.chatHistory.map((m: ChatMessage & { role: string }) => ({
            ...m,
            role: m.role === 'user' ? 'user' : 'arix',
          }))
        : [];
      return {
        rules: migratedRules,
        persona: {
          ...DEFAULT_PERSONA,
          ...(legacy.persona || {}),
        },
        connections: [],
        connectionTokens: {},
        audits: Array.isArray(legacy.audits) ? legacy.audits : [],
        chatHistory: migratedChat,
        customSections: [],
      };
    } catch {
      // Fallback to fresh store
    }
  }
  return {
    rules: DEFAULT_RULES,
    persona: DEFAULT_PERSONA,
    connections: [],
    connectionTokens: {},
    audits: [],
    chatHistory: [],
    customSections: [],
  };
}

function ensureStore(): PersistedArixStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    const initial = createInitialStore();
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedArixStore>;
    return {
      rules: Array.isArray(parsed.rules) ? parsed.rules : DEFAULT_RULES,
      persona: { ...DEFAULT_PERSONA, ...(parsed.persona || {}) },
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      connectionTokens: parsed.connectionTokens || {},
      audits: Array.isArray(parsed.audits) ? parsed.audits : [],
      chatHistory: Array.isArray(parsed.chatHistory) ? parsed.chatHistory : [],
      customSections: Array.isArray(parsed.customSections)
        ? parsed.customSections
        : [],
      computerRootOverride: parsed.computerRootOverride,
    };
  } catch {
    const fallback = createInitialStore();
    fs.writeFileSync(STORE_FILE, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function writeStore(store: PersistedArixStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export function maskSecret(token?: string): string | undefined {
  if (!token) return undefined;
  const trimmed = token.trim();
  if (trimmed.length <= 6) return '••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function getActiveComputerRoot(): string {
  const store = ensureStore();
  return resolveComputerRoot(store.computerRootOverride);
}

export function setComputerRootOverride(newRoot: string): string {
  const clean = newRoot.trim();
  const resolved = resolveComputerRoot(clean || undefined);
  const store = ensureStore();
  store.computerRootOverride = clean || undefined;
  writeStore(store);
  return resolved;
}

export function getPublicState(): ArixStatePayload {
  const store = ensureStore();
  return {
    rules: store.rules,
    persona: store.persona,
    connections: store.connections,
    audits: store.audits,
    chatHistory: store.chatHistory,
    customSections: store.customSections,
    computerRoot: resolveComputerRoot(store.computerRootOverride),
  };
}

export function getConnectionToken(connectionId: string): string | undefined {
  const store = ensureStore();
  return store.connectionTokens[connectionId];
}

export function addRule(
  input: Omit<TaughtRule, 'id' | 'createdAt'>
): TaughtRule {
  const store = ensureStore();
  const rule: TaughtRule = {
    ...input,
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  store.rules = [rule, ...store.rules];
  writeStore(store);
  return rule;
}

export function updateRule(
  id: string,
  patch: Partial<Omit<TaughtRule, 'id' | 'createdAt'>>
): TaughtRule | null {
  const store = ensureStore();
  const idx = store.rules.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  store.rules[idx] = { ...store.rules[idx], ...patch };
  writeStore(store);
  return store.rules[idx];
}

export function deleteRule(id: string): boolean {
  const store = ensureStore();
  const before = store.rules.length;
  store.rules = store.rules.filter((r) => r.id !== id);
  if (store.rules.length === before) return false;
  writeStore(store);
  return true;
}

export function resetRulesToZero(): void {
  const store = ensureStore();
  store.rules = [];
  writeStore(store);
}

export function updatePersona(persona: Partial<PersonaSettings>): PersonaSettings {
  const store = ensureStore();
  store.persona = { ...store.persona, ...persona };
  writeStore(store);
  return store.persona;
}

export function addConnection(
  site: Omit<ConnectedSite, 'id' | 'createdAt'>,
  rawToken?: string
): ConnectedSite {
  const store = ensureStore();
  const id = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanToken = rawToken?.trim();
  const record: ConnectedSite = {
    ...site,
    id,
    createdAt: new Date().toISOString(),
    hasToken: Boolean(cleanToken),
    maskedToken: maskSecret(cleanToken),
  };
  if (cleanToken) {
    store.connectionTokens[id] = cleanToken;
  }
  store.connections = [record, ...store.connections];
  writeStore(store);
  return record;
}

export function updateConnection(
  id: string,
  patch: Partial<Omit<ConnectedSite, 'id' | 'createdAt'>>,
  rawToken?: string
): ConnectedSite | null {
  const store = ensureStore();
  const idx = store.connections.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const current = store.connections[idx];
  const updated: ConnectedSite = {
    ...current,
    ...patch,
  };
  if (rawToken !== undefined) {
    const cleanToken = rawToken.trim();
    if (cleanToken) {
      store.connectionTokens[id] = cleanToken;
      updated.hasToken = true;
      updated.maskedToken = maskSecret(cleanToken);
    } else {
      delete store.connectionTokens[id];
      updated.hasToken = false;
      updated.maskedToken = undefined;
    }
  }
  store.connections[idx] = updated;
  writeStore(store);
  return updated;
}

export function deleteConnection(id: string): boolean {
  const store = ensureStore();
  const before = store.connections.length;
  store.connections = store.connections.filter((c) => c.id !== id);
  delete store.connectionTokens[id];
  if (store.connections.length === before) return false;
  writeStore(store);
  return true;
}

export function saveAudit(audit: WebsiteAudit): WebsiteAudit {
  const store = ensureStore();
  store.audits = [audit, ...store.audits].slice(0, 30);
  writeStore(store);
  return audit;
}

export function updateIssueStatus(
  auditId: string,
  issueId: string,
  status: 'open' | 'resolved'
): WebsiteAudit | null {
  const store = ensureStore();
  const audit = store.audits.find((a) => a.id === auditId);
  if (!audit) return null;
  const issue = audit.issues.find((i) => i.id === issueId);
  if (!issue) return null;
  issue.status = status;
  writeStore(store);
  return audit;
}

export function deleteAudit(auditId: string): boolean {
  const store = ensureStore();
  const before = store.audits.length;
  store.audits = store.audits.filter((a) => a.id !== auditId);
  if (store.audits.length === before) return false;
  writeStore(store);
  return true;
}

export function appendChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const store = ensureStore();
  store.chatHistory = [...store.chatHistory, ...messages].slice(-100);
  writeStore(store);
  return store.chatHistory;
}

export function clearChatHistory(): void {
  const store = ensureStore();
  store.chatHistory = [];
  writeStore(store);
}

export function getCustomSections(): CustomSection[] {
  return ensureStore().customSections;
}

export function addCustomSection(
  input: Omit<CustomSection, 'id' | 'createdAt' | 'updatedAt'>
): CustomSection {
  const store = ensureStore();
  const now = new Date().toISOString();
  const section: CustomSection = {
    ...input,
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    updatedAt: now,
  };
  store.customSections = [section, ...store.customSections];
  writeStore(store);
  return section;
}

export function updateCustomSection(
  idOrTitle: string,
  patch: Partial<Omit<CustomSection, 'id' | 'createdAt'>>
): CustomSection | null {
  const store = ensureStore();
  const lower = idOrTitle.trim().toLowerCase();
  const idx = store.customSections.findIndex(
    (s) =>
      s.id === idOrTitle ||
      s.title.toLowerCase() === lower ||
      s.navLabel.toLowerCase() === lower
  );
  if (idx === -1) return null;
  store.customSections[idx] = {
    ...store.customSections[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.customSections[idx];
}

export function deleteCustomSection(idOrTitle: string): boolean {
  const store = ensureStore();
  const lower = idOrTitle.trim().toLowerCase();
  const before = store.customSections.length;
  store.customSections = store.customSections.filter(
    (s) =>
      s.id !== idOrTitle &&
      s.title.toLowerCase() !== lower &&
      s.navLabel.toLowerCase() !== lower
  );
  if (store.customSections.length === before) return false;
  writeStore(store);
  return true;
}

export function exportPortableBrain() {
  const state = getPublicState();
  return {
    exportedAt: new Date().toISOString(),
    aiName: 'Arix',
    version: 2,
    persona: state.persona,
    rules: state.rules,
    customSections: state.customSections,
    connections: state.connections.map((c) => ({
      name: c.name,
      type: c.type,
      targetUrl: c.targetUrl,
      identifier: c.identifier,
      active: c.active,
    })),
  };
}

export function importPortableBrain(payload: {
  persona?: Partial<PersonaSettings>;
  rules?: TaughtRule[];
  customSections?: CustomSection[];
}): { importedRules: number; importedSections: number } {
  const store = ensureStore();
  if (payload.persona) {
    store.persona = { ...store.persona, ...payload.persona };
  }
  let importedRules = 0;
  if (Array.isArray(payload.rules)) {
    const existingTitles = new Set(
      store.rules.map((r) => r.title.toLowerCase())
    );
    for (const r of payload.rules) {
      if (r.title && r.instruction && !existingTitles.has(r.title.toLowerCase())) {
        store.rules.unshift({
          id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: String(r.title),
          instruction: String(r.instruction),
          category: mapLegacyCategory(String(r.category || 'owner_directive')),
          weight:
            r.weight === 'strict' ||
            r.weight === 'preferred' ||
            r.weight === 'advisory'
              ? r.weight
              : 'strict',
          active: r.active !== false,
          createdAt: r.createdAt || new Date().toISOString(),
          source: r.source === 'chat' ? 'chat' : 'manual',
        });
        existingTitles.add(r.title.toLowerCase());
        importedRules++;
      }
    }
  }

  let importedSections = 0;
  if (Array.isArray(payload.customSections)) {
    const existingSecTitles = new Set(
      store.customSections.map((s) => s.title.toLowerCase())
    );
    for (const s of payload.customSections) {
      if (s.title && s.htmlCode && !existingSecTitles.has(s.title.toLowerCase())) {
        const now = new Date().toISOString();
        store.customSections.unshift({
          id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: String(s.title),
          navLabel: String(s.navLabel || s.title).slice(0, 24),
          description: String(s.description || ''),
          placement:
            s.placement === 'main_page' || s.placement === 'both'
              ? s.placement
              : 'sidebar_tab',
          htmlCode: String(s.htmlCode),
          createdAt: s.createdAt || now,
          updatedAt: s.updatedAt || now,
        });
        existingSecTitles.add(s.title.toLowerCase());
        importedSections++;
      }
    }
  }

  writeStore(store);
  return { importedRules, importedSections };
}

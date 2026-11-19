import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Cpu,
  Database,
  FileUp,
  FolderInput,
  HardDrive,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  WifiOff,
  Zap,
} from 'lucide-react';
import type {
  BrainEngineMode,
  BrainSettings,
  KnowledgeNote,
  KnowledgeNoteCategory,
  LocalLlmStatus,
} from '../types/arix';

interface BuiltInGuideSummary {
  id: string;
  title: string;
  category: string;
  summary: string;
  tags: string[];
}

interface OfflineBrainWorkspaceProps {
  brainSettings: BrainSettings;
  knowledgeNotes: KnowledgeNote[];
  activeRuleCount: number;
  auditCount: number;
  chatCount: number;
  onSaveBrainSettings: (
    patch: Partial<BrainSettings>
  ) => Promise<{ settings: BrainSettings; localLlm: LocalLlmStatus }>;
  onAddKnowledgeNote: (input: {
    title?: string;
    content?: string;
    category: KnowledgeNoteCategory;
    tags: string[];
    localFilePath?: string;
    source?: 'manual' | 'file_import';
  }) => Promise<void>;
  onDeleteKnowledgeNote: (id: string) => Promise<void>;
}

const MODE_CARDS: Array<{
  id: BrainEngineMode;
  title: string;
  subtitle: string;
  badge: string;
}> = [
  {
    id: 'auto',
    title: 'Auto Hybrid',
    subtitle:
      'Uses Cloud when online and switches automatically to Local PC LLM or Offline Knowledge Brain whenever offline.',
    badge: 'Recommended',
  },
  {
    id: 'offline',
    title: '100% Offline Knowledge',
    subtitle:
      'Runs completely offline using your Knowledge Vault, Taught Rules, past memory, built-in guides, math & local PC tools.',
    badge: 'Zero Internet',
  },
  {
    id: 'local_llm',
    title: 'Local PC LLM (Ollama)',
    subtitle:
      'Runs an open-weights neural AI model directly on your own computer with full offline privacy and zero quotas.',
    badge: 'Local Neural',
  },
  {
    id: 'cloud',
    title: 'Cloud Brain Only',
    subtitle:
      'Always uses the cloud engine with live Google Search, Maps, URL context, and full agentic tools.',
    badge: 'Online',
  },
];

const CATEGORY_OPTIONS: Array<{ value: KnowledgeNoteCategory; label: string }> = [
  { value: 'coding', label: 'Coding & Tech' },
  { value: 'website', label: 'Website & Business' },
  { value: 'commands', label: 'Commands & DevOps' },
  { value: 'personal', label: 'Personal & Notes' },
  { value: 'reference', label: 'General Reference' },
];

const OLLAMA_INSTALL_CMD = `winget install Ollama.Ollama
ollama pull qwen2.5-coder:7b`;

export function OfflineBrainWorkspace({
  brainSettings,
  knowledgeNotes,
  activeRuleCount,
  auditCount,
  chatCount,
  onSaveBrainSettings,
  onAddKnowledgeNote,
  onDeleteKnowledgeNote,
}: OfflineBrainWorkspaceProps) {
  const [localUrl, setLocalUrl] = useState(brainSettings.localLlmUrl);
  const [localModel, setLocalModel] = useState(brainSettings.localLlmModel);
  const [autoIndexChat, setAutoIndexChat] = useState(
    brainSettings.autoIndexChat
  );
  const [localLlm, setLocalLlm] = useState<LocalLlmStatus | null>(null);
  const [scanning, setScanning] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  const [builtInGuides, setBuiltInGuides] = useState<BuiltInGuideSummary[]>([]);
  const [vaultView, setVaultView] = useState<'custom' | 'builtin'>('custom');
  const [searchQuery, setSearchQuery] = useState('');

  // Add note form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] =
    useState<KnowledgeNoteCategory>('reference');
  const [noteTags, setNoteTags] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Import local workspace file
  const [workspaceFilePath, setWorkspaceFilePath] = useState('');
  const [importingFile, setImportingFile] = useState(false);

  // Copy command feedback
  const [copiedInstall, setCopiedInstall] = useState(false);

  // Offline tester
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<{
    reply: string;
    engineLabel: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setLocalUrl(brainSettings.localLlmUrl);
    setLocalModel(brainSettings.localLlmModel);
    setAutoIndexChat(brainSettings.autoIndexChat);
  }, [brainSettings]);

  const scanLocalBrain = async () => {
    setScanning(true);
    try {
      const [statusRes, kbRes] = await Promise.all([
        fetch('/api/brain/status'),
        fetch('/api/knowledge'),
      ]);
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as {
          localLlm: LocalLlmStatus;
        };
        setLocalLlm(statusData.localLlm);
      }
      if (kbRes.ok) {
        const kbData = (await kbRes.json()) as {
          builtInTitles?: BuiltInGuideSummary[];
        };
        setBuiltInGuides(kbData.builtInTitles || []);
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    void scanLocalBrain();
  }, []);

  const handleSelectMode = async (mode: BrainEngineMode) => {
    setSavingSettings(true);
    setSettingsSavedMsg(null);
    try {
      const res = await onSaveBrainSettings({
        mode,
        localLlmUrl: localUrl,
        localLlmModel: localModel,
        autoIndexChat,
      });
      setLocalLlm(res.localLlm);
      setSettingsSavedMsg(`Switched brain mode to ${mode.replace('_', ' ')}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveLocalConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedMsg(null);
    try {
      const res = await onSaveBrainSettings({
        localLlmUrl: localUrl,
        localLlmModel: localModel,
        autoIndexChat,
      });
      setLocalLlm(res.localLlm);
      setSettingsSavedMsg('Local brain settings saved & scanned.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddNoteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) {
      setNoteError('Please enter both a title and knowledge content.');
      return;
    }
    setAddingNote(true);
    setNoteError(null);
    try {
      await onAddKnowledgeNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        category: noteCategory,
        tags: noteTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        source: 'manual',
      });
      setNoteTitle('');
      setNoteTags('');
      setNoteContent('');
    } catch (err) {
      setNoteError(
        err instanceof Error ? err.message : 'Failed to save knowledge note.'
      );
    } finally {
      setAddingNote(false);
    }
  };

  const handleImportWorkspaceFile = async () => {
    if (!workspaceFilePath.trim()) return;
    setImportingFile(true);
    setNoteError(null);
    try {
      await onAddKnowledgeNote({
        category: 'coding',
        tags: ['file', 'workspace'],
        localFilePath: workspaceFilePath.trim(),
        source: 'file_import',
      });
      setWorkspaceFilePath('');
    } catch (err) {
      setNoteError(
        err instanceof Error ? err.message : 'Could not import workspace file.'
      );
    } finally {
      setImportingFile(false);
    }
  };

  const handleUploadLocalTextFile = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingFile(true);
    setNoteError(null);
    try {
      const text = await file.text();
      await onAddKnowledgeNote({
        title: file.name,
        content: text.slice(0, 24000),
        category: 'reference',
        tags: [
          'uploaded',
          file.name.split('.').pop()?.toLowerCase() || 'doc',
        ],
        source: 'file_import',
      });
    } catch (err) {
      setNoteError(
        err instanceof Error ? err.message : 'Failed to read uploaded file.'
      );
    } finally {
      setImportingFile(false);
    }
  };

  const handleRunOfflineTest = async (useLocalLlm: boolean) => {
    if (!testPrompt.trim()) return;
    setTesting(true);
    setTestError(null);
    try {
      const res = await fetch('/api/brain/offline-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: testPrompt.trim(),
          useLocalLlm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Offline test failed.');
      }
      setTestResult({
        reply: data.reply,
        engineLabel: data.engineLabel || 'Arix Offline Brain',
      });
    } catch (err) {
      setTestError(
        err instanceof Error ? err.message : 'Offline test failed.'
      );
    } finally {
      setTesting(false);
    }
  };

  const handleCopyOllamaCmd = async () => {
    try {
      await navigator.clipboard.writeText(OLLAMA_INSTALL_CMD);
      setCopiedInstall(true);
      setTimeout(() => setCopiedInstall(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const filteredNotes = knowledgeNotes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const filteredBuiltIns = builtInGuides.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.title.toLowerCase().includes(q) ||
      g.summary.toLowerCase().includes(q) ||
      g.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/90 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sky-400 mb-2">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Autonomous Local &amp; Offline Intelligence</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white tracking-tight">
            Offline Brain &amp; Knowledge Vault
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">
            Run Arix under any condition — online or completely offline — using
            your local Knowledge Vault, Taught Rules, real computer tools, and
            optional local PC neural models (Ollama / LM Studio).
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5 text-center shrink-0">
          <div className="rounded-lg border border-slate-800 bg-[#0B152B] px-3.5 py-2">
            <div className="text-lg font-mono font-bold text-white tabular-nums">
              {knowledgeNotes.length + builtInGuides.length}
            </div>
            <div className="text-[11px] text-slate-400">Offline Docs</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#0B152B] px-3.5 py-2">
            <div className="text-lg font-mono font-bold text-sky-400 tabular-nums">
              {activeRuleCount}
            </div>
            <div className="text-[11px] text-slate-400">Active Rules</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#0B152B] px-3.5 py-2">
            <div className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
              {chatCount + auditCount}
            </div>
            <div className="text-[11px] text-slate-400">Memories</div>
          </div>
        </div>
      </div>

      {/* Section 1: Brain Mode Selector */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            1. Active Brain Engine Mode
          </h2>
          {settingsSavedMsg && (
            <span className="text-xs text-emerald-400 font-medium">
              {settingsSavedMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {MODE_CARDS.map((card) => {
            const active = brainSettings.mode === card.id;
            return (
              <button
                key={card.id}
                type="button"
                disabled={savingSettings}
                onClick={() => void handleSelectMode(card.id)}
                className={`text-left rounded-xl border p-4 transition-all cursor-pointer ${
                  active
                    ? 'border-sky-400 bg-sky-500/12 shadow-[0_0_24px_rgba(56,189,248,0.12)]'
                    : 'border-slate-800 bg-[#0B152B] hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-white">
                    {card.title}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                      active
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {card.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {card.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 2: Local PC Neural Model (Ollama / LM Studio) */}
      <section className="rounded-xl border border-slate-800 bg-[#0B152B] p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Local PC Neural Model (Ollama / LM Studio)
              </h2>
              <p className="text-xs text-slate-400">
                Optional: Connect a local LLM on your own Windows PC for full
                conversational offline AI with zero internet and zero limits.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void scanLocalBrain()}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 cursor-pointer shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-sky-400 ${scanning ? 'animate-spin' : ''}`}
            />
            <span>{scanning ? 'Scanning...' : 'Scan Local PC Models'}</span>
          </button>
        </div>

        {/* Status banner */}
        {localLlm && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              localLlm.available
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                : 'border-slate-700/80 bg-slate-900/70 text-slate-300'
            }`}
          >
            <div className="space-y-0.5">
              <div className="font-semibold flex items-center gap-2">
                {localLlm.available ? (
                  <>
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Local LLM Detected ({localLlm.provider}) —{' '}
                      {localLlm.models.length} model(s) ready
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      Built-in Offline Knowledge Engine is active (No local
                      Ollama detected yet)
                    </span>
                  </>
                )}
              </div>
              {localLlm.error && (
                <p className="text-slate-400">{localLlm.error}</p>
              )}
            </div>
            {localLlm.available && localLlm.models.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {localLlm.models.slice(0, 6).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLocalModel(m)}
                    className={`px-2 py-1 rounded text-[11px] font-mono border cursor-pointer ${
                      localModel === m || (!localModel && localLlm.activeModel === m)
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={handleSaveLocalConfig}
          className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
        >
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Local Model Server URL
            </label>
            <input
              type="text"
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Local Model Name (blank = auto-pick)
            </label>
            <input
              type="text"
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              placeholder="qwen2.5-coder:7b"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              {savingSettings ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Save &amp; Test</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
          <label className="inline-flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoIndexChat}
              onChange={(e) => setAutoIndexChat(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
            />
            <span>
              Automatically index past online answers so Arix remembers them
              offline
            </span>
          </label>

          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2">
            <code className="text-[11px] font-mono text-sky-300 whitespace-pre">
              {OLLAMA_INSTALL_CMD}
            </code>
            <button
              type="button"
              onClick={() => void handleCopyOllamaCmd()}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="Copy Windows PowerShell Ollama install commands"
            >
              {copiedInstall ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Section 3: Knowledge Vault + Offline Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Add / Import Knowledge */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-slate-800 bg-[#0B152B] p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-semibold text-white">
                Add to Offline Knowledge Vault
              </h2>
            </div>

            {noteError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {noteError}
              </div>
            )}

            <form onSubmit={handleAddNoteSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Topic / Title
                </label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Prime-Upload Deployment Steps or CineStream API"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={noteCategory}
                    onChange={(e) =>
                      setNoteCategory(e.target.value as KnowledgeNoteCategory)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Keywords / Tags
                  </label>
                  <input
                    type="text"
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                    placeholder="deploy, api, react"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Knowledge Content (Notes, Code, Docs, Answers)
                </label>
                <textarea
                  rows={5}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Paste documentation, code patterns, personal facts, commands, or Q&A that Arix should know offline..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 resize-y"
                />
              </div>

              <button
                type="submit"
                disabled={addingNote}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {addingNote ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Save Permanently to Offline Brain</span>
              </button>
            </form>

            {/* File Import Bar */}
            <div className="pt-4 border-t border-slate-800 space-y-2.5">
              <div className="text-xs font-medium text-slate-300">
                Or Import a Document / Code File into Offline Memory
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workspaceFilePath}
                  onChange={(e) => setWorkspaceFilePath(e.target.value)}
                  placeholder="Workspace file path (e.g. README.md)"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  disabled={importingFile || !workspaceFilePath.trim()}
                  onClick={() => void handleImportWorkspaceFile()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 cursor-pointer disabled:opacity-50"
                >
                  <FolderInput className="w-3.5 h-3.5 text-sky-400" />
                  <span>Import</span>
                </button>
              </div>
              <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-700 hover:border-sky-500/60 bg-slate-950/60 text-xs text-slate-300 cursor-pointer transition-colors">
                <FileUp className="w-3.5 h-3.5 text-sky-400" />
                <span>Upload .txt / .md / .json / code file from PC</span>
                <input
                  type="file"
                  accept=".txt,.md,.json,.ts,.tsx,.js,.jsx,.py,.sql,.html,.css,.ps1,.sh,.yml,.yaml"
                  onChange={(e) => void handleUploadLocalTextFile(e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Offline Sandbox Tester */}
          <div className="rounded-xl border border-slate-800 bg-[#0B152B] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Test Offline Brain Directly
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Zero Cloud Calls
              </span>
            </div>
            <input
              type="text"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleRunOfflineTest(false);
                }
              }}
              placeholder="Try: git pull, (1450 * 0.18) + 250, list files, or a note topic..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={testing || !testPrompt.trim()}
                onClick={() => void handleRunOfflineTest(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 hover:bg-sky-500/30 text-xs font-medium text-sky-200 cursor-pointer disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>Test Offline Knowledge</span>
              </button>
              <button
                type="button"
                disabled={testing || !testPrompt.trim() || !localLlm?.available}
                onClick={() => void handleRunOfflineTest(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 cursor-pointer disabled:opacity-40"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test Local Ollama</span>
              </button>
            </div>
            {testError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {testError}
              </div>
            )}
            {testResult && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2 max-h-64 overflow-y-auto">
                <div className="text-[11px] font-mono text-sky-400">
                  {testResult.engineLabel}
                </div>
                <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {testResult.reply}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Vault Contents Browser */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0B152B] p-5 flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVaultView('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  vaultView === 'custom'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Your Offline Notes ({knowledgeNotes.length})
              </button>
              <button
                type="button"
                onClick={() => setVaultView('builtin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  vaultView === 'builtin'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Built-in Offline Library ({builtInGuides.length})
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search offline vault..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {vaultView === 'custom' ? (
            filteredNotes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-slate-800 rounded-xl">
                <BookOpen className="w-8 h-8 text-slate-600 mb-3" />
                <div className="text-sm font-medium text-slate-300">
                  {knowledgeNotes.length === 0
                    ? 'No custom offline notes saved yet'
                    : 'No matching notes found'}
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Add your own code snippets, website guides, commands, or files
                  on the left — or type{' '}
                  <code className="text-sky-400">remember: ...</code> in chat
                  while offline.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {note.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {note.category} · {note.source.replace('_', ' ')}
                          {note.tags.length > 0 &&
                            ` · ${note.tags.join(', ')}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onDeleteKnowledgeNote(note.id)}
                        className="p-1.5 rounded hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                        title="Delete offline note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap line-clamp-5 leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {filteredBuiltIns.map((guide) => (
                <div
                  key={guide.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">
                      {guide.title}
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-sky-300 shrink-0">
                      {guide.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {guide.summary}
                  </p>
                  <div className="text-[11px] font-mono text-slate-500">
                    Keywords: {guide.tags.slice(0, 8).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

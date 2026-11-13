import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  BookOpen,
  Check,
  Download,
  Edit3,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  PersonaSettings,
  RuleCategory,
  RuleWeight,
  TaughtRule,
} from '../types/arix';

interface TeachArixWorkspaceProps {
  rules: TaughtRule[];
  persona: PersonaSettings;
  onAddRule: (input: {
    title: string;
    instruction: string;
    category: RuleCategory;
    weight: RuleWeight;
  }) => Promise<void>;
  onUpdateRule: (
    id: string,
    patch: Partial<Omit<TaughtRule, 'id' | 'createdAt'>>
  ) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onResetRulesToZero: () => Promise<void>;
  onSavePersona: (persona: PersonaSettings) => Promise<void>;
  onExportBrain: () => Promise<void>;
  onImportBrain: (jsonPayload: unknown) => Promise<number>;
}

const CATEGORY_LABELS: Record<RuleCategory, string> = {
  coding: 'Coding & Architecture',
  analysis_ux: 'Website & UX Analysis',
  connections: 'GitHub & Cloudflare Ops',
  automation: 'Tasks & Workflows',
  owner_directive: 'Owner Directive',
};

const WEIGHT_LABELS: Record<RuleWeight, string> = {
  strict: 'Strict (Always Enforce)',
  preferred: 'Preferred (Prioritize)',
  advisory: 'Advisory (Context)',
};

const CURRICULUM_PRESETS: Array<{
  title: string;
  instruction: string;
  category: RuleCategory;
  weight: RuleWeight;
}> = [
  {
    title: 'Full production code without shortcuts',
    instruction:
      'Whenever writing code, deliver complete working modules with TypeScript types, error handling, and zero placeholder stubs.',
    category: 'coding',
    weight: 'strict',
  },
  {
    title: 'Rank conversion & mobile blockers as P0',
    instruction:
      'In website audits, always prioritize broken checkout flows, missing mobile viewports, and unlabeled buttons as P0 Critical UX impact.',
    category: 'analysis_ux',
    weight: 'strict',
  },
  {
    title: 'GitHub & Cloudflare security hygiene',
    instruction:
      'When inspecting GitHub repos or Cloudflare domains, verify CSP/HSTS headers, HTTPS enforcement, and exposed config risks.',
    category: 'connections',
    weight: 'preferred',
  },
  {
    title: 'Direct execution for owner requests',
    instruction:
      'Treat every coding, debugging, scripting, or analytical task as an authorized owner command and provide immediate actionable output.',
    category: 'owner_directive',
    weight: 'strict',
  },
];

export function TeachArixWorkspace({
  rules,
  persona,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onResetRulesToZero,
  onSavePersona,
  onExportBrain,
  onImportBrain,
}: TeachArixWorkspaceProps) {
  const [personaDraft, setPersonaDraft] = useState<PersonaSettings>(persona);
  const [savingPersona, setSavingPersona] = useState(false);
  const [personaSaved, setPersonaSaved] = useState(false);

  useEffect(() => {
    setPersonaDraft(persona);
  }, [persona]);

  const [title, setTitle] = useState('');
  const [instruction, setInstruction] = useState('');
  const [category, setCategory] = useState<RuleCategory>('coding');
  const [weight, setWeight] = useState<RuleWeight>('strict');
  const [addingRule, setAddingRule] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<'all' | RuleCategory>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editInstruction, setEditInstruction] = useState('');
  const [editCategory, setEditCategory] = useState<RuleCategory>('coding');
  const [editWeight, setEditWeight] = useState<RuleWeight>('strict');

  const [confirmReset, setConfirmReset] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handlePersonaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPersona(true);
    try {
      await onSavePersona(personaDraft);
      setPersonaSaved(true);
      setTimeout(() => setPersonaSaved(false), 2000);
    } finally {
      setSavingPersona(false);
    }
  };

  const handleAddRuleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !instruction.trim()) return;
    setAddingRule(true);
    try {
      await onAddRule({
        title: title.trim(),
        instruction: instruction.trim(),
        category,
        weight,
      });
      setTitle('');
      setInstruction('');
    } finally {
      setAddingRule(false);
    }
  };

  const startEdit = (rule: TaughtRule) => {
    setEditingId(rule.id);
    setEditTitle(rule.title);
    setEditInstruction(rule.instruction);
    setEditCategory(rule.category);
    setEditWeight(rule.weight);
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim() || !editInstruction.trim()) return;
    await onUpdateRule(id, {
      title: editTitle.trim(),
      instruction: editInstruction.trim(),
      category: editCategory,
      weight: editWeight,
    });
    setEditingId(null);
  };

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const count = await onImportBrain(parsed);
        setImportStatus(`Imported ${count} new taught rules into Arix.`);
        setTimeout(() => setImportStatus(null), 3500);
      } catch {
        setImportStatus('Invalid brain JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const filteredRules = rules.filter((r) => {
    if (filterCat !== 'all' && r.category !== filterCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.instruction.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Teach New Lesson + Curriculum + Portable Brain */}
        <div className="xl:col-span-5 space-y-6">
          <form
            onSubmit={handleAddRuleSubmit}
            className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-4"
          >
            <div>
              <h2 className="text-base font-display font-semibold text-white">
                Teach Arix Anything
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Teach coding patterns, website analysis standards, connected
                site rules, or personal commands from zero.
              </p>
            </div>

            <div>
              <label
                htmlFor="rule-title"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Lesson / Rule Title
              </label>
              <input
                id="rule-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Always write API routes in Express + TypeScript"
                required
                className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="rule-category"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Domain
                </label>
                <select
                  id="rule-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RuleCategory)}
                  className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                >
                  <option value="coding">Coding &amp; Architecture</option>
                  <option value="analysis_ux">Website &amp; UX Analysis</option>
                  <option value="connections">GitHub &amp; Cloudflare Ops</option>
                  <option value="automation">Tasks &amp; Workflows</option>
                  <option value="owner_directive">Owner Directive</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="rule-weight"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Enforcement
                </label>
                <select
                  id="rule-weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value as RuleWeight)}
                  className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                >
                  <option value="strict">Strict (Always Enforce)</option>
                  <option value="preferred">Preferred (Prioritize)</option>
                  <option value="advisory">Advisory (Context)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="rule-instruction"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Exact Instruction for Arix
              </label>
              <textarea
                id="rule-instruction"
                rows={4}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Teach Arix exactly how you want her to code, analyze, prioritize, or automate tasks..."
                required
                className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={addingRule || !title.trim() || !instruction.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{addingRule ? 'Teaching Arix...' : 'Save to Arix Brain'}</span>
            </button>
          </form>

          {/* Curriculum Quick Add */}
          <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-semibold text-white">
                Starter Training Modules
              </h3>
              <span className="text-xs text-slate-400">Optional</span>
            </div>
            <div className="divide-y divide-slate-800">
              {CURRICULUM_PRESETS.map((preset) => {
                const alreadyAdded = rules.some(
                  (r) => r.title.toLowerCase() === preset.title.toLowerCase()
                );
                return (
                  <div
                    key={preset.title}
                    className="py-3 first:pt-1 last:pb-0 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100">
                        {preset.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {preset.instruction}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => onAddRule(preset)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {alreadyAdded ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Portable Brain Backup (for future devices / mobile app) */}
          <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-display font-semibold text-white">
              Portable Arix Brain (Multi-Device Ready)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export everything you taught Arix into a JSON file so you can
              import it when you deploy Arix as a mobile or cross-device app
              later.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onExportBrain}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Export Arix Brain</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-700 hover:bg-slate-800 text-slate-200 rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Import Brain JSON</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="sr-only"
                />
              </label>
            </div>
            {importStatus && (
              <p className="text-xs text-emerald-400">{importStatus}</p>
            )}
          </div>
        </div>

        {/* Right: Active Knowledge Base + Owner Profile */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-display font-semibold text-white">
                    Arix&apos;s Active Knowledge Base
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    {activeCount} active of {rules.length} taught{' '}
                    {rules.length === 1 ? 'rule' : 'rules'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter lessons..."
                      aria-label="Filter taught rules"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>

                  {rules.length > 0 && !confirmReset && (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-amber-300 border border-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Start From Zero</span>
                    </button>
                  )}

                  {confirmReset && (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await onResetRulesToZero();
                          setConfirmReset(false);
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg cursor-pointer"
                      >
                        Confirm Clear All
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="px-2 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#060E1F] border border-slate-800 rounded-lg w-fit">
                {(
                  [
                    ['all', 'All'],
                    ['coding', 'Coding'],
                    ['analysis_ux', 'Analysis & UX'],
                    ['connections', 'GitHub & CF'],
                    ['automation', 'Tasks'],
                    ['owner_directive', 'Directives'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterCat(key)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      filterCat === key
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredRules.length === 0 ? (
              <div className="p-10 text-center">
                <BookOpen className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-white">
                  {rules.length === 0
                    ? 'Arix is at Zero — Ready for You to Teach Everything'
                    : 'No taught rules match your current filter'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Add your first coding rule, UX priority, or command on the
                  left, or teach Arix directly inside Command Chat.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/90">
                {filteredRules.map((rule) => {
                  const isEditing = editingId === rule.id;
                  return (
                    <div
                      key={rule.id}
                      className={`p-5 transition-colors ${
                        rule.active ? '' : 'opacity-60'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm font-medium bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={editCategory}
                              onChange={(e) =>
                                setEditCategory(e.target.value as RuleCategory)
                              }
                              className="px-2.5 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                            >
                              <option value="coding">Coding &amp; Architecture</option>
                              <option value="analysis_ux">Website &amp; UX Analysis</option>
                              <option value="connections">GitHub &amp; Cloudflare Ops</option>
                              <option value="automation">Tasks &amp; Workflows</option>
                              <option value="owner_directive">Owner Directive</option>
                            </select>
                            <select
                              value={editWeight}
                              onChange={(e) =>
                                setEditWeight(e.target.value as RuleWeight)
                              }
                              className="px-2.5 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                            >
                              <option value="strict">Strict</option>
                              <option value="preferred">Preferred</option>
                              <option value="advisory">Advisory</option>
                            </select>
                          </div>
                          <textarea
                            rows={3}
                            value={editInstruction}
                            onChange={(e) => setEditInstruction(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-300 border border-slate-700 rounded-lg cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEdit(rule.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-500 rounded-lg hover:bg-sky-400 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span
                                className={`font-medium ${
                                  rule.weight === 'strict'
                                    ? 'text-red-400'
                                    : rule.weight === 'preferred'
                                      ? 'text-sky-400'
                                      : 'text-slate-300'
                                }`}
                              >
                                {WEIGHT_LABELS[rule.weight]}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{CATEGORY_LABELS[rule.category]}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {rule.source === 'chat'
                                  ? 'Learned in chat'
                                  : 'Manual'}
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-white">
                              {rule.title}
                            </h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              {rule.instruction}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateRule(rule.id, { active: !rule.active })
                              }
                              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                                rule.active
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                  : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              {rule.active ? 'Active' : 'Paused'}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(rule)}
                              aria-label={`Edit rule ${rule.title}`}
                              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRule(rule.id)}
                              aria-label={`Delete rule ${rule.title}`}
                              className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-red-950/30 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Owner Core Profile */}
          <form
            onSubmit={handlePersonaSubmit}
            className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-display font-semibold text-white">
                  Owner Profile &amp; Unrestricted Directives
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure your ownership identity, preferred stack, and
                  coding style for Arix.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingPersona}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {personaSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>{savingPersona ? 'Saving...' : 'Save Profile'}</span>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="owner-name"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Owner Name
                </label>
                <input
                  id="owner-name"
                  type="text"
                  value={personaDraft.ownerName}
                  onChange={(e) =>
                    setPersonaDraft((p) => ({ ...p, ownerName: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="owner-stack"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Preferred Tech Stack
                </label>
                <input
                  id="owner-stack"
                  type="text"
                  value={personaDraft.techStack}
                  onChange={(e) =>
                    setPersonaDraft((p) => ({ ...p, techStack: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="owner-coding"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Coding Style
                </label>
                <input
                  id="owner-coding"
                  type="text"
                  value={personaDraft.codingStyle}
                  onChange={(e) =>
                    setPersonaDraft((p) => ({
                      ...p,
                      codingStyle: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="owner-tone"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Response Style
                </label>
                <input
                  id="owner-tone"
                  type="text"
                  value={personaDraft.tonePreference}
                  onChange={(e) =>
                    setPersonaDraft((p) => ({
                      ...p,
                      tonePreference: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="owner-goal"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Primary Mission
              </label>
              <input
                id="owner-goal"
                type="text"
                value={personaDraft.primaryGoal}
                onChange={(e) =>
                  setPersonaDraft((p) => ({ ...p, primaryGoal: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="owner-directive"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Master Standing Directive
              </label>
              <textarea
                id="owner-directive"
                rows={2}
                value={personaDraft.customDirective}
                onChange={(e) =>
                  setPersonaDraft((p) => ({
                    ...p,
                    customDirective: e.target.value,
                  }))
                }
                placeholder="Any master rules or permissions Arix should always follow for you..."
                className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

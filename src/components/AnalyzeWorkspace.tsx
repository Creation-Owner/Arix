import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Globe,
  Image as ImageIcon,
  Info,
  MessageSquare,
  Search,
  Upload,
} from 'lucide-react';
import { ArixAvatar } from './ArixAvatar';
import { CodeBlock } from './CodeBlock';
import type {
  AuditIssue,
  ConnectedSite,
  IssuePriority,
  PersonaSettings,
  TaughtRule,
  WebsiteAudit,
} from '../types/arix';

interface AnalyzeWorkspaceProps {
  activeAudit: WebsiteAudit | null;
  analyzing: boolean;
  error: string | null;
  activeRules: TaughtRule[];
  connections: ConnectedSite[];
  preselectedConnectionId: string | null;
  persona: PersonaSettings;
  onRunAnalysis: (payload: {
    inputType: 'url' | 'code' | 'screenshot';
    url?: string;
    code?: string;
    notes?: string;
    screenshotBase64?: string;
    screenshotMimeType?: string;
    connectionId?: string;
  }) => Promise<void>;
  onToggleIssueStatus: (
    auditId: string,
    issueId: string,
    status: 'open' | 'resolved'
  ) => Promise<void>;
  onAskAboutIssue: (auditId: string, issueId: string) => void;
  onGoToTeach: () => void;
}

const SAMPLE_FLAWED_HTML = `<!doctype html>
<html>
<head>
  <title>Shop</title>
  <script src="/heavy-analytics-sync.js"></script>
</head>
<body>
  <div style="background:#f8fafc; color:#cbd5e1; padding:12px;">
    <h4>Flash Sale Ends Soon</h4>
  </div>
  <nav>
    <a href="/cart" target="_blank"><svg width="16" height="16"></svg></a>
    <a href="/products">Products</a>
  </nav>
  <main>
    <img src="/hero-banner.png" />
    <form action="/checkout" method="post">
      <input type="email" placeholder="Email" />
      <input type="text" placeholder="Card" />
      <button type="submit" style="font-size:10px; padding:2px 4px; color:#94a3b8; background:#f1f5f9;">Pay</button>
    </form>
  </main>
</body>
</html>`;

function PriorityLabel({ priority }: { priority: IssuePriority }) {
  if (priority === 'P0 Critical') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>P0 Critical</span>
      </span>
    );
  }
  if (priority === 'P1 High') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>P1 High</span>
      </span>
    );
  }
  if (priority === 'P2 Medium') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 whitespace-nowrap">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>P2 Medium</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 whitespace-nowrap">
      <Info className="w-3.5 h-3.5 shrink-0" />
      <span>P3 Low</span>
    </span>
  );
}

export function AnalyzeWorkspace({
  activeAudit,
  analyzing,
  error,
  activeRules,
  connections,
  preselectedConnectionId,
  persona,
  onRunAnalysis,
  onToggleIssueStatus,
  onAskAboutIssue,
  onGoToTeach,
}: AnalyzeWorkspaceProps) {
  const [inputType, setInputType] = useState<'url' | 'code' | 'screenshot'>(
    'url'
  );
  const [selectedConnId, setSelectedConnId] = useState<string>(
    preselectedConnectionId || ''
  );
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null
  );
  const [screenshotBase64, setScreenshotBase64] = useState<
    string | undefined
  >();
  const [screenshotMime, setScreenshotMime] = useState<string | undefined>();

  const [priorityFilter, setPriorityFilter] = useState<
    'all' | IssuePriority | 'open' | 'resolved'
  >('all');
  const [issueSearch, setIssueSearch] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedConnectionId) {
      setSelectedConnId(preselectedConnectionId);
      const match = connections.find((c) => c.id === preselectedConnectionId);
      if (match?.targetUrl) {
        setUrl(match.targetUrl);
      }
      setInputType('url');
    }
  }, [preselectedConnectionId, connections]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      if (commaIdx > -1) {
        setScreenshotPreview(result);
        setScreenshotBase64(result.slice(commaIdx + 1));
        setScreenshotMime(file.type || 'image/png');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSelectedIssueId(null);
    await onRunAnalysis({
      inputType,
      url: inputType === 'url' ? url : undefined,
      code: inputType === 'code' ? code : undefined,
      notes,
      screenshotBase64:
        inputType === 'screenshot' ? screenshotBase64 : undefined,
      screenshotMimeType:
        inputType === 'screenshot' ? screenshotMime : undefined,
      connectionId:
        inputType === 'url' && selectedConnId ? selectedConnId : undefined,
    });
  };

  const filteredIssues: AuditIssue[] = (activeAudit?.issues || []).filter(
    (issue) => {
      if (priorityFilter === 'open' && issue.status !== 'open') return false;
      if (priorityFilter === 'resolved' && issue.status !== 'resolved')
        return false;
      if (
        priorityFilter !== 'all' &&
        priorityFilter !== 'open' &&
        priorityFilter !== 'resolved' &&
        issue.priority !== priorityFilter
      ) {
        return false;
      }
      if (issueSearch.trim()) {
        const q = issueSearch.toLowerCase();
        return (
          issue.title.toLowerCase().includes(q) ||
          issue.affectedArea.toLowerCase().includes(q) ||
          issue.userExperienceImpact.toLowerCase().includes(q)
        );
      }
      return true;
    }
  );

  const selectedIssue =
    filteredIssues.find((i) => i.id === selectedIssueId) ||
    activeAudit?.issues.find((i) => i.id === selectedIssueId) ||
    filteredIssues[0] ||
    null;

  const signals = activeAudit?.technicalSignals;

  return (
    <div className="space-y-6">
      {/* Audit Input Panel */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-display font-semibold text-white">
              Analyze Website, GitHub Repo, or Code
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Applying{' '}
              <button
                type="button"
                onClick={onGoToTeach}
                className="text-sky-400 hover:underline font-medium cursor-pointer"
              >
                {activeRules.length} taught{' '}
                {activeRules.length === 1 ? 'rule' : 'rules'}
              </button>
              <span className="mx-1.5 text-slate-600" aria-hidden="true">
                ·
              </span>
              <span>Stack: {persona.techStack}</span>
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#060E1F] border border-slate-800 rounded-lg">
            {(
              [
                ['url', 'Website / Connected', Globe],
                ['code', 'Paste HTML / JSX', Code2],
                ['screenshot', 'Upload Screenshot', ImageIcon],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setInputType(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  inputType === key
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {inputType === 'url' && (
          <div className="space-y-3">
            {connections.filter((c) => c.type !== 'telegram').length > 0 && (
              <div>
                <label
                  htmlFor="audit-conn-select"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Pick a Connected Platform (Optional)
                </label>
                <select
                  id="audit-conn-select"
                  value={selectedConnId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedConnId(id);
                    const found = connections.find((c) => c.id === id);
                    if (found?.targetUrl) setUrl(found.targetUrl);
                  }}
                  className="w-full px-3.5 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                >
                  <option value="">Custom URL below</option>
                  {connections
                    .filter((c) => c.type !== 'telegram')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.type.toUpperCase()} — {c.name} (
                        {c.targetUrl || c.identifier})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-7">
                <label
                  htmlFor="audit-url"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Website or Connected URL
                </label>
                <input
                  id="audit-url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  required={!selectedConnId}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 font-mono"
                />
              </div>
              <div className="md:col-span-5">
                <label
                  htmlFor="audit-notes-url"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Focus Area (Optional)
                </label>
                <input
                  id="audit-notes-url"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Check mobile navigation and signup form"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>
            </div>
          </div>
        )}

        {inputType === 'code' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="audit-code"
                className="block text-xs font-medium text-slate-300"
              >
                HTML, React JSX, or Page Template Code
              </label>
              <button
                type="button"
                onClick={() => {
                  setCode(SAMPLE_FLAWED_HTML);
                  setNotes('Sample checkout page with UX & accessibility errors');
                }}
                className="text-xs text-sky-400 hover:underline font-medium cursor-pointer"
              >
                Load sample flawed HTML
              </button>
            </div>
            <textarea
              id="audit-code"
              rows={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your HTML, React component, or layout markup here..."
              required
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-[#060E1F] border border-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 leading-relaxed"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context (e.g. Checkout form component)"
              aria-label="Optional code context notes"
              className="w-full px-3.5 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
            />
          </div>
        )}

        {inputType === 'screenshot' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-7">
              <label
                htmlFor="screenshot-upload"
                className="flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-lg p-6 bg-[#060E1F] hover:border-sky-500/50 transition-colors cursor-pointer"
              >
                <Upload className="w-5 h-5 text-sky-400 mb-2" />
                <span className="text-sm font-medium text-white">
                  {screenshotPreview
                    ? 'Replace website screenshot'
                    : 'Upload PNG, JPG, or WebP screenshot'}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Arix will inspect visual hierarchy, contrast, spacing, and UI
                  errors
                </span>
                <input
                  id="screenshot-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="md:col-span-5 space-y-3">
              {screenshotPreview && (
                <div className="border border-slate-700 rounded-lg overflow-hidden bg-[#060E1F] h-28">
                  <img
                    src={screenshotPreview}
                    alt="Uploaded website screenshot preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What page is this? Any user complaints?"
                aria-label="Screenshot context notes"
                className="w-full px-3.5 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg"
              />
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-950/30 text-xs text-red-300 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="submit"
            disabled={analyzing}
            className="px-5 py-2.5 bg-sky-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {analyzing ? 'Arix is analyzing...' : 'Run Arix Audit'}
          </button>
        </div>
      </form>

      {/* Loading Skeleton */}
      {analyzing && (
        <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-4 animate-pulse">
          <div className="h-5 w-64 bg-slate-800 rounded" />
          <div className="h-4 w-full max-w-2xl bg-slate-800/70 rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-14 bg-slate-800/70 rounded-lg" />
            ))}
          </div>
          <div className="space-y-2 pt-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-11 bg-slate-800/60 rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!analyzing && !activeAudit && (
        <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <ArixAvatar size="lg" />
          <div className="space-y-1.5">
            <h3 className="text-base font-display font-semibold text-white">
              Ready to audit any website or connected platform
            </h3>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Choose a connected GitHub repo, Cloudflare domain, or live URL
              above—or paste code or upload a screenshot. Arix detects errors,
              ranks issues by UX impact, and generates fixes using everything you
              taught her.
            </p>
          </div>
        </div>
      )}

      {/* Audit Results */}
      {!analyzing && activeAudit && (
        <div className="space-y-6">
          <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-medium text-sky-400">Audit Report</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {new Date(activeAudit.analyzedAt).toLocaleString()}
                  </span>
                  {activeAudit.url && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{activeAudit.url}</span>
                    </>
                  )}
                </div>
                <h3 className="text-lg font-display font-semibold text-white">
                  {activeAudit.targetLabel}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {activeAudit.summary}
                </p>
              </div>

              <div className="text-right tabular-nums shrink-0">
                <div className="text-2xl font-display font-bold text-white">
                  {activeAudit.issues.filter((i) => i.status === 'open').length}
                </div>
                <div className="text-xs text-slate-400">
                  Open of {activeAudit.issues.length} issues
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-slate-200">
                  UX Prioritization Logic:{' '}
                </span>
                <span className="text-slate-400 leading-relaxed">
                  {activeAudit.uxPrioritizationRationale}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-200">
                  Taught Rules Applied:{' '}
                </span>
                <span className="text-slate-400">
                  {activeAudit.appliedRulesUsed.length > 0
                    ? activeAudit.appliedRulesUsed.join(' · ')
                    : 'General UX & Engineering standards'}
                </span>
              </div>
            </div>

            {signals && (
              <div className="pt-4 border-t border-slate-800">
                {signals.fetchWarning && (
                  <p className="text-xs text-amber-300 mb-3">
                    Note: {signals.fetchWarning}
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
                  {signals.httpStatus !== undefined && (
                    <div>
                      <div className="text-slate-400">HTTP Status</div>
                      <div className="font-mono tabular-nums font-semibold text-white mt-0.5">
                        {signals.httpStatus}
                      </div>
                    </div>
                  )}
                  {signals.loadTimeMs !== undefined && (
                    <div>
                      <div className="text-slate-400">Response Time</div>
                      <div className="font-mono tabular-nums font-semibold text-white mt-0.5">
                        {signals.loadTimeMs} ms
                      </div>
                    </div>
                  )}
                  {signals.htmlSizeBytes !== undefined && (
                    <div>
                      <div className="text-slate-400">HTML Size</div>
                      <div className="font-mono tabular-nums font-semibold text-white mt-0.5">
                        {(signals.htmlSizeBytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  )}
                  {signals.imagesMissingAlt !== undefined && (
                    <div>
                      <div className="text-slate-400">Images Missing Alt</div>
                      <div
                        className={`font-mono tabular-nums font-semibold mt-0.5 ${
                          signals.imagesMissingAlt > 0
                            ? 'text-red-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {signals.imagesMissingAlt} / {signals.totalImages ?? 0}
                      </div>
                    </div>
                  )}
                  {signals.unlabeledInputs !== undefined && (
                    <div>
                      <div className="text-slate-400">Unlabeled Inputs</div>
                      <div
                        className={`font-mono tabular-nums font-semibold mt-0.5 ${
                          signals.unlabeledInputs > 0
                            ? 'text-red-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {signals.unlabeledInputs}
                      </div>
                    </div>
                  )}
                  {signals.hasViewportMeta !== undefined && (
                    <div>
                      <div className="text-slate-400">Mobile Viewport</div>
                      <div
                        className={`font-mono font-semibold mt-0.5 ${
                          signals.hasViewportMeta
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {signals.hasViewportMeta ? 'Present' : 'Missing'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-7 bg-[#0B152B] border border-slate-800/90 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-display font-semibold text-white">
                    Prioritized Issues by UX Impact
                  </h3>
                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={issueSearch}
                      onChange={(e) => setIssueSearch(e.target.value)}
                      placeholder="Search issues..."
                      aria-label="Search prioritized issues"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#060E1F] border border-slate-800 rounded-lg w-fit">
                  {(
                    [
                      ['all', 'All'],
                      ['P0 Critical', 'P0 Critical'],
                      ['P1 High', 'P1 High'],
                      ['P2 Medium', 'P2 Medium'],
                      ['open', 'Open'],
                      ['resolved', 'Resolved'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPriorityFilter(key)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        priorityFilter === key
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredIssues.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  No issues match the selected filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#081124] text-xs font-medium text-slate-400">
                        <th className="py-2.5 px-4">Priority</th>
                        <th className="py-2.5 px-3">Issue &amp; Area</th>
                        <th className="py-2.5 px-3 text-right">UX Impact</th>
                        <th className="py-2.5 px-4 text-right">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-sm">
                      {filteredIssues.map((issue) => {
                        const isSelected = selectedIssue?.id === issue.id;
                        return (
                          <tr
                            key={issue.id}
                            onClick={() => setSelectedIssueId(issue.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-sky-500/10'
                                : 'hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-3 px-4 align-top">
                              <PriorityLabel priority={issue.priority} />
                            </td>
                            <td className="py-3 px-3 align-top">
                              <div
                                className={`font-medium ${
                                  issue.status === 'resolved'
                                    ? 'line-through text-slate-500'
                                    : 'text-white'
                                }`}
                              >
                                {issue.title}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {issue.category}
                                <span className="mx-1.5" aria-hidden="true">
                                  ·
                                </span>
                                {issue.affectedArea}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right align-top font-mono tabular-nums font-semibold text-white">
                              {issue.uxImpactScore}
                              <span className="text-xs font-normal text-slate-500">
                                /100
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right align-top whitespace-nowrap text-xs">
                              {issue.status === 'resolved' ? (
                                <span className="text-emerald-400 font-medium">
                                  Resolved
                                </span>
                              ) : (
                                <span className="text-slate-400">Open</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="xl:col-span-5 bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-5">
              {selectedIssue ? (
                <>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <PriorityLabel priority={selectedIssue.priority} />
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums font-medium text-slate-200">
                        UX Impact {selectedIssue.uxImpactScore}/100
                      </span>
                    </div>
                    <h4 className="text-base font-display font-semibold text-white">
                      {selectedIssue.title}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Area: {selectedIssue.affectedArea}
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      Category: {selectedIssue.category}
                    </p>
                  </div>

                  {selectedIssue.matchedTaughtRule && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200">
                      <span className="font-semibold">Taught Rule Applied: </span>
                      <span>{selectedIssue.matchedTaughtRule}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {(
                      [
                        [
                          'Task Completion',
                          selectedIssue.impactDimensions.taskCompletion,
                        ],
                        [
                          'Accessibility',
                          selectedIssue.impactDimensions.accessibility,
                        ],
                        [
                          'Perceived Speed',
                          selectedIssue.impactDimensions.perceivedSpeed,
                        ],
                        [
                          'Trust & Clarity',
                          selectedIssue.impactDimensions.trustAndClarity,
                        ],
                      ] as const
                    ).map(([label, score]) => (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">{label}</span>
                          <span className="font-mono tabular-nums text-white font-medium">
                            {score}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-400 rounded-full"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-800 text-sm">
                    <div>
                      <h5 className="text-xs font-semibold text-slate-300 mb-1">
                        Why This Hurts User Experience
                      </h5>
                      <p className="text-slate-300 leading-relaxed">
                        {selectedIssue.userExperienceImpact}
                      </p>
                    </div>

                    <div>
                      <h5 className="text-xs font-semibold text-slate-300 mb-1">
                        Detected Evidence
                      </h5>
                      <p className="text-xs font-mono text-slate-200 bg-[#060E1F] border border-slate-800 rounded-lg p-2.5 break-words">
                        {selectedIssue.evidence}
                      </p>
                    </div>

                    <div>
                      <h5 className="text-xs font-semibold text-slate-300 mb-1">
                        Arix&apos;s Recommended Solution
                      </h5>
                      <p className="text-slate-300 leading-relaxed">
                        {selectedIssue.solutionSummary}
                      </p>
                    </div>
                  </div>

                  {(selectedIssue.beforeCode || selectedIssue.afterCode) && (
                    <div className="space-y-3 pt-1">
                      {selectedIssue.beforeCode && (
                        <CodeBlock
                          label="Current / Problematic Code"
                          code={selectedIssue.beforeCode}
                          tone="before"
                        />
                      )}
                      {selectedIssue.afterCode && (
                        <CodeBlock
                          label="Recommended Fix"
                          code={selectedIssue.afterCode}
                          tone="after"
                        />
                      )}
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onToggleIssueStatus(
                          activeAudit.id,
                          selectedIssue.id,
                          selectedIssue.status === 'resolved'
                            ? 'open'
                            : 'resolved'
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedIssue.status === 'resolved'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-700 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {selectedIssue.status === 'resolved'
                          ? 'Reopen Issue'
                          : 'Mark Resolved'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onAskAboutIssue(activeAudit.id, selectedIssue.id)
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Ask Arix for Custom Fix</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-sm text-slate-400">
                  Select an issue on the left to inspect its UX impact and
                  recommended fix.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

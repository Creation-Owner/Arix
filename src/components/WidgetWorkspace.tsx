import { useEffect, useState, type FormEvent } from 'react';
import {
  Bot,
  Check,
  Code2,
  Copy,
  Globe,
  KeyRound,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { ConnectedSite, WebsiteWidgetSettings } from '../types/arix';

interface WidgetWorkspaceProps {
  settings: WebsiteWidgetSettings;
  connections: ConnectedSite[];
  onSaveSettings: (patch: Partial<WebsiteWidgetSettings>) => Promise<void>;
  onRegenerateKey: () => Promise<void>;
}

const COLOR_PRESETS = ['#38BDF8', '#10B981', '#818CF8', '#F59E0B', '#F43F5E'];

export function WidgetWorkspace({
  settings,
  connections,
  onSaveSettings,
  onRegenerateKey,
}: WidgetWorkspaceProps) {
  const [form, setForm] = useState<WebsiteWidgetSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [snippetTab, setSnippetTab] = useState<'html' | 'react' | 'api'>('html');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const defaultOrigin =
    typeof window !== 'undefined' &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.includes('127.0.0.1')
      ? window.location.origin
      : 'https://YOUR-DEPLOYED-ARIX-URL';
  const [publicServerUrl, setPublicServerUrl] = useState(defaultOrigin);

  // Live Visitor Sandbox Test
  const [testMessages, setTestMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [testInput, setTestInput] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const cleanServerUrl = publicServerUrl.trim().replace(/\/+$/, '') || defaultOrigin;

  const htmlSnippet = `<script
  src="${cleanServerUrl}/arix-widget.js"${
    form.requirePublicKey ? `\n  data-key="${form.publicKey}"` : ''
  }
  async
></script>`;

  const reactSnippet = `import { useEffect } from 'react';

export function ArixWebsiteAssistant() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${cleanServerUrl}/arix-widget.js';${
      form.requirePublicKey
        ? `\n    script.setAttribute('data-key', '${form.publicKey}');`
        : ''
    }
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return null;
}`;

  const apiSnippet = `const res = await fetch('${cleanServerUrl}/api/assistant/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',${
      form.requirePublicKey
        ? `\n    'X-Arix-Widget-Key': '${form.publicKey}',`
        : ''
    }
  },
  body: JSON.stringify({
    message: 'How can I contact support?',
    pageUrl: window.location.href,
    pageTitle: document.title,
    history: []
  })
});
const data = await res.json();
console.log(data.reply);`;

  const activeSnippet =
    snippetTab === 'html'
      ? htmlSnippet
      : snippetTab === 'react'
        ? reactSnippet
        : apiSnippet;

  const copyText = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSavedBanner(false);
    try {
      await onSaveSettings(form);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save widget settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = testInput.trim();
    if (!text || testing) return;
    setTestInput('');
    const nextHistory = [...testMessages, { role: 'user' as const, content: text }];
    setTestMessages(nextHistory);
    setTesting(true);
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Arix-Widget-Key': form.publicKey,
        },
        body: JSON.stringify({
          message: text,
          history: testMessages.slice(-8),
          pageTitle: 'Widget Sandbox Preview',
          pageUrl: window.location.href,
          widgetKey: form.publicKey,
        }),
      });
      const data = await res.json();
      setTestMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.ok
            ? data.reply
            : data.error || 'Error testing assistant.',
        },
      ]);
    } catch {
      setTestMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Unable to reach /api/assistant/chat.' },
      ]);
    } finally {
      setTesting(false);
    }
  };

  const connectedWebsites = connections.filter((c) => c.type === 'website' && c.active);

  return (
    <div className="space-y-6">
      {/* Header & Hosting Guide */}
      <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-white">
                Connect Arix to Any Website as a Live Visitor Assistant
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Embed Arix directly on your website with 1 line of HTML or React
                code. Website visitors talk to a{' '}
                <strong className="text-slate-200">visitor-safe</strong> version
                of Arix using your website knowledge below—your local computer
                files, shell commands, and private tokens are never exposed.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({ ...prev, enabled: !prev.enabled }))
            }
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              form.enabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {form.enabled ? 'Widget Enabled' : 'Widget Disabled'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#060E1F] border border-slate-800 rounded-lg p-3.5 space-y-1">
            <div className="font-semibold text-sky-300">
              1. Deploy Arix Publicly
            </div>
            <p className="text-slate-400 leading-relaxed">
              Your live website visitors cannot reach <code className="text-slate-200">localhost</code>. Use your deployed Cloud Run / Render / VPS URL (or a Cloudflare Tunnel) as the server URL below.
            </p>
          </div>
          <div className="bg-[#060E1F] border border-slate-800 rounded-lg p-3.5 space-y-1">
            <div className="font-semibold text-sky-300">
              2. Teach Visitor Knowledge
            </div>
            <p className="text-slate-400 leading-relaxed">
              Add your business details, pricing, FAQs, and support rules below. Arix also automatically reads any active websites in Connect Sites.
            </p>
          </div>
          <div className="bg-[#060E1F] border border-slate-800 rounded-lg p-3.5 space-y-1">
            <div className="font-semibold text-sky-300">
              3. Paste 1 Tag on Your Site
            </div>
            <p className="text-slate-400 leading-relaxed">
              Copy the <code className="text-slate-200">&lt;script&gt;</code> tag below before <code className="text-slate-200">&lt;/body&gt;</code> on HTML, WordPress, Shopify, React, or Next.js.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Settings Form */}
        <form
          onSubmit={handleSave}
          className="xl:col-span-6 bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Assistant Appearance &amp; Knowledge</span>
            </h3>
            {connectedWebsites.length > 0 && (
              <span className="text-[11px] text-emerald-300 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>
                  {connectedWebsites.length} connected site
                  {connectedWebsites.length > 1 ? 's' : ''} linked
                </span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="w-name"
                className="block text-xs font-medium text-slate-300"
              >
                Assistant Name
              </label>
              <input
                id="w-name"
                type="text"
                value={form.assistantName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, assistantName: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="w-tagline"
                className="block text-xs font-medium text-slate-300"
              >
                Subtitle / Tagline
              </label>
              <input
                id="w-tagline"
                type="text"
                value={form.tagline}
                onChange={(e) =>
                  setForm((p) => ({ ...p, tagline: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="w-welcome"
              className="block text-xs font-medium text-slate-300"
            >
              Welcome Greeting
            </label>
            <input
              id="w-welcome"
              type="text"
              value={form.welcomeMessage}
              onChange={(e) =>
                setForm((p) => ({ ...p, welcomeMessage: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Accent Color
              </label>
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, accentColor: c }))}
                    aria-label={`Color ${c}`}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full cursor-pointer border-2 ${
                      form.accentColor.toLowerCase() === c.toLowerCase()
                        ? 'border-white scale-110'
                        : 'border-transparent'
                    }`}
                  />
                ))}
                <input
                  type="text"
                  value={form.accentColor}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, accentColor: e.target.value }))
                  }
                  className="w-24 px-2 py-1 text-xs font-mono bg-[#060E1F] border border-slate-700 text-white rounded"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="w-pos"
                className="block text-xs font-medium text-slate-300"
              >
                Corner Position
              </label>
              <select
                id="w-pos"
                value={form.position}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    position:
                      e.target.value === 'bottom-left'
                        ? 'bottom-left'
                        : 'bottom-right',
                  }))
                }
                className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="w-knowledge"
              className="block text-xs font-medium text-slate-300"
            >
              Website Knowledge, Products &amp; Visitor Rules
            </label>
            <textarea
              id="w-knowledge"
              rows={5}
              value={form.siteKnowledge}
              onChange={(e) =>
                setForm((p) => ({ ...p, siteKnowledge: e.target.value }))
              }
              placeholder="Paste what your website does, pricing, support email, shipping policy, opening hours, and how Arix should answer visitors..."
              className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500 resize-y"
            />
          </div>

          <div className="p-3.5 rounded-lg bg-[#060E1F] border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Domain &amp; Access Control</span>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="w-origins"
                className="block text-[11px] text-slate-400"
              >
                Allowed Website Origins (comma-separated, or * for all sites)
              </label>
              <input
                id="w-origins"
                type="text"
                value={form.allowedOrigins}
                onChange={(e) =>
                  setForm((p) => ({ ...p, allowedOrigins: e.target.value }))
                }
                placeholder="* or https://mywebsite.com, https://www.mywebsite.com"
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#0B152B] border border-slate-700 text-white rounded-md"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requirePublicKey}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      requirePublicKey: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-600"
                />
                <span>Require Public Widget Key</span>
              </label>

              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0B152B] border border-slate-700 text-[11px] font-mono text-sky-300">
                  <KeyRound className="w-3 h-3" />
                  <span>{form.publicKey}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void onRegenerateKey()}
                  title="Regenerate public widget key"
                  className="p-1.5 rounded border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {saveError && (
            <div className="px-3 py-2 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-300">
              {saveError}
            </div>
          )}

          {savedBanner && (
            <div className="px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300">
              Website Assistant settings saved. Live widgets will pick up changes automatically.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Assistant Settings</span>
            </button>
          </div>
        </form>

        {/* Right: Embed Code + Live Sandbox */}
        <div className="xl:col-span-6 space-y-6">
          {/* Embed Code Generator */}
          <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-sky-400" />
                <span>Embed Code for Your Website</span>
              </h3>
              <div className="inline-flex rounded-lg border border-slate-700 bg-[#060E1F] p-0.5">
                {(
                  [
                    { id: 'html', label: 'HTML Script' },
                    { id: 'react', label: 'React / Next.js' },
                    { id: 'api', label: 'REST API' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSnippetTab(tab.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      snippetTab === tab.id
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="w-server-url"
                className="block text-xs font-medium text-slate-300"
              >
                Your Public Arix Server URL (HTTPS)
              </label>
              <input
                id="w-server-url"
                type="url"
                value={publicServerUrl}
                onChange={(e) => setPublicServerUrl(e.target.value)}
                placeholder="https://your-arix-app.run.app"
                className="w-full px-3 py-2 text-xs font-mono bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="relative">
              <pre className="p-4 rounded-lg bg-[#060E1F] border border-slate-800 text-xs font-mono text-sky-200 overflow-x-auto leading-relaxed">
                <code>{activeSnippet}</code>
              </pre>
              <button
                type="button"
                onClick={() => void copyText(snippetTab, activeSnippet)}
                className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
              >
                {copiedId === snippetTab ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Visitor Sandbox */}
          <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-[#081124] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: form.accentColor || '#38BDF8' }}
                />
                <div>
                  <div className="text-xs font-semibold text-white">
                    Test Visitor Experience: {form.assistantName}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Simulates exactly how a visitor on your website interacts
                    with Arix
                  </div>
                </div>
              </div>
              {testMessages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTestMessages([])}
                  className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="p-4 h-64 overflow-y-auto space-y-2.5 bg-[#060E1F]">
              <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs bg-[#0B152B] border border-slate-800 text-slate-200">
                {form.welcomeMessage}
              </div>
              {testMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    m.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'text-slate-950 font-medium'
                        : 'bg-[#0B152B] border border-slate-800 text-slate-200'
                    }`}
                    style={
                      m.role === 'user'
                        ? { backgroundColor: form.accentColor || '#38BDF8' }
                        : undefined
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {testing && (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0B152B] border border-slate-800 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            <form
              onSubmit={handleTestSend}
              className="p-3 border-t border-slate-800 bg-[#081124] flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-slate-500 ml-1 shrink-0" />
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder={form.placeholder || 'Test a visitor question...'}
                className="flex-1 px-3 py-2 text-xs bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={testing || !testInput.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Test</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

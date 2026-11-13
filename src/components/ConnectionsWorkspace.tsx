import { useState, type FormEvent } from 'react';
import {
  Cloud,
  GitBranch,
  Globe,
  KeyRound,
  MessageSquare,
  Plus,
  RefreshCw,
  SearchCode,
  Send,
  Server,
  Trash2,
} from 'lucide-react';
import type { ConnectedSite, ConnectedSiteType } from '../types/arix';

interface ConnectionsWorkspaceProps {
  connections: ConnectedSite[];
  onAddConnection: (payload: {
    name: string;
    type: ConnectedSiteType;
    targetUrl: string;
    identifier: string;
    token?: string;
  }) => Promise<void>;
  onSyncConnection: (id: string) => Promise<void>;
  onUpdateConnection: (
    id: string,
    patch: { identifier?: string; targetUrl?: string; token?: string }
  ) => Promise<void>;
  onToggleConnection: (id: string, active: boolean) => Promise<void>;
  onDeleteConnection: (id: string) => Promise<void>;
  onSendTelegramTest: (connectionId: string, message: string) => Promise<void>;
  onAnalyzeConnection: (conn: ConnectedSite) => void;
  onChatWithConnection: (conn: ConnectedSite) => void;
}

const TYPE_META: Record<
  ConnectedSiteType,
  {
    label: string;
    icon: typeof Globe;
    placeholderUrl: string;
    placeholderId: string;
  }
> = {
  website: {
    label: 'Website URL',
    icon: Globe,
    placeholderUrl: 'https://yourwebsite.com',
    placeholderId: 'Production Site',
  },
  github: {
    label: 'GitHub Repo',
    icon: GitBranch,
    placeholderUrl: 'https://github.com/owner/repo',
    placeholderId: 'owner/repo',
  },
  cloudflare: {
    label: 'Cloudflare',
    icon: Cloud,
    placeholderUrl: 'https://yourdomain.com',
    placeholderId: 'Optional Zone ID',
  },
  telegram: {
    label: 'Telegram Bot',
    icon: Send,
    placeholderUrl: 'https://t.me/your_bot',
    placeholderId: 'Chat ID (auto-detected on Sync if blank)',
  },
  api: {
    label: 'Custom API',
    icon: Server,
    placeholderUrl: 'https://api.yourdomain.com/health',
    placeholderId: 'REST Endpoint',
  },
};

export function ConnectionsWorkspace({
  connections,
  onAddConnection,
  onSyncConnection,
  onUpdateConnection,
  onToggleConnection,
  onDeleteConnection,
  onSendTelegramTest,
  onAnalyzeConnection,
  onChatWithConnection,
}: ConnectionsWorkspaceProps) {
  const [type, setType] = useState<ConnectedSiteType>('github');
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [token, setToken] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [tgNotice, setTgNotice] = useState<string | null>(null);
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [editConnToken, setEditConnToken] = useState('');
  const [editConnIdVal, setEditConnIdVal] = useState('');
  const [savingEditConn, setSavingEditConn] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (type === 'telegram' && !token.trim()) {
      setError('Please enter your Telegram Bot Token from @BotFather.');
      return;
    }
    if (type !== 'telegram' && !targetUrl.trim() && !identifier.trim()) {
      setError('Please enter a URL, GitHub owner/repo, or domain.');
      return;
    }
    setAdding(true);
    try {
      await onAddConnection({
        name: name.trim(),
        type,
        targetUrl: targetUrl.trim(),
        identifier: identifier.trim(),
        token: token.trim() || undefined,
      });
      setName('');
      setTargetUrl('');
      setIdentifier('');
      setToken('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to connect platform.'
      );
    } finally {
      setAdding(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await onSyncConnection(id);
    } finally {
      setSyncingId(null);
    }
  };

  const handleTestTelegram = async (id: string) => {
    setTgNotice(null);
    setError(null);
    try {
      await onSendTelegramTest(id, 'Hello from Arix AI — Telegram connected!');
      setTgNotice('Test message sent to Telegram.');
      setTimeout(() => setTgNotice(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send Telegram test.'
      );
    }
  };

  const meta = TYPE_META[type];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left: Add Connector Form */}
      <form
        onSubmit={handleSubmit}
        className="xl:col-span-5 bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-base font-display font-semibold text-white">
            Connect Any Website, Bot, or Platform
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Connect GitHub, Cloudflare, Telegram, live websites, or custom APIs
            so Arix can inspect, analyze, and send updates directly.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-[#060E1F] border border-slate-800 rounded-lg">
          {(Object.keys(TYPE_META) as ConnectedSiteType[]).map((key) => {
            const ItemIcon = TYPE_META[key].icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setType(key);
                  setError(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  type === key
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{TYPE_META[key].label}</span>
              </button>
            );
          })}
        </div>

        <div>
          <label
            htmlFor="conn-name"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Display Name
          </label>
          <input
            id="conn-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              type === 'telegram'
                ? 'e.g. My Telegram Alerts Bot'
                : type === 'github'
                  ? 'e.g. My Main App Repo'
                  : type === 'cloudflare'
                    ? 'e.g. Cloudflare Edge Domain'
                    : 'e.g. My Production Website'
            }
            className="w-full px-3 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
          />
        </div>

        {type !== 'telegram' && (
          <div>
            <label
              htmlFor="conn-url"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              {type === 'github'
                ? 'GitHub Repository URL'
                : type === 'cloudflare'
                  ? 'Domain or Site URL'
                  : 'Target URL'}
            </label>
            <input
              id="conn-url"
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder={meta.placeholderUrl}
              className="w-full px-3 py-2 text-sm font-mono bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
          </div>
        )}

        {(type === 'github' || type === 'cloudflare' || type === 'telegram') && (
          <div>
            <label
              htmlFor="conn-id"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              {type === 'github'
                ? 'Repository (owner/repo)'
                : type === 'cloudflare'
                  ? 'Cloudflare Zone ID (Optional)'
                  : 'Telegram Chat ID (Optional — auto-detected if you sent /start)'}
            </label>
            <input
              id="conn-id"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={meta.placeholderId}
              className="w-full px-3 py-2 text-sm font-mono bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="conn-token"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            {type === 'telegram'
              ? 'Telegram Bot Token (from @BotFather — stored server-side)'
              : 'Access Token / API Key (Optional — stored server-side only)'}
          </label>
          <input
            id="conn-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={
              type === 'telegram'
                ? '123456789:ABCdef...'
                : type === 'github'
                  ? 'ghp_... (needed for private repos & writing/committing files)'
                  : type === 'cloudflare'
                    ? 'Cloudflare API Token (optional)'
                    : 'Optional Bearer token'
            }
            className="w-full px-3 py-2 text-sm font-mono bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
          />
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-950/30 text-xs text-red-300">
            {error}
          </div>
        )}

        {tgNotice && (
          <div className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 text-xs text-emerald-300">
            {tgNotice}
          </div>
        )}

        <button
          type="submit"
          disabled={adding}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{adding ? 'Connecting & Verifying...' : 'Connect & Sync'}</span>
        </button>
      </form>

      {/* Right: Connected Platforms List */}
      <div className="xl:col-span-7 bg-[#0B152B] border border-slate-800/90 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-display font-semibold text-white">
              Connected Websites, Bots &amp; Platforms
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {connections.filter((c) => c.active).length} active of{' '}
              {connections.length} connected
            </p>
          </div>
        </div>

        {connections.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Globe className="w-7 h-7 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-white">
              No websites, bots, or platforms connected yet
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Add a GitHub repo, Cloudflare domain, Telegram bot, or live
              website on the left. Arix will sync it and use it in Command Chat
              and Website Analysis.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/90">
            {connections.map((conn) => {
              const Icon = TYPE_META[conn.type]?.icon || Globe;
              const isSyncing = syncingId === conn.id;
              return (
                <div
                  key={conn.id}
                  className={`p-5 space-y-3 transition-colors ${
                    conn.active ? '' : 'opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-[#060E1F] border border-slate-800 text-sky-400 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-medium text-sky-300">
                            {TYPE_META[conn.type]?.label || conn.type}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{conn.lastStatus || 'Ready'}</span>
                          {conn.hasToken && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <KeyRound className="w-3 h-3" />
                                <span>Token {conn.maskedToken}</span>
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-white mt-0.5 truncate">
                          {conn.name}
                        </h3>
                        <p className="text-xs font-mono text-slate-400 truncate">
                          {conn.targetUrl || conn.identifier}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSync(conn.id)}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 border border-slate-700 rounded-md hover:bg-slate-800 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                        />
                        <span>Sync</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onToggleConnection(conn.id, !conn.active)
                        }
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
                          conn.active
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-700 text-slate-400'
                        }`}
                      >
                        {conn.active ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConnection(conn.id)}
                        aria-label={`Remove ${conn.name}`}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-md hover:bg-red-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {conn.metadataSummary && (
                    <p className="text-xs text-slate-300 bg-[#060E1F] border border-slate-800/80 rounded-lg px-3 py-2 leading-relaxed">
                      {conn.metadataSummary}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {conn.type === 'telegram' ? (
                      <button
                        type="button"
                        onClick={() => handleTestTelegram(conn.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-sky-400" />
                        <span>Send Test Message</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAnalyzeConnection(conn)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors cursor-pointer"
                      >
                        <SearchCode className="w-3.5 h-3.5 text-sky-400" />
                        <span>Analyze with Arix</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onChatWithConnection(conn)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-700 hover:bg-slate-800 text-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                      <span>Command in Chat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingConnId === conn.id) {
                          setEditingConnId(null);
                        } else {
                          setEditingConnId(conn.id);
                          setEditConnIdVal(conn.identifier || '');
                          setEditConnToken('');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-md transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {editingConnId === conn.id
                          ? 'Close Edit'
                          : 'Update Token / ID'}
                      </span>
                    </button>
                  </div>

                  {editingConnId === conn.id && (
                    <div className="mt-2 p-3.5 rounded-lg bg-[#060E1F] border border-slate-800 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Identifier (owner/repo, Zone ID, or Chat ID)
                          </label>
                          <input
                            type="text"
                            value={editConnIdVal}
                            onChange={(e) => setEditConnIdVal(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#0B152B] border border-slate-700 text-white rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            New Access Token (leave blank to keep current)
                          </label>
                          <input
                            type="password"
                            value={editConnToken}
                            onChange={(e) => setEditConnToken(e.target.value)}
                            placeholder="Paste new token..."
                            className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#0B152B] border border-slate-700 text-white rounded-md"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={savingEditConn}
                          onClick={async () => {
                            setSavingEditConn(true);
                            try {
                              await onUpdateConnection(conn.id, {
                                identifier: editConnIdVal.trim(),
                                ...(editConnToken.trim()
                                  ? { token: editConnToken.trim() }
                                  : {}),
                              });
                              await onSyncConnection(conn.id);
                              setEditingConnId(null);
                            } finally {
                              setSavingEditConn(false);
                            }
                          }}
                          className="px-3 py-1.5 bg-sky-500 text-slate-950 text-xs font-semibold rounded-md hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
                        >
                          {savingEditConn ? 'Saving & Syncing...' : 'Save & Sync'}
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
    </div>
  );
}

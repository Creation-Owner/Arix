import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Send, Trash2, Wrench } from 'lucide-react';
import { ArixAvatar } from './ArixAvatar';
import { CodeBlock } from './CodeBlock';
import type { ChatMessage, ConnectedSite, WebsiteAudit } from '../types/arix';

interface AskArixWorkspaceProps {
  messages: ChatMessage[];
  audits: WebsiteAudit[];
  connections: ConnectedSite[];
  selectedAuditId: string | null;
  focusedIssueId: string | null;
  selectedConnectionId: string | null;
  sending: boolean;
  activeRuleCount: number;
  draftPrompt?: string | null;
  onConsumeDraftPrompt?: () => void;
  onSelectContext: (
    auditId: string | null,
    issueId: string | null,
    connectionId: string | null
  ) => void;
  onSendMessage: (message: string) => Promise<void>;
  onClearChat: () => Promise<void>;
  onGoToTeach: () => void;
}

function renderFormattedReply(content: string) {
  const segments = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
      {segments.map((seg, idx) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const inner = seg.slice(3, -3);
          const firstNewline = inner.indexOf('\n');
          const lang =
            firstNewline > 0 ? inner.slice(0, firstNewline).trim() : 'Code';
          const codeBody =
            firstNewline > 0 ? inner.slice(firstNewline + 1) : inner;
          return (
            <CodeBlock
              key={idx}
              label={lang || 'Code Output'}
              code={codeBody.trim()}
            />
          );
        }
        const paragraphs = seg
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);
        return paragraphs.map((p, pIdx) => (
          <p key={`${idx}-${pIdx}`} className="whitespace-pre-wrap">
            {p}
          </p>
        ));
      })}
    </div>
  );
}

export function AskArixWorkspace({
  messages,
  audits,
  connections,
  selectedAuditId,
  focusedIssueId,
  selectedConnectionId,
  sending,
  activeRuleCount,
  draftPrompt,
  onConsumeDraftPrompt,
  onSelectContext,
  onSendMessage,
  onClearChat,
  onGoToTeach,
}: AskArixWorkspaceProps) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (draftPrompt) {
      setInput(draftPrompt);
      onConsumeDraftPrompt?.();
    }
  }, [draftPrompt, onConsumeDraftPrompt]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const activeAudit = audits.find((a) => a.id === selectedAuditId);
  const focusedIssue = activeAudit?.issues.find((i) => i.id === focusedIssueId);
  const activeConnection = connections.find(
    (c) => c.id === selectedConnectionId
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    await onSendMessage(text);
  };

  const quickPrompts = focusedIssue
    ? [
        `Write the complete fixed code for "${focusedIssue.title}" using my preferred stack.`,
        `Explain why "${focusedIssue.title}" hurts user experience and how to verify the fix.`,
        `Teach Arix: Always rank issues like "${focusedIssue.title}" as P0 Critical.`,
      ]
    : activeConnection
      ? [
          `Inspect ${activeConnection.name} live and tell me what errors or improvements you see.`,
          `Write a production script or component integrating with ${activeConnection.name}.`,
          `Teach Arix: Remember that ${activeConnection.name} is my primary environment.`,
        ]
      : [
          'Create folder "projects/demo" and file "projects/demo/notes.txt" with my launch checklist.',
          'Find files matching "notes" and show me what is inside.',
          'Send a summary of my latest website audit or message to Telegram.',
          'Inspect a GitHub repo or Cloudflare domain (e.g. "Inspect cloudflare.com DNS and headers").',
        ];

  return (
    <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl flex flex-col h-[calc(100vh-11rem)] min-h-[540px] overflow-hidden">
      {/* Context Bar */}
      <div className="px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-[#081124]">
        <div className="flex flex-wrap items-center gap-3">
          <ArixAvatar size="sm" />
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-white">Arix Command Chat</span>
            <span className="mx-1.5 text-slate-600" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              onClick={onGoToTeach}
              className="text-sky-400 hover:underline cursor-pointer"
            >
              {activeRuleCount} active taught{' '}
              {activeRuleCount === 1 ? 'rule' : 'rules'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {connections.length > 0 && (
            <select
              aria-label="Attach connected platform"
              value={selectedConnectionId || ''}
              onChange={(e) =>
                onSelectContext(
                  selectedAuditId,
                  focusedIssueId,
                  e.target.value || null
                )
              }
              className="px-2.5 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-slate-200 rounded-lg max-w-[190px] truncate"
            >
              <option value="">No connected site pinned</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type.toUpperCase()}: {c.name}
                </option>
              ))}
            </select>
          )}

          {audits.length > 0 && (
            <select
              aria-label="Select website audit context"
              value={selectedAuditId || ''}
              onChange={(e) =>
                onSelectContext(
                  e.target.value || null,
                  null,
                  selectedConnectionId
                )
              }
              className="px-2.5 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-slate-200 rounded-lg max-w-[190px] truncate"
            >
              <option value="">No audit pinned</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.targetLabel}
                </option>
              ))}
            </select>
          )}

          {activeAudit && activeAudit.issues.length > 0 && (
            <select
              aria-label="Focus on specific UX issue"
              value={focusedIssueId || ''}
              onChange={(e) =>
                onSelectContext(
                  activeAudit.id,
                  e.target.value || null,
                  selectedConnectionId
                )
              }
              className="px-2.5 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-slate-200 rounded-lg max-w-[210px] truncate"
            >
              <option value="">All issues in report</option>
              {activeAudit.issues.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issue.priority} · {issue.title}
                </option>
              ))}
            </select>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 border border-slate-700 bg-[#060E1F] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-8 space-y-6">
            <div className="flex items-start gap-4">
              <ArixAvatar size="lg" />
              <div>
                <h2 className="text-lg font-display font-semibold text-white">
                  Arix is ready. Command me or teach me anything.
                </h2>
                <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                  Ask me to write code, debug errors, inspect your connected
                  GitHub repositories, check Cloudflare DNS/headers, analyze
                  websites, or type any rule you want me to learn permanently.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">
                Suggested owner commands
              </p>
              <div className="grid grid-cols-1 gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onSendMessage(prompt)}
                    disabled={sending}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-left text-sm text-slate-200 bg-[#081124] hover:bg-slate-800/70 border border-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="w-4 h-4 text-sky-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3.5 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'arix' && <ArixAvatar size="sm" className="mt-1" />}
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-sky-500 text-slate-950 font-medium'
                      : 'bg-[#081124] border border-slate-800 text-slate-100'
                  }`}
                >
                  {msg.issueTitle && (
                    <div
                      className={`text-xs mb-1.5 ${
                        msg.role === 'user' ? 'text-slate-900/70' : 'text-slate-400'
                      }`}
                    >
                      Context: {msg.issueTitle}
                    </div>
                  )}

                  {msg.role === 'user' ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  ) : (
                    renderFormattedReply(msg.content)
                  )}

                  {msg.toolsInvoked && msg.toolsInvoked.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-800/90 flex flex-wrap items-center gap-2 text-xs text-sky-400">
                      <Wrench className="w-3.5 h-3.5 shrink-0" />
                      <span>Tools used: {msg.toolsInvoked.join(' · ')}</span>
                    </div>
                  )}

                  {msg.newlyLearnedRules && msg.newlyLearnedRules.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800/90 space-y-1">
                      {msg.newlyLearnedRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Learned &amp; saved rule: &ldquo;{rule.title}&rdquo;
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-start gap-3.5">
                <ArixAvatar size="sm" className="mt-1" />
                <div className="bg-[#081124] border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-400">
                  Arix is executing your request...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-slate-800 bg-[#081124]"
      >
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="ask-arix-input" className="sr-only">
              Command Arix or teach a new rule
            </label>
            <textarea
              id="ask-arix-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask Arix to code, inspect GitHub/Cloudflare, fix an error, or teach a new rule..."
              className="w-full px-3.5 py-2.5 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer h-[44px]"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
      </form>
    </div>
  );
}

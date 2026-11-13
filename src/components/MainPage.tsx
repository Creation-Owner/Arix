import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Cpu,
  Globe,
  Link2,
  MonitorDown,
  Send,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { ArixCore3D } from './ArixCore3D';
import { SelfSectionFrame } from './SelfSectionFrame';
import type {
  ArixLiveStatus,
  ArixSatelliteKey,
  ChatMessage,
  CustomSection,
} from '../types/arix';

interface MainPageProps {
  connectedCount: number;
  activeRuleCount: number;
  auditCount: number;
  chatCount: number;
  ownerName: string;
  liveStatus: ArixLiveStatus;
  sendingCommand: boolean;
  latestArixReply: ChatMessage | null;
  customSections: CustomSection[];
  onSendCommand: (message: string) => Promise<void>;
  onDeleteSection: (id: string) => Promise<void>;
  onAskArixToModifySection: (section: CustomSection) => void;
  onOpenDesktopAppModal: () => void;
  onNavigate: (
    tab: 'connections' | 'computer' | 'analyze' | 'ask' | 'teach' | 'history'
  ) => void;
}

export function MainPage({
  connectedCount,
  activeRuleCount,
  auditCount,
  chatCount,
  ownerName,
  liveStatus,
  sendingCommand,
  latestArixReply,
  customSections,
  onSendCommand,
  onDeleteSection,
  onAskArixToModifySection,
  onOpenDesktopAppModal,
  onNavigate,
}: MainPageProps) {
  const [commandInput, setCommandInput] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || sendingCommand) return;
    const text = commandInput.trim();
    setCommandInput('');
    await onSendCommand(text);
  };

  const handleSatelliteSelect = (node: ArixSatelliteKey) => {
    if (node === 'code') {
      onNavigate('connections');
    } else if (node === 'compute') {
      onNavigate('computer');
    } else if (node === 'text') {
      onNavigate('teach');
    } else if (node === 'network') {
      onNavigate('connections');
    } else {
      onNavigate('ask');
    }
  };

  const quickCommands = [
    'Create a Quick Tasks & Timer section in yourself',
    'Add arix-notes.md to my GitHub',
    'Create folder "demo-project" with README.txt inside',
    'Send a live status update to my Telegram',
    'Inspect cloudflare.com DNS and headers',
  ];

  const capabilities = [
    {
      num: '01.',
      title: 'Connect Websites, GitHub, Cloudflare & Telegram',
      description:
        'Link GitHub repositories, Cloudflare domains, Telegram bots, live websites, and custom APIs so Arix inspects, writes commits, and sends alerts directly.',
      actionLabel: 'Connect Sites & Bots',
      target: 'connections' as const,
      icon: Link2,
    },
    {
      num: '02.',
      title: 'Computer Files & Folder Control',
      description:
        'Create files or folders, search contents, read code, and delete items inside your configured computer directory from Command Chat or the file browser.',
      actionLabel: 'Open Computer Files',
      target: 'computer' as const,
      icon: Cpu,
    },
    {
      num: '03.',
      title: 'Teach From Zero to Everything',
      description:
        'Start from a clean slate or build structured rules across coding, UX analysis, GitHub, Cloudflare, and custom owner directives.',
      actionLabel: 'Teach Arix',
      target: 'teach' as const,
      icon: BookOpen,
    },
    {
      num: '04.',
      title: 'Coding, Debugging & UX Analysis',
      description:
        'Audit any website for errors and UX impact (P0–P3), generate complete Before/After fixes, or command Arix in natural language.',
      actionLabel: 'Analyze Website',
      target: 'analyze' as const,
      icon: Globe,
    },
  ];

  const recentEvents = liveStatus.events.slice(-4).reverse();
  const mainPageSections = customSections.filter(
    (s) => s.placement === 'main_page' || s.placement === 'both'
  );

  return (
    <div className="space-y-8">
      {/* Live 3D Arix Core Hero + Direct Command Bar */}
      <section className="bg-[#081226] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl">
        {/* Top Heading Strip */}
        <div className="px-6 py-4 border-b border-slate-800/90 bg-[#071022] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300 font-medium">
              <span>Arix Autonomous Core</span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-300">
                Owner: {ownerName || 'Owner'}
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-400">Local Desktop Edition</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
              Command Arix &amp; Watch Live 3D Execution
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('connections')}
              className="px-3.5 py-2 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-800/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Connect GitHub / Site / Bot
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ask')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Full Command Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Always-Moving 3D Neural Sphere & Satellite Task Nodes */}
        <ArixCore3D
          liveStatus={liveStatus}
          connectedCount={connectedCount}
          activeRuleCount={activeRuleCount}
          onSelectSatellite={handleSatelliteSelect}
        />

        {/* Docked Main Page Command Composer */}
        <div className="p-5 sm:p-6 border-t border-slate-800/90 bg-[#071022] space-y-4">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <label htmlFor="main-arix-command" className="sr-only">
              Command Arix directly
            </label>
            <input
              id="main-arix-command"
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder='Command Arix (e.g. "Add status.md to my GitHub", "Create folder notes", "Send update to Telegram")...'
              className="flex-1 px-4 py-3 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/35 focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={sendingCommand || !commandInput.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-sky-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sendingCommand ? 'Executing...' : 'Run with Arix'}</span>
            </button>
          </form>

          {/* Quick Command Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">Try live:</span>
            {quickCommands.map((cmd) => (
              <button
                key={cmd}
                type="button"
                disabled={sendingCommand}
                onClick={() => onSendCommand(cmd)}
                className="px-3 py-1.5 text-xs text-slate-200 bg-[#0B152B] hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Live Step Trail + Latest Reply */}
          {(recentEvents.length > 0 || latestArixReply) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
              {recentEvents.length > 0 && (
                <div className="lg:col-span-5 bg-[#060E1F] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-semibold text-sky-300">
                    Live 3D Activity Log
                  </div>
                  <div className="space-y-1.5">
                    {recentEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-start justify-between gap-2 text-xs border-b border-slate-800/70 pb-1.5 last:border-b-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <div
                            className={`font-medium truncate ${
                              ev.phase === 'error'
                                ? 'text-red-300'
                                : ev.phase === 'done' || ev.phase === 'tool_done'
                                  ? 'text-emerald-300'
                                  : 'text-cyan-200'
                            }`}
                          >
                            {ev.title}
                          </div>
                          <div className="text-slate-400 truncate font-mono text-[11px]">
                            {ev.detail}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0 tabular-nums">
                          {new Date(ev.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {latestArixReply && (
                <div
                  className={`${
                    recentEvents.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                  } bg-[#060E1F] border border-slate-800 rounded-xl p-4 space-y-2`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">
                      Latest Arix Response
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('ask')}
                      className="text-xs text-sky-400 hover:underline cursor-pointer"
                    >
                      Continue in Chat
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {latestArixReply.content}
                  </p>
                  {latestArixReply.toolsInvoked &&
                    latestArixReply.toolsInvoked.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-sky-400 font-mono">
                        <Wrench className="w-3 h-3 shrink-0" />
                        <span>
                          {latestArixReply.toolsInvoked.join(' · ')}
                        </span>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Live Workspace Metrics Strip */}
      <section
        aria-label="Workspace overview metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: 'Connected Websites & APIs',
            value: connectedCount,
            action: () => onNavigate('connections'),
            hint: 'GitHub, Cloudflare & URLs',
          },
          {
            label: 'Taught Rules & Skills',
            value: activeRuleCount,
            action: () => onNavigate('teach'),
            hint: 'Active owner instructions',
          },
          {
            label: 'Completed Site Audits',
            value: auditCount,
            action: () => onNavigate('analyze'),
            hint: 'UX impact prioritized',
          },
          {
            label: 'Command Chat Messages',
            value: chatCount,
            action: () => onNavigate('ask'),
            hint: 'Coding & live tool runs',
          },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="text-left bg-[#0B152B] border border-slate-800/90 hover:border-sky-500/50 rounded-xl p-5 transition-colors cursor-pointer"
          >
            <div className="text-xs text-slate-400">{item.label}</div>
            <div className="mt-2 text-2xl font-display font-bold text-white font-mono tabular-nums">
              {item.value}
            </div>
            <div className="mt-1 text-xs text-sky-400">{item.hint}</div>
          </button>
        ))}
      </section>

      {/* Core Capabilities */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.num}
              className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-sky-400 font-medium">
                    {cap.num}
                  </span>
                  <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <h3 className="text-base font-display font-semibold text-white">
                  {cap.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {cap.description}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => onNavigate(cap.target)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                >
                  <span>{cap.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Self-Built Sections Pinned to Main Page */}
      {mainPageSections.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-display font-semibold text-white">
                Self-Built Arix Sections
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {mainPageSections.length}{' '}
              {mainPageSections.length === 1 ? 'section' : 'sections'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5">
            {mainPageSections.map((section) => (
              <SelfSectionFrame
                key={section.id}
                section={section}
                compact
                onAskArixToModify={onAskArixToModifySection}
                onDeleteSection={onDeleteSection}
              />
            ))}
          </div>
        </section>
      )}

      {/* Standalone Desktop App & Brain Portability Notice */}
      <section className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <Code2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-display font-semibold text-white">
              Standalone App Mode &amp; VS Code GitHub Installer Ready
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
              Run Arix as its own dedicated Desktop App (no localhost browser
              address bar), pull updates straight from your GitHub repo in VS
              Code, or export Arix&apos;s complete brain and self-built sections
              to move between devices.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenDesktopAppModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MonitorDown className="w-3.5 h-3.5" />
            <span>Desktop App &amp; VS Code Setup</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('teach')}
            className="px-4 py-2 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Manage Brain &amp; Export
          </button>
        </div>
      </section>
    </div>
  );
}

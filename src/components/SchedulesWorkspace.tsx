import { useState, type FormEvent } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Globe,
  Loader2,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  ConnectedSite,
  ScheduledTask,
  ScheduledTaskAction,
} from '../types/arix';

interface SchedulesWorkspaceProps {
  tasks: ScheduledTask[];
  connections: ConnectedSite[];
  onCreateTask: (payload: {
    title: string;
    actionType: ScheduledTaskAction;
    intervalMinutes: number;
    promptOrMessage: string;
    targetUrl?: string;
    telegramConnectionId?: string;
  }) => Promise<void>;
  onToggleTask: (id: string, active: boolean) => Promise<void>;
  onRunTaskNow: (id: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

const INTERVAL_PRESETS = [
  { label: 'Every 5m', minutes: 5 },
  { label: 'Every 15m', minutes: 15 },
  { label: 'Hourly', minutes: 60 },
  { label: 'Every 6h', minutes: 360 },
  { label: 'Daily', minutes: 1440 },
];

function formatInterval(minutes: number): string {
  if (minutes < 60) return `Every ${minutes} min`;
  if (minutes === 60) return 'Every 1 hour';
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? 'Daily (24h)' : `Every ${days} days`;
  }
  if (minutes % 60 === 0) return `Every ${minutes / 60} hours`;
  return `Every ${minutes} min`;
}

export function SchedulesWorkspace({
  tasks,
  connections,
  onCreateTask,
  onToggleTask,
  onRunTaskNow,
  onDeleteTask,
}: SchedulesWorkspaceProps) {
  const [title, setTitle] = useState('');
  const [actionType, setActionType] =
    useState<ScheduledTaskAction>('site_check');
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [targetUrl, setTargetUrl] = useState('');
  const [promptOrMessage, setPromptOrMessage] = useState('');
  const [telegramConnectionId, setTelegramConnectionId] = useState('');
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const telegramBots = connections.filter((c) => c.type === 'telegram');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Enter a clear task title.');
      return;
    }
    if (actionType === 'site_check' && !targetUrl.trim()) {
      setError('Enter the website URL to monitor.');
      return;
    }
    if (actionType !== 'site_check' && !promptOrMessage.trim()) {
      setError(
        actionType === 'telegram_message'
          ? 'Enter the message to send to Telegram.'
          : 'Enter the recurring instruction for Arix to run.'
      );
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await onCreateTask({
        title: title.trim(),
        actionType,
        intervalMinutes,
        promptOrMessage:
          promptOrMessage.trim() ||
          (actionType === 'site_check' ? targetUrl.trim() : ''),
        targetUrl: targetUrl.trim() || undefined,
        telegramConnectionId: telegramConnectionId || undefined,
      });
      setTitle('');
      setTargetUrl('');
      setPromptOrMessage('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create scheduled task.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    setError(null);
    try {
      await onRunTaskNow(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run task.');
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-white">
              Scheduled &amp; Recurring Automation
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Run background website health checks, recurring AI prompts, or
              scheduled Telegram alerts automatically while Arix is running. You
              can also create schedules by asking Arix in Command Chat.
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-300 bg-[#060E1F] border border-slate-800 rounded-lg px-3.5 py-2 tabular-nums">
          {tasks.filter((t) => t.active).length} active · {tasks.length} total
        </div>
      </div>

      {/* Create Schedule Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-5"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus className="w-4 h-4 text-sky-400" />
          <span>New Recurring Task</span>
        </div>

        {error && (
          <div className="px-3.5 py-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="sched-title"
              className="block text-xs font-medium text-slate-300"
            >
              Task Title
            </label>
            <input
              id="sched-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monitor main website uptime"
              className="w-full px-3.5 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sched-action"
              className="block text-xs font-medium text-slate-300"
            >
              Action Type
            </label>
            <select
              id="sched-action"
              value={actionType}
              onChange={(e) =>
                setActionType(e.target.value as ScheduledTaskAction)
              }
              className="w-full px-3.5 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
            >
              <option value="site_check">Website Health &amp; Uptime Check</option>
              <option value="command">Recurring AI Prompt / Summary</option>
              <option value="telegram_message">Scheduled Telegram Alert</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="sched-interval"
            className="block text-xs font-medium text-slate-300"
          >
            Run Interval (minutes)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {INTERVAL_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                onClick={() => setIntervalMinutes(preset.minutes)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  intervalMinutes === preset.minutes
                    ? 'bg-sky-500 text-slate-950 border-sky-400 font-semibold'
                    : 'bg-[#060E1F] text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <input
              id="sched-interval"
              type="number"
              min={1}
              max={10080}
              value={intervalMinutes}
              onChange={(e) =>
                setIntervalMinutes(
                  Math.max(1, Math.min(10080, Number(e.target.value) || 1))
                )
              }
              className="w-24 px-3 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-white rounded-lg font-mono"
            />
            <span className="text-xs text-slate-400">min</span>
          </div>
        </div>

        {actionType === 'site_check' && (
          <div className="space-y-1.5">
            <label
              htmlFor="sched-url"
              className="block text-xs font-medium text-slate-300"
            >
              Website URL to Check
            </label>
            <input
              id="sched-url"
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3.5 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="sched-prompt"
            className="block text-xs font-medium text-slate-300"
          >
            {actionType === 'site_check'
              ? 'Notes (optional)'
              : actionType === 'telegram_message'
                ? 'Telegram Message Text'
                : 'AI Command / Prompt'}
          </label>
          <textarea
            id="sched-prompt"
            rows={2}
            value={promptOrMessage}
            onChange={(e) => setPromptOrMessage(e.target.value)}
            placeholder={
              actionType === 'site_check'
                ? 'Optional check note...'
                : actionType === 'telegram_message'
                  ? 'Daily reminder: Check server backups and metrics.'
                  : 'Summarize top priorities and daily focus areas for my stack.'
            }
            className="w-full px-3.5 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500 resize-none"
          />
        </div>

        {telegramBots.length > 0 && (
          <div className="space-y-1.5">
            <label
              htmlFor="sched-tg"
              className="block text-xs font-medium text-slate-300"
            >
              {actionType === 'telegram_message'
                ? 'Target Telegram Bot'
                : 'Also forward result to Telegram (optional)'}
            </label>
            <select
              id="sched-tg"
              value={telegramConnectionId}
              onChange={(e) => setTelegramConnectionId(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:border-sky-500"
            >
              <option value="">
                {actionType === 'telegram_message'
                  ? 'Default active Telegram bot'
                  : 'Do not send to Telegram'}
              </option>
              {telegramBots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name} ({bot.identifier || 'Telegram'})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Create Schedule</span>
          </button>
        </div>
      </form>

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-8 text-center space-y-2">
            <CalendarClock className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-medium text-white">
              No scheduled tasks yet
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Add a recurring check above, or tell Arix in Command Chat:
              &ldquo;Check my site every 15 minutes and send Telegram alerts if
              it goes down.&rdquo;
            </p>
          </div>
        ) : (
          tasks.map((task) => {
            const Icon =
              task.actionType === 'site_check'
                ? Globe
                : task.actionType === 'telegram_message'
                  ? Send
                  : Sparkles;
            return (
              <div
                key={task.id}
                className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-[#060E1F] border border-slate-800 text-sky-400 shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">
                          {task.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            task.active
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {task.active ? 'Active' : 'Paused'}
                        </span>
                        <span className="text-xs font-mono text-sky-300">
                          {formatInterval(task.intervalMinutes)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 break-words">
                        {task.actionType === 'site_check'
                          ? task.targetUrl || task.promptOrMessage
                          : task.promptOrMessage}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                        <span>Runs: {task.runCount}</span>
                        {task.lastRunAt && (
                          <span>
                            Last:{' '}
                            {new Date(task.lastRunAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                        {task.active && (
                          <span>
                            Next:{' '}
                            {new Date(task.nextRunAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleRunNow(task.id)}
                      disabled={runningId === task.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#060E1F] border border-slate-700 text-slate-200 hover:border-sky-500/60 hover:text-sky-300 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {runningId === task.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-sky-400" />
                      )}
                      <span>Run Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onToggleTask(task.id, !task.active)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#060E1F] border border-slate-700 text-slate-200 hover:border-slate-500 rounded-lg cursor-pointer"
                    >
                      {task.active ? (
                        <>
                          <Pause className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Resume</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteTask(task.id)}
                      aria-label={`Delete ${task.title}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 bg-[#060E1F] border border-slate-700 hover:border-red-500/40 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {task.lastResult && (
                  <div
                    className={`px-3 py-2 rounded-lg border text-xs flex items-start gap-2 ${
                      task.lastStatus === 'error'
                        ? 'bg-red-950/30 border-red-500/30 text-red-200'
                        : 'bg-[#060E1F] border-slate-800 text-slate-300'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                        task.lastStatus === 'error'
                          ? 'text-red-400'
                          : 'text-emerald-400'
                      }`}
                    />
                    <span className="whitespace-pre-wrap break-words">
                      {task.lastResult}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

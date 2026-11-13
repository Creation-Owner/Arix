import { ArrowUpRight, Code2, Globe, Image as ImageIcon, Trash2 } from 'lucide-react';
import type { WebsiteAudit } from '../types/arix';

interface HistoryWorkspaceProps {
  audits: WebsiteAudit[];
  onOpenAudit: (auditId: string) => void;
  onDeleteAudit: (auditId: string) => void;
  onStartNew: () => void;
}

export function HistoryWorkspace({
  audits,
  onOpenAudit,
  onDeleteAudit,
  onStartNew,
}: HistoryWorkspaceProps) {
  if (audits.length === 0) {
    return (
      <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-12 text-center">
        <h2 className="text-lg font-display font-semibold text-white">
          No saved website audits yet
        </h2>
        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
          Once Arix inspects a URL, GitHub repo, code snippet, or screenshot,
          every report and UX priority breakdown is stored here.
        </p>
        <button
          type="button"
          onClick={onStartNew}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Run First Audit
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-display font-semibold text-white">
            Saved Audits &amp; Reports
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {audits.length} {audits.length === 1 ? 'report' : 'reports'} saved in
            Arix&apos;s workspace
          </p>
        </div>
        <button
          type="button"
          onClick={onStartNew}
          className="px-3.5 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          New Audit
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-[#081124] text-xs font-medium text-slate-400">
              <th className="py-3 px-6">Target</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4 text-right">Issues</th>
              <th className="py-3 px-4 text-right">Open P0/P1</th>
              <th className="py-3 px-4 text-right">Resolved</th>
              <th className="py-3 px-4">Analyzed</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-sm">
            {audits.map((audit) => {
              const highCount = audit.issues.filter(
                (i) =>
                  i.status === 'open' &&
                  (i.priority === 'P0 Critical' || i.priority === 'P1 High')
              ).length;
              const resolvedCount = audit.issues.filter(
                (i) => i.status === 'resolved'
              ).length;
              const MethodIcon =
                audit.inputType === 'code'
                  ? Code2
                  : audit.inputType === 'screenshot'
                    ? ImageIcon
                    : Globe;

              return (
                <tr
                  key={audit.id}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3.5 px-6 max-w-xs">
                    <button
                      type="button"
                      onClick={() => onOpenAudit(audit.id)}
                      className="font-medium text-white hover:text-sky-400 text-left truncate block w-full cursor-pointer"
                    >
                      {audit.targetLabel}
                    </button>
                    {audit.url && (
                      <div className="text-xs text-slate-400 font-mono truncate mt-0.5">
                        {audit.url}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-300 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <MethodIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span className="capitalize">{audit.inputType}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-200">
                    {audit.issues.length}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    <span
                      className={
                        highCount > 0 ? 'text-red-400 font-semibold' : 'text-slate-400'
                      }
                    >
                      {highCount}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-400">
                    {resolvedCount}/{audit.issues.length}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                    {new Date(audit.analyzedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3.5 px-6 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenAudit(audit.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-200 border border-slate-700 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAudit(audit.id)}
                        aria-label={`Delete audit ${audit.targetLabel}`}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-md hover:bg-red-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

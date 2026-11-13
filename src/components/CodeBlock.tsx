import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  label: string;
  code: string;
  tone?: 'neutral' | 'before' | 'after';
}

export function CodeBlock({ label, code, tone = 'neutral' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const borderClass =
    tone === 'before'
      ? 'border-red-500/30 bg-red-950/20'
      : tone === 'after'
        ? 'border-emerald-500/30 bg-emerald-950/20'
        : 'border-slate-800 bg-[#071022]';

  const labelColor =
    tone === 'before'
      ? 'text-red-300'
      : tone === 'after'
        ? 'text-emerald-300'
        : 'text-slate-300';

  return (
    <div className={`rounded-lg border overflow-hidden ${borderClass}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-[#0B1730]">
        <span className={`text-xs font-medium ${labelColor}`}>{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">
        <code>{code || 'No snippet provided.'}</code>
      </pre>
    </div>
  );
}

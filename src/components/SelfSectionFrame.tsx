import { useMemo, useState } from 'react';
import { Code2, MessageSquare, Sparkles, Trash2 } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import type { CustomSection } from '../types/arix';

interface SelfSectionFrameProps {
  section: CustomSection;
  compact?: boolean;
  onAskArixToModify: (section: CustomSection) => void;
  onDeleteSection: (sectionId: string) => Promise<void>;
}

export function SelfSectionFrame({
  section,
  compact = false,
  onAskArixToModify,
  onDeleteSection,
}: SelfSectionFrameProps) {
  const [showCode, setShowCode] = useState(false);

  const srcDoc = useMemo(() => {
    const raw = section.htmlCode || '';
    const hasHtmlWrapper = /<html[\s>]/i.test(raw);
    const themeStyle = `<style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 18px;
        background: #060E1F;
        color: #f1f5f9;
        font-family: "DM Sans", system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }
      button, input, select, textarea {
        font-family: inherit;
      }
      button {
        background: #0ea5e9;
        color: #020617;
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-weight: 600;
        cursor: pointer;
      }
      button:hover { background: #38bdf8; }
      input, select, textarea {
        background: #0B152B;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 8px 10px;
      }
      .card {
        background: #0B152B;
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 16px;
      }
    </style>`;

    const baseOrigin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const baseTag = baseOrigin ? `<base href="${baseOrigin}/" />` : '';

    if (hasHtmlWrapper) {
      return raw.replace(/<\/head>/i, `${baseTag}${themeStyle}</head>`);
    }
    return `<!doctype html><html><head><meta charset="utf-8" />${baseTag}${themeStyle}</head><body>${raw}</body></html>`;
  }, [section.htmlCode]);

  return (
    <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800 bg-[#081124] flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-sky-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Self-Built by Arix</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-400 font-mono">
              Updated {new Date(section.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-base font-display font-semibold text-white truncate mt-0.5">
            {section.title}
          </h3>
          {section.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {section.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-200 border border-slate-700 rounded-md hover:bg-slate-800 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-sky-400" />
            <span>{showCode ? 'Hide Code' : 'View Code'}</span>
          </button>
          <button
            type="button"
            onClick={() => onAskArixToModify(section)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-md cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>Modify</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteSection(section.id)}
            aria-label={`Delete section ${section.title}`}
            className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-red-950/30 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showCode ? (
        <div className="p-5">
          <CodeBlock
            label={`${section.title} — Source HTML/CSS/JS`}
            code={section.htmlCode}
          />
        </div>
      ) : (
        <iframe
          title={section.title}
          srcDoc={srcDoc}
          allowFullScreen
          sandbox="allow-scripts allow-forms allow-downloads allow-popups"
          className={`w-full border-0 bg-[#060E1F] ${
            compact ? 'h-[420px]' : 'h-[640px]'
          }`}
        />
      )}
    </div>
  );
}

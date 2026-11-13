import { Check, Copy, Download, Monitor, Terminal, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DesktopAppModalProps {
  open: boolean;
  onClose: () => void;
}

export function DesktopAppModal({ open, onClose }: DesktopAppModalProps) {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!open) return null;

  const vsCodeCloneAndInstall = `# 1. In VS Code Terminal (Windows PowerShell), clone your GitHub repo:
git clone https://github.com/YOUR_USERNAME/YOUR_ARIX_REPO.git
cd YOUR_ARIX_REPO

# 2. Install base dependencies & create your .env file:
npm install --legacy-peer-deps
copy .env.example .env
# Open .env in VS Code and set:
#   GEMINI_API_KEY="your-key-here"
#   ARIX_COMPUTER_ROOT="C:/Users/YourName/Desktop"

# 3. Install & launch Arix as a Windows Desktop App (also creates Launch-Arix.bat):
node scripts/install-desktop-app.mjs

# 4. (Optional) Build a Windows .exe Installer & Portable App in release/:
npm run app:pack`;

  const copySnippet = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-2xl bg-[#0B152B] border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-[#081124] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-display font-semibold text-white">
                Install Arix as a Standalone Desktop App
              </h2>
              <p className="text-xs text-slate-400">
                Run Arix in its own app window without opening localhost in a
                browser
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Desktop App modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Option 1: Direct Standalone App Install */}
          <div className="bg-[#060E1F] border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-display font-semibold text-white">
                Option 1 · Instant Standalone Window (PWA App)
              </h3>
              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  onClick={install}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Now</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isInstalled
                ? 'Arix is already running in standalone App mode.'
                : 'In Chrome or Edge, click the Install App icon in the address bar (or three-dot menu → Cast, save, and share → Install page as app) to launch Arix as a standalone desktop window with zero browser chrome.'}
            </p>
          </div>

          {/* Option 2: VS Code + GitHub -> Native Desktop App (Electron) */}
          <div className="bg-[#060E1F] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-display font-semibold text-white">
                  Option 2 · VS Code + GitHub Native Desktop App (.exe / .dmg / Linux)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => copySnippet('vscode', vsCodeCloneAndInstall)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-slate-700 text-slate-200 hover:bg-slate-800 rounded-md cursor-pointer"
              >
                {copiedKey === 'vscode' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy VS Code Script</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This repository includes <code className="text-sky-300">electron/main.cjs</code>{' '}
              and <code className="text-sky-300">scripts/install-desktop-app.mjs</code>.
              After you upload Arix to your GitHub repo and open VS Code on your
              computer, run these commands in the VS Code Terminal:
            </p>

            <pre className="p-3.5 rounded-lg bg-[#040916] border border-slate-800 text-xs font-mono text-sky-100 overflow-x-auto leading-relaxed">
              {vsCodeCloneAndInstall}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
